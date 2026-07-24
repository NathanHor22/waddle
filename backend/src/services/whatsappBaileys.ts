import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type proto,
} from '@whiskeysockets/baileys'
import { EventEmitter } from 'node:events'
import P from 'pino'
import QRCode from 'qrcode'
import type { WhatsAppConnectionStatus } from '../types.js'
import { usePostgresAuthState, clearWhatsAppAuth } from '../db/queries/whatsappAuth.js'

// Silence Baileys' internal pino logger — we surface only what matters
const silentLogger = P({ level: 'silent' })

// Inbound handler carries the companyId, so a supplier reply is attributed to
// the tenant whose session received it — no ambiguity when two companies talk
// to the same supplier number.
type InboundHandler = (companyId: string, phone: string, text: string, messageKey: proto.IMessageKey) => void

// Reconnect backoff (jittered exponential) — avoids a thundering-herd of
// simultaneous reconnects after a restart or network blip.
const RECONNECT_BASE_MS = 2_000
const RECONNECT_MAX_MS = 60_000

// Idle management — a session with no traffic for IDLE_TTL_MS and no active
// negotiation is put to sleep (socket closed, creds kept) to free memory.
const IDLE_TTL_MS = 30 * 60 * 1_000 // 30 min
const IDLE_SWEEP_MS = 5 * 60 * 1_000 // check every 5 min

/**
 * One WhatsApp link for one company. Wraps a single Baileys socket with its own
 * Postgres-backed auth state, so each tenant links its own number independently.
 */
class WhatsAppSession extends EventEmitter {
  readonly companyId: string
  lastActivityAt = Date.now()

  private sock: WASocket | null = null
  private status: WhatsAppConnectionStatus = 'disconnected'
  private qrDataUrl: string | null = null
  private connectedNumber: string | null = null
  private connectedAt: string | null = null
  private reconnecting = false
  private reconnectAttempts = 0
  private intentionalClose = false        // set by sleep()/disconnect() to suppress auto-reconnect
  private generation = 0                   // bumped each initialize() so stale handlers self-discard

  constructor(companyId: string) {
    super()
    this.companyId = companyId
  }

  touch(): void { this.lastActivityAt = Date.now() }
  isConnected(): boolean { return this.status === 'connected' }
  getStatus(): WhatsAppConnectionStatus { return this.status }
  getQR(): string | null { return this.qrDataUrl }
  getInfo(): { status: WhatsAppConnectionStatus; phone: string | null; since: string | null } {
    return { status: this.status, phone: this.connectedNumber, since: this.connectedAt }
  }

  async initialize(): Promise<void> {
    if (this.reconnecting) return
    this.reconnecting = true
    this.intentionalClose = false
    this.status = 'connecting'
    this.sock = null
    const gen = ++this.generation

    try {
      const { state, saveCreds } = await usePostgresAuthState(this.companyId)

      // fetchLatestBaileysVersion() calls GitHub — fall back to bundled version if it fails
      const versionResult = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))

      this.sock = makeWASocket({
        ...(versionResult.version ? { version: versionResult.version } : {}),
        auth: state,
        logger: silentLogger,
        printQRInTerminal: false,
        browser: ['Waddle', 'Desktop', '1.0.0'],
        markOnlineOnConnect: false,
      })

      this.sock.ev.on('creds.update', saveCreds)

