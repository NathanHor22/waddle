import { apiFetch } from './api'

async function json(resPromise) {
  const res = await resPromise
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data
}

export const getMyCompany = () => json(apiFetch('/api/companies/me'))

export const createCompany = (profile) =>
  json(apiFetch('/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  }))
