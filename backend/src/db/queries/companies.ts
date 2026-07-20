import { randomUUID } from 'node:crypto'
import { pool } from '../client.js'
import { buildUpdate } from '../buildUpdate.js'
import type { Company, Country } from '../../types.js'

function rowToCompany(row: Record<string, unknown>): Company {
  return {
    id: row.id as string,
    name: row.name as string,
    registrationNo: (row.registration_no as string | null) ?? null,
    country: row.country as Country,
    defaultCurrency: row.default_currency as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  }
}

export async function createCompany(params: {
  name: string
  registrationNo?: string
  country?: Country
  defaultCurrency?: string
}): Promise<Company> {
  const { rows } = await pool.query(
    `INSERT INTO companies (id, name, registration_no, country, default_currency)
     VALUES ($1, $2, $3, COALESCE($4, 'MY'), COALESCE($5, 'MYR'))
     RETURNING *`,
    [randomUUID(), params.name, params.registrationNo ?? null, params.country ?? null, params.defaultCurrency ?? null],
  )
  return rowToCompany(rows[0])
}

export async function getCompany(id: string): Promise<Company | null> {
  const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1', [id])
  return rows[0] ? rowToCompany(rows[0]) : null
}

export async function updateCompany(
  id: string,
  updates: Partial<Pick<Company, 'name' | 'registrationNo' | 'country' | 'defaultCurrency'>>,
): Promise<void> {
  const { clause, values } = buildUpdate({
    name: updates.name,
    registration_no: updates.registrationNo,
    country: updates.country,
    default_currency: updates.defaultCurrency,
  })
  values.push(id)
  await pool.query(`UPDATE companies SET ${clause} WHERE id = $${values.length}`, values)
}
