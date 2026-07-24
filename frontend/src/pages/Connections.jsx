import { useState, useEffect } from 'react'
import { Mail, Smartphone, QrCode, Hash, ShieldCheck, Loader2, Link2, Unlink, ArrowRight, AlertCircle } from 'lucide-react'
import { useWhatsAppStatus } from '../hooks/useWhatsAppStatus.js'
import { requestWhatsAppPairingCode, disconnectWhatsApp } from '../lib/whatsappApi.js'
import { getEmailStatus, connectEmail, disconnectEmail } from '../lib/emailApi.js'
import './Connections.css'

// Connections hub — the permanent home for the channels Waddle uses to reach
// suppliers. WhatsApp is live; Email is the V1 slot, shown as coming soon.
export function Connections() {
  const wa = useWhatsAppStatus()

  return (
    <div className="conn">
      <div className="page-heading">
        <div>
          <p className="page-kicker">Workspace</p>
          <h1>Connections</h1>
          <p className="page-summary">Link the channels Waddle uses to reach your suppliers. Everything Waddle sends and tracks flows through here.</p>
        </div>
      </div>

      <div className="conn-grid">
        <WhatsAppCard wa={wa} />
        <EmailCard />
      </div>
    </div>
  )
}

/* ─────────────────────────── WhatsApp ─────────────────────────── */

function WhatsAppCard({ wa }) {
  const { status, isConnected, qr, phone, since, refresh } = wa
  const [open, setOpen] = useState(false)      // connect panel revealed
  const [tab, setTab] = useState('qr')          // 'qr' | 'code'

  const chip = isConnected
    ? { tone: 'live', label: 'Connected' }
    : status === 'qr_ready' || (open && status !== 'disconnected')
      ? { tone: 'pending', label: 'Waiting to link' }
      : { tone: 'off', label: 'Not connected' }

  return (
    <section className={`conn-card conn-card--wa ${isConnected ? 'is-live' : ''}`}>
      <div className="conn-card__glow" aria-hidden="true" />

      <header className="conn-card__head">
        <div className="conn-card__brand">
          <span className="conn-brand-tile conn-brand-tile--wa"><WhatsAppGlyph /></span>
          <div>
            <h2>WhatsApp</h2>
            <p>Supplier messaging &amp; negotiation</p>
          </div>
        </div>
        <span className={`conn-chip conn-chip--${chip.tone}`}>
          <span className="conn-chip__dot" />{chip.label}
        </span>
      </header>

      {isConnected ? (
        <ConnectedBody phone={phone} since={since} onDisconnected={() => { setOpen(false); refresh() }} />
      ) : open ? (
        <ConnectBody status={status} qr={qr} tab={tab} setTab={setTab} onCancel={() => setOpen(false)} />
      ) : (
        <IdleBody onConnect={() => { setOpen(true); setTab('qr') }} />
      )}
    </section>
  )
}

// Resting state: the "Waddle ⇢ your phone" device-link visual + one CTA.
function IdleBody({ onConnect }) {
  return (
    <div className="conn-card__body">
      <div className="conn-link-viz" aria-hidden="true">
        <div className="conn-node conn-node--waddle"><Link2 size={20} /></div>
        <div className="conn-link-wire"><span /><span /><span /></div>
        <div className="conn-node conn-node--phone"><Smartphone size={20} /></div>
      </div>

      <p className="conn-lead">
        Link Waddle as a device — exactly like WhatsApp Web. Waddle sends quotes and negotiates
        from your number, and every reply is tracked in your dashboard.
      </p>

      <ul className="conn-assurances">
        <li><ShieldCheck size={14} /> Your number stays yours — unlink anytime</li>
        <li><ShieldCheck size={14} /> Waddle never posts to groups or your contacts</li>
      </ul>

      <button className="primary-button conn-cta" onClick={onConnect}>
        Connect WhatsApp <ArrowRight size={15} />
      </button>
    </div>
  )
}

