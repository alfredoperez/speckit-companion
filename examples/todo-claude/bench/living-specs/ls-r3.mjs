#!/usr/bin/env node
// bench/living-specs/ls-r3.mjs — the round-3 living-specs matrix.
//
// Proves the write-back loop closes reliably across the real dimensions it
// broke on: central vs colocated layout, a change that adds a requirement vs one
// that adds nothing, adopt, go-around-the-pipeline drift, disabled, and
// idempotency. Every value is captured from a real execFileSync against the
// shipped scripts pointed at a baked sandbox via --root — never hand-authored.
// The only seeded inputs are the prose an AI would write (a feature spec, a delta
// block, a skip reason); the scripts under test do the rest for real, which is
// exactly what exercises the #535 (deterministic gate) and #536 (accountability)
// fixes.
//
// Usage: node ls-r3.mjs            (runs the whole matrix, writes evidence)
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'

import { REPO_ROOT, gitInitCell, gitCommitCellBaseline } from '../lib.mjs'
import {
  SANDBOX_ROOT,
  EVIDENCE_DIR,
  WRITE_CONTEXT,
  REGISTER,
  RESOLVER,
  DRIFT,
  runCheckLivingSpec,
  unifiedDiff,
  readText,
} from './ls-lib.mjs'

// record-living-specs.py — the #535 deterministic gate (records loaded + stamps
// the last_action breadcrumb). Not yet wrapped in ls-lib, so run it here.
const RECORD = join(REPO_ROOT, 'speckit-extension', 'scripts', 'record-living-specs.py')

function rel(p) {
  return relative(REPO_ROOT, p)
}

function write(root, relPath, body) {
  const p = join(root, relPath)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, body)
}

function readCtx(root, featureRel) {
  try {
    return JSON.parse(readFileSync(join(root, featureRel, '.spec-context.json'), 'utf8'))
  } catch {
    return null
  }
}

// Run a python script and capture BOTH stdout and stderr — the fold and drift
// receipts print to stderr and exit 0, so execFileSync (stdout-only) would drop
// them. spawnSync returns both regardless of exit code.
function sh(root, args, script, cmdLabel) {
  const p = spawnSync('python3', [script, ...args], { encoding: 'utf8', cwd: root })
  let merged = `${p.stdout || ''}${p.stderr || ''}`.trim()
  // A signal-killed process (status null) or a spawn error is a failure, not a
  // clean exit 0 — otherwise a crashed script could record a false PASS.
  const exit = typeof p.status === 'number' ? p.status : 1
  if (p.signal) merged += `\n[harness] process killed by signal ${p.signal}`
  if (p.error) merged += `\n[harness] spawn error: ${p.error.message}`
  const clean = merged.split(`${REPO_ROOT}/`).join('').split(`${root}/`).join('')
  return {
    cwd: rel(root),
    cmd: cmdLabel,
    exit,
    stdout: clean,          // merged stdout+stderr — for message matching
    out: (p.stdout || '').trim(),  // pure stdout — for JSON parsing
    tail: clean.split('\n').slice(-8).join('\n'),
  }
}

// The #535 gate: record which living specs cover the change + write the breadcrumb.
function runRecord(root, featureRel, changed) {
  const r = sh(root, ['--feature-dir', join(root, featureRel), '--changed', ...changed, '--root', root], RECORD,
    `python3 ${rel(RECORD)} --feature-dir ${featureRel} --changed ${changed.join(' ')}`)
  return { ...r, ctx: readCtx(root, featureRel) }
}

// The #536 skip note.
function runSkip(root, featureRel, note) {
  const r = sh(root, ['--feature-dir', join(root, featureRel), '--living-spec-skip', note], WRITE_CONTEXT,
    `python3 ${rel(WRITE_CONTEXT)} --feature-dir ${featureRel} --living-spec-skip "${note}"`)
  return { ...r, ctx: readCtx(root, featureRel) }
}

