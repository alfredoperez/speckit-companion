// Smoke test for the bench-framing strip in sync-templates.mjs — runnable with
// `node --test` (no AI needed).
//   node --test examples/todo-claude/bench/sync-templates.test.mjs
//
// A baked cell must read as a plain app: NOTHING about the bench anywhere a spec
// run could see it. The strip is marker-driven now, so this asserts (a) a baked
// CLAUDE.md has zero `bench` references, and (b) a drifted source (missing marker)
// fails loudly instead of silently leaking the framing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripMarkedRange } from './sync-templates.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SOURCE_CLAUDE = join(__dirname, '..', 'CLAUDE.md')

// Mirror exactly the three strips presentAsCleanApp applies to CLAUDE.md.
function bakeClaude(md) {
  md = stripMarkedRange(md, 'BENCH-PHRASE', { replacement: '' })
  md = stripMarkedRange(md, 'BENCH-VITEST', { replacement: 'Vitest (component + unit tests)' })
  md = stripMarkedRange(md, 'BENCH-SECTION', { replacement: '', trimSurroundingBlankLines: true })
  return md
}

test('a baked cell CLAUDE.md has zero bench references', () => {
  const source = readFileSync(SOURCE_CLAUDE, 'utf8')
  // Sanity: the source is the bench target and DOES mention the bench.
  assert.ok(/bench/i.test(source), 'source CLAUDE.md should contain bench framing to strip')
  const baked = bakeClaude(source)
  const hits = baked.match(/bench/gi) || []
  assert.equal(hits.length, 0, `baked CLAUDE.md still leaks bench framing: ${hits.length} reference(s)`)
})

test('a missing strip marker throws loudly (no silent no-op)', () => {
  const drifted = '# CLAUDE.md\n\nGuidance with no markers at all.\n'
  assert.throws(
    () => stripMarkedRange(drifted, 'BENCH-PHRASE', { replacement: '' }),
    /BENCH-PHRASE.*missing or malformed/s,
    'a drifted source must fail loudly, not silently leak framing',
  )
})

test('strip removes exactly the marked range', () => {
  const md = 'a<!-- X START -->bench junk<!-- X END -->b'
  assert.equal(stripMarkedRange(md, 'X', { replacement: '' }), 'ab')
})
