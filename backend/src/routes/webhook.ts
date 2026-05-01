import { Router } from 'express'
import type { Request, Response } from 'express'
import { negotiationStore } from '../store/negotiations.js'
import { runNegotiationTurn } from '../services/negotiationAgent.js'

const router = Router()

// Meta webhook verification handshake
router.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

// Incoming messages from Meta
router.post('/', (req: Request, res: Response) => {
  const body = req.body

  if (body.object !== 'whatsapp_business_account') {
    res.sendStatus(404)
    return
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue

      for (const message of change.value?.messages ?? []) {
        if (message.type !== 'text') continue

        const from: string = message.from
        const text: string = message.text.body

        const negotiation = negotiationStore.getByPhone(from)
        if (!negotiation) continue

        // Ignore if already concluded
        if (negotiation.status === 'done' || negotiation.status === 'failed') continue

        negotiationStore.appendMessage(negotiation.id, {
          role: 'supplier',
          text,
          timestamp: new Date().toISOString(),
        })

        negotiationStore.update(negotiation.id, { status: 'negotiating' })

        // Fire agentic turn — do NOT await, return 200 to Meta immediately
        runNegotiationTurn(negotiation.id).catch(err =>
          console.error('[webhook] negotiation turn error:', err)
        )
      }
    }
  }

  res.sendStatus(200)
})

export default router
