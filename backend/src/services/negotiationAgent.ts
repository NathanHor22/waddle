import Anthropic from '@anthropic-ai/sdk'
import { negotiationStore } from '../store/negotiations.js'
import { sendWhatsAppMessage } from './whatsapp.js'
import type { ConversationMessage } from '../types.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MAX_ROUNDS = 3

const SYSTEM_PROMPT = `You are a procurement assistant for Waddle, a platform that helps small and medium businesses find the best deals from suppliers.

You are negotiating on behalf of a buyer via WhatsApp. Your goal is to get the best possible price, MOQ, and lead time for the product they need.

Tone: professional, warm, and confident — like a real person texting on WhatsApp. Keep messages concise and natural. No markdown, no bullet points, no numbered lists. Sound human.

Your objectives each turn:
- Push politely for a better price or more favourable terms
- Clarify anything missing (MOQ, lead time, payment terms) if not yet provided
- Build rapport without being pushy or aggressive

When you have gathered a satisfactory quotation (price, MOQ, lead time all known) OR after ${MAX_ROUNDS} rounds of negotiation, respond ONLY with this exact JSON (no other text):
{"action":"done","summary":"<concise summary of agreed terms: price, MOQ, lead time, payment terms, and any special conditions>"}

Otherwise respond with just the WhatsApp message text to send — no JSON, no extra formatting.`

function humanLikeDelayMs(supplierText: string): number {
  const minSec = parseInt(process.env.NEG_MIN_DELAY_SEC ?? '45', 10)
  const maxSec = parseInt(process.env.NEG_MAX_DELAY_SEC ?? '120', 10)
  const baseSec = minSec + Math.random() * (maxSec - minSec)
  const wordCount = supplierText.trim().split(/\s+/).length
  const readSec = wordCount * 0.8
  return Math.round(Math.min(baseSec + readSec, 180) * 1000)
}

function buildAnthropicMessages(messages: ConversationMessage[]): Anthropic.MessageParam[] {
  return messages.map(msg => ({
    role: msg.role === 'agent' ? ('assistant' as const) : ('user' as const),
    content: msg.text,
  }))
}

function countAgentRounds(messages: ConversationMessage[]): number {
  // First agent message is the opening; only count replies after that
  return messages.filter((m, i) => m.role === 'agent' && i > 0).length
}

export async function runNegotiationTurn(negotiationId: string): Promise<void> {
  const negotiation = negotiationStore.get(negotiationId)
  if (!negotiation) return
  if (negotiation.status === 'done' || negotiation.status === 'failed') return

  const supplierMessages = negotiation.messages.filter(m => m.role === 'supplier')
  if (supplierMessages.length === 0) return

  const lastSupplierMsg = supplierMessages[supplierMessages.length - 1]

  // Enforce max rounds before calling Claude
  const agentRounds = countAgentRounds(negotiation.messages)
  if (agentRounds >= MAX_ROUNDS) {
    negotiationStore.update(negotiationId, {
      status: 'done',
      summary: 'Maximum negotiation rounds reached. Please review the conversation above and contact the supplier directly for final confirmation.',
    })
    return
  }

  // Simulate human read + think + type delay
  await new Promise(resolve => setTimeout(resolve, humanLikeDelayMs(lastSupplierMsg.text)))

  // Re-fetch after delay in case a concurrent update changed status
  const fresh = negotiationStore.get(negotiationId)
  if (!fresh || fresh.status === 'done' || fresh.status === 'failed') return

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: buildAnthropicMessages(fresh.messages),
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return

    const text = textBlock.text.trim()

    // Check if Claude signalled completion
    try {
      const parsed = JSON.parse(text)
      if (parsed.action === 'done' && typeof parsed.summary === 'string') {
        negotiationStore.update(negotiationId, {
          status: 'done',
          summary: parsed.summary,
        })
        return
      }
    } catch {
      // Not JSON — treat as a message to send
    }

    // Send Claude's reply via WhatsApp
    await sendWhatsAppMessage(fresh.phone, text)

    negotiationStore.appendMessage(negotiationId, {
      role: 'agent',
      text,
      timestamp: new Date().toISOString(),
    })

    negotiationStore.update(negotiationId, { status: 'negotiating' })
  } catch (err) {
    console.error('[negotiationAgent] error:', err)
    negotiationStore.update(negotiationId, { status: 'failed' })
  }
}
