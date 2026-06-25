#!/usr/bin/env node
// bench/living-specs/ls-demos.mjs — the reusable Living Specs sandbox demo runner.
//
// LS·1 (deterministic): bake a throwaway repo, run the shipped resolver across
// modes + the pytest suite, and assert the contract. Every value in the evidence
// is captured from a real execFileSync — never hand-authored. Writes machine
// evidence to evidence/<LS>.json per the evidence contract; if a step can't run
// the verdict becomes INCONCLUSIVE rather than a fabricated pass.
//
// LS·2 (deterministic): prove the read path's two real halves — (1) the resolver
// resolves the configured capability for the sandbox's changed files, and (2) the
// recording write path (write-context.py --living-specs) produces livingSpecs.loaded
// on a real .spec-context.json — plus the opt-out (enabled:false → nothing resolves,
// nothing recorded). A genuine live-AI specify run is out of this harness's scope,
// so that live step stays INCONCLUSIVE rather than a fabricated pass.
//
// Usage: node ls-demos.mjs [LS1|LS2]      (default LS1)
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { REPO_ROOT } from '../lib.mjs'
import {
  EVIDENCE_DIR,
  bakeLs1Repo,
  bakeOptOutRepo,
  bakeLs2Repo,
  bakeLs2OptOutRepo,
  runResolver,
  runRecordWrite,
  runPytest,
  fileTree,
} from './ls-lib.mjs'

function parseJson(stdout) {
  try { return JSON.parse(stdout) } catch { return null }
}

function assert(id, ok, detail) {
  return { id, status: ok ? 'PASS' : 'FAIL', detail }
}

function runLs1() {
  const commands = []
  const assertions = []

  // --- arrange + act -------------------------------------------------------
  const root = bakeLs1Repo()
  const changed = runResolver(root, ['--changed', 'src/checkout/cart/x.ts', '--json'])
  const all = runResolver(root, ['--all', '--json'])
  const orphans = runResolver(root, ['--orphans', '--json'])

  const optOutRoot = bakeOptOutRepo()
  const optOut = runResolver(optOutRoot, ['--changed', 'src/checkout/cart/x.ts', '--json'])

  const pytest = runPytest()

  commands.push(
    { cwd: relative(REPO_ROOT, root), cmd: changed.cmd, exit: changed.exit, stdoutTail: changed.stdoutTail },
    { cwd: relative(REPO_ROOT, root), cmd: all.cmd, exit: all.exit, stdoutTail: all.stdoutTail },
    { cwd: relative(REPO_ROOT, root), cmd: orphans.cmd, exit: orphans.exit, stdoutTail: orphans.stdoutTail },
    { cwd: relative(REPO_ROOT, optOutRoot), cmd: optOut.cmd, exit: optOut.exit, stdoutTail: optOut.stdoutTail },
    { cwd: relative(REPO_ROOT, REPO_ROOT) || '.', cmd: pytest.cmd, exit: pytest.exit, stdoutTail: pytest.stdoutTail },
  )

  // --- assert (against the real captured stdout) ---------------------------
  const changedJson = parseJson(changed.stdout)
  const matchedNames = changedJson ? changedJson.matched.map((m) => m.name) : []
  assertions.push(assert(
    'changed-order',
    changedJson != null &&
      JSON.stringify(matchedNames) === JSON.stringify(['checkout-cart', 'checkout']),
    `--changed src/checkout/cart/x.ts -> [${matchedNames.join(', ')}]`,
  ))

  const allJson = parseJson(all.stdout)
  const allNames = allJson ? allJson.capabilities.map((c) => c.name) : []
  assertions.push(assert(
    'all-union',
    allJson != null && ['checkout', 'checkout-cart', 'todos'].every((n) => allNames.includes(n)),
    `--all capabilities -> [${allNames.join(', ')}]`,
  ))

  const orphansJson = parseJson(orphans.stdout)
  const orphanList = orphansJson ? orphansJson.orphans : []
  assertions.push(assert(
    'orphan-flagged',
    orphanList.includes('notes/stray.spec.md'),
    `orphans -> [${orphanList.join(', ')}]`,
  ))
  assertions.push(assert(
    'tier-not-orphan',
    !orphanList.some((o) => o.endsWith('.arch.md')),
    'reserved .arch.md tier excluded from orphans',
  ))

  const optOutJson = parseJson(optOut.stdout)
  assertions.push(assert(
    'opt-out-inert',
    optOut.exit === 0 && optOutJson != null && optOutJson.matched.length === 0,
    `enabled:false -> matched=[], exit ${optOut.exit}`,
  ))

  assertions.push(assert(
    'pytest-green',
    pytest.exit === 0,
    `${pytest.runner} exit ${pytest.exit}`,
  ))

  const ran = changed.exit === 0 && all.exit === 0 && orphans.exit === 0 && optOut.exit === 0
  const allPass = assertions.every((a) => a.status === 'PASS')
  const verdict = !ran ? 'INCONCLUSIVE' : allPass ? 'PASS' : 'FAIL'

  return {
    ticket: 'LS1',
    issue: 361,
    title: 'capability resolver, config + sandbox harness (LS·1)',
    ranAt: new Date().toISOString(),
    mode: 'deterministic',
    sandbox: relative(REPO_ROOT, root),
    commands,
    fileTree: {
      added: fileTree(root, [
        '.specify/companion.yml',
        'capabilities/todos/spec.md',
        'capabilities/todos/spec.arch.md',
        'src/checkout/index.ts',
        'src/checkout/cart/cart.ts',
        'src/todos/list.ts',
        'notes/stray.spec.md',
      ]),
      modified: [],
      removed: [],
    },
    config: 'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: checkout\n      match: ["src/checkout/**"]\n      exclude: ["src/checkout/**/*.test.ts"]\n    - name: checkout-cart\n      match: ["src/checkout/cart/**"]\n    - name: todos\n      match: ["src/todos/**"]',
    resolverOutputs: {
      changed: changed.stdout,
      all: all.stdout,
      orphans: orphans.stdout,
      optOut: optOut.stdout,
    },
    assertions,
    pytest: { runner: pytest.runner, exit: pytest.exit, tail: pytest.stdoutTail },
    verdict,
  }
}

