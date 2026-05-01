import { randomUUID } from 'crypto'
import type { Negotiation, ConversationMessage } from '../types.js'

class NegotiationStore {
  private byId = new Map<string, Negotiation>()
  private byPhone = new Map<string, string>() // normalised phone → id

  private normalise(phone: string): string {
    return phone.replace(/\D/g, '')
  }

  create(data: Omit<Negotiation, 'id' | 'sentAt' | 'status' | 'messages'>): Negotiation {
    const negotiation: Negotiation = {
      ...data,
      id: randomUUID(),
      sentAt: new Date().toISOString(),
      status: 'sent',
      messages: [],
    }
    this.byId.set(negotiation.id, negotiation)
    this.byPhone.set(this.normalise(data.phone), negotiation.id)
    return negotiation
  }

  get(id: string): Negotiation | undefined {
    return this.byId.get(id)
  }

  getByPhone(phone: string): Negotiation | undefined {
    const id = this.byPhone.get(this.normalise(phone))
    return id ? this.byId.get(id) : undefined
  }

  update(id: string, updates: Partial<Negotiation>): void {
    const existing = this.byId.get(id)
    if (!existing) return
    this.byId.set(id, { ...existing, ...updates })
  }

  appendMessage(id: string, message: ConversationMessage): void {
    const existing = this.byId.get(id)
    if (!existing) return
    this.byId.set(id, { ...existing, messages: [...existing.messages, message] })
  }
}

// Singleton — swap this export for a DB-backed class when ready to scale
export const negotiationStore = new NegotiationStore()
