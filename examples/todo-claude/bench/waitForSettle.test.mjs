// Unit test for waitForSettle — runnable with `node --test` (no AI needed).
//   node --test examples/todo-claude/bench/waitForSettle.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { waitForSettle, SETTLED_STATUS_BY_STEP } from './lib.mjs'

function makeCell() {
  const cell = mkdtempSync(join(tmpdir(), 'bench-settle-'))
  const specDir = join(cell, 'specs', '001-x')
  mkdirSync(specDir, { recursive: true })
  return { cell, specDir }
}

function writeStatus(specDir, status) {
  writeFileSync(
    join(specDir, '.spec-context.json'),
    JSON.stringify({ workflow: 'companion', specName: 'X', currentStep: 'plan', status, history: [] })
  )
}

test('resolves once the step reaches its completed-form status', async () => {
  const { cell, specDir } = makeCell()
  try {
    writeStatus(specDir, 'planning') // in-flight, not yet settled
    // Flip to settled shortly after the poll loop starts.
    setTimeout(() => writeStatus(specDir, 'planned'), 150)
    const res = await waitForSettle(cell, 'plan', 5000, 50)
    assert.equal(res.settled, true)
    assert.equal(res.status, 'planned')
  } finally {
    rmSync(cell, { recursive: true, force: true })
  }
})

test('returns settled:false on timeout when the status never advances', async () => {
  const { cell, specDir } = makeCell()
  try {
    writeStatus(specDir, 'planning') // stays in-flight forever
    const res = await waitForSettle(cell, 'plan', 300, 50)
    assert.equal(res.settled, false)
    assert.equal(res.status, 'planning')
  } finally {
    rmSync(cell, { recursive: true, force: true })
  }
})

test('times out cleanly when no .spec-context.json exists yet', async () => {
  const cell = mkdtempSync(join(tmpdir(), 'bench-settle-'))
  try {
    const res = await waitForSettle(cell, 'specify', 300, 50)
    assert.equal(res.settled, false)
    assert.equal(res.status, null)
  } finally {
    rmSync(cell, { recursive: true, force: true })
  }
})

test('SETTLED_STATUS_BY_STEP covers every measured step', () => {
  assert.deepEqual(Object.keys(SETTLED_STATUS_BY_STEP).sort(), ['implement', 'plan', 'specify', 'tasks'])
})

test('rejects an unknown step', async () => {
  await assert.rejects(() => waitForSettle('/tmp/nope', 'bogus', 100, 50), /unknown step/)
})
