// Builds a parameterised SET clause from a column→value map, skipping any
// `undefined` value so callers can pass a flat object of optional fields.
// Always bumps `updated_at`. Returns the clause plus the ordered values, ready
// to append the WHERE-clause params after.
export function buildUpdate(columns: Record<string, unknown>): { clause: string; values: unknown[] } {
  const sets: string[] = ['updated_at = NOW()']
  const values: unknown[] = []

  for (const [column, value] of Object.entries(columns)) {
    if (value === undefined) continue
    values.push(value)
    sets.push(`${column} = $${values.length}`)
  }

  return { clause: sets.join(', '), values }
}
