import { apiFetch } from './api'

async function json(resPromise) {
  const res = await resPromise
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data
}

function post(url, body) {
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

// ── RFQs ────────────────────────────────────────────────────────────────────
export const captureRfq    = (text, opts = {}) => json(post('/api/rfqs/capture', { text, ...opts }))
export const listRfqs      = (companyId)       => json(apiFetch(`/api/rfqs${companyId ? `?companyId=${companyId}` : ''}`))
export const getRfqDetail  = (id)              => json(apiFetch(`/api/rfqs/${id}/detail`))
export const submitRfq     = (id, suppliers)   => json(post(`/api/rfqs/${id}/submit`, { suppliers }))
export const decideRfq     = (id, quoteId)     => json(post(`/api/rfqs/${id}/decide`, { quoteId }))
export const closeRfq      = (id)              => json(post(`/api/rfqs/${id}/close`))

export const patchRfq = (id, updates) =>
  json(apiFetch(`/api/rfqs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  }))

// ── Approval gates ──────────────────────────────────────────────────────────
export const listPendingGates = ()                    => json(apiFetch('/api/approvals/pending'))
export const resolveGate      = (gateId, action, note) => json(post(`/api/approvals/${gateId}/resolve`, { action, note }))

// ── Dashboard aggregates ──────────────────────────────────────────────────────
export const getDashboardStats = () => json(apiFetch('/api/dashboard/stats'))
export const getActivity       = () => json(apiFetch('/api/dashboard/activity'))
