import { apiFetch } from './api'

export async function getEmailStatus() {
  const res = await apiFetch('/api/email/status')
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to fetch email status')
  return data
}

// Full-page redirect into Google consent. requireAuth also accepts ?token=, so
// the browser navigation (which can't set an Authorization header) still authenticates.
export function connectEmail() {
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  const token = localStorage.getItem('waddle_token') ?? ''
  window.location.href = `${base}/api/email/connect?token=${encodeURIComponent(token)}`
}

export async function disconnectEmail() {
  const res = await apiFetch('/api/email/disconnect', { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Could not disconnect')
  return data
}

export async function previewEmail({ supplierName, supplierEmail, product, quantity, targetPrice, senderName }) {
  const res = await apiFetch('/api/email/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supplierName, supplierEmail, product, quantity, targetPrice, senderName }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to generate email draft')
  return data
}

export async function sendEmail({ to, subject, body }) {
  const res = await apiFetch('/api/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to send email')
  return data
}
