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

test('the fast path settles specify and plan without their own statuses', async () => {
  // Right-sizing folds specify→plan→tasks, so the run jumps straight to
  // `ready-to-implement`. Waiting for `specified`/`planned` would strand the
  // driver and force the fast path off — the feature the bench must measure.
  const { cell, specDir } = makeCell()
  try {
    writeStatus(specDir, 'ready-to-implement')
    for (const step of ['specify', 'plan', 'tasks']) {
      const res = await waitForSettle(cell, step, 300, 50)
      assert.equal(res.settled, true, `${step} should settle on a folded lifecycle`)
      assert.equal(res.status, 'ready-to-implement')
    }
    assert.equal((await waitForSettle(cell, 'specify', 300, 50)).folded, true)
  } finally {
    rmSync(cell, { recursive: true, force: true })
  }
})

test('implement settles when the pipeline auto-completes past it', async () => {
  // mark-complete is Companion's terminal node, so implement lands on
  // `completed`, never re-settling at `implemented`.
  const { cell, specDir } = makeCell()
  try {
    writeStatus(specDir, 'completed')
    const res = await waitForSettle(cell, 'implement', 300, 50)
    assert.equal(res.settled, true)
    assert.equal(res.status, 'completed')
  } finally {
    rmSync(cell, { recursive: true, force: true })
  }
})

test('an in-flight status never satisfies its own step', async () => {
  const { cell, specDir } = makeCell()
  try {
    writeStatus(specDir, 'implementing')
    assert.equal((await waitForSettle(cell, 'implement', 300, 50)).settled, false)
    // ...but it does satisfy the steps genuinely behind it.
    assert.equal((await waitForSettle(cell, 'tasks', 300, 50)).settled, true)
  } finally {
    rmSync(cell, { recursive: true, force: true })
  }
})

test('an unknown status never settles', async () => {
  const { cell, specDir } = makeCell()
  try {
    writeStatus(specDir, 'small') // the wrong-vocabulary size word, as a status
    assert.equal((await waitForSettle(cell, 'specify', 300, 50)).settled, false)
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
