import { Router } from 'express'
import type { Request, Response } from 'express'
import { getGate, resolveGate, listPendingGates } from '../db/queries/approvalGates.js'
import { queueManager } from '../services/queueManager.js'
import type { GateAction, GateStatus } from '../types.js'
import { requireAuth } from '../middleware/auth.js'
import { getRfq } from '../db/queries/rfqs.js'

const router = Router()
router.use(requireAuth)

const STATUS_FOR_ACTION: Record<GateAction, Exclude<GateStatus, 'pending'>> = {
  approve: 'approved',
  reject: 'rejected',
  counter: 'countered',
}

router.get('/pending', async (req: Request, res: Response) => {
  try {
    res.json(await listPendingGates(req.user!.companyId ?? undefined))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list gates' })
  }
})

router.post('/:gateId/resolve', async (req: Request<{ gateId: string }>, res: Response) => {
  const { gateId } = req.params
  const { action, note } = req.body as { action?: GateAction; note?: string }

  if (!action || !(action in STATUS_FOR_ACTION)) {
    res.status(400).json({ error: 'action must be approve, reject, or counter' })
    return
  }
  if (action === 'counter' && !note?.trim()) {
    res.status(400).json({ error: 'A counter needs a note/target' })
    return
  }

  try {
    const gate = await getGate(gateId)
    if (!gate) {
      res.status(404).json({ error: 'Gate not found' })
      return
    }
    if (gate.rfqId) {
      const rfq = await getRfq(gate.rfqId)
      if (!rfq || (rfq.companyId && rfq.companyId !== req.user!.companyId)) { res.status(403).json({ error: 'You do not have access to this approval' }); return }
    }
    if (gate.status !== 'pending') {
      res.status(409).json({ error: 'Gate already resolved' })
      return
    }

    await resolveGate(gateId, STATUS_FOR_ACTION[action], { note: note?.trim(), resolvedBy: req.user!.id })

    // Only the price gate has a wired flow today; list/winner gates resolve the
    // record and their flows land with sourcing (Phase 3) and decisions (Phase 4).
    if (gate.gateType === 'price' && gate.negotiationId) {
      if (action === 'approve') await queueManager.approveAndCommit(gate.negotiationId)
      else if (action === 'reject') await queueManager.rejectOffer(gate.negotiationId, note?.trim())
      else await queueManager.counterOffer(gate.negotiationId, note!.trim())
    }

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to resolve gate' })
  }
})

export default router
