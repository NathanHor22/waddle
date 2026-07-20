import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  createRfq, getRfq, listRfqSummaries, updateRfq, setWinningQuote,
} from '../db/queries/rfqs.js'
import { createNegotiation, hasActiveNegotiationForRfqSupplier, listNegotiationsByRfq } from '../db/queries/negotiations.js'
import { getQuote, getQuotesByRfq } from '../db/queries/quotes.js'
import { listPendingGatesByRfq } from '../db/queries/approvalGates.js'
import { captureRfqFromText } from '../services/rfqAgent.js'
import { queueManager } from '../services/queueManager.js'
import type { RfqSpec, RfqStatus } from '../types.js'
import { requireAuth } from '../middleware/auth.js'
import { assertRfqTransition, dedupeSuppliers } from '../workflow/rfqRules.js'

const router = Router()
router.use(requireAuth)


// The front door. Natural language in → a draft RFQ out, plus any clarifying
// questions for missing critical fields. The buyer never fills a form.
router.post('/capture', async (req: Request, res: Response) => {
  const { text, companyId, createdBy, requireListApproval, requireWinnerApproval } =
    req.body as {
      text?: string
      companyId?: string
      createdBy?: string
      requireListApproval?: boolean
      requireWinnerApproval?: boolean
    }

  if (!text?.trim()) {
    res.status(400).json({ error: 'Tell us what you need to buy' })
    return
  }

  try {
    const { spec, clarifyingQuestions } = await captureRfqFromText(text.trim())

    // Can't even identify the product — ask before persisting anything.
    if (!spec.product) {
      res.json({ rfq: null, clarifyingQuestions })
      return
    }

    const rfq = await createRfq({
      companyId: req.user!.companyId ?? companyId,
      createdBy: req.user!.id,
      spec,
      requireListApproval,
      requireWinnerApproval,
    })
    res.json({ rfq, clarifyingQuestions })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to capture RFQ' })
  }
})

// The board. Counts per RFQ; scoped to a company when provided.
router.get('/', async (req: Request, res: Response) => {
  const companyId = req.query.companyId as string | undefined
  try {
    res.json(await listRfqSummaries(req.user!.companyId ?? companyId))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list RFQs' })
  }
})

// Everything the single-RFQ view needs in one call.
router.get('/:id/detail', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const rfq = await getRfq(req.params.id)
    if (!rfq) {
      res.status(404).json({ error: 'RFQ not found' })
      return
    }
    if (rfq.companyId && rfq.companyId !== req.user!.companyId) { res.status(403).json({ error: 'You do not have access to this RFQ' }); return }
    const [negotiations, quotes, pendingGates] = await Promise.all([
      listNegotiationsByRfq(rfq.id),
      getQuotesByRfq(rfq.id),
      listPendingGatesByRfq(rfq.id),
    ])
    res.json({ rfq, negotiations, quotes, pendingGates })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load RFQ' })
  }
})

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const rfq = await getRfq(req.params.id)
    if (!rfq) {
      res.status(404).json({ error: 'RFQ not found' })
      return
    }
    if (rfq.companyId && rfq.companyId !== req.user!.companyId) { res.status(403).json({ error: 'You do not have access to this RFQ' }); return }
    res.json(rfq)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch RFQ' })
  }
})

// Apply clarifying answers or manual edits to the spec.
router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const rfq = await getRfq(req.params.id)
    if (!rfq) {
      res.status(404).json({ error: 'RFQ not found' })
      return
    }
    const updates = req.body as Partial<RfqSpec> & { status?: RfqStatus }
    if (rfq.companyId && rfq.companyId !== req.user!.companyId) { res.status(403).json({ error: 'You do not have access to this RFQ' }); return }
    if (rfq.status !== 'draft') { res.status(409).json({ error: 'Only draft RFQs can be edited' }); return }
    if (updates.status) assertRfqTransition(rfq.status, updates.status)
    await updateRfq(req.params.id, updates)
    res.json(await getRfq(req.params.id))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update RFQ' })
  }
})

