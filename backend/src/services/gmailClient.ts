import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { getEmailAccount } from '../db/queries/emailAccounts.js'

// Read RFQ threads + send replies as the user. Both are restricted scopes
// (Google verification needed for public launch; fine for testing-mode users).
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
]

function normaliseUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`
}
const BACKEND_URL = normaliseUrl(process.env.BACKEND_URL ?? 'http://localhost:3001')
const REDIRECT_URI = `${BACKEND_URL}/api/email/connect/callback`

// A bare OAuth2 client used to run the consent handshake.
function oauthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    REDIRECT_URI,
  )
}

// Consent URL for the "Connect email" button. `state` carries the companyId so
// the callback knows which tenant to attach the mailbox to. access_type=offline
// + prompt=consent guarantee a refresh_token so we can act while the user is away.
export function getConsentUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  })
}

// Exchanges the OAuth code for a refresh token and reads the connected address.
export async function exchangeCode(code: string): Promise<{ refreshToken: string; emailAddress: string }> {
  const client = oauthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token — reconnect and grant offline access')
  }
  client.setCredentials(tokens)
  const gmail = google.gmail({ version: 'v1', auth: client })
  const profile = await gmail.users.getProfile({ userId: 'me' })
  const emailAddress = profile.data.emailAddress
  if (!emailAddress) throw new Error('Could not read the connected email address')
  return { refreshToken: tokens.refresh_token, emailAddress }
}

// Authed Gmail client for a company, rebuilt from the stored refresh token.
// google-auth-library refreshes the short-lived access token automatically.
async function gmailForCompany(companyId: string) {
  const account = await getEmailAccount(companyId)
  if (!account) throw new Error('No email account connected for this company')
  const client = oauthClient()
  client.setCredentials({ refresh_token: account.refreshToken })
  return { gmail: google.gmail({ version: 'v1', auth: client }), address: account.emailAddress }
}

// Threads involving a given supplier address — the scoped, RFQ-relevant slice of
// the inbox (never the whole mailbox).
export async function listThreadsWithSupplier(
  companyId: string,
  supplierEmail: string,
): Promise<Array<{ id: string; snippet: string; historyId: string }>> {
  const { gmail } = await gmailForCompany(companyId)
  const res = await gmail.users.threads.list({
    userId: 'me',
    q: `from:${supplierEmail} OR to:${supplierEmail}`,
    maxResults: 20,
  })
  return (res.data.threads ?? []).map((t) => ({
    id: t.id ?? '',
    snippet: t.snippet ?? '',
    historyId: t.historyId ?? '',
  }))
}

// Sends a reply as the user. When threadId + inReplyTo are supplied, Gmail keeps
// it in the same conversation the supplier will see.
export async function sendAsUser(params: {
  companyId: string
  to: string
  subject: string
  body: string
  threadId?: string
  inReplyToMessageId?: string
}): Promise<{ id: string; threadId: string }> {
  const { gmail, address } = await gmailForCompany(params.companyId)

  const headers = [
    `From: ${address}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
  ]
  if (params.inReplyToMessageId) {
    headers.push(`In-Reply-To: ${params.inReplyToMessageId}`)
    headers.push(`References: ${params.inReplyToMessageId}`)
  }
  const raw = Buffer.from(`${headers.join('\r\n')}\r\n\r\n${params.body}`)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, ...(params.threadId ? { threadId: params.threadId } : {}) },
  })
  return { id: res.data.id ?? '', threadId: res.data.threadId ?? '' }
}
