// Unit test: the health composite is a 0-100 scale and must stay inside it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeOverall } from './lib.mjs'

const perfect = {
  buildPass: true,
  acceptancePassed: 3, acceptanceTotal: 3,
  regressionPassed: 5, regressionTotal: 5,
  capture: { pass: 20, fail: 0 },
  doctor: { problems: 0 },
}

test('a perfect cell scores exactly 100', () => {
  assert.equal(computeOverall({ ...perfect, quality: { readability: 5, conventions: 5, scope: 5 } }), 100)
})

test('a judge answering on the wrong scale cannot exceed 100', () => {
  // A 0-10 judge writing 10s used to push rubric past its 30-point share.
  const out = computeOverall({ ...perfect, quality: { readability: 10, conventions: 10, scope: 10 } })
  assert.ok(out <= 100, `expected <= 100, got ${out}`)
  assert.equal(out, 100)
})

test('negative rubric values floor at zero rather than subtracting', () => {
  const out = computeOverall({ ...perfect, quality: { readability: -5, conventions: -5, scope: -5 } })
  assert.equal(out, computeOverall({ ...perfect, quality: null }))
})

test('a missing rubric costs its whole share and nothing more', () => {
  assert.equal(computeOverall({ ...perfect, quality: null }), 70)
})

test('every doctor problem costs a tenth of the capture share', () => {
  const clean = computeOverall({ ...perfect, quality: { readability: 5, conventions: 5, scope: 5 } })
  const oneProblem = computeOverall({ ...perfect, doctor: { problems: 1 }, quality: { readability: 5, conventions: 5, scope: 5 } })
  assert.ok(oneProblem < clean)
})
