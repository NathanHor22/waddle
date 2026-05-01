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
