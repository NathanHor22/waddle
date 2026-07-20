import test from 'node:test'
import assert from 'node:assert/strict'
import { assertRfqTransition, dedupeSuppliers, isValidRfqTransition } from './rfqRules.js'

test('allows the normal RFQ lifecycle', () => {
  const lifecycle = [
    ['draft', 'out_for_quotes'],
    ['out_for_quotes', 'quotes_in'],
    ['quotes_in', 'negotiating'],
    ['negotiating', 'awaiting_approval'],
    ['awaiting_approval', 'decided'],
    ['decided', 'closed'],
  ] as const

  for (const [current, next] of lifecycle) {
    assert.equal(isValidRfqTransition(current, next), true)
    assert.doesNotThrow(() => assertRfqTransition(current, next))
  }
})

test('rejects backwards and unsafe RFQ transitions', () => {
  const invalid = [
    ['draft', 'decided'],
    ['closed', 'draft'],
    ['closed', 'out_for_quotes'],
    ['decided', 'negotiating'],
  ] as const

  for (const [current, next] of invalid) {
    assert.equal(isValidRfqTransition(current, next), false)
    assert.throws(() => assertRfqTransition(current, next), /Cannot move RFQ/)
  }
})

test('deduplicates supplier contacts by normalised phone number', () => {
  const result = dedupeSuppliers([
    { supplier: 'Alpha Chemicals', phone: '+60 12-345 6789' },
    { supplier: 'Alpha duplicate', phone: '60123456789' },
    { supplier: 'No phone', phone: '---' },
    { supplier: 'Beta Medical', phone: '+65 8123 4567' },
  ])

  assert.deepEqual(result.map((supplier) => supplier.supplier), ['Alpha Chemicals', 'Beta Medical'])
})