function runFold(root, featureRel) {
  const r = sh(root, ['--feature-dir', join(root, featureRel), '--fold-living-spec', '--by', 'ai'], WRITE_CONTEXT,
    `python3 ${rel(WRITE_CONTEXT)} --feature-dir ${featureRel} --fold-living-spec --by ai`)
  return { ...r, ctx: readCtx(root, featureRel) }
}

function runResolver(root, args) {
  return sh(root, ['--root', '.', ...args], RESOLVER, `python3 ${rel(RESOLVER)} --root . ${args.join(' ')}`)
}

function runDrift(root, args = []) {
  return sh(root, ['--root', '.', ...args], DRIFT, `python3 ${rel(DRIFT)} --root . ${args.join(' ')}`.trim())
}

function runRegister(root, args) {
  return sh(root, ['--root', '.', ...args], REGISTER, `python3 ${rel(REGISTER)} --root . ${args.join(' ')}`)
}

// Inline git identity so the harness works without global git config (matches
// gitCommitCellBaseline's -c flags) — a clean CI/dev box has no user.email set.
const GIT_ID = ['-c', 'user.email=bench@local', '-c', 'user.name=bench']

function branchWithChange(root, slug, file, content) {
  execFileSync('git', ['-C', root, 'checkout', '-q', '-b', slug])
  write(root, file, content)
  execFileSync('git', ['-C', root, 'add', '-A'])
  execFileSync('git', ['-C', root, ...GIT_ID, 'commit', '-qm', slug])
}

function finishedContext(slug) {
  return JSON.stringify({
    workflow: 'speckit', specName: slug, branch: slug,
    currentStep: 'implement', status: 'implemented', history: [],
  }) + '\n'
}

const LIVING_TODOS = [
  '# Todos capability',
  '',
  '### Users can add a todo',
  '',
  '#### Scenario: add a todo',
  '- WHEN a user types text and submits',
  '- THEN a todo appears in the list',
  '',
].join('\n')

const LIVING_ABOUT = '# About capability\n\n### The about page renders\n\n#### Scenario: open\n- WHEN a user opens /about\n- THEN the page renders\n'

// A real ADDED delta block, marked so the fold routes it to `todos`.
const DUE_DATE_DELTA = [
  '## ADDED Requirements',
  '<!-- capability: todos -->',
  '',
  '### Users can set a due date on a todo',
  '',
  '#### Scenario: set a due date',
  '- WHEN a user picks a date for a todo',
  '- THEN the todo shows the due date',
  '',
].join('\n')

// ---- bakers: canonical ROOT living-specs.yml (not the legacy .specify path) ----

function rootRegistry(caps, enabled = true) {
  const lines = [`enabled: ${enabled}`, 'capabilities:']
  for (const c of caps) {
    lines.push(`  - name: ${c.name}`)
    lines.push(`    match: ["${c.match}"]`)
    if (c.spec) lines.push(`    spec: ${c.spec}`)
  }
  return lines.join('\n') + '\n'
}

// ls-r3-central: central capabilities (spec defaults to capabilities/<name>/spec.md).
function bakeCentral(name = 'ls-r3-central') {
  const root = join(SANDBOX_ROOT, name)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })
  write(root, 'living-specs.yml', rootRegistry([
    { name: 'todos', match: 'src/todos/**' },
    { name: 'about', match: 'src/about/**' },
  ]))
  write(root, 'capabilities/todos/spec.md', LIVING_TODOS)
  write(root, 'capabilities/about/spec.md', LIVING_ABOUT)
  write(root, 'src/todos/list.ts', '// todos\n')
  write(root, 'src/about/page.ts', '// about\n')
  gitInitCell(root)
  gitCommitCellBaseline(root)
  return root
}

// ls-r3-coloc: colocated capability spec next to the code it describes.
function bakeColoc(name = 'ls-r3-coloc') {
  const root = join(SANDBOX_ROOT, name)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })
  write(root, 'living-specs.yml', rootRegistry([
    { name: 'todos', match: 'src/todos/**', spec: 'src/todos/todos.spec.md' },
  ]))
  write(root, 'src/todos/todos.spec.md', LIVING_TODOS)
  write(root, 'src/todos/list.ts', '// todos\n')
  gitInitCell(root)
  gitCommitCellBaseline(root)
  return root
}

