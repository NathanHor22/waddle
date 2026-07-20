// ── Message & Negotiation ──────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'agent' | 'supplier'
  text: string
  timestamp: string
}

export type NegotiationStatus = 'sent' | 'negotiating' | 'awaiting_approval' | 'done' | 'failed'

export interface Negotiation {
  id: string
  supplier: string
  phone: string
  product: string
  quantity: string
  targetPrice: string
  status: NegotiationStatus
  sentAt: string
  messages: ConversationMessage[]
  summary?: string
  rfqId?: string
  companyId?: string
}

export interface ParsedQuotation {
  price: string | null
  moq: string | null
  leadTime: string | null
  raw: string
}

// ── Request bodies ─────────────────────────────────────────────────────────

export interface StartNegotiateBody {
  supplier: string
  phone: string
  product: string
  quantity: string
  targetPrice: string
  sessionId?: string
}

// ── Queue ──────────────────────────────────────────────────────────────────

export type QueueItemStatus = 'pending' | 'active' | 'waiting_reply' | 'timed_out' | 'done'

export interface QueueItem {
  id: string
  negotiationId: string
  position: number
  status: QueueItemStatus
  lastMessageAt: string | null
  timeoutAt: string | null
  createdAt: string
}

// ── Negotiation agent ──────────────────────────────────────────────────────

export type NegotiationTurnResult =
  | { done: true; summary: string }
  | { done: false; paused?: boolean } // paused → stopped at an approval gate

export interface DetectionResult {
  hasQuotedPrice: boolean
  isNegotiationComplete: boolean
  isRejection: boolean
  asksQuestion: boolean
  extractedPrice: string | null
  extractedMoq: string | null
  extractedLeadTime: string | null
}

// ── SSE events ─────────────────────────────────────────────────────────────

export type SSEEventType = 'message' | 'status' | 'activity' | 'typing' | 'extraction'

export interface SSEPayload {
  message: ConversationMessage
  status: { status: NegotiationStatus; summary?: string }
  activity: { text: string }
  typing: { isTyping: boolean }
  extraction: { price?: string; moq?: string; leadTime?: string }
}

// ── Sessions ───────────────────────────────────────────────────────────────

export interface Session {
  id: string
  title: string
  threadId: string
  createdAt: string
  updatedAt: string
  messageCount?: number
  negotiationCount?: number
}

export interface SessionMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'options' | 'recommendations'
  content: string
  createdAt: string
}

// ── Company / RFQ / Quote (the spine) ──────────────────────────────────────

export type Country = 'MY' | 'SG'

export interface Company {
  id: string
  name: string
  registrationNo: string | null
  country: Country
  defaultCurrency: string
  createdAt: string
  updatedAt: string
}

export type RfqStatus =
  | 'draft'
  | 'out_for_quotes'
  | 'quotes_in'
  | 'negotiating'
  | 'awaiting_approval'
  | 'decided'
  | 'closed'

// The procurement spec, filled by the agent from natural language.
export interface RfqSpec {
  product: string
  grade: string | null
  quantity: string | null
  packaging: string | null
  deliveryLocation: string | null
  neededBy: string | null
  targetPrice: string | null
  currency: string
}

// Which approval gates are active. The price gate is always on (enforced in
// code) and intentionally absent here so it can never be switched off.
export interface RfqAutonomy {
  requireListApproval: boolean
  requireWinnerApproval: boolean
}

export interface Rfq extends RfqSpec, RfqAutonomy {
  id: string
  companyId: string | null
  createdBy: string | null
  status: RfqStatus
  winningQuoteId: string | null
  createdAt: string
  updatedAt: string
}

// Board row: an RFQ plus the counts the dashboard shows per row.
export interface RfqSummary extends Rfq {
  contactedCount: number
  quoteCount: number
}

export type QuoteChannel = 'whatsapp' | 'email'
export type SpecMatch = 'match' | 'mismatch' | 'unknown'

export interface Quote {
  id: string
  rfqId: string | null
  negotiationId: string | null
  supplier: string
  channel: QuoteChannel
  price: string | null
  currency: string | null
  moq: string | null
  leadTime: string | null
  paymentTerms: string | null
  incoterm: string | null
  quotedSpec: string | null
  specMatch: SpecMatch
  specMatchNote: string | null
  createdAt: string
  updatedAt: string
}

// ── Approval gates (human-in-the-loop) ─────────────────────────────────────

export type GateType = 'supplier_list' | 'price' | 'winner'
export type GateStatus = 'pending' | 'approved' | 'rejected' | 'countered'
export type GateAction = 'approve' | 'reject' | 'counter'

export interface ApprovalGate {
  id: string
  rfqId: string | null
  negotiationId: string | null
  gateType: GateType
  status: GateStatus
  proposal: Record<string, unknown>
  resolutionNote: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
}

// ── WhatsApp connection ────────────────────────────────────────────────────

export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
