// Unit test for the behavioral judge — runnable with `node --test` (no AI needed).
//   node --test examples/todo-claude/bench/behavioral-judge.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractAcceptanceScenarios,
  gatherEvidence,
  parseVerdict,
  judgeBehavior,
} from './behavioral-judge.mjs'

const SPEC = `# Spec

## User Scenarios

### User Story 1
**Acceptance Scenarios**
1. **Given** a loading view, **When** the spinner renders, **Then** a busy indicator shows.
2. **Given** a count of 3, **When** the badge renders, **Then** it shows 3.

- Some unrelated bullet with the word Given but no conclusion clause here.
3. Given no items When the list renders Then a friendly message shows.
`

test('extractAcceptanceScenarios pulls Given/Then lines, numbered or plain', () => {
  const s = extractAcceptanceScenarios(SPEC)
  assert.equal(s.length, 3)
  assert.equal(s[0].n, 1)
  assert.match(s[0].text, /busy indicator shows/)
  assert.doesNotMatch(s[0].text, /\*\*/) // bold stripped
  assert.match(s[2].text, /friendly message/)
})

test('extractAcceptanceScenarios is empty for a spec with no scenarios', () => {
  assert.deepEqual(extractAcceptanceScenarios('# Spec\n\nNo scenarios here.'), [])
  assert.deepEqual(extractAcceptanceScenarios(''), [])
})

test('gatherEvidence drops deletes and caps file size', () => {
  const changed = [
    { path: 'a.tsx', status: 'added', content: 'x'.repeat(99999) },
    { path: 'b.tsx', status: 'deleted', content: '' },
  ]
  const ev = gatherEvidence(changed)
  assert.equal(ev.length, 1)
  assert.equal(ev[0].path, 'a.tsx')
  assert.ok(ev[0].content.length <= 6000)
})

test('parseVerdict extracts the first balanced JSON object', () => {
  const out = 'Sure!\n{"verdicts":[{"n":1,"pass":true,"reason":"works"}]}\nthanks'
  const v = parseVerdict(out)
  assert.equal(v.verdicts.length, 1)
  assert.equal(v.verdicts[0].pass, true)
})

test('parseVerdict returns null on garbage or missing verdicts', () => {
  assert.equal(parseVerdict('no json at all'), null)
  assert.equal(parseVerdict('{"nope":1}'), null)
  assert.equal(parseVerdict(''), null)
})

test('judgeBehavior returns null with no judge command (deterministic fallback)', () => {
  const r = judgeBehavior({ specMd: SPEC, changed: [], buildPass: true, judgeCmd: '' })
  assert.equal(r, null)
})

test('judgeBehavior returns null when the spec has no scenarios', () => {
  const r = judgeBehavior({ specMd: 'nothing', changed: [], buildPass: true, judgeCmd: 'echo {}' })
  assert.equal(r, null)
})

test('judgeBehavior parses a stubbed judge command into a verdict', () => {
  // A fake judge that echoes a fixed verdict — proves the wiring without an LLM.
  const stub = `node -e "console.log(JSON.stringify({verdicts:[{n:1,pass:true,reason:'ok'},{n:2,pass:false,reason:'no'},{n:3,pass:true,reason:'ok'}]}))"`
  const r = judgeBehavior({ specMd: SPEC, changed: [{ path: 'a.tsx', status: 'added', content: 'code' }], buildPass: true, judgeCmd: stub })
  assert.equal(r.total, 3)
  assert.equal(r.passed, 2)
  assert.equal(r.source, 'behavioral')
})
