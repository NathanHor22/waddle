import { randomUUID } from 'node:crypto'
import { pool } from '../client.js'
import { buildUpdate } from '../buildUpdate.js'
import type { Quote, QuoteChannel, SpecMatch } from '../../types.js'

function rowToQuote(row: Record<string, unknown>): Quote {
  return {
    id: row.id as string,
    rfqId: (row.rfq_id as string | null) ?? null,
    negotiationId: (row.negotiation_id as string | null) ?? null,
    supplier: row.supplier as string,
    channel: row.channel as QuoteChannel,
    price: (row.price as string | null) ?? null,
    currency: (row.currency as string | null) ?? null,
    moq: (row.moq as string | null) ?? null,
    leadTime: (row.lead_time as string | null) ?? null,
    paymentTerms: (row.payment_terms as string | null) ?? null,
    incoterm: (row.incoterm as string | null) ?? null,
    quotedSpec: (row.quoted_spec as string | null) ?? null,
    specMatch: row.spec_match as SpecMatch,
    specMatchNote: (row.spec_match_note as string | null) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  }
}

// Upsert the quote tied to a negotiation. Called each time the agent extracts
// new terms, so we COALESCE — a later turn that didn't mention price must not
// wipe a price captured earlier. One evolving quote per negotiation.
export async function recordQuote(params: {
  negotiationId: string
  rfqId?: string | null
  supplier: string
  channel: QuoteChannel
  price?: string | null
  moq?: string | null
  leadTime?: string | null
}): Promise<void> {
  await pool.query(
    `INSERT INTO quotes (id, rfq_id, negotiation_id, supplier, channel, price, moq, lead_time)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (negotiation_id) DO UPDATE SET
       rfq_id     = COALESCE(EXCLUDED.rfq_id, quotes.rfq_id),
       price      = COALESCE(EXCLUDED.price, quotes.price),
       moq        = COALESCE(EXCLUDED.moq, quotes.moq),
       lead_time  = COALESCE(EXCLUDED.lead_time, quotes.lead_time),
       updated_at = NOW()`,
    [
      randomUUID(), params.rfqId ?? null, params.negotiationId, params.supplier, params.channel,
      params.price ?? null, params.moq ?? null, params.leadTime ?? null,
    ],
  )
}

export async function getQuotesByRfq(rfqId: string): Promise<Quote[]> {
  const { rows } = await pool.query(
    'SELECT * FROM quotes WHERE rfq_id = $1 ORDER BY created_at ASC',
    [rfqId],
  )
  return rows.map(rowToQuote)
}

export async function getQuote(id: string): Promise<Quote | null> {
  const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [id])
  return rows[0] ? rowToQuote(rows[0]) : null
}

export async function getQuoteByNegotiation(negotiationId: string): Promise<Quote | null> {
  const { rows } = await pool.query('SELECT * FROM quotes WHERE negotiation_id = $1', [negotiationId])
  return rows[0] ? rowToQuote(rows[0]) : null
}

// Spec-match assessment and richer terms land here once those flows exist.
export async function updateQuote(
  id: string,
  updates: Partial<Pick<Quote, 'paymentTerms' | 'incoterm' | 'quotedSpec' | 'specMatch' | 'specMatchNote'>>,
): Promise<void> {
  const { clause, values } = buildUpdate({
    payment_terms: updates.paymentTerms,
    incoterm: updates.incoterm,
    quoted_spec: updates.quotedSpec,
    spec_match: updates.specMatch,
    spec_match_note: updates.specMatchNote,
  })
  values.push(id)
  await pool.query(`UPDATE quotes SET ${clause} WHERE id = $${values.length}`, values)
}
