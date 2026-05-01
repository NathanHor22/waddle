import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import negotiateRouter from './routes/negotiate.js'
import webhookRouter from './routes/webhook.js'

const app = express()
const PORT = Number(process.env.PORT ?? 3001)

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/negotiate', negotiateRouter)
app.use('/webhook/whatsapp', webhookRouter)

app.listen(PORT, () => {
  console.log(`Waddle backend → http://localhost:${PORT}`)
})
