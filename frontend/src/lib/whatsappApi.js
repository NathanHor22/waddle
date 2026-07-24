import { apiFetch } from './api'

export async function getWhatsAppStatus() {
  const res = await apiFetch('/api/whatsapp/status')
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to fetch WhatsApp status')
  return data
}

export async function getWhatsAppQR() {
  const res = await apiFetch('/api/whatsapp/qr')
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'No QR available')
  return data
}

export async function requestWhatsAppPairingCode(phone) {
  const res = await apiFetch('/api/whatsapp/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Could not request pairing code')
  return data
}

export async function disconnectWhatsApp() {
  const res = await apiFetch('/api/whatsapp/disconnect', { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Could not disconnect')
  return data
}