// ls-r3-unadopted: real code, NO registry — the adoption starting point.
function bakeUnadopted(name = 'ls-r3-unadopted') {
  const root = join(SANDBOX_ROOT, name)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })
  write(root, 'src/billing/index.ts', 'export { createInvoice } from "./invoice"\n')
  write(root, 'src/billing/invoice.ts', 'export function createInvoice(amount) { return { amount, paid: false } }\n')
  gitInitCell(root)
  gitCommitCellBaseline(root)
  return root
}

// ls-r3-off: a real registry, enabled:false — the negative control.
function bakeOff(name = 'ls-r3-off') {
  const root = join(SANDBOX_ROOT, name)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })
  write(root, 'living-specs.yml', rootRegistry([{ name: 'todos', match: 'src/todos/**' }], false))
  write(root, 'capabilities/todos/spec.md', LIVING_TODOS)
  write(root, 'src/todos/list.ts', '// todos\n')
  gitInitCell(root)
  gitCommitCellBaseline(root)
  return root
}

function assert(id, ok, detail) {
  return { id, status: ok ? 'PASS' : 'FAIL', detail }
}

const scenarios = []
function scenario(id, title, fn) {
  scenarios.push({ id, title, fn })
}

// ---- S1: install sanity — the shipped scripts run against every registry shape.
scenario('S1-install-sanity', 'the resolver + gate run against all four registry shapes', () => {
  const roots = { central: bakeCentral(), coloc: bakeColoc(), unadopted: bakeUnadopted(), off: bakeOff() }
  const a = []
  const cmds = []
  for (const [kind, root] of Object.entries(roots)) {
    const r = runResolver(root, ['--all', '--json'])
    cmds.push({ cwd: r.cwd, cmd: r.cmd, exit: r.exit, stdoutTail: r.tail || r.stdoutTail })
    let parsed = null
    try { parsed = JSON.parse(r.out) } catch { /* */ }
    a.push(assert(`resolver-runs-${kind}`, r.exit === 0 && parsed != null, `resolve-spec-paths --all --json exit ${r.exit}, JSON ${parsed ? 'parsed' : 'unparsed'}`))
  }
  a.push(assert('scripts-present', existsSync(RECORD) && existsSync(WRITE_CONTEXT) && existsSync(REGISTER),
    'record-living-specs.py, write-context.py, register-capability.py all present'))
  return { assertions: a, commands: cmds }
})

// ---- S2: simple change adds a requirement — colocated layout, loop closes once.
scenario('S2-simple-adds-req-coloc', 'a fast-path change folds one requirement into the colocated spec', () => {
  const root = bakeColoc()
  const FEATURE = 'specs/001-add-due-dates'
  const SPEC = 'src/todos/todos.spec.md'
  write(root, join(FEATURE, 'spec.md'), `# Add due dates\n\n${DUE_DATE_DELTA}`)
  write(root, join(FEATURE, '.spec-context.json'), finishedContext('001-add-due-dates'))
  branchWithChange(root, '001-add-due-dates', 'src/todos/list.ts', '// todos — due dates\n')

  const rec = runRecord(root, FEATURE, ['src/todos/list.ts'])
  const before = readText(join(root, SPEC))
  const fold = runFold(root, FEATURE)
  const after = readText(join(root, SPEC))
  const refold = runFold(root, FEATURE)
  const afterRefold = readText(join(root, SPEC))
  const loaded = rec.ctx?.livingSpecs?.loaded
  const synced = fold.ctx?.livingSpecs?.synced

  const a = [
    assert('gate-recorded-loaded', Array.isArray(loaded) && loaded.includes('todos'), `livingSpecs.loaded -> [${(loaded || []).join(', ')}]`),
    assert('gate-breadcrumb', rec.ctx?.last_action === 'living specs loaded (todos)', `last_action = "${rec.ctx?.last_action}"`),
    assert('colocated-spec-updated', after.includes('### Users can set a due date on a todo'), 'colocated todos.spec.md gained the requirement'),
    assert('records-synced', Array.isArray(synced) && synced.includes('todos'), `livingSpecs.synced -> [${(synced || []).join(', ')}]`),
    assert('idempotent', afterRefold === after, 're-fold left the colocated spec byte-identical'),
  ]
  return {
    assertions: a,
    commands: [rec, fold, refold].map((r) => ({ cwd: r.cwd, cmd: r.cmd, exit: r.exit, stdoutTail: r.tail || r.stdoutTail })),
    livingSpec: { path: SPEC, before, after, unifiedDiff: unifiedDiff(before, after) },
  }
})

