import type { RfqStatus } from '../types.js'

export const ALLOWED_Rfq_TRANSITIONS: Record<RfqStatus, RfqStatus[]> = {
  draft: ['draft', 'out_for_quotes'],
  out_for_quotes: ['out_for_quotes', 'quotes_in', 'negotiating', 'awaiting_approval'],
  quotes_in: ['quotes_in', 'negotiating', 'awaiting_approval', 'decided'],
  negotiating: ['negotiating', 'quotes_in', 'awaiting_approval', 'decided'],
  awaiting_approval: ['awaiting_approval', 'negotiating', 'decided'],
  decided: ['decided', 'closed'],
  closed: ['closed'],
}

export function isValidRfqTransition(current: RfqStatus, next: RfqStatus): boolean {
  return ALLOWED_Rfq_TRANSITIONS[current]?.includes(next) ?? false
}

export function assertRfqTransition(current: RfqStatus, next: RfqStatus): void {
  if (!isValidRfqTransition(current, next)) {
    throw new Error(`Cannot move RFQ from ${current} to ${next}`)
  }
}

export function normaliseSupplierPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function dedupeSuppliers<T extends { supplier: string; phone: string }>(suppliers: T[]): T[] {
  const seen = new Set<string>()
  return suppliers.filter((supplier) => {
    const phone = normaliseSupplierPhone(supplier.phone)
    if (!supplier.supplier.trim() || !phone || seen.has(phone)) return false
    seen.add(phone)
    return true
  })
}
