import { pool } from '../client.js'

export interface EmailAccount {
  companyId: string
  provider: string
  emailAddress: string
  refreshToken: string
  historyId: string | null
  connectedBy: string | null
  connectedAt: string
}

function rowToAccount(row: Record<string, unknown>): EmailAccount {
  return {
    companyId: row.company_id as string,
    provider: row.provider as string,
    emailAddress: row.email_address as string,
    refreshToken: row.refresh_token as string,
    historyId: (row.history_id as string | null) ?? null,
    connectedBy: (row.connected_by as string | null) ?? null,
    connectedAt: (row.connected_at as Date).toISOString(),
  }
}

// Connect (or reconnect) a company's mailbox. A reconnect keeps the row but
// refreshes the token/address — Google only returns a refresh_token on first
// consent, so callers should skip overwriting it with an empty value.
export async function upsertEmailAccount(params: {
  companyId: string
  emailAddress: string
  refreshToken: string
  connectedBy?: string
}): Promise<EmailAccount> {
  const { rows } = await pool.query(
    `INSERT INTO email_accounts (company_id, email_address, refresh_token, connected_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (company_id) DO UPDATE SET
       email_address = EXCLUDED.email_address,
       refresh_token = COALESCE(NULLIF(EXCLUDED.refresh_token, ''), email_accounts.refresh_token),
       connected_by  = EXCLUDED.connected_by,
       updated_at    = NOW()
     RETURNING *`,
    [params.companyId, params.emailAddress, params.refreshToken, params.connectedBy ?? null],
  )
  return rowToAccount(rows[0])
}

export async function getEmailAccount(companyId: string): Promise<EmailAccount | null> {
  const { rows } = await pool.query('SELECT * FROM email_accounts WHERE company_id = $1', [companyId])
  return rows[0] ? rowToAccount(rows[0]) : null
}

export async function updateEmailHistoryId(companyId: string, historyId: string): Promise<void> {
  await pool.query(
    'UPDATE email_accounts SET history_id = $2, updated_at = NOW() WHERE company_id = $1',
    [companyId, historyId],
  )
}

export async function deleteEmailAccount(companyId: string): Promise<void> {
  await pool.query('DELETE FROM email_accounts WHERE company_id = $1', [companyId])
}