// ---- S3: normal change adds a requirement — central layout, full loop.
scenario('S3-normal-adds-req-central', 'a normal change folds one requirement into the central spec', () => {
  const root = bakeCentral()
  const FEATURE = 'specs/001-add-due-dates'
  const SPEC = 'capabilities/todos/spec.md'
  write(root, join(FEATURE, 'spec.md'), `# Add due dates\n\n${DUE_DATE_DELTA}`)
  write(root, join(FEATURE, '.spec-context.json'), finishedContext('001-add-due-dates'))
  branchWithChange(root, '001-add-due-dates', 'src/todos/list.ts', '// todos — due dates\n')

  const rec = runRecord(root, FEATURE, ['src/todos/list.ts'])
  const before = readText(join(root, SPEC))
  const fold = runFold(root, FEATURE)
  const after = readText(join(root, SPEC))
  const cls = runCheckLivingSpec(join(root, FEATURE, 'spec.md'), before, after)
  const loaded = rec.ctx?.livingSpecs?.loaded
  const synced = fold.ctx?.livingSpecs?.synced

  const a = [
    assert('gate-recorded-loaded', Array.isArray(loaded) && loaded.includes('todos'), `livingSpecs.loaded -> [${(loaded || []).join(', ')}]`),
    assert('gate-breadcrumb', rec.ctx?.last_action === 'living specs loaded (todos)', `last_action = "${rec.ctx?.last_action}"`),
    assert('central-spec-updated', after.includes('### Users can set a due date on a todo'), 'capabilities/todos/spec.md gained the requirement'),
    assert('records-synced', Array.isArray(synced) && synced.includes('todos'), `livingSpecs.synced -> [${(synced || []).join(', ')}]`),
    assert('check-living-spec-green', cls.exit === 0 && cls.report?.failed === 0, `check_living_spec.py -> ${cls.report ? cls.report.checks.length : 0} checks, ${cls.report?.failed} fail`),
  ]
  return {
    assertions: a,
    commands: [rec, fold].map((r) => ({ cwd: r.cwd, cmd: r.cmd, exit: r.exit, stdoutTail: r.tail || r.stdoutTail })),
    livingSpec: { path: SPEC, before, after, unifiedDiff: unifiedDiff(before, after) },
    checkLivingSpec: cls.report,
  }
})

