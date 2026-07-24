import { Router } from 'express'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { generateEmailDraft } from '../services/emailAgent.js'
import { getConsentUrl, exchangeCode, sendAsUser } from '../services/gmailClient.js'
import { upsertEmailAccount, getEmailAccount, deleteEmailAccount } from '../db/queries/emailAccounts.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function normaliseUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`
}
const FRONTEND_URL = normaliseUrl(process.env.FRONTEND_URL ?? 'http://localhost:5173')

function companyOf(req: Request, res: Response): string | null {
  const companyId = req.user?.companyId
  if (!companyId) {
    res.status(400).json({ error: 'Set up your company before connecting email' })
    return null
  }
  return companyId
}

// ── Connection status for the Connections hub ────────────────────────────────
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  const companyId = companyOf(req, res)
  if (!companyId) return
  const account = await getEmailAccount(companyId)
  res.json({
    connected: !!account,
    address: account?.emailAddress ?? null,
    since: account?.connectedAt ?? null,
  })
})

// ── OAuth: start the "Connect email" consent flow ────────────────────────────
// State is a short-lived signed token carrying the company, so the callback
// (which Google hits without our auth header) can trust which tenant to attach.
router.get('/connect', requireAuth, (req: Request, res: Response) => {
  const companyId = companyOf(req, res)
  if (!companyId) return
  const state = jwt.sign({ companyId, userId: req.user!.id }, process.env.JWT_SECRET!, { expiresIn: '10m' })
  res.redirect(getConsentUrl(state))
})

// ── OAuth: Google redirects back here ────────────────────────────────────────
router.get('/connect/callback', async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  try {
    const { companyId, userId } = jwt.verify(state, process.env.JWT_SECRET!) as { companyId: string; userId: string }
    const { refreshToken, emailAddress } = await exchangeCode(code)
    await upsertEmailAccount({ companyId, emailAddress, refreshToken, connectedBy: userId })
    res.redirect(`${FRONTEND_URL}/connections?email=connected`)
  } catch (err) {
    console.error('[email] connect callback error:', err)
    res.redirect(`${FRONTEND_URL}/connections?email=error`)
  }
})

// ── Disconnect ───────────────────────────────────────────────────────────────
router.post('/disconnect', requireAuth, async (req: Request, res: Response) => {
  const companyId = companyOf(req, res)
  if (!companyId) return
  await deleteEmailAccount(companyId)
  res.json({ ok: true })
})

// ── AI draft (human reviews before sending) ──────────────────────────────────
router.post('/preview', requireAuth, async (req: Request, res: Response) => {
  const { supplierName, supplierEmail, product, quantity, targetPrice, senderName } = req.body

  if (!supplierName?.trim() || !supplierEmail?.trim() || !product?.trim() ||
      !quantity?.trim() || !targetPrice?.trim() || !senderName?.trim()) {
    res.status(400).json({ error: 'All fields are required' })
    return
  }

  try {
    const draft = await generateEmailDraft({
      supplierName: supplierName.trim(),
      supplierEmail: supplierEmail.trim(),
      product: product.trim(),
      quantity: quantity.trim(),
      targetPrice: targetPrice.trim(),
      senderName: senderName.trim(),
    })
    res.json(draft)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate draft' })
  }
})

// ── Send the human-approved reply as the connected user ──────────────────────
router.post('/send', requireAuth, async (req: Request, res: Response) => {
  const companyId = companyOf(req, res)
  if (!companyId) return
  const { to, subject, body, threadId, inReplyToMessageId } = req.body

  if (!to?.trim() || !subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'to, subject, and body are required' })
    return
  }

  try {
    const sent = await sendAsUser({
      companyId,
      to: to.trim(),
      subject: subject.trim(),
      body: body.trim(),
      threadId: typeof threadId === 'string' ? threadId : undefined,
      inReplyToMessageId: typeof inReplyToMessageId === 'string' ? inReplyToMessageId : undefined,
    })
    res.json({ ok: true, ...sent })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to send email' })
  }
})

export default router
