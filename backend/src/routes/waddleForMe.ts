import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { createJob, getJobs } from '../db/queries/waddleForMe.js'

const router = Router()

router.use(requireAuth)

router.get('/', async (req: Request, res: Response) => {
  const jobs = await getJobs(req.user!.id)
  res.json(jobs)
})

router.post('/', async (req: Request, res: Response) => {
  const { supplierContact, contactType, productDescription, quantity, budget, notes } = req.body

  if (!supplierContact?.trim()) {
    res.status(400).json({ error: 'supplierContact is required' })
    return
  }
  if (contactType !== 'phone' && contactType !== 'email') {
    res.status(400).json({ error: 'contactType must be phone or email' })
    return
  }
  if (!productDescription?.trim()) {
    res.status(400).json({ error: 'productDescription is required' })
    return
  }

  const job = await createJob({
    userId: req.user!.id,
    supplierContact: supplierContact.trim(),
    contactType,
    productDescription: productDescription.trim(),
    quantity: quantity?.trim() || undefined,
    budget: budget?.trim() || undefined,
    notes: notes?.trim() || undefined,
  })

  res.json(job)
})

export default router
