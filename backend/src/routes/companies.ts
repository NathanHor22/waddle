import { Router } from 'express'
import type { Request, Response } from 'express'
import { createCompany, getCompany } from '../db/queries/companies.js'
import { setUserCompany } from '../db/queries/users.js'
import { requireAuth } from '../middleware/auth.js'
import type { Country } from '../types.js'

const router = Router()

// The company the signed-in user belongs to (null if they haven't onboarded).
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.companyId
    res.json(companyId ? await getCompany(companyId) : null)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load company' })
  }
})

// Onboarding: create the company and attach the signed-in user to it.
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { name, registrationNo, country, defaultCurrency } =
    req.body as { name?: string; registrationNo?: string; country?: Country; defaultCurrency?: string }

  if (!name?.trim()) {
    res.status(400).json({ error: 'Company name is required' })
    return
  }
  if (req.user!.companyId) {
    res.status(409).json({ error: 'You already belong to a company' })
    return
  }

  try {
    const company = await createCompany({
      name: name.trim(),
      registrationNo: registrationNo?.trim() || undefined,
      country,
      defaultCurrency: defaultCurrency?.trim() || undefined,
    })
    await setUserCompany(req.user!.id, company.id)
    res.json(company)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create company' })
  }
})

export default router
