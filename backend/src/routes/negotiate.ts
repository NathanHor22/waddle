import { Router } from 'express'
import type { Request, Response } from 'express'
import { negotiationStore } from '../store/negotiations.js'
import { sendWhatsAppMessage, buildNegotiationMessage } from '../services/whatsapp.js'
import type { StartNegotiateBody } from '../types.js'

const router = Router()

router.post('/start', async (req: Request<{}, {}, StartNegotiateBody>, res: Response) => {
  const { supplier, phone, product, quantity, targetPrice } = req.body

  if (!phone?.trim()) {
    res.status(400).json({ error: 'Supplier phone number is required' })
    return
  }

  const negotiation = negotiationStore.create({
    supplier,
    phone: phone.trim(),
    product,
    quantity,
    targetPrice,
  })

  try {
    const messageText = buildNegotiationMessage({ supplier, product, quantity, targetPrice })
    const whatsappMessageId = await sendWhatsAppMessage(phone, messageText)

    // Store opening message so the conversation thread starts immediately
    negotiationStore.appendMessage(negotiation.id, {
      role: 'agent',
      text: messageText,
      timestamp: new Date().toISOString(),
    })

    negotiationStore.update(negotiation.id, { whatsappMessageId })
    res.json({ id: negotiation.id, status: 'sent' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    negotiationStore.update(negotiation.id, { status: 'failed' })
    res.status(500).json({ error: message })
  }
})

router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  const negotiation = negotiationStore.get(req.params.id)
  if (!negotiation) {
    res.status(404).json({ error: 'Negotiation not found' })
    return
  }
  res.json(negotiation)
})

export default router
