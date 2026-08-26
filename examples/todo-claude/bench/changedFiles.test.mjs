// Unit test: the changed-file surface must cover everything resetFolder restores.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { changedSrcFiles, blastRadius, CANONICAL_DIR, CANONICAL_SRC } from './lib.mjs'

function pristineCell() {
  const cell = mkdtempSync(join(tmpdir(), 'bench-changed-'))
  cpSync(CANONICAL_SRC, join(cell, 'src'), { recursive: true })
  cpSync(join(CANONICAL_DIR, 'index.html'), join(cell, 'index.html'))
  return cell
}

test('a pristine cell reports no changes', () => {
  const cell = pristineCell()
  try {
    assert.deepEqual(changedSrcFiles(cell), [])
  } finally { rmSync(cell, { recursive: true, force: true }) }
})

test('an edited index.html is seen as changed', () => {
  const cell = pristineCell()
  try {
    const p = join(cell, 'index.html')
    writeFileSync(p, readFileSync(p, 'utf8').replace('Todo App', 'Task Manager'))
    const changed = changedSrcFiles(cell)
    const html = changed.find((c) => c.path === 'index.html')
    assert.ok(html, 'index.html must appear in the changed set')
    assert.equal(html.status, 'modified')
    assert.match(html.content, /Task Manager/)
  } finally { rmSync(cell, { recursive: true, force: true }) }
})

test('index.html is in scope for easy and out of scope for medium', () => {
  const changed = [{ path: 'index.html', status: 'modified', content: '' }]
  assert.deepEqual(blastRadius('easy', changed).outOfScope, [])
  assert.deepEqual(blastRadius('medium', changed).outOfScope, ['index.html'])
})
