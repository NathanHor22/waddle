import { complete, LLM_MODELS, type LlmMessage } from './llm.js'
import { getNegotiation, updateNegotiation } from '../db/queries/negotiations.js'
import { appendMessage, getRecentMessages } from '../db/queries/messages.js'
import { recordQuote, getQuoteByNegotiation } from '../db/queries/quotes.js'
import { createGate } from '../db/queries/approvalGates.js'
import type { Negotiation } from '../types.js'
import { whatsappManager } from './whatsappBaileys.js'
import { sseManager } from './sseManager.js'
import { calculateReadDelay, calculateTypingDelay } from '../utils/delayCalculator.js'
import type { ConversationMessage, DetectionResult, NegotiationTurnResult } from '../types.js'

const CONTEXT_WINDOW_SIZE = 6
const MAX_AGENT_ROUNDS    = 5

// In-memory rate limiter: max 10 messages per phone per minute
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60_000

function isRateLimited(phone: string): boolean {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(phone) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  timestamps.push(now)
  rateLimitMap.set(phone, timestamps)
  return timestamps.length > RATE_LIMIT_MAX
}

// Shared negotiation persona, sent as the system message each turn.
const SYSTEM_PROMPT = `You are a procurement negotiation assistant for Waddle. You negotiate with suppliers via WhatsApp on behalf of a buyer.

Your goal: get the best price, MOQ (minimum order quantity), and lead time for the requested product.

Tone: professional, warm, and confident — like an experienced buyer texting on WhatsApp. Be concise and natural. No markdown, no bullet points, no numbered lists. Sound human.

Each turn you should:
- Push politely for a better price or more favourable terms
- Fill in any missing details (MOQ, lead time, payment terms) if not yet known
- Build rapport — be friendly but focused on getting a good deal
- Show professionalism without being rude or aggressive

When negotiation is complete (you have price, MOQ, and lead time) OR after ${MAX_AGENT_ROUNDS} rounds, respond ONLY with this exact JSON and nothing else:
{"action":"done","summary":"<concise summary of agreed terms: price, MOQ, lead time, payment terms, any special conditions>"}

Otherwise respond with only the WhatsApp message text to send — no JSON, no extra formatting.`

// ── Token-efficient detection (Haiku — ~25x cheaper than Sonnet) ──────────
// Classifies incoming supplier message before deciding how to respond
async function detectSupplierIntent(supplierText: string): Promise<DetectionResult> {
  const raw = await complete({
    model: LLM_MODELS.fast,
    maxTokens: 150,
    json: true,
    messages: [
      {
        role: 'user',
        content: `Analyse this WhatsApp message from a supplier and respond with ONLY valid JSON, no other text.

Message: "${supplierText.replace(/"/g, "'")}"

JSON format:
{
  "hasQuotedPrice": boolean,
  "isNegotiationComplete": boolean,
  "isRejection": boolean,
  "asksQuestion": boolean,
  "extractedPrice": string | null,
  "extractedMoq": string | null,
  "extractedLeadTime": string | null
}

Rules:
- hasQuotedPrice: true if a specific price/cost figure is mentioned
- isNegotiationComplete: true if all key terms are confirmed and supplier is ready to proceed
- isRejection: true if supplier declined, cannot supply, or is out of stock
- asksQuestion: true if the supplier is asking a question that needs a specific answer (delivery address, company name, specifications, etc.)
- extractedPrice: exact price string mentioned (e.g. "RM 4,500"), null if none
- extractedMoq: MOQ string if mentioned (e.g. "50 units"), null if none
- extractedLeadTime: lead time string if mentioned (e.g. "7 days"), null if none`,
      },
    ],
  })

  const fallback: DetectionResult = {
    hasQuotedPrice: false, isNegotiationComplete: false, isRejection: false,
    asksQuestion: false, extractedPrice: null, extractedMoq: null, extractedLeadTime: null,
  }
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as DetectionResult
  } catch {
    return fallback
  }
}

// ── Context window builder ─────────────────────────────────────────────────
function buildMessages(messages: ConversationMessage[]): LlmMessage[] {
  return messages.map(msg => ({
    role: msg.role === 'agent' ? ('assistant' as const) : ('user' as const),
    content: msg.text,
  }))
}

function countAgentRounds(messages: ConversationMessage[]): number {
  return messages.filter((m, i) => m.role === 'agent' && i > 0).length
}