function runLs2() {
  const commands = []
  const assertions = []
  const FEATURE = join('specs', '001-add-due-dates')

  // --- arrange + act -------------------------------------------------------
  const root = bakeLs2Repo()
  // (1) resolver resolves the capability for the change's files (leaf-first).
  const changed = runResolver(root, ['--changed', 'src/todos/items/item.ts', '--json'])
  const changedJson = parseJson(changed.stdout)
  const matchedNames = changedJson ? changedJson.matched.map((m) => m.name) : []

  // (2) the recording write path produces livingSpecs.loaded on a real context.
  const record = runRecordWrite(root, FEATURE, matchedNames.length ? matchedNames : ['todos-items', 'todos'])
  const loaded = record.ctx && record.ctx.livingSpecs ? record.ctx.livingSpecs.loaded : null

  // opt-out — enabled:false resolves nothing, so nothing is recorded.
  const optOutRoot = bakeLs2OptOutRepo()
  const optOut = runResolver(optOutRoot, ['--changed', 'src/todos/items/item.ts', '--json'])
  const optOutJson = parseJson(optOut.stdout)

  const pytest = runPytest()

  commands.push(
    { cwd: relative(REPO_ROOT, root), cmd: changed.cmd, exit: changed.exit, stdoutTail: changed.stdoutTail },
    { cwd: relative(REPO_ROOT, root), cmd: record.cmd, exit: record.exit, stdoutTail: record.stdoutTail },
    { cwd: relative(REPO_ROOT, optOutRoot), cmd: optOut.cmd, exit: optOut.exit, stdoutTail: optOut.stdoutTail },
    { cwd: '.', cmd: pytest.cmd, exit: pytest.exit, stdoutTail: pytest.stdoutTail },
  )

  // --- assert (against the real captured stdout / re-read context) ---------
  assertions.push(assert(
    'resolves-capability-for-changed-file',
    changedJson != null && JSON.stringify(matchedNames) === JSON.stringify(['todos-items', 'todos']),
    `--changed src/todos/items/item.ts -> [${matchedNames.join(', ')}]`,
  ))
  assertions.push(assert(
    'records-loaded-capabilities',
    record.exit === 0 && Array.isArray(loaded) && JSON.stringify(loaded) === JSON.stringify(['todos-items', 'todos']),
    `livingSpecs.loaded -> [${(loaded || []).join(', ')}]`,
  ))
  assertions.push(assert(
    'record-merge-keeps-lifecycle',
    record.ctx != null && record.ctx.status === 'specified' && record.ctx.currentStep === 'specify' && Array.isArray(record.ctx.history),
    `status=${record.ctx && record.ctx.status}, currentStep=${record.ctx && record.ctx.currentStep} preserved`,
  ))
  assertions.push(assert(
    'opt-out-resolves-nothing',
    optOut.exit === 0 && optOutJson != null && optOutJson.matched.length === 0,
    `enabled:false -> matched=[], exit ${optOut.exit}`,
  ))
  assertions.push(assert(
    'pytest-green',
    pytest.exit === 0,
    `${pytest.runner} exit ${pytest.exit}`,
  ))

  const ran = changed.exit === 0 && record.exit === 0 && optOut.exit === 0
  const allPass = assertions.every((a) => a.status === 'PASS')
  const verdict = !ran ? 'INCONCLUSIVE' : allPass ? 'PASS' : 'FAIL'

  return {
    ticket: 'LS2',
    issue: 362,
    title: 'auto-load living specs into specify & plan (LS·2)',
    ranAt: new Date().toISOString(),
    // The two halves the node prose orchestrates are exercised with real exec +
    // readFileSync; a genuine live-AI specify run is out of this harness's scope.
    mode: 'deterministic',
    liveSpecifyRun: 'INCONCLUSIVE — not executed (no live-AI step in this harness)',
    sandbox: relative(REPO_ROOT, root),
    commands,
    fileTree: {
      added: fileTree(root, [
        '.specify/companion.yml',
        'capabilities/todos/spec.md',
        'capabilities/todos-items/spec.md',
        'src/todos/list.ts',
        'src/todos/items/item.ts',
        'specs/001-add-due-dates/.spec-context.json',
      ]),
      modified: ['specs/001-add-due-dates/.spec-context.json'],
      removed: [],
    },
    config: 'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: todos\n      match: ["src/todos/**"]\n    - name: todos-items\n      match: ["src/todos/items/**"]',
    resolverOutputs: { changed: changed.stdout, optOut: optOut.stdout },
    recordedContext: record.ctx,
    assertions,
    pytest: { runner: pytest.runner, exit: pytest.exit, tail: pytest.stdoutTail },
    verdict,
  }
}