// ---- S4: change adds nothing — the #536 split. A skip note is "correctly
// nothing"; its absence is the loud "loop did not close" backstop.
scenario('S4-adds-nothing-central', 'an untouched capability needs a skip note; without one the fold shouts', () => {
  const root = bakeCentral()
  const FEATURE = 'specs/002-rename-vars'
  const SPEC = 'capabilities/todos/spec.md'
  // A render-only refactor: real change to the area, but NO delta block.
  write(root, join(FEATURE, 'spec.md'), '# Rename internal vars\n\nA render-only refactor. No behavior change.\n')
  write(root, join(FEATURE, '.spec-context.json'), finishedContext('002-rename-vars'))
  branchWithChange(root, '002-rename-vars', 'src/todos/list.ts', '// todos (renamed vars)\n')

  const rec = runRecord(root, FEATURE, ['src/todos/list.ts'])
  const before = readText(join(root, SPEC))

  // (a) WITHOUT a skip note → the backstop fires loudly.
  const foldNoSkip = runFold(root, FEATURE)
  const afterNoSkip = readText(join(root, SPEC))

  // (b) record the skip → fold goes quiet: "correctly nothing".
  const skip = runSkip(root, FEATURE, 'todos: render-only refactor, no behavior change')
  const foldSkipped = runFold(root, FEATURE)
  const afterSkipped = readText(join(root, SPEC))
  const skipped = foldSkipped.ctx?.livingSpecs?.skipped

  const a = [
    assert('gate-recorded-loaded', rec.ctx?.livingSpecs?.loaded?.includes('todos'), `loaded -> [${(rec.ctx?.livingSpecs?.loaded || []).join(', ')}]`),
    assert('no-skip-shouts', /loop did not close/i.test(foldNoSkip.stdout) && afterNoSkip === before,
      'without a skip note: spec byte-identical AND fold prints "the loop did not close"'),
    assert('skip-recorded', Array.isArray(skipped) && skipped.some((s) => s.name === 'todos' && s.reason),
      `livingSpecs.skipped -> ${JSON.stringify(skipped)}`),
    assert('skip-is-correctly-nothing', /correctly nothing/i.test(foldSkipped.stdout) && !/loop did not close/i.test(foldSkipped.stdout) && afterSkipped === before,
      'with a skip note: spec byte-identical AND fold prints "correctly nothing"'),
  ]
  return {
    assertions: a,
    commands: [rec, foldNoSkip, skip, foldSkipped].map((r) => ({ cwd: r.cwd, cmd: r.cmd, exit: r.exit, stdoutTail: r.tail || r.stdoutTail })),
    livingSpec: { path: SPEC, before, after: afterSkipped, unifiedDiff: unifiedDiff(before, afterSkipped) || '(byte-identical — correctly nothing)' },
  }
})

// ---- S5: not adopted → adopt. Registration makes the invisible failure visible.
scenario('S5-adopt-unadopted', 'an unadopted area resolves nothing until it is registered', () => {
  const root = bakeUnadopted()
  const beforeReg = runResolver(root, ['--changed', 'src/billing/invoice.ts', '--json'])
  let beforeMatched = null
  try { beforeMatched = JSON.parse(beforeReg.out).matched } catch { /* */ }

  const register = runRegister(root, ['--name', 'billing', '--match', 'src/billing/**'])
  const afterReg = runResolver(root, ['--changed', 'src/billing/invoice.ts', '--json'])
  let afterMatched = null
  try { afterMatched = JSON.parse(afterReg.out).matched } catch { /* */ }

  // Idempotent re-adopt: registering the same capability again is detected, not duplicated.
  const reRegister = runRegister(root, ['--name', 'billing', '--match', 'src/billing/**'])

  const a = [
    assert('unadopted-resolves-nothing', Array.isArray(beforeMatched) && beforeMatched.length === 0, `before register: matched ${(beforeMatched || []).length}`),
    assert('register-succeeds', register.exit === 0, `register-capability.py exit ${register.exit}`),
    assert('adopted-then-loads', Array.isArray(afterMatched) && afterMatched.some((m) => m.name === 'billing'), `after register: matched [${(afterMatched || []).map((m) => m.name).join(', ')}]`),
    assert('re-adopt-detects-existing', reRegister.exit === 0 && /exist|already|present/i.test(reRegister.stdout), `re-register stdout: ${reRegister.tail.split('\n').pop()}`),
  ]
  return {
    assertions: a,
    commands: [beforeReg, register, afterReg, reRegister].map((r) => ({ cwd: r.cwd, cmd: r.cmd, exit: r.exit, stdoutTail: r.tail || r.stdoutTail })),
  }
})

