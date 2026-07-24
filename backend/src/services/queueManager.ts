import {
  enqueueItem,
  updateQueueItem,
  getRecoverableItems,
  getNextPosition,
  getQueueItem,
} from '../db/queries/queue.js'
import {
  getNegotiationByPhone,
  updateNegotiation,
} from '../db/queries/negotiations.js'
import { appendMessage } from '../db/queries/messages.js'
import { sseManager } from './sseManager.js'
import { runNegotiationTurn, commitAgreedPrice, applyCounter } from './negotiationAgent.js'
import type { NegotiationTurnResult } from '../types.js'

const REPLY_TIMEOUT_MS = 3 * 60 * 1_000 // 3 minutes

interface ActiveEntry {
  negotiationId: string
  position: number
  timeoutHandle: NodeJS.Timeout | null
}

class QueueManager {
  private entries = new Map<string, ActiveEntry>() // negotiationId → entry
  private processing = false

  // ── Public API ────────────────────────────────────────────────────────────

  async enqueue(negotiationId: string): Promise<void> {
    const position = await getNextPosition()
    await enqueueItem(negotiationId, position)
    this.entries.set(negotiationId, { negotiationId, position, timeoutHandle: null })
    this.processNext()
  }

  // Called by the Baileys message handler when a supplier replies. companyId is
  // the tenant whose WhatsApp session received the message, so the reply routes
  // to the right negotiation even if two companies talk to the same supplier.
  async onIncomingReply(companyId: string, phone: string, text: string, timestamp: string): Promise<void> {
    const negotiation = await getNegotiationByPhone(phone, companyId)
    if (!negotiation) return
    if (negotiation.status === 'done' || negotiation.status === 'failed') return

    const entry = this.entries.get(negotiation.id)
    if (!entry) return

    // Record the message in DB and push to SSE clients
    const message = await appendMessage(negotiation.id, {
      role: 'supplier',
      text,
      timestamp,
    })
    await updateNegotiation(negotiation.id, { status: 'negotiating' })
    sseManager.emit(negotiation.id, 'message', message)
    sseManager.emit(negotiation.id, 'status', { status: 'negotiating' })

    // Clear the 3-minute timeout — supplier has replied
    if (entry.timeoutHandle) {
      clearTimeout(entry.timeoutHandle)
      entry.timeoutHandle = null
    }

    await updateQueueItem(negotiation.id, {
      status: 'active',
      lastMessageAt: timestamp,
      timeoutAt: null,
    })

    sseManager.emit(negotiation.id, 'activity', { text: `Reply received — crafting response...` })

    const result = await runNegotiationTurn(negotiation.id)
    await this.handleTurnResult(negotiation.id, result)
  }

  async onNegotiationDone(negotiationId: string): Promise<void> {
    const entry = this.entries.get(negotiationId)
    if (!entry) return
    if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle)
    this.entries.delete(negotiationId)
    await updateQueueItem(negotiationId, { status: 'done' })
    this.processNext()
  }

  // Negotiation hit an approval gate — park it and free the queue for the next
  // supplier. It resumes only when the buyer decides (approve/reject/counter).
  async onNegotiationPaused(negotiationId: string): Promise<void> {
    const entry = this.entries.get(negotiationId)
    if (entry?.timeoutHandle) clearTimeout(entry.timeoutHandle)
    this.entries.delete(negotiationId)
    await updateQueueItem(negotiationId, { status: 'done' })
    this.processNext()
  }

  // ── Buyer decisions on an open gate ─────────────────────────────────────────

  async approveAndCommit(negotiationId: string): Promise<void> {
    await commitAgreedPrice(negotiationId)
  }

  async rejectOffer(negotiationId: string, note?: string): Promise<void> {
    const summary = note ? `Buyer declined: ${note}` : 'Buyer declined the offer.'
    await updateNegotiation(negotiationId, { status: 'failed', summary })
    sseManager.emit(negotiationId, 'status', { status: 'failed', summary })
  }

  async counterOffer(negotiationId: string, directive: string): Promise<void> {
    const item = await getQueueItem(negotiationId)
    const position = item?.position ?? await getNextPosition()
    this.entries.set(negotiationId, { negotiationId, position, timeoutHandle: null })
    await updateQueueItem(negotiationId, { status: 'active' })
    await applyCounter(negotiationId, directive)
    await this.waitForReply(negotiationId)
  }

  // Rebuild in-memory state from DB on server startup
  async recover(): Promise<void> {
    const items = await getRecoverableItems()
    for (const item of items) {
      this.entries.set(item.negotiationId, {
        negotiationId: item.negotiationId,
        position: item.position,
        timeoutHandle: null,
      })
    }
    if (this.entries.size > 0) {
      console.log(`[queue] recovered ${this.entries.size} negotiation(s) from DB`)
      this.processNext()
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private processNext(): void {
    if (this.processing) return

    const pending = [...this.entries.values()]
      .filter(e => e.timeoutHandle === null)
      .sort((a, b) => a.position - b.position)

    if (pending.length === 0) return

    const next = pending[0]
    this.runEntry(next.negotiationId)
  }

  private async runEntry(negotiationId: string): Promise<void> {
    if (this.processing) return
    this.processing = true
    let errored = false

    try {
      await updateQueueItem(negotiationId, { status: 'active' })
      sseManager.emit(negotiationId, 'activity', { text: 'Starting negotiation...' })

      const result = await runNegotiationTurn(negotiationId)
      await this.handleTurnResult(negotiationId, result)
    } catch (err) {
      console.error(`[queue] turn error for ${negotiationId}:`, err)
      await updateNegotiation(negotiationId, { status: 'failed' })
      sseManager.emit(negotiationId, 'status', { status: 'failed' })
      this.entries.delete(negotiationId)
      errored = true
    } finally {
      this.processing = false
      // Only drive the queue forward here on error — the happy path calls
      // processNext via handleTurnResult/onNegotiationDone
      if (errored) this.processNext()
    }
  }

  private async handleTurnResult(
    negotiationId: string,
    result: NegotiationTurnResult,
  ): Promise<void> {
    if (result.done) {
      await this.onNegotiationDone(negotiationId)
      return
    }
    if (result.paused) {
      await this.onNegotiationPaused(negotiationId)
      return
    }
    await this.waitForReply(negotiationId)
  }

  // Arm the 3-minute wait for a supplier reply. On timeout the entry stays in the
  // map (so we resume when they eventually reply) and the queue moves on.
  private async waitForReply(negotiationId: string): Promise<void> {
    const entry = this.entries.get(negotiationId)
    if (!entry) return

    const timeoutAt = new Date(Date.now() + REPLY_TIMEOUT_MS).toISOString()
    await updateQueueItem(negotiationId, { status: 'waiting_reply', timeoutAt })
    sseManager.emit(negotiationId, 'activity', { text: 'Waiting for supplier reply...' })

    entry.timeoutHandle = setTimeout(async () => {
      entry.timeoutHandle = null
      await updateQueueItem(negotiationId, { status: 'timed_out', timeoutAt: null })
      sseManager.emit(negotiationId, 'activity', {
        text: 'No reply — moved to next supplier. Will resume when they respond.',
      })
      this.processNext()
    }, REPLY_TIMEOUT_MS)
  }
}

export const queueManager = new QueueManager()