      this.sock.ev.on('connection.update', async (update) => {
        if (gen !== this.generation) return // superseded by a newer initialize()
        const { connection, lastDisconnect, qr } = update

        if (qr) {
          this.qrDataUrl = await QRCode.toDataURL(qr)
          this.status = 'qr_ready'
          this.emit('qr', this.qrDataUrl)
        }

        if (connection === 'open') {
          this.status = 'connected'
          this.qrDataUrl = null
          this.reconnecting = false
          this.reconnectAttempts = 0
          // sock.user.id looks like "60123456789:12@s.whatsapp.net" — keep the digits
          this.connectedNumber = this.sock?.user?.id?.split(':')[0]?.replace(/\D/g, '') ?? null
          this.connectedAt = new Date().toISOString()
          this.touch()
          console.log(`[whatsapp:${this.companyId}] connected`)
          this.emit('connected')
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })
            ?.output?.statusCode
          const loggedOut = statusCode === DisconnectReason.loggedOut

          this.status = 'disconnected'
          this.reconnecting = false
          this.connectedNumber = null
          this.connectedAt = null
          this.emit('disconnected', loggedOut)
          console.log(`[whatsapp:${this.companyId}] disconnected — loggedOut=${loggedOut}`)

          if (loggedOut) {
            // Stale credentials — wipe them so the next link starts fresh
            await clearWhatsAppAuth(this.companyId).catch(() => {})
            this.emit('logged_out')
            return
          }
          if (this.intentionalClose) return // idle sleep / manual disconnect — do not reconnect

          // Jittered exponential backoff before retrying
          const attempt = this.reconnectAttempts++
          const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS) + Math.floor(Math.random() * 1_000)
          await new Promise(r => setTimeout(r, delay))
          if (gen !== this.generation) return
          await this.initialize()
        }
      })

      this.sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (gen !== this.generation) return
        if (type !== 'notify') return

        for (const msg of messages) {
          if (msg.key.fromMe) continue
          if (!msg.message) continue

          const jid = msg.key.remoteJid
          if (!jid || !jid.endsWith('@s.whatsapp.net')) continue // groups ignored

          const text      = extractText(msg.message)
          const mediaType = extractMediaType(msg.message)

          if (!text && !mediaType) continue
          if (mediaType === 'sticker') continue

          const effectiveText = text ?? `[${mediaType} received — please respond in text so I can continue the negotiation]`
          const phone = jid.replace('@s.whatsapp.net', '')
          this.touch()
          this.emit('inbound', phone, effectiveText, msg.key)
        }
      })
    } catch (err) {
      this.reconnecting = false
      console.error(`[whatsapp:${this.companyId}] initialization error — retrying:`, err)
      const attempt = this.reconnectAttempts++
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS) + Math.floor(Math.random() * 1_000)
      setTimeout(() => {
        this.initialize().catch(e => console.error(`[whatsapp:${this.companyId}] retry error:`, e))
      }, delay)
    }
  }

  async sendMessage(to: string, text: string): Promise<void> {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('WhatsApp is not connected')
    }
    this.touch()
    await this.sock.sendMessage(normaliseJid(to), { text })
  }

  // Shows "typing..." in the recipient's chat, then resolves — call before sendMessage
  async sendTypingIndicator(to: string, durationMs: number): Promise<void> {
    if (!this.sock || this.status !== 'connected') return
    const jid = normaliseJid(to)
    this.touch()
    await this.sock.sendPresenceUpdate('composing', jid)
    await new Promise(r => setTimeout(r, durationMs))
    await this.sock.sendPresenceUpdate('paused', jid)
  }

  async markAsRead(messageKey: proto.IMessageKey): Promise<void> {
    if (!this.sock || this.status !== 'connected') return
    try {
      await this.sock.readMessages([messageKey])
    } catch {
      // Non-fatal — best effort
    }
  }

  // Links via an 8-char pairing code instead of a QR — the phone-friendly path.
  async requestPairingCode(phone: string): Promise<string> {
    if (this.status === 'connected') throw new Error('WhatsApp is already connected')
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 8) throw new Error('Enter a full phone number including country code')
    if (!this.sock) await this.initialize()
    if (!this.sock) throw new Error('WhatsApp is still starting — try again in a moment')

    const code = await this.sock.requestPairingCode(digits)
    return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
  }

  // Unlinks the device and wipes credentials.
  async disconnect(): Promise<void> {
    this.intentionalClose = true
    this.generation++ // detach current socket's handlers so its 'close' can't reconnect
    if (this.sock) {
      try { await this.sock.logout() } catch { /* best effort */ }
    }
    await clearWhatsAppAuth(this.companyId).catch(() => {})
    this.sock = null
    this.status = 'disconnected'
    this.connectedNumber = null
    this.connectedAt = null
  }

  // Idle sleep: close the socket but KEEP credentials so we can silently
  // reconnect later without a re-scan. Used by the manager's idle sweeper.
  sleep(): void {
    this.intentionalClose = true
    this.generation++ // detach handlers so the resulting 'close' does not reconnect
    try { this.sock?.end(undefined) } catch { /* best effort */ }
    this.sock = null
    this.status = 'disconnected'
    this.qrDataUrl = null
  }
}

/**
 * Owns every company's WhatsApp session. O(1) lookup by companyId, lazy creation,
 * and an idle sweeper so concurrent sockets stay far below total customers.
 */
class WhatsAppManager {
  private sessions = new Map<string, WhatsAppSession>()
  private inboundHandlers: InboundHandler[] = []
  private idleGuard: (companyId: string) => boolean | Promise<boolean> = () => false