// Sends one agent message with human-like typing, persists it, and pushes it to
// the live panel. The single place outbound WhatsApp messages go out.
async function deliverAgentMessage(negotiationId: string, companyId: string | undefined, phone: string, text: string): Promise<void> {
  sseManager.emit(negotiationId, 'typing', { isTyping: true })
  await whatsappManager.sendTypingIndicator(companyId, phone, calculateTypingDelay(text))
  sseManager.emit(negotiationId, 'typing', { isTyping: false })

  await whatsappManager.sendMessage(companyId, phone, text)

  const saved = await appendMessage(negotiationId, {
    role: 'agent',
    text,
    timestamp: new Date().toISOString(),
  })
  sseManager.emit(negotiationId, 'message', saved)
}

// ── Main turn ──────────────────────────────────────────────────────────────
export async function runNegotiationTurn(negotiationId: string): Promise<NegotiationTurnResult> {
  const negotiation = await getNegotiation(negotiationId)
  if (!negotiation) return { done: false }
  if (negotiation.status === 'done' || negotiation.status === 'failed') return { done: true, summary: negotiation.summary ?? '' }

  const allMessages = negotiation.messages

  // Opening turn — no supplier message yet, just send the first message
  if (allMessages.length === 0) {
    return sendOpeningMessage(negotiation.id, negotiation.supplier, negotiation.product, negotiation.quantity, negotiation.targetPrice)
  }

  const supplierMessages = allMessages.filter(m => m.role === 'supplier')
  if (supplierMessages.length === 0) return { done: false }

  const lastSupplierMsg = supplierMessages[supplierMessages.length - 1]

  if (isRateLimited(negotiation.phone)) {
    sseManager.emit(negotiationId, 'activity', { text: 'Rate limit reached — pausing briefly...' })
    return { done: false }
  }

  // Enforce max rounds
  if (countAgentRounds(allMessages) >= MAX_AGENT_ROUNDS) {
    const summary = 'Maximum negotiation rounds reached. Review the conversation and contact the supplier directly for final confirmation.'
    await updateNegotiation(negotiationId, { status: 'done', summary })
    sseManager.emit(negotiationId, 'status', { status: 'done', summary })
    return { done: true, summary }
  }

  // Phase 1: Detect supplier intent (Haiku — cheap)
  sseManager.emit(negotiationId, 'activity', { text: 'Reading supplier message...' })
  const detection = await detectSupplierIntent(lastSupplierMsg.text)

  // Persist any extracted terms to the quote, then mirror them to the live panel.
  if (detection.extractedPrice || detection.extractedMoq || detection.extractedLeadTime) {
    await recordQuote({
      negotiationId,
      rfqId: negotiation.rfqId ?? null,
      supplier: negotiation.supplier,
      channel: 'whatsapp',
      price: detection.extractedPrice,
      moq: detection.extractedMoq,
      leadTime: detection.extractedLeadTime,
    })
    sseManager.emit(negotiationId, 'extraction', {
      price: detection.extractedPrice ?? undefined,
      moq: detection.extractedMoq ?? undefined,
      leadTime: detection.extractedLeadTime ?? undefined,
    })
  }

  if (detection.isRejection) {
    const summary = `Supplier declined or cannot fulfil the order. Last message: "${lastSupplierMsg.text}"`
    await updateNegotiation(negotiationId, { status: 'done', summary })
    sseManager.emit(negotiationId, 'status', { status: 'done', summary })
    return { done: true, summary }
  }

  if (detection.asksQuestion) {
    sseManager.emit(negotiationId, 'activity', { text: 'Supplier asked a question — preparing answer...' })
  }

  // Phase 2: Simulate reading delay
  const readDelay = calculateReadDelay(lastSupplierMsg.text)
  await new Promise(r => setTimeout(r, readDelay))

  // Re-check in case the negotiation was cancelled while we waited
  const fresh = await getNegotiation(negotiationId)
  if (!fresh || fresh.status === 'done' || fresh.status === 'failed') {
    return { done: true, summary: fresh?.summary ?? '' }
  }

  // Phase 3: Craft reply (Sonnet with cached system prompt + sliding window)
  sseManager.emit(negotiationId, 'activity', { text: 'Crafting response...' })

  const recentMessages = await getRecentMessages(negotiationId, CONTEXT_WINDOW_SIZE)

  const replyText = await complete({
    model: LLM_MODELS.smart,
    maxTokens: 350,
    system: SYSTEM_PROMPT,
    messages: buildMessages(recentMessages),
  })

  if (!replyText) return { done: false }

  // Claude signals an agreed price → stop and ask the buyer before committing.
  // The price gate is always on; the agent never confirms the deal on its own.
  try {
    const parsed = JSON.parse(replyText) as { action?: string; summary?: string }
    if (parsed.action === 'done' && typeof parsed.summary === 'string') {
      return raisePriceGate(fresh, parsed.summary)
    }
  } catch {
    // Not JSON — treat as a regular message to send
  }

  // Phase 4: Send the reply, then wait for the supplier
  await deliverAgentMessage(negotiationId, fresh.companyId, fresh.phone, replyText)
  await updateNegotiation(negotiationId, { status: 'negotiating' })

  sseManager.emit(negotiationId, 'status', { status: 'negotiating' })
  sseManager.emit(negotiationId, 'activity', { text: 'Message sent — waiting for reply...' })

  return { done: false }
}

