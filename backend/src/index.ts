import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { runMigrations } from './db/migrate.js'
import { whatsAppService } from './services/whatsappBaileys.js'
import { queueManager } from './services/queueManager.js'
import negotiateRouter from './routes/negotiate.js'
import whatsappRouter from './routes/whatsapp.js'
import sessionsRouter from './routes/sessions.js'

const app = express()
const PORT = Number(process.env.PORT ?? 3001)

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/sessions', sessionsRouter)
app.use('/api/negotiate', negotiateRouter)
app.use('/api/whatsapp', whatsappRouter)

async function start(): Promise<void> {
  // 1. Run any pending DB migrations before anything else
  await runMigrations()
  console.log('[db] migrations up to date')

  // 2. Start HTTP server
  app.listen(PORT, () => {
    console.log(`[server] Waddle backend → http://localhost:${PORT}`)
  })

  // 3. Initialise WhatsApp — route incoming messages to the queue manager
  whatsAppService.onMessage((phone, text) => {
    queueManager.onIncomingReply(phone, text, new Date().toISOString()).catch(err => {
      console.error('[server] incoming message error:', err)
    })
  })

  await whatsAppService.initialize()
  console.log('[whatsapp] initialising...')

  // 4. Recover any negotiations that were mid-flight before the last restart
  await queueManager.recover()
}

start().catch(err => {
  console.error('[server] fatal startup error:', err)
  process.exit(1)
})
