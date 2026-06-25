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
// LS·4 (real+seeded-spec / deterministic): the v1 end-to-end gate — drive TWO
// features (additive no-op + real delta) through the real fold against ONE repo and
// prove the living spec ACCUMULATES both with no clobber, plus a deterministic
// opt-out run (enabled:false → byte-identical spec, no new capabilities/** files).
//
// Usage: node ls-demos.mjs [LS1|LS2|LS3|LS4]      (default LS1)
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { join as pjoin } from 'node:path'

import { REPO_ROOT, runCaptureEval } from '../lib.mjs'
import {
  EVIDENCE_DIR,
  bakeLs1Repo,
  bakeOptOutRepo,
  bakeLs2Repo,
  bakeLs2OptOutRepo,
  bakeLs3Repo,
  bakeLs3OptOutRepo,
  bakeLs4Repo,
  bakeLs4OptOutRepo,
  bakeLs5Repo,
  capabilitiesTree,
  runResolver,
  runRecordWrite,
  runFold,
  runRegister,
  readConfig,
  seedDraftedSpec,
  checkDraftStructure,
  unifiedDiff,
  runCheckLivingSpec,
  runPytest,
  fileTree,
  readText,
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

function runLs3() {
  const commands = []
  const assertions = []
  const FEATURE = pjoin('specs', '001-add-due-dates')
  const LIVING = pjoin('capabilities', 'todos', 'spec.md')

  // --- arrange + act -------------------------------------------------------
  const root = bakeLs3Repo()
  const before = readText(pjoin(root, LIVING))           // real read, pre-fold
  const fold = runFold(root, FEATURE)                    // the REAL fold script
  const after = readText(pjoin(root, LIVING))            // real read, post-fold
  const synced = fold.ctx && fold.ctx.livingSpecs ? fold.ctx.livingSpecs.synced : null

  // Idempotency — a second fold must change nothing on disk.
  const refold = runFold(root, FEATURE)
  const afterRefold = readText(pjoin(root, LIVING))

  // The real unified diff + the real check_living_spec.py report.
  const diff = unifiedDiff(before, after)
  const cls = runCheckLivingSpec(pjoin(root, FEATURE, 'spec.md'), before, after)

  // Opt-out — enabled:false leaves the living spec byte-identical.
  const optRoot = bakeLs3OptOutRepo()
  const optBefore = readText(pjoin(optRoot, LIVING))
  const optFold = runFold(optRoot, FEATURE)
  const optAfter = readText(pjoin(optRoot, LIVING))

  const pytest = runPytest()

  commands.push(
    { cwd: fold.cwd, cmd: fold.cmd, exit: fold.exit, stdoutTail: fold.stdoutTail },
    { cwd: refold.cwd, cmd: refold.cmd, exit: refold.exit, stdoutTail: refold.stdoutTail },
    { cwd: optFold.cwd, cmd: optFold.cmd, exit: optFold.exit, stdoutTail: optFold.stdoutTail },
    { cwd: '.', cmd: pytest.cmd, exit: pytest.exit, stdoutTail: pytest.stdoutTail },
  )

  // --- assert (against the real captured output / re-read files) -----------
  assertions.push(assert(
    'added-folded',
    after.includes('### Users can set a due date on a todo'),
    'ADDED requirement present in capabilities/todos/spec.md after fold',
  ))
  assertions.push(assert(
    'records-synced',
    fold.exit === 0 && Array.isArray(synced) && synced.includes('todos'),
    `livingSpecs.synced -> [${(synced || []).join(', ')}]`,
  ))
  assertions.push(assert(
    'idempotent',
    afterRefold === after,
    're-running the fold left capabilities/todos/spec.md byte-identical',
  ))
  const clsFailed = cls.report ? cls.report.failed : -1
  assertions.push(assert(
    'check-living-spec-green',
    cls.exit === 0 && clsFailed === 0,
    `check_living_spec.py -> ${cls.report ? cls.report.checks.length : 0} checks, ${clsFailed} fail`,
  ))
  assertions.push(assert(
    'opt-out-byte-identical',
    optBefore === optAfter && (optFold.ctx == null || optFold.ctx.livingSpecs == null),
    `enabled:false -> living spec unchanged, no livingSpecs.synced`,
  ))
  assertions.push(assert(
    'pytest-green',
    pytest.exit === 0,
    `${pytest.runner} exit ${pytest.exit}`,
  ))

  const ran = fold.exit === 0 && refold.exit === 0 && optFold.exit === 0
  const allPass = assertions.every((a) => a.status === 'PASS')
  const verdict = !ran ? 'INCONCLUSIVE' : allPass ? 'PASS' : 'FAIL'

  return {
    ticket: 'LS3',
    issue: 363,
    title: 'fold feature-spec deltas into the durable living spec at mark-complete (LS·3)',
    ranAt: new Date().toISOString(),
    // The fold (the unit under test) runs fully real on disk; only the model's
    // prose is seeded (a real feature spec + delta), removing AI variability from
    // the part not under test.
    mode: 'real+seeded-spec',
    sandbox: relative(REPO_ROOT, root),
    commands,
    fileTree: {
      added: fileTree(root, [
        '.specify/companion.yml',
        'capabilities/todos/spec.md',
        'specs/001-add-due-dates/spec.md',
        'specs/001-add-due-dates/.spec-context.json',
        'src/todos/list.ts',
      ]),
      modified: ['capabilities/todos/spec.md', 'specs/001-add-due-dates/.spec-context.json'],
      removed: [],
    },
    config: 'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: todos\n      match: ["src/todos/**"]',
    livingSpec: {
      path: 'capabilities/todos/spec.md',
      before,
      after,
      unifiedDiff: diff,
    },
    syncedCapabilities: synced,
    assertions,
    checkLivingSpec: cls.report,
    pytest: { runner: pytest.runner, exit: pytest.exit, tail: pytest.stdoutTail },
    verdict,
  }
}

function runLs4() {
  const commands = []
  const assertions = []
  const LIVING = pjoin('capabilities', 'todos', 'spec.md')

  // --- accumulation: two sequential features against ONE repo --------------
  const { root, featureA, featureB } = bakeLs4Repo()
  const before = readText(pjoin(root, LIVING))     // real read, pre-anything
  const foldA = runFold(root, featureA)            // additive feature → clean no-op
  const afterA = readText(pjoin(root, LIVING))     // real read, post-A
  const foldB = runFold(root, featureB)            // delta feature → folds in
  const afterB = readText(pjoin(root, LIVING))     // real read, post-B
  const syncedB = foldB.ctx && foldB.ctx.livingSpecs ? foldB.ctx.livingSpecs.synced : null

  const diffBeforeA = unifiedDiff(before, afterA)  // expected empty (no-op)
  const diffBeforeB = unifiedDiff(before, afterB)  // expected: B's block appended

  // --- opt-out: same delta feature, enabled:false → inert ------------------
  const { root: optRoot } = bakeLs4OptOutRepo()
  const optTreeBefore = capabilitiesTree(optRoot)
  const optSpecBefore = readText(pjoin(optRoot, LIVING))
  const optFold = runFold(optRoot, 'specs/002-add-due-dates')
  const optSpecAfter = readText(pjoin(optRoot, LIVING))
  const optTreeAfter = capabilitiesTree(optRoot)
  const optNewFiles = optTreeAfter.filter((f) => !optTreeBefore.includes(f))

  const pytest = runPytest()

  commands.push(
    { cwd: foldA.cwd, cmd: foldA.cmd, exit: foldA.exit, stdoutTail: foldA.stdoutTail },
    { cwd: foldB.cwd, cmd: foldB.cmd, exit: foldB.exit, stdoutTail: foldB.stdoutTail },
    { cwd: optFold.cwd, cmd: optFold.cmd, exit: optFold.exit, stdoutTail: optFold.stdoutTail },
    { cwd: '.', cmd: pytest.cmd, exit: pytest.exit, stdoutTail: pytest.stdoutTail },
  )

  // --- assert (against the real captured output / re-read files) -----------
  assertions.push(assert(
    'additive-feature-noop',
    afterA === before,
    'feature A (no delta) left capabilities/todos/spec.md byte-identical',
  ))
  assertions.push(assert(
    'delta-feature-folds',
    afterB.includes('### Users can set a due date on a todo'),
    "feature B's ADDED requirement present after fold",
  ))
  assertions.push(assert(
    'no-clobber',
    afterB.includes('### Users can add a todo'),
    'original requirement still present after feature B fold (no clobber)',
  ))
  assertions.push(assert(
    'monotonic-growth',
    afterB.length > before.length && afterB.startsWith(before.trimEnd()),
    `living spec grew ${before.length} → ${afterB.length} bytes, prior content preserved as prefix`,
  ))
  assertions.push(assert(
    'records-synced-B-only',
    foldB.exit === 0 && Array.isArray(syncedB) && syncedB.includes('todos'),
    `livingSpecs.synced after B -> [${(syncedB || []).join(', ')}]`,
  ))
  assertions.push(assert(
    'opt-out-byte-identical',
    optSpecBefore === optSpecAfter,
    'enabled:false -> capabilities/todos/spec.md byte-identical before/after',
  ))
  assertions.push(assert(
    'opt-out-no-new-files',
    optNewFiles.length === 0 && (optFold.ctx == null || optFold.ctx.livingSpecs == null),
    `enabled:false -> no new capabilities/** files, no livingSpecs.synced`,
  ))
  assertions.push(assert(
    'pytest-green',
    pytest.exit === 0,
    `${pytest.runner} exit ${pytest.exit}`,
  ))

  const ran = foldA.exit === 0 && foldB.exit === 0 && optFold.exit === 0
  const allPass = assertions.every((a) => a.status === 'PASS')
  const verdict = !ran ? 'INCONCLUSIVE' : allPass ? 'PASS' : 'FAIL'

  // Lifecycle-capture eval on the delta feature's spec dir (per the ticket's
  // evidence contract). The fold writes livingSpecs.synced onto this context;
  // the demo drives the fold directly (not a full pipeline), so capture may be
  // limited/informational — recorded as-is, never gating the verdict.
  const captureEval = runCaptureEval(join(root, 'specs/002-add-due-dates')) ||
    { pass: 0, fail: 0, failing: [], error: 'no .spec-context.json' }

  return {
    ticket: 'LS4',
    issue: 364,
    title: 'end-to-end sandbox validation gate (LS·4)',
    ranAt: new Date().toISOString(),
    // Two real, honest modes: the accumulation runs reuse the LS·3 fold path
    // verbatim (only the model's prose is seeded), so they are real+seeded-spec;
    // the opt-out is a deterministic enabled:false no-op proof.
    mode: 'real+seeded-spec',
    runModes: { accumulation: 'real+seeded-spec', optOut: 'deterministic' },
    sandbox: relative(REPO_ROOT, root),
    commands,
    fileTree: {
      added: fileTree(root, [
        '.specify/companion.yml',
        'capabilities/todos/spec.md',
        'specs/001-clear-completed/spec.md',
        'specs/001-clear-completed/.spec-context.json',
        'specs/002-add-due-dates/spec.md',
        'specs/002-add-due-dates/.spec-context.json',
        'src/todos/list.ts',
      ]),
      modified: ['capabilities/todos/spec.md', 'specs/002-add-due-dates/.spec-context.json'],
      removed: [],
    },
    config: 'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: todos\n      match: ["src/todos/**"]',
    accumulation: {
      livingSpecPath: 'capabilities/todos/spec.md',
      before,
      afterA,
      afterB,
      diffBeforeA,
      diffBeforeB,
      syncedAfterB: syncedB,
    },
    optOut: {
      sandbox: relative(REPO_ROOT, optRoot),
      specByteIdentical: optSpecBefore === optSpecAfter,
      capabilitiesTreeBefore: optTreeBefore,
      capabilitiesTreeAfter: optTreeAfter,
      newCapabilityFiles: optNewFiles,
      recordedLivingSpecs: optFold.ctx ? (optFold.ctx.livingSpecs || null) : null,
    },
    assertions,
    pytest: { runner: pytest.runner, exit: pytest.exit, tail: pytest.stdoutTail },
    captureEval: { pass: captureEval.pass, fail: captureEval.fail, failing: captureEval.failing },
    verdict,
  }
}

function runLs5() {
  const commands = []
  const assertions = []
  const LIVING = pjoin('capabilities', 'billing', 'spec.md')

  // --- arrange: a brownfield repo with a real src/billing/ area, no config yet -
  const root = bakeLs5Repo()
  const configBefore = readConfig(root)                  // expected empty (no block yet)

  // --- act (deterministic, REAL): register the billing capability -------------
  const register = runRegister(root, ['--name', 'billing', '--match', 'src/billing/**', '--json'])
  const configAfter = readConfig(root)
  // the resolver now recognizes a changed file under the adopted area
  const resolved = runResolver(root, ['--changed', 'src/billing/invoice.ts', '--json'])
  const resolvedJson = parseJson(resolved.stdout)
  const matchedNames = resolvedJson ? resolvedJson.matched.map((m) => m.name) : []
  // idempotent re-register — config must stay byte-identical
  const reregister = runRegister(root, ['--name', 'billing', '--match', 'src/billing/**'])
  const configReregister = readConfig(root)

  // --- act (structure, SEEDED): assert a drafted spec's required structure ----
  // The live AI extraction is NOT run here — this draft is a seeded fixture
  // standing in for the wizard's output, so the structure contract is proven
  // without faking a model draft.
  const draftText = seedDraftedSpec(root, 'billing')
  const structure = checkDraftStructure(draftText)

  const pytest = runPytest()

  commands.push(
    { cwd: register.cwd, cmd: register.cmd, exit: register.exit, stdoutTail: register.stdoutTail },
    { cwd: relative(REPO_ROOT, root), cmd: resolved.cmd, exit: resolved.exit, stdoutTail: resolved.stdoutTail },
    { cwd: reregister.cwd, cmd: reregister.cmd, exit: reregister.exit, stdoutTail: reregister.stdoutTail },
    { cwd: '.', cmd: pytest.cmd, exit: pytest.exit, stdoutTail: pytest.stdoutTail },
  )

  // --- assert (against the real captured output / re-read files) --------------
  const registerJson = parseJson(register.stdout)
  assertions.push(assert(
    'registers-capability',
    register.exit === 0 && registerJson != null && registerJson.action === 'created' &&
      registerJson.name === 'billing',
    `register-capability -> action=${registerJson ? registerJson.action : '?'}, name=billing`,
  ))
  assertions.push(assert(
    'resolver-recognizes-append',
    resolved.exit === 0 && JSON.stringify(matchedNames) === JSON.stringify(['billing']),
    `--changed src/billing/invoice.ts -> [${matchedNames.join(', ')}]`,
  ))
  assertions.push(assert(
    'append-is-incremental',
    configBefore === '' && /name: billing/.test(configAfter),
    'no config before; billing block present after (created, not whole-repo bootstrap)',
  ))
  assertions.push(assert(
    'register-idempotent',
    reregister.exit === 0 && configReregister === configAfter,
    're-register left companion.yml byte-identical',
  ))
  const sFailed = structure.failed
  assertions.push(assert(
    'drafted-spec-structure',
    sFailed === 0,
    `seeded draft -> ${structure.checks.length} structure checks, ${sFailed} fail`,
  ))
  assertions.push(assert(
    'pytest-green',
    pytest.exit === 0,
    `${pytest.runner} exit ${pytest.exit}`,
  ))

  // The deterministic half ran fully real; the live AI drafting did not run in
  // this harness, so it stays INCONCLUSIVE (never a fabricated pass).
  const ran = register.exit === 0 && resolved.exit === 0 && reregister.exit === 0
  const allPass = assertions.every((a) => a.status === 'PASS')
  const verdict = !ran ? 'INCONCLUSIVE' : allPass ? 'PASS' : 'FAIL'

  return {
    ticket: 'LS5',
    issue: 365,
    title: 'brownfield adoption wizard (LS·5)',
    ranAt: new Date().toISOString(),
    // The registry-append + resolver recognition run fully real on disk
    // (deterministic). The drafted-spec STRUCTURE is proven against a seeded
    // draft. The live AI extraction itself is out of harness scope.
    mode: 'deterministic',
    liveDraftRun: 'INCONCLUSIVE — live AI surface-extraction not executed (no live-AI step in this harness); structure proven against a seeded draft',
    sandbox: relative(REPO_ROOT, root),
    commands,
    fileTree: {
      added: fileTree(root, [
        'src/billing/index.ts',
        'src/billing/invoice.ts',
        'src/billing/discount.ts',
        '.specify/companion.yml',
        'capabilities/billing/spec.md',
      ]),
      modified: [],
      removed: [],
    },
    config: configAfter,
    registerResult: registerJson,
    resolverOutput: resolved.stdout,
    draftedSpec: {
      path: 'capabilities/billing/spec.md',
      mode: 'seeded',
      text: draftText,
    },
    structureChecks: structure.checks,
    assertions,
    pytest: { runner: pytest.runner, exit: pytest.exit, tail: pytest.stdoutTail },
    verdict,
  }
}

const RUNNERS = { LS1: runLs1, LS2: runLs2, LS3: runLs3, LS4: runLs4, LS5: runLs5 }

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