// Linking state: framed QR scanner + pairing-code tab.
function ConnectBody({ status, qr, tab, setTab, onCancel }) {
  return (
    <div className="conn-card__body">
      <div className="conn-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'qr'} className={`conn-tab ${tab === 'qr' ? 'is-active' : ''}`} onClick={() => setTab('qr')}>
          <QrCode size={15} /> Scan QR
        </button>
        <button role="tab" aria-selected={tab === 'code'} className={`conn-tab ${tab === 'code' ? 'is-active' : ''}`} onClick={() => setTab('code')}>
          <Hash size={15} /> Link with number
        </button>
      </div>

      {tab === 'qr' ? <QrTab status={status} qr={qr} /> : <CodeTab />}

      <button className="conn-textlink" onClick={onCancel}>Cancel</button>
    </div>
  )
}

function QrTab({ status, qr }) {
  const ready = status === 'qr_ready' && qr
  return (
    <div className="conn-connect">
      <div className={`conn-scanner ${ready ? 'is-ready' : ''}`}>
        <span className="conn-scanner__bracket conn-scanner__bracket--tl" />
        <span className="conn-scanner__bracket conn-scanner__bracket--tr" />
        <span className="conn-scanner__bracket conn-scanner__bracket--bl" />
        <span className="conn-scanner__bracket conn-scanner__bracket--br" />
        {ready
          ? <img className="conn-scanner__qr" src={qr} alt="Scan with WhatsApp" />
          : <div className="conn-scanner__pending"><Loader2 className="conn-spin" size={22} /><span>Generating code…</span></div>}
      </div>
      <ol className="conn-steps">
        <li>Open <strong>WhatsApp</strong> on your phone</li>
        <li>Tap <strong>⋮</strong> → <strong>Linked Devices</strong> → <strong>Link a Device</strong></li>
        <li>Point your camera at this code</li>
      </ol>
    </div>
  )
}

function CodeTab() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function getCode() {
    setError(''); setBusy(true)
    try {
      const { code } = await requestWhatsAppPairingCode(phone.trim())
      setCode(code)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="conn-connect">
      {code ? (
        <div className="conn-code">
          <span className="conn-code__label">Enter this code in WhatsApp</span>
          <div className="conn-code__boxes">
            {code.split('').map((ch, i) =>
              ch === '-'
                ? <span key={i} className="conn-code__sep">–</span>
                : <span key={i} className="conn-code__box">{ch}</span>,
            )}
          </div>
          <ol className="conn-steps">
            <li>Open <strong>WhatsApp</strong> → <strong>Linked Devices</strong></li>
            <li>Tap <strong>Link a Device</strong> → <strong>Link with phone number instead</strong></li>
            <li>Type the code above</li>
          </ol>
        </div>
      ) : (
        <div className="conn-phone">
          <label className="conn-phone__label">Your WhatsApp number</label>
          <input
            className="conn-phone__input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 60123456789 (with country code)"
            inputMode="tel"
            onKeyDown={(e) => { if (e.key === 'Enter' && phone.trim()) getCode() }}
          />
          {error && <p className="conn-phone__error">{error}</p>}
          <button className="primary-button conn-cta" disabled={!phone.trim() || busy} onClick={getCode}>
            {busy ? <><Loader2 className="conn-spin" size={15} /> Requesting…</> : <>Get pairing code <ArrowRight size={15} /></>}
          </button>
        </div>
      )}
    </div>
  )
}

