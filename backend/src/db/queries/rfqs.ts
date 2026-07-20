import { randomUUID } from 'node:crypto'
import { pool } from '../client.js'
import { buildUpdate } from '../buildUpdate.js'
import type { Rfq, RfqSpec, RfqStatus, RfqSummary } from '../../types.js'

function rowToRfq(row: Record<string, unknown>): Rfq {
  return {
    id: row.id as string,
    companyId: (row.company_id as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    product: row.product as string,
    grade: (row.grade as string | null) ?? null,
    quantity: (row.quantity as string | null) ?? null,
    packaging: (row.packaging as string | null) ?? null,
    deliveryLocation: (row.delivery_location as string | null) ?? null,
    neededBy: row.needed_by ? (row.needed_by as Date).toISOString() : null,
    targetPrice: (row.target_price as string | null) ?? null,
    currency: row.currency as string,
    requireListApproval: row.require_list_approval as boolean,
    requireWinnerApproval: row.require_winner_approval as boolean,
    status: row.status as RfqStatus,
    winningQuoteId: (row.winning_quote_id as string | null) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  }
}

function rowToSummary(row: Record<string, unknown>): RfqSummary {
  return {
    ...rowToRfq(row),
    contactedCount: Number(row.contacted_count),
    quoteCount: Number(row.quote_count),
  }
}

export async function createRfq(params: {
  companyId?: string
  createdBy?: string
  spec: RfqSpec
  requireListApproval?: boolean
  requireWinnerApproval?: boolean
}): Promise<Rfq> {
  const { spec } = params
  const { rows } = await pool.query(
    `INSERT INTO rfqs (
       id, company_id, created_by,
       product, grade, quantity, packaging, delivery_location, needed_by, target_price, currency,
       require_list_approval, require_winner_approval
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,'MYR'),COALESCE($12,TRUE),COALESCE($13,TRUE))
     RETURNING *`,
    [
      randomUUID(), params.companyId ?? null, params.createdBy ?? null,
      spec.product, spec.grade, spec.quantity, spec.packaging, spec.deliveryLocation,
      spec.neededBy, spec.targetPrice, spec.currency ?? null,
      params.requireListApproval ?? null, params.requireWinnerApproval ?? null,
    ],
  )
  return rowToRfq(rows[0])
}

export async function getRfq(id: string): Promise<Rfq | null> {
  const { rows } = await pool.query('SELECT * FROM rfqs WHERE id = $1', [id])
  return rows[0] ? rowToRfq(rows[0]) : null
}

// Board rows with per-RFQ counts. Scoped to a company when given; otherwise all
// (single-company demo, until tenancy lands in Phase 5).
export async function listRfqSummaries(companyId?: string): Promise<RfqSummary[]> {
  const { rows } = await pool.query(
    `SELECT r.*,
       (SELECT COUNT(*) FROM negotiations n WHERE n.rfq_id = r.id) AS contacted_count,
       (SELECT COUNT(*) FROM quotes q WHERE q.rfq_id = r.id) AS quote_count
     FROM rfqs r
     ${companyId ? 'WHERE r.company_id = $1' : ''}
     ORDER BY r.created_at DESC`,
    companyId ? [companyId] : [],
  )
  return rows.map(rowToSummary)
}

export async function setWinningQuote(rfqId: string, quoteId: string): Promise<void> {
  await pool.query(
    `UPDATE rfqs SET winning_quote_id = $1, status = 'decided', updated_at = NOW() WHERE id = $2`,
    [quoteId, rfqId],
  )
}

export async function updateRfq(
  id: string,
  updates: Partial<RfqSpec> & { status?: RfqStatus },
): Promise<void> {
  const { clause, values } = buildUpdate({
    product: updates.product,
    grade: updates.grade,
    quantity: updates.quantity,
    packaging: updates.packaging,
    delivery_location: updates.deliveryLocation,
    needed_by: updates.neededBy,
    target_price: updates.targetPrice,
    currency: updates.currency,
    status: updates.status,
  })
  values.push(id)
  await pool.query(`UPDATE rfqs SET ${clause} WHERE id = $${values.length}`, values)
}
