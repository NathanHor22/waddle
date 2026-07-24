import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import passport from 'passport'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
import { runMigrations } from './db/migrate.js'
import { whatsappManager } from './services/whatsappBaileys.js'
import { hasActiveNegotiationForCompany, getCompaniesWithActiveNegotiations } from './db/queries/negotiations.js'
import { queueManager } from './services/queueManager.js'
import negotiateRouter from './routes/negotiate.js'
import whatsappRouter from './routes/whatsapp.js'
import sessionsRouter from './routes/sessions.js'
import emailRouter from './routes/email.js'
import authRouter from './routes/auth.js'
import waddleForMeRouter from './routes/waddleForMe.js'
import approvalsRouter from './routes/approvals.js'
import rfqsRouter from './routes/rfqs.js'
import companiesRouter from './routes/companies.js'
import dashboardRouter from './routes/dashboard.js'

const app = express()
app.set('trust proxy', 1) // Railway (and other PaaS) terminate TLS at the proxy
const PORT = Number(process.env.PORT ?? 3001)
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist')

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(session({
  secret: process.env.SESSION_SECRET ?? 'waddle-session-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 5 * 60 * 1000 }, // 5 min — only for OAuth handshake
}))
app.use(passport.initialize())
app.use(passport.session())

app.use('/api/auth', authRouter)
app.use('/api/sessions', sessionsRouter)
app.use('/api/email', emailRouter)
app.use('/api/negotiate', negotiateRouter)
app.use('/api/whatsapp', whatsappRouter)
app.use('/api/waddle-for-me', waddleForMeRouter)
app.use('/api/approvals', approvalsRouter)
app.use('/api/rfqs', rfqsRouter)
app.use('/api/companies', companiesRouter)
app.use('/api/dashboard', dashboardRouter)

app.use(express.static(FRONTEND_DIST))
app.get('*', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
})

async function start(): Promise<void> {
  // 1. Run any pending DB migrations before anything else
  await runMigrations()
  console.log('[db] migrations up to date')

  // 2. Start HTTP server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Waddle backend → http://0.0.0.0:${PORT}`)
  })

  // 3. Wire WhatsApp — inbound replies route to the queue, scoped by the tenant
  //    whose session received them. Non-fatal so a Baileys error never takes the
  //    HTTP server down. Sessions are created lazily per company, not at boot.
  whatsappManager.onMessage((companyId, phone, text) => {
    queueManager.onIncomingReply(companyId, phone, text, new Date().toISOString()).catch(err => {
      console.error('[server] incoming message error:', err)
    })
  })

  // Keep a company's socket alive while it has in-flight negotiations, so the
  // idle sweeper never sleeps a session that's awaiting a supplier reply.
  whatsappManager.setIdleGuard(companyId => hasActiveNegotiationForCompany(companyId))

  // 4. Recover any negotiations that were mid-flight before the last restart
  await queueManager.recover()

  // 5. Warm the sockets for companies with active negotiations, so ongoing
  //    conversations keep receiving replies even with no one viewing the app.
  try {
    const companyIds = await getCompaniesWithActiveNegotiations()
    for (const companyId of companyIds) whatsappManager.ensure(companyId)
    if (companyIds.length) console.log(`[whatsapp] warmed ${companyIds.length} session(s) with active work`)
  } catch (err) {
    console.error('[whatsapp] warm-up error (non-fatal):', err)
  }
}

start().catch(err => {
  console.error('[server] fatal startup error:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandled rejection:', reason)
})

process.on('uncaughtException', (err) => {
  console.error('[process] uncaught exception:', err)
})