// ---- S6: go around the pipeline — a direct commit drifts; a fold clears it.
scenario('S6-drift-then-sync-coloc', 'a direct edit shows as drift, then reads in-sync after the spec updates', () => {
  const root = bakeColoc()
  // Commit the colocated spec + code as the in-sync baseline.
  execFileSync('git', ['-C', root, 'add', '-A'], { encoding: 'utf8' })
  // A direct edit to the capability area, committed AFTER the spec's last commit — bypassing the pipeline.
  write(root, 'src/todos/list.ts', '// todos — edited directly, no spec update\n')
  execFileSync('git', ['-C', root, 'add', '-A'], { encoding: 'utf8' })
  execFileSync('git', ['-C', root, '-c', 'user.email=b@l', '-c', 'user.name=b', 'commit', '-qm', 'direct edit'], { encoding: 'utf8' })

  // A capability is drifted only when its `drifted[]` list is non-empty — the
  // `capabilities[]` array lists every checked capability (in-sync ones too).
  const driftedNames = (j) => (j.capabilities || []).filter((c) => (c.drifted || []).length > 0).map((c) => c.name)

  const driftBefore = runDrift(root, ['--json'])
  let before = []
  try { before = driftedNames(JSON.parse(driftBefore.out)) } catch { /* */ }

  // The sync's deterministic effect: touch the colocated spec so it is newer than the code, then commit.
  write(root, 'src/todos/todos.spec.md', LIVING_TODOS + '\n<!-- synced: direct edit reviewed -->\n')
  execFileSync('git', ['-C', root, 'add', '-A'], { encoding: 'utf8' })
  execFileSync('git', ['-C', root, '-c', 'user.email=b@l', '-c', 'user.name=b', 'commit', '-qm', 'sync todos spec'], { encoding: 'utf8' })

  const driftAfter = runDrift(root, ['--json'])
  let cleared = []
  try { cleared = driftedNames(JSON.parse(driftAfter.out)) } catch { /* */ }

  const a = [
    assert('direct-edit-drifts', driftBefore.exit === 0 && before.includes('todos'), `drift before sync: [${before.join(', ')}]`),
    assert('sync-clears-drift', driftAfter.exit === 0 && !cleared.includes('todos'), `drift after sync: [${cleared.join(', ')}]`),
  ]
  return {
    assertions: a,
    commands: [driftBefore, driftAfter].map((r) => ({ cwd: r.cwd, cmd: r.cmd, exit: r.exit, stdoutTail: r.tail || r.stdoutTail })),
  }
})

// ---- S7: disabled — every verb no-ops, nothing invented.
scenario('S7-disabled-off', 'with living specs disabled every verb no-ops', () => {
  const root = bakeOff()
  const FEATURE = 'specs/001-add-due-dates'
  write(root, join(FEATURE, 'spec.md'), `# Add due dates\n\n${DUE_DATE_DELTA}`)
  write(root, join(FEATURE, '.spec-context.json'), finishedContext('001-add-due-dates'))
  branchWithChange(root, '001-add-due-dates', 'src/todos/list.ts', '// todos — due dates\n')

  const before = readText(join(root, 'capabilities/todos/spec.md'))
  const rec = runRecord(root, FEATURE, ['src/todos/list.ts'])
  const fold = runFold(root, FEATURE)
  const after = readText(join(root, 'capabilities/todos/spec.md'))
  const drift = runDrift(root, ['--json'])

  const a = [
    assert('gate-not-configured', rec.ctx?.last_action === 'living specs evaluated — skipped (not configured)' && rec.ctx?.livingSpecs == null,
      `last_action = "${rec.ctx?.last_action}", livingSpecs ${rec.ctx?.livingSpecs == null ? 'absent' : 'present'}`),
    assert('fold-inert', fold.exit === 0 && after === before && fold.ctx?.livingSpecs == null, 'disabled fold left the spec byte-identical, no livingSpecs written'),
    assert('drift-inert', drift.exit === 0, `drift exit ${drift.exit} (opt-in: reports nothing when off)`),
  ]
  return {
    assertions: a,
    commands: [rec, fold, drift].map((r) => ({ cwd: r.cwd, cmd: r.cmd, exit: r.exit, stdoutTail: r.tail || r.stdoutTail })),
  }
})