// ── Price gate (Gate 2 — always on) ─────────────────────────────────────────
// The agent reached agreed terms. Record what it proposes, pause the
// negotiation, and wait for the buyer to approve / reject / counter.
async function raisePriceGate(negotiation: Negotiation, summary: string): Promise<NegotiationTurnResult> {
  const quote = await getQuoteByNegotiation(negotiation.id)
  await createGate({
    gateType: 'price',
    negotiationId: negotiation.id,
    rfqId: negotiation.rfqId ?? null,
    proposal: {
      summary,
      supplier: negotiation.supplier,
      price: quote?.price ?? null,
      moq: quote?.moq ?? null,
      leadTime: quote?.leadTime ?? null,
    },
  })

  await updateNegotiation(negotiation.id, { status: 'awaiting_approval', summary })
  sseManager.emit(negotiation.id, 'status', { status: 'awaiting_approval', summary })
  sseManager.emit(negotiation.id, 'activity', {
    text: 'Agreed terms reached — waiting for your approval before committing.',
  })
  return { done: false, paused: true }
}

// ── Resume after a buyer decision ────────────────────────────────────────────

// Approve: tell the supplier we're proceeding and close out the negotiation.
export async function commitAgreedPrice(negotiationId: string): Promise<void> {
  const negotiation = await getNegotiation(negotiationId)
  if (!negotiation) return

  await deliverAgentMessage(
    negotiationId,
    negotiation.companyId,
    negotiation.phone,
    "Great — that works for us. Please go ahead and we'll proceed with the order. Thank you!",
  )

  const summary = negotiation.summary ?? 'Deal approved by buyer.'
  await updateNegotiation(negotiationId, { status: 'done', summary })
  sseManager.emit(negotiationId, 'status', { status: 'done', summary })
}

// Counter: the buyer wants a better deal. Send one directed push and re-open the
// negotiation so the normal reply loop continues.
export async function applyCounter(negotiationId: string, directive: string): Promise<void> {
  const negotiation = await getNegotiation(negotiationId)
  if (!negotiation) return

  const recentMessages = await getRecentMessages(negotiationId, CONTEXT_WINDOW_SIZE)
  const text = await complete({
    model: LLM_MODELS.smart,
    maxTokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      ...buildMessages(recentMessages),
      {
        role: 'user',
        content: `[Buyer instruction] The buyer reviewed the terms and is not ready to accept. Keep negotiating: ${directive}. Reply with only the WhatsApp message to send the supplier.`,
      },
    ],
  })

  if (text) await deliverAgentMessage(negotiationId, negotiation.companyId, negotiation.phone, text)

  await updateNegotiation(negotiationId, { status: 'negotiating' })
  sseManager.emit(negotiationId, 'status', { status: 'negotiating' })
}

// ── Opening message ────────────────────────────────────────────────────────
async function sendOpeningMessage(
  negotiationId: string,
  supplier: string,
  product: string,
  quantity: string,
  targetPrice: string,
): Promise<NegotiationTurnResult> {
  const negotiation = await getNegotiation(negotiationId)
  if (!negotiation) return { done: false }

  const text = buildOpeningMessage({ supplier, product, quantity, targetPrice })
  sseManager.emit(negotiationId, 'activity', { text: 'Sending opening message...' })

  await deliverAgentMessage(negotiationId, negotiation.companyId, negotiation.phone, text)
  await updateNegotiation(negotiationId, { status: 'sent' })

  sseManager.emit(negotiationId, 'activity', { text: `Opening message sent to ${supplier} — waiting for reply...` })
  return { done: false }
}

function buildOpeningMessage(params: {
  supplier: string
  product: string
  quantity: string
  targetPrice: string
}): string {
  const { supplier, product, quantity, targetPrice } = params
  return `Hi ${supplier}, hope you're doing well!

We're looking to procure ${product} and came across your business. We're interested in placing an order.

Quantity needed: ${quantity}
Budget target: ${targetPrice}

Could you share your best price for this quantity, along with MOQ, lead time, and payment terms? Looking forward to hearing from you!`
}
