export const WORKFLOW_STEPS = ['draft', 'out_for_quotes', 'quotes_in', 'negotiating', 'awaiting_approval', 'decided', 'closed']

export const WORKFLOW_LABELS = {
  draft: 'Draft',
  out_for_quotes: 'Collecting quotes',
  quotes_in: 'Quotes received',
  negotiating: 'Negotiating',
  awaiting_approval: 'Needs approval',
  decided: 'Decision recorded',
  closed: 'Closed',
}

export function getWorkflowProgress(status) {
  const index = WORKFLOW_STEPS.indexOf(status)
  return { index: index < 0 ? 0 : index, step: index < 0 ? 1 : index + 1, total: WORKFLOW_STEPS.length }
}

export function getStatusTone(status) {
  if (status === 'awaiting_approval') return 'warning'
  if (status === 'decided' || status === 'closed') return 'success'
  if (status === 'failed') return 'danger'
  return 'neutral'
}