const RUNNERS = { LS1: runLs1, LS2: runLs2 }

function main() {
  const ticket = (process.argv[2] || 'LS1').toUpperCase()
  const runner = RUNNERS[ticket]
  if (!runner) {
    console.error(`[ls-demos] unknown ticket ${ticket} — known: ${Object.keys(RUNNERS).join(', ')}`)
    process.exit(2)
  }
  const evidence = runner()
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  const out = join(EVIDENCE_DIR, `${ticket}.json`)
  writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n')
  // Append-only trend row.
  const histRow = JSON.stringify({ ticket, ranAt: evidence.ranAt, mode: evidence.mode, verdict: evidence.verdict }) + '\n'
  writeFileSync(join(EVIDENCE_DIR, 'history.jsonl'), histRow, { flag: 'a' })

  console.log(`[ls-demos] ${ticket} verdict=${evidence.verdict} (${evidence.assertions.filter((a) => a.status === 'PASS').length}/${evidence.assertions.length} assertions PASS)`)
  for (const a of evidence.assertions) console.log(`  ${a.status === 'PASS' ? '✓' : '✗'} ${a.id}: ${a.detail}`)
  console.log(`[ls-demos] evidence → ${relative(REPO_ROOT, out)}`)
  process.exit(evidence.verdict === 'PASS' ? 0 : 1)
}

main()
