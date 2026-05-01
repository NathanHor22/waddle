export interface ConversationMessage {
  role: 'agent' | 'supplier'
  text: string
  timestamp: string
}

export interface Negotiation {
  id: string
  supplier: string
  phone: string
  product: string
  quantity: string
  targetPrice: string
  status: 'sent' | 'negotiating' | 'done' | 'failed'
  sentAt: string
  whatsappMessageId?: string
  messages: ConversationMessage[]
  summary?: string
}

export interface ParsedQuotation {
  price: string | null
  moq: string | null
  leadTime: string | null
  raw: string
}

export interface StartNegotiateBody {
  supplier: string
  phone: string
  product: string
  quantity: string
  targetPrice: string
}