// Send the RFQ to the approved supplier list. Each supplier becomes a
// negotiation carrying this rfqId, so its quotes attach back to the RFQ.
router.post('/:id/submit', async (req: Request<{ id: string }>, res: Response) => {
  const { suppliers } = req.body as { suppliers?: { supplier: string; phone: string }[] }
  if (!suppliers?.length) {
    res.status(400).json({ error: 'Add at least one supplier to send to' })
    return
  }

  try {
    const rfq = await getRfq(req.params.id)
    if (!rfq) {
      res.status(404).json({ error: 'RFQ not found' })
      return
    }
    if (rfq.companyId && rfq.companyId !== req.user!.companyId) { res.status(403).json({ error: 'You do not have access to this RFQ' }); return }
    if (rfq.status !== 'draft') {
      res.status(409).json({ error: 'RFQ is already out for quotes' })
      return
    }

    const cleanSuppliers = dedupeSuppliers(suppliers)
    if (!cleanSuppliers.length) { res.status(400).json({ error: 'Add at least one supplier with a valid contact' }); return }
    let created = 0
    for (const s of cleanSuppliers) {
      if (!s.supplier?.trim() || !s.phone?.trim()) continue
      if (await hasActiveNegotiationForRfqSupplier(rfq.id, s.phone)) continue
      const negotiation = await createNegotiation({
        supplier: s.supplier.trim(),
        phone: s.phone.trim(),
        product: rfq.grade ? `${rfq.product} (${rfq.grade})` : rfq.product,
        quantity: rfq.quantity ?? 'Not specified',
        targetPrice: rfq.targetPrice ?? 'Open',
        rfqId: rfq.id,
        companyId: rfq.companyId ?? undefined,
      })
      await queueManager.enqueue(negotiation.id)
      created += 1
    }

    if (created === 0) { res.status(409).json({ error: 'These suppliers are already being contacted for this RFQ' }); return }

    await updateRfq(rfq.id, { status: 'out_for_quotes' })
    res.json(await getRfq(rfq.id))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to submit RFQ' })
  }
})

// The decision: pick the winning quote and mark the RFQ decided.
router.post('/:id/decide', async (req: Request<{ id: string }>, res: Response) => {
  const { quoteId } = req.body as { quoteId?: string }
  if (!quoteId) {
    res.status(400).json({ error: 'quoteId is required' })
    return
  }
  try {
    const rfq = await getRfq(req.params.id)
    if (!rfq) {
      res.status(404).json({ error: 'RFQ not found' })
      return
    }
    if (rfq.companyId && rfq.companyId !== req.user!.companyId) { res.status(403).json({ error: 'You do not have access to this RFQ' }); return }
    if (!['quotes_in', 'negotiating', 'awaiting_approval'].includes(rfq.status)) { res.status(409).json({ error: 'RFQ is not ready for a supplier decision' }); return }
    const quote = await getQuote(quoteId)
    if (!quote || quote.rfqId !== rfq.id) { res.status(400).json({ error: 'Quote does not belong to this RFQ' }); return }
    await setWinningQuote(rfq.id, quoteId)
    res.json(await getRfq(rfq.id))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to record decision' })
  }
})

router.post('/:id/close', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const rfq = await getRfq(req.params.id)
    if (!rfq) {
      res.status(404).json({ error: 'RFQ not found' })
      return
    }
    if (rfq.companyId && rfq.companyId !== req.user!.companyId) { res.status(403).json({ error: 'You do not have access to this RFQ' }); return }
    if (rfq.status !== 'decided') { res.status(409).json({ error: 'Only decided RFQs can be closed' }); return }
    await updateRfq(rfq.id, { status: 'closed' })
    res.json(await getRfq(rfq.id))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to close RFQ' })
  }
})

export default router
