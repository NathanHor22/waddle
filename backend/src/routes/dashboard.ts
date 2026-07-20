import { Router } from 'express'
import type { Request, Response } from 'express'
import { getDashboardStats, getActivity } from '../db/queries/dashboard.js'

const router = Router()

// Money figures + this-week counts + savings sparkline for the home dashboard.
router.get('/stats', async (req: Request, res: Response) => {
  const companyId = req.query.companyId as string | undefined
  try {
    res.json(await getDashboardStats(companyId))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load stats' })
  }
})

// Unified recent-activity feed for the WadRail.
router.get('/activity', async (req: Request, res: Response) => {
  const companyId = req.query.companyId as string | undefined
  const limit = Math.min(Number(req.query.limit) || 30, 100)
  try {
    res.json(await getActivity(limit, companyId))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load activity' })
  }
})

export default router
