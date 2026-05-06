const BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001'

export async function startNegotiation({ supplier, phone, product, quantity, targetPrice }) {
  const res = await fetch(`${BASE}/api/negotiate/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supplier, phone, product, quantity, targetPrice }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to start negotiation')
  return data
}

export async function getNegotiation(id) {
  const res = await fetch(`${BASE}/api/negotiate/${id}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to fetch negotiation')
  return data
}

export async function getWhatsAppStatus() {
  const res = await fetch(`${BASE}/api/whatsapp/status`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to fetch WhatsApp status')
  return data // { status: 'connected' | 'disconnected' | 'connecting' | 'qr_ready' }
}

export async function getWhatsAppQR() {
  const res = await fetch(`${BASE}/api/whatsapp/qr`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'No QR available')
  return data // { qr: 'data:image/png;base64,...' }
}

// Subscribes to real-time SSE events for a negotiation.
// Returns an unsubscribe function — call it to close the connection.
export function subscribeToNegotiation(id, callbacks) {
  const source = new EventSource(`${BASE}/api/negotiate/${id}/events`)

  source.addEventListener('message', e => callbacks.onMessage?.(JSON.parse(e.data)))
  source.addEventListener('status', e => callbacks.onStatus?.(JSON.parse(e.data)))
  source.addEventListener('activity', e => callbacks.onActivity?.(JSON.parse(e.data)))
  source.addEventListener('typing', e => callbacks.onTyping?.(JSON.parse(e.data)))
  source.addEventListener('extraction', e => callbacks.onExtraction?.(JSON.parse(e.data)))

  source.onerror = () => callbacks.onError?.()

  return () => source.close()
}