  constructor() {
    const sweeper = setInterval(
      () => { this.sweepIdle().catch(e => console.error('[whatsapp] idle sweep error:', e)) },
      IDLE_SWEEP_MS,
    )
    sweeper.unref?.() // don't keep the process alive for the sweeper alone
  }

  onMessage(handler: InboundHandler): void { this.inboundHandlers.push(handler) }

  // A company is "busy" (keep its socket alive despite idleness) when this returns
  // true — wired to active negotiations so we never miss a pending supplier reply.
  setIdleGuard(fn: (companyId: string) => boolean | Promise<boolean>): void { this.idleGuard = fn }

  // O(1) lookup; lazily creates and starts a session the first time a company needs one.
  ensure(companyId: string): WhatsAppSession {
    let session = this.sessions.get(companyId)
    if (!session) {
      session = new WhatsAppSession(companyId)
      session.on('inbound', (phone: string, text: string, key: proto.IMessageKey) => {
        for (const h of this.inboundHandlers) {
          try { h(companyId, phone, text, key) } catch (e) { console.error('[whatsapp] inbound handler error:', e) }
        }
      })
      this.sessions.set(companyId, session)
      session.initialize().catch(e => console.error(`[whatsapp:${companyId}] initialize error:`, e))
    }
    session.touch()
    return session
  }

  // Waits until the company's session is connected — for outbound sends.
  private async ensureConnected(companyId: string, timeoutMs = 15_000): Promise<WhatsAppSession> {
    const session = this.ensure(companyId)
    if (session.isConnected()) return session
    await new Promise<void>((resolve, reject) => {
      const onConnected = () => { clearTimeout(timer); resolve() }
      const timer = setTimeout(() => {
        session.off('connected', onConnected)
        reject(new Error('WhatsApp is not connected for this company'))
      }, timeoutMs)
      session.once('connected', onConnected)
    })
    return session
  }

  // ── Company-scoped API ──────────────────────────────────────────────────────

  getInfo(companyId: string): { status: WhatsAppConnectionStatus; phone: string | null; since: string | null } {
    return this.ensure(companyId).getInfo()
  }

  getQR(companyId: string): string | null {
    return this.sessions.get(companyId)?.getQR() ?? null
  }

  getStatus(companyId: string): WhatsAppConnectionStatus {
    return this.sessions.get(companyId)?.getStatus() ?? 'disconnected'
  }

  async requestPairingCode(companyId: string, phone: string): Promise<string> {
    return this.ensure(companyId).requestPairingCode(phone)
  }

  async sendMessage(companyId: string | undefined, to: string, text: string): Promise<void> {
    if (!companyId) throw new Error('Cannot send WhatsApp: negotiation has no company')
    const session = await this.ensureConnected(companyId)
    await session.sendMessage(to, text)
  }

  async sendTypingIndicator(companyId: string | undefined, to: string, durationMs: number): Promise<void> {
    if (!companyId) return
    const session = this.sessions.get(companyId)
    if (session?.isConnected()) await session.sendTypingIndicator(to, durationMs)
  }

  async disconnect(companyId: string): Promise<void> {
    const session = this.sessions.get(companyId)
    if (session) {
      await session.disconnect()
      this.sessions.delete(companyId)
    }
  }

  // ── Idle management ─────────────────────────────────────────────────────────

  private async sweepIdle(): Promise<void> {
    const now = Date.now()
    for (const [companyId, session] of this.sessions) {
      if (now - session.lastActivityAt < IDLE_TTL_MS) continue
      if (await this.idleGuard(companyId)) continue // company has active work — keep alive
      console.log(`[whatsapp:${companyId}] idle for >${IDLE_TTL_MS / 60_000}min — sleeping socket`)
      session.sleep()
      this.sessions.delete(companyId)
    }
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function normaliseJid(phone: string): string {
  return phone.replace(/\D/g, '') + '@s.whatsapp.net'
}

function extractText(message: proto.IMessage): string | null {
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    null
  )
}

function extractMediaType(message: proto.IMessage): string | null {
  if (message.imageMessage)    return 'image'
  if (message.documentMessage) return 'document'
  if (message.audioMessage)    return 'voice note'
  if (message.videoMessage)    return 'video'
  if (message.stickerMessage)  return 'sticker'
  return null
}

export const whatsappManager = new WhatsAppManager()
