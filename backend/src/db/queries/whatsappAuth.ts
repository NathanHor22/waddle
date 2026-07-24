import {
  initAuthCreds,
  BufferJSON,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys'
import { pool } from '../client.js'

// Baileys values can contain Buffers; BufferJSON round-trips them through JSON.
const encode = (value: unknown): string => JSON.stringify(value, BufferJSON.replacer)
const decode = (text: string): unknown => JSON.parse(text, BufferJSON.reviver)

async function readValue(companyId: string, key: string): Promise<unknown | null> {
  const { rows } = await pool.query(
    'SELECT data_value FROM whatsapp_auth WHERE company_id = $1 AND data_key = $2',
    [companyId, key],
  )
  return rows[0] ? decode(rows[0].data_value as string) : null
}

async function writeValue(companyId: string, key: string, value: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO whatsapp_auth (company_id, data_key, data_value, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (company_id, data_key)
     DO UPDATE SET data_value = EXCLUDED.data_value, updated_at = NOW()`,
    [companyId, key, encode(value)],
  )
}

async function deleteValue(companyId: string, key: string): Promise<void> {
  await pool.query('DELETE FROM whatsapp_auth WHERE company_id = $1 AND data_key = $2', [companyId, key])
}

// A Baileys AuthenticationState backed by Postgres, scoped to one company.
// Drop-in replacement for useMultiFileAuthState — durable across restarts and
// portable across processes (the state lives in shared storage, not local disk).
export async function usePostgresAuthState(
  companyId: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const creds = ((await readValue(companyId, 'creds')) as AuthenticationCreds | null) ?? initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          // One round-trip for every requested key of this type
          const wanted = ids.map((id) => `${type}-${id}`)
          const { rows } = await pool.query(
            'SELECT data_key, data_value FROM whatsapp_auth WHERE company_id = $1 AND data_key = ANY($2)',
            [companyId, wanted],
          )
          const byKey = new Map<string, string>(
            rows.map((r: { data_key: string; data_value: string }) => [r.data_key, r.data_value]),
          )

          const data: Record<string, unknown> = {}
          for (const id of ids) {
            const raw = byKey.get(`${type}-${id}`)
            if (!raw) continue
            let value = decode(raw)
            // App-state sync keys must be rehydrated into their proto message
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value as object)
            }
            data[id] = value
          }
          return data as { [id: string]: SignalDataTypeMap[typeof type] }
        },
        set: async (data) => {
          const tasks: Promise<void>[] = []
          for (const category in data) {
            const bucket = data[category as keyof SignalDataTypeMap]
            if (!bucket) continue
            for (const id in bucket) {
              const value = bucket[id]
              const key = `${category}-${id}`
              tasks.push(value ? writeValue(companyId, key, value) : deleteValue(companyId, key))
            }
          }
          await Promise.all(tasks)
        },
      },
    },
    // creds mutate in place; persist the latest snapshot on each Baileys signal
    saveCreds: async () => {
      await writeValue(companyId, 'creds', creds)
    },
  }
}

// Wipes a company's WhatsApp auth so the next link starts from a fresh
// QR/pairing surface. Called on logout / loggedOut.
export async function clearWhatsAppAuth(companyId: string): Promise<void> {
  await pool.query('DELETE FROM whatsapp_auth WHERE company_id = $1', [companyId])
}