// ---- S8: idempotency — re-fold is a byte no-op; re-adopt detects existing.
scenario('S8-idempotency-central', 're-folding and re-adopting change nothing the second time', () => {
  const root = bakeCentral()
  const FEATURE = 'specs/001-add-due-dates'
  const SPEC = 'capabilities/todos/spec.md'
  write(root, join(FEATURE, 'spec.md'), `# Add due dates\n\n${DUE_DATE_DELTA}`)
  write(root, join(FEATURE, '.spec-context.json'), finishedContext('001-add-due-dates'))
  branchWithChange(root, '001-add-due-dates', 'src/todos/list.ts', '// todos — due dates\n')

  runRecord(root, FEATURE, ['src/todos/list.ts'])
  const fold1 = runFold(root, FEATURE)
  const after1 = readText(join(root, SPEC))
  const fold2 = runFold(root, FEATURE)
  const after2 = readText(join(root, SPEC))
  const fold3 = runFold(root, FEATURE)
  const after3 = readText(join(root, SPEC))

  const a = [
    assert('first-fold-writes', fold1.exit === 0 && after1.includes('### Users can set a due date on a todo'), 'first fold applied the delta'),
    assert('refold-byte-identical', after2 === after1 && after3 === after1, 're-fold (x2) left the spec byte-identical'),
    assert('refold-reports-noop', /up to date|no change|already/i.test(fold2.stdout), `second fold stdout: ${fold2.tail.split('\n').pop()}`),
    // Regression guard: an already-synced capability is accounted for across
    // re-folds, so the #536 backstop must NOT fire on a refold. This is the exact
    // false-alarm this matrix caught and #541 fixed.
    assert('refold-does-not-false-alarm',
      !/loop did not close/i.test(fold2.stdout) && !/loop did not close/i.test(fold3.stdout),
      'no "loop did not close" backstop on an idempotent refold'),
  ]
  return {
    assertions: a,
    commands: [fold1, fold2, fold3].map((r) => ({ cwd: r.cwd, cmd: r.cmd, exit: r.exit, stdoutTail: r.tail || r.stdoutTail })),
  }
})

function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  const results = []
  for (const s of scenarios) {
    let out
    try {
      out = s.fn()
    } catch (e) {
      out = { assertions: [assert('ran', false, `threw: ${e.message}`)], commands: [], error: String(e.stack || e) }
    }
    const allPass = out.assertions.length > 0 && out.assertions.every((x) => x.status === 'PASS')
    const evidence = {
      id: s.id, title: s.title, ranAt: new Date().toISOString(),
      mode: 'real+seeded-prose', verdict: allPass ? 'PASS' : 'FAIL',
      ...out,
    }
    writeFileSync(join(EVIDENCE_DIR, `${s.id}.json`), JSON.stringify(evidence, null, 2) + '\n')
    results.push(evidence)
    const passN = out.assertions.filter((x) => x.status === 'PASS').length
    console.log(`${evidence.verdict === 'PASS' ? '✓' : '✗'} ${s.id} (${passN}/${out.assertions.length})  ${s.title}`)
    for (const x of out.assertions) console.log(`    ${x.status === 'PASS' ? '·' : '✗'} ${x.id}: ${x.detail}`)
  }
  const summary = {
    ranAt: new Date().toISOString(),
    verdict: results.every((r) => r.verdict === 'PASS') ? 'PASS' : 'FAIL',
    scenarios: results.map((r) => ({ id: r.id, verdict: r.verdict, title: r.title })),
  }
  writeFileSync(join(EVIDENCE_DIR, 'LS-R3.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(`\n[ls-r3] ${summary.verdict} — ${results.filter((r) => r.verdict === 'PASS').length}/${results.length} scenarios; evidence → ${relative(REPO_ROOT, EVIDENCE_DIR)}`)
  process.exit(summary.verdict === 'PASS' ? 0 : 1)
}

main()
