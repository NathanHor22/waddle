import { randomUUID } from 'node:crypto'
import { pool } from '../client.js'
import type { ApprovalGate, GateStatus, GateType } from '../../types.js'

function rowToGate(row: Record<string, unknown>): ApprovalGate {
  return {
    id: row.id as string,
    rfqId: (row.rfq_id as string | null) ?? null,
    negotiationId: (row.negotiation_id as string | null) ?? null,
    gateType: row.gate_type as GateType,
    status: row.status as GateStatus,
    proposal: (row.proposal as Record<string, unknown>) ?? {},
    resolutionNote: (row.resolution_note as string | null) ?? null,
    resolvedBy: (row.resolved_by as string | null) ?? null,
    resolvedAt: row.resolved_at ? (row.resolved_at as Date).toISOString() : null,
    createdAt: (row.created_at as Date).toISOString(),
  }
}

export async function createGate(params: {
  gateType: GateType
  rfqId?: string | null
  negotiationId?: string | null
  proposal?: Record<string, unknown>
}): Promise<ApprovalGate> {
  const { rows } = await pool.query(
    `INSERT INTO approval_gates (id, rfq_id, negotiation_id, gate_type, proposal)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [randomUUID(), params.rfqId ?? null, params.negotiationId ?? null, params.gateType, params.proposal ?? {}],
  )
  return rowToGate(rows[0])
}

export async function getGate(id: string): Promise<ApprovalGate | null> {
  const { rows } = await pool.query('SELECT * FROM approval_gates WHERE id = $1', [id])
  return rows[0] ? rowToGate(rows[0]) : null
}

export async function listPendingGates(companyId?: string): Promise<ApprovalGate[]> {
  const { rows } = await pool.query(
    `SELECT ag.* FROM approval_gates ag
     LEFT JOIN rfqs r ON r.id = ag.rfq_id
     WHERE ag.status = 'pending' ${companyId ? 'AND r.company_id = $1' : ''}
     ORDER BY ag.created_at ASC`,
    companyId ? [companyId] : [],
  )
  return rows.map(rowToGate)
}

export async function listPendingGatesByRfq(rfqId: string): Promise<ApprovalGate[]> {
  const { rows } = await pool.query(
    `SELECT * FROM approval_gates WHERE rfq_id = $1 AND status = 'pending' ORDER BY created_at ASC`,
    [rfqId],
  )
  return rows.map(rowToGate)
}

export async function resolveGate(
  id: string,
  status: Exclude<GateStatus, 'pending'>,
  resolution: { note?: string; resolvedBy?: string } = {},
): Promise<void> {
  await pool.query(
    `UPDATE approval_gates
     SET status = $1, resolution_note = $2, resolved_by = $3, resolved_at = NOW()
     WHERE id = $4`,
    [status, resolution.note ?? null, resolution.resolvedBy ?? null, id],
  )
}
