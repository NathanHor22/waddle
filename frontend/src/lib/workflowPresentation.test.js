import test from 'node:test'
import assert from 'node:assert/strict'
import { getStatusTone, getWorkflowProgress, WORKFLOW_LABELS } from './workflowPresentation.js'

test('maps workflow status to a stable progress position', () => {
  assert.deepEqual(getWorkflowProgress('draft'), { index: 0, step: 1, total: 7 })
  assert.deepEqual(getWorkflowProgress('awaiting_approval'), { index: 4, step: 5, total: 7 })
  assert.deepEqual(getWorkflowProgress('closed'), { index: 6, step: 7, total: 7 })
})

test('unknown workflow statuses fail safe to the first step', () => {
  assert.deepEqual(getWorkflowProgress('unexpected'), { index: 0, step: 1, total: 7 })
  assert.equal(WORKFLOW_LABELS.unexpected, undefined)
})

test('assigns decision-oriented status tones', () => {
  assert.equal(getStatusTone('awaiting_approval'), 'warning')
  assert.equal(getStatusTone('decided'), 'success')
  assert.equal(getStatusTone('closed'), 'success')
  assert.equal(getStatusTone('draft'), 'neutral')
  assert.equal(getStatusTone('failed'), 'danger')
})
