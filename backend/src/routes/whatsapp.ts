import { Router } from 'express'
import type { Request, Response } from 'express'
import { whatsappManager } from '../services/whatsappBaileys.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Resolve the signed-in user's company, or 400 if they haven't onboarded.
function companyOf(req: Request, res: Response): string | null {
  const companyId = req.user?.companyId
  if (!companyId) {
    res.status(400).json({ error: 'Set up your company before connecting WhatsApp' })
    return null
  }
  return companyId
}

// Current connection status, linked number and link time for this company.
// Ensures the session exists so status polling drives the QR flow.
router.get('/status', requireAuth, (req: Request, res: Response) => {
  const companyId = companyOf(req, res)
  if (!companyId) return
  res.json(whatsappManager.getInfo(companyId))
})

// Current QR as a base64 data URL, or 404 if not in a QR state.
router.get('/qr', requireAuth, (req: Request, res: Response) => {
  const companyId = companyOf(req, res)
  if (!companyId) return
  const qr = whatsappManager.getQR(companyId)
  if (!qr) {
    res.status(404).json({ error: 'No QR code available — WhatsApp may already be connected or still initialising' })
    return
  }
  res.json({ qr })
})

// Requests an 8-char pairing code for this company (QR alternative).
router.post('/pair', requireAuth, async (req: Request, res: Response) => {
  const companyId = companyOf(req, res)
  if (!companyId) return
  const phone = typeof req.body?.phone === 'string' ? req.body.phone : ''
  try {
    const code = await whatsappManager.requestPairingCode(companyId, phone)
    res.json({ code })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not request pairing code' })
  }
})

// Unlinks this company's connected device.
router.post('/disconnect', requireAuth, async (req: Request, res: Response) => {
  const companyId = companyOf(req, res)
  if (!companyId) return
  try {
    await whatsappManager.disconnect(companyId)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not disconnect' })
  }
})

export default router
