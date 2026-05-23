function getToken() {
  return localStorage.getItem('waddle_token')
}

export async function apiFetch(url, options = {}) {
  const token = getToken()
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  return fetch(url, { ...options, headers })
}