// Live state.
function ConnectedBody({ phone, since, onDisconnected }) {
  const [busy, setBusy] = useState(false)

  async function disconnect() {
    setBusy(true)
    try { await disconnectWhatsApp() } catch { /* status will resync */ }
    finally { setBusy(false); onDisconnected() }
  }

  return (
    <div className="conn-card__body">
      <div className="conn-live">
        <div className="conn-live__pulse"><span /><span /><Smartphone size={22} /></div>
        <div className="conn-live__meta">
          <strong>{phone ? `+${phone}` : 'Linked device'}</strong>
          <span>Live · linked {formatSince(since)}</span>
        </div>
      </div>

      <div className="conn-facts">
        <div><span>Channel</span><strong>WhatsApp Web link</strong></div>
        <div><span>Status</span><strong className="conn-facts__ok">Sending &amp; receiving</strong></div>
      </div>

      <div className="conn-live__actions">
        <button className="secondary-button" onClick={disconnect} disabled={busy}>
          {busy ? <><Loader2 className="conn-spin" size={14} /> Unlinking…</> : <><Unlink size={14} /> Disconnect</>}
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────── Email (Gmail) ─────────────────────────── */

function EmailCard() {
  const [state, setState] = useState({ loading: true, connected: false, address: null, since: null })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null) // 'connected' | 'error' from OAuth redirect

  async function refresh() {
    try {
      const s = await getEmailStatus()
      setState({ loading: false, connected: s.connected, address: s.address, since: s.since })
    } catch {
      setState((p) => ({ ...p, loading: false }))
    }
  }

  useEffect(() => {
    // Surface the OAuth round-trip result, then clean the URL
    const params = new URLSearchParams(window.location.search)
    const result = params.get('email')
    if (result) {
      setNotice(result)
      params.delete('email')
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`)
    }
    refresh()
  }, [])

  const connected = state.connected
  const chip = connected
    ? { tone: 'live', label: 'Connected' }
    : { tone: 'off', label: 'Not connected' }

  async function disconnect() {
    setBusy(true)
    try { await disconnectEmail() } catch { /* status will resync */ }
    finally { setBusy(false); refresh() }
  }

  return (
    <section className={`conn-card conn-card--mail ${connected ? 'is-live' : ''}`}>
      <header className="conn-card__head">
        <div className="conn-card__brand">
          <span className="conn-brand-tile conn-brand-tile--mail"><Mail size={20} /></span>
          <div>
            <h2>Email</h2>
            <p>Reply &amp; track supplier threads</p>
          </div>
        </div>
        <span className={`conn-chip conn-chip--${chip.tone}`}><span className="conn-chip__dot" />{chip.label}</span>
      </header>

      <div className="conn-card__body">
        {notice === 'error' && (
          <div className="conn-inline-alert"><AlertCircle size={14} /> Couldn't connect Gmail — please try again.</div>
        )}

        {state.loading ? (
          <div className="conn-scanner__pending" style={{ padding: '20px 0' }}><Loader2 className="conn-spin" size={20} /><span>Checking…</span></div>
        ) : connected ? (
          <>
            <div className="conn-live">
              <div className="conn-live__pulse conn-live__pulse--mail"><span /><span /><Mail size={20} /></div>
              <div className="conn-live__meta">
                <strong>{state.address}</strong>
                <span className="conn-live__meta--mail">Connected · replies send from your inbox</span>
              </div>
            </div>
            <ul className="conn-assurances">
              <li><ShieldCheck size={14} /> Waddle reads only threads with your suppliers — never your whole inbox</li>
              <li><ShieldCheck size={14} /> Every reply is drafted for your approval before it sends</li>
            </ul>
            <div className="conn-live__actions">
              <button className="secondary-button" onClick={disconnect} disabled={busy}>
                {busy ? <><Loader2 className="conn-spin" size={14} /> Disconnecting…</> : <><Unlink size={14} /> Disconnect</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="conn-lead">
              Connect Gmail and Waddle drafts replies to your RFQ threads for one-click approval —
              sent from your own inbox, with every supplier's progress tracked right here.
            </p>
            <ul className="conn-assurances">
              <li><ShieldCheck size={14} /> Scoped to supplier threads only — not your whole inbox</li>
              <li><ShieldCheck size={14} /> Drafts always wait for your approval</li>
            </ul>
            <button className="primary-button conn-cta" onClick={connectEmail}>
              Connect Gmail <ArrowRight size={15} />
            </button>
          </>
        )}
      </div>
    </section>
  )
}

/* ─────────────────────────── helpers ─────────────────────────── */

function formatSince(iso) {
  if (!iso) return 'just now'
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
  return `on ${new Date(iso).toLocaleDateString()}`
}

function WhatsAppGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}
