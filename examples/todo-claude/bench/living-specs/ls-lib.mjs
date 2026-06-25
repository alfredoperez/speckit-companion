// bench/living-specs/ls-lib.mjs — shared arrange helpers for the Living Specs
// sandbox demos. Thin layer over the existing bench helpers in ../lib.mjs: it
// bakes a throwaway repo with a livingSpecs companion.yml + a capability spec
// fixture, plants code files + a stray orphan spec, and gives the demo runner a
// place to capture real resolver/pytest output. LS·1 is `deterministic` (no AI),
// so it does not install spec-kit — it points the real shipped resolver at the
// sandbox via --root.
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

import { REPO_ROOT, gitInitCell, gitCommitCellBaseline, readText } from '../lib.mjs'

export const LS_DIR = dirname(fileURLToPath(import.meta.url))
export const EVIDENCE_DIR = join(LS_DIR, 'evidence')
export const RESOLVER = join(REPO_ROOT, 'speckit-extension', 'scripts', 'resolve-spec-paths.py')
export const WRITE_CONTEXT = join(REPO_ROOT, 'speckit-extension', 'scripts', 'write-context.py')
export const TEST_FILE = join(REPO_ROOT, 'speckit-extension', 'tests', 'test_living_specs.py')
export const SANDBOX_ROOT = join(REPO_ROOT, 'examples', 'bench-sandboxes')

function write(root, rel, body) {
  const p = join(root, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, body)
}

// Repo-relative path for the recorded `cmd` strings + evidence — never leak an
// absolute home path or username into committed evidence.
function rel(p) {
  return relative(REPO_ROOT, p)
}

// Arrange — bake a throwaway repo for the LS·1 demo. checkout + checkout-cart
// (nested), enabled:true; a centralized todos capability spec on disk; planted
// code files under each area; and a stray orphan spec no capability claims.
export function bakeLs1Repo(name = 'ls-1') {
  const root = join(SANDBOX_ROOT, name)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })

  write(root, join('.specify', 'companion.yml'), [
    'livingSpecs:',
    '  enabled: true',
    '  capabilities:',
    '    - name: checkout',
    '      match: ["src/checkout/**"]',
    '      exclude: ["src/checkout/**/*.test.ts"]',
    '    - name: checkout-cart',
    '      match: ["src/checkout/cart/**"]',
    '    - name: todos',
    '      match: ["src/todos/**"]',
    '',
  ].join('\n'))

  write(root, join('capabilities', 'todos', 'spec.md'), '# Todos capability\n\nLiving spec for the todos area.\n')
  write(root, join('src', 'checkout', 'index.ts'), '// checkout\n')
  write(root, join('src', 'checkout', 'cart', 'cart.ts'), '// cart\n')
  write(root, join('src', 'todos', 'list.ts'), '// todos\n')
  // A stray spec no capability's spec path claims — must surface as an orphan.
  write(root, join('notes', 'stray.spec.md'), '# stray\n')
  // Reserved-tier sibling — must NEVER be flagged as an orphan.
  write(root, join('capabilities', 'todos', 'spec.arch.md'), '# arch\n')

  gitInitCell(root)
  gitCommitCellBaseline(root)
  return root
}

// A second arrangement for the opt-out case: same repo shape, enabled:false.
export function bakeOptOutRepo(name = 'ls-1-optout') {
  const root = bakeLs1Repo(name)
  write(root, join('.specify', 'companion.yml'), [
    'livingSpecs:',
    '  enabled: false',
    '  capabilities:',
    '    - name: checkout',
    '      match: ["src/checkout/**"]',
    '',
  ].join('\n'))
  return root
}

// Act — run the shipped resolver against the sandbox via --root, capturing the
// real stdout + exit code (never paraphrased). Mirrors the evidence contract's
// commands[] shape.
export function runResolver(root, args) {
  let stdout = ''
  let exit = 0
  try {
    stdout = execFileSync('python3', [RESOLVER, '--root', root, ...args], { encoding: 'utf8' })
  } catch (e) {
    stdout = (e.stdout || '') + (e.stderr || '')
    exit = typeof e.status === 'number' ? e.status : 1
  }
  return {
    cwd: rel(root),
    cmd: `python3 ${rel(RESOLVER)} --root ${rel(root)} ${args.join(' ')}`,
    exit,
    stdout: stdout.trim(),
    stdoutTail: stdout.trim().split('\n').slice(-40).join('\n'),
  }
}

// Act — run the pytest suite, capturing real output + exit. Falls back to the
// stdlib unittest runner when pytest is not importable.
export function runPytest() {
  const tryRun = (mod, extra) => {
    try {
      const out = execFileSync('python3', ['-m', mod, ...extra], { encoding: 'utf8', cwd: REPO_ROOT })
      return { mod, exit: 0, stdout: out.trim() }
    } catch (e) {
      const out = (e.stdout || '') + (e.stderr || '')
      return { mod, exit: typeof e.status === 'number' ? e.status : 1, stdout: out.trim(), err: e.message }
    }
  }
  let res = tryRun('pytest', [TEST_FILE, '-q'])
  if (res.err && /No module named pytest/.test(res.stdout + (res.err || ''))) {
    res = tryRun('unittest', ['-v', 'speckit-extension.tests.test_living_specs'])
  }
  return {
    runner: res.mod,
    cwd: '.',
    cmd: `python3 -m ${res.mod} ${res.mod === 'pytest' ? rel(TEST_FILE) + ' -q' : '-v speckit-extension.tests.test_living_specs'}`,
    exit: res.exit,
    stdout: res.stdout,
    stdoutTail: res.stdout.split('\n').slice(-12).join('\n'),
  }
}

// --- LS·2: the read-path demo ------------------------------------------------
//
// LS·2 wires the LS·1 resolver into specify/plan: a change touching a configured
// capability auto-loads that capability's living spec and records the loaded
// names onto .spec-context.json (livingSpecs.loaded). This demo is `deterministic`
// — it proves the two halves the node prose orchestrates with real exec/read:
//   (1) the resolver resolves the capability for the sandbox's changed files, and
//   (2) the recording write path (write-context.py --living-specs) produces the
//       livingSpecs.loaded field on a real .spec-context.json.
// A genuine live-AI specify run is out of scope for this harness, so any live step
// stays INCONCLUSIVE rather than a fabricated pass.

// Arrange — a sandbox with a `todos` capability (populated spec) + nested
// `todos-items`, enabled:true, and a feature dir holding a minimal
// .spec-context.json the recorder writes onto. Mirrors the #362 acceptance shape
// (a change touching the capability area loads its spec).
export function bakeLs2Repo(name = 'ls-2') {
  const root = join(SANDBOX_ROOT, name)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })

  write(root, join('.specify', 'companion.yml'), [
    'livingSpecs:',
    '  enabled: true',
    '  capabilities:',
    '    - name: todos',
    '      match: ["src/todos/**"]',
    '    - name: todos-items',
    '      match: ["src/todos/items/**"]',
    '',
  ].join('\n'))

  write(root, join('capabilities', 'todos', 'spec.md'),
    '# Todos capability\n\nThe todos area owns the task list, its store, and persistence.\n')
  write(root, join('capabilities', 'todos-items', 'spec.md'),
    '# Todos items capability\n\nThe item row, its toggle + delete affordances.\n')
  write(root, join('src', 'todos', 'list.ts'), '// todos\n')
  write(root, join('src', 'todos', 'items', 'item.ts'), '// item\n')

  // The feature dir the recorder writes onto — a minimal valid context.
  write(root, join('specs', '001-add-due-dates', '.spec-context.json'), JSON.stringify({
    workflow: 'speckit',
    specName: '001-add-due-dates',
    branch: '001-add-due-dates',
    currentStep: 'specify',
    status: 'specified',
    history: [],
  }) + '\n')

  gitInitCell(root)
  gitCommitCellBaseline(root)
  return root
}

// Opt-out arrangement: same shape, enabled:false — nothing should resolve.
export function bakeLs2OptOutRepo(name = 'ls-2-optout') {
  const root = bakeLs2Repo(name)
  write(root, join('.specify', 'companion.yml'), [
    'livingSpecs:',
    '  enabled: false',
    '  capabilities:',
    '    - name: todos',
    '      match: ["src/todos/**"]',
    '',
  ].join('\n'))
  return root
}

// Act — run the real recording write path against the sandbox feature dir, then
// re-read the .spec-context.json it wrote. Every value captured from real exec +
// readFileSync (never paraphrased).
export function runRecordWrite(root, featureRel, names) {
  const flags = names.flatMap((n) => ['--living-specs', n])
  let stdout = ''
  let exit = 0
  try {
    stdout = execFileSync(
      'python3',
      [WRITE_CONTEXT, '--feature-dir', join(root, featureRel), ...flags],
      { encoding: 'utf8', cwd: root },
    )
  } catch (e) {
    stdout = (e.stdout || '') + (e.stderr || '')
    exit = typeof e.status === 'number' ? e.status : 1
  }
  let ctx = null
  try {
    ctx = JSON.parse(readFileSync(join(root, featureRel, '.spec-context.json'), 'utf8'))
  } catch { ctx = null }
  // The writer echoes an absolute target path; strip the home/repo prefix so the
  // committed evidence stays repo-relative (no /Users/<name>/ leak — LS·1 lesson).
  const clean = stdout.trim().split(`${REPO_ROOT}/`).join('')
  return {
    cwd: rel(root),
    cmd: `python3 ${rel(WRITE_CONTEXT)} --feature-dir ${featureRel} ${flags.join(' ')}`,
    exit,
    stdout: clean,
    stdoutTail: clean.split('\n').slice(-12).join('\n'),
    ctx,
  }
}

export function fileTree(root, rels) {
  return rels.filter((r) => existsSync(join(root, r)))
}

// --- LS·3: the write path (archive-as-merge / fold-back) ---------------------
//
// LS·3 folds the feature spec's requirement deltas into the durable living spec
// at mark-complete. Mode is `real+seeded-spec`: the fold logic — the unit under
// test — runs fully real on disk (real write-context.py --fold-living-spec, real
// readFileSync of before/after), with only the model's prose seeded (a real
// feature spec carrying a genuine `## ADDED Requirements` delta) so the part NOT
// under test (the AI's authoring variability) is removed.

export const CHECK_LIVING_SPEC = join(
  REPO_ROOT, '.claude', 'skills', 'eval-speckit-extension', 'check_living_spec.py')

// Arrange — bake a real git repo: a real centralized `todos` capability spec, a
// real feature spec carrying a genuine ADDED Requirements delta, code under the
// capability's area, and a feature branch with a change so the fold's git
// merge-base diff yields in-scope files.
export function bakeLs3Repo(name = 'ls-3') {
  const root = join(SANDBOX_ROOT, name)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })

  write(root, join('.specify', 'companion.yml'), [
    'livingSpecs:',
    '  enabled: true',
    '  capabilities:',
    '    - name: todos',
    '      match: ["src/todos/**"]',
    '',
  ].join('\n'))

  // The REAL living spec the fold writes into (OpenSpec requirement + scenario shape).
  write(root, join('capabilities', 'todos', 'spec.md'), [
    '# Todos capability',
    '',
    '### Users can add a todo',
    '',
    '#### Scenario: add a todo',
    '- WHEN a user types text and submits',
    '- THEN a todo appears in the list',
    '',
  ].join('\n'))

  // The REAL feature spec carrying a genuine ADDED Requirements delta (seeded prose).
  write(root, join('specs', '001-add-due-dates', 'spec.md'), [
    '# Add due dates',
    '',
    'Lets a user attach a due date to a todo.',
    '',
    '## ADDED Requirements',
    '',
    '### Users can set a due date on a todo',
    '',
    '#### Scenario: set a due date',
    '- WHEN a user picks a date for a todo',
    '- THEN the todo shows the due date',
    '',
    '#### Scenario: clear a due date',
    '- WHEN a user clears the date',
    '- THEN the todo shows no due date',
    '',
  ].join('\n'))

  // A finished feature context — the state mark-complete folds from.
  write(root, join('specs', '001-add-due-dates', '.spec-context.json'), JSON.stringify({
    workflow: 'speckit',
    specName: '001-add-due-dates',
    branch: '001-add-due-dates',
    currentStep: 'implement',
    status: 'implemented',
    history: [],
  }) + '\n')

  write(root, join('src', 'todos', 'list.ts'), '// todos\n')

  gitInitCell(root)
  gitCommitCellBaseline(root)
  // A feature branch with a change so `git diff` (merge-base) yields in-scope files.
  execFileSync('git', ['checkout', '-q', '-b', '001-add-due-dates'], { cwd: root })
  writeFileSync(join(root, 'src', 'todos', 'list.ts'), '// todos — due dates\n')
  execFileSync('git', ['add', '-A'], { cwd: root })
  execFileSync('git', ['commit', '-qm', 'add due dates'], { cwd: root })
  return root
}

// An opt-out arrangement: identical shape, enabled:false — the fold must be inert.
export function bakeLs3OptOutRepo(name = 'ls-3-optout') {
  const root = bakeLs3Repo(name)
  write(root, join('.specify', 'companion.yml'), [
    'livingSpecs:',
    '  enabled: false',
    '  capabilities:',
    '    - name: todos',
    '      match: ["src/todos/**"]',
    '',
  ].join('\n'))
  execFileSync('git', ['add', '-A'], { cwd: root })
  execFileSync('git', ['commit', '-qm', 'opt out'], { cwd: root })
  return root
}

// Act — run the REAL fold script against the sandbox feature dir, capturing real
// stdout + exit. The fold resolves the capability, applies the delta to the real
// capability spec on disk, and records livingSpecs.synced.
export function runFold(root, featureRel) {
  let stdout = ''
  let exit = 0
  try {
    stdout = execFileSync('python3', [WRITE_CONTEXT, '--feature-dir', join(root, featureRel),
      '--fold-living-spec', '--by', 'ai'], { encoding: 'utf8', cwd: root })
  } catch (e) {
    stdout = (e.stdout || '') + (e.stderr || '')
    exit = typeof e.status === 'number' ? e.status : 1
  }
  const clean = stdout.trim().split(`${REPO_ROOT}/`).join('').split(`${root}/`).join('')
  let ctx = null
  try {
    ctx = JSON.parse(readFileSync(join(root, featureRel, '.spec-context.json'), 'utf8'))
  } catch { ctx = null }
  return {
    cwd: rel(root),
    cmd: `python3 ${rel(WRITE_CONTEXT)} --feature-dir ${featureRel} --fold-living-spec --by ai`,
    exit,
    stdout: clean,
    stdoutTail: clean.split('\n').slice(-12).join('\n'),
    ctx,
  }
}

// Act — a real `git diff --no-index` unified diff of the living spec before/after
// (captured to two temp files), repo-relative labels only.
export function unifiedDiff(beforeText, afterText) {
  const tmp = join(SANDBOX_ROOT, '.diff-tmp')
  mkdirSync(tmp, { recursive: true })
  const a = join(tmp, 'before.md')
  const b = join(tmp, 'after.md')
  writeFileSync(a, beforeText)
  writeFileSync(b, afterText)
  let out = ''
  try {
    out = execFileSync('git', ['diff', '--no-index', '--', a, b], { encoding: 'utf8' })
  } catch (e) {
    // git diff --no-index exits 1 when files differ — that's the normal case.
    out = (e.stdout || '')
  }
  rmSync(tmp, { recursive: true, force: true })
  // Strip absolute temp paths from the diff labels so committed evidence is clean.
  return out.split(`${tmp}/`).join('').split(`${SANDBOX_ROOT}/`).join('')
}

// Act — run the real check_living_spec.py over before/after + the feature spec,
// capturing its --json report (real exec, never paraphrased).
export function runCheckLivingSpec(featureSpecPath, beforeText, afterText) {
  const tmp = join(SANDBOX_ROOT, '.cls-tmp')
  mkdirSync(tmp, { recursive: true })
  const a = join(tmp, 'before.md')
  const b = join(tmp, 'after.md')
  writeFileSync(a, beforeText)
  writeFileSync(b, afterText)
  let stdout = ''
  let exit = 0
  try {
    stdout = execFileSync('python3', [CHECK_LIVING_SPEC, '--feature-spec', featureSpecPath,
      '--before', a, '--after', b, '--json'], { encoding: 'utf8' })
  } catch (e) {
    stdout = (e.stdout || '') + (e.stderr || '')
    exit = typeof e.status === 'number' ? e.status : 1
  }
  rmSync(tmp, { recursive: true, force: true })
  let report = null
  try { report = JSON.parse(stdout) } catch { report = null }
  return { exit, report, stdout: stdout.trim() }
}

// --- LS·4: the end-to-end accumulation gate ----------------------------------
//
// LS·4 is the v1 "done" gate: it proves the whole loop works by driving TWO
// features through the real fold against ONE repo and confirming the living spec
// ACCUMULATES both. Feature A is additive (its spec carries NO delta block) so its
// fold is a clean no-op; feature B carries a real `## ADDED Requirements` delta so
// it folds in. The accumulation runs reuse the LS·3 fold path verbatim (real
// write-context.py --fold-living-spec, real readFileSync), so this is the same
// `real+seeded-spec` mode — only the model's prose is seeded. The opt-out run is
// `deterministic`: enabled:false → the fold is inert, asserted by byte-equality +
// an empty capabilities/** file-tree diff.

// The two feature deltas, reused by the opt-out repo so the disabled fold has a
// real delta to (not) apply.
const LS4_FEATURE_A_SPEC = [
  '# Add a clear-completed button',
  '',
  'Adds a button that removes all completed todos. Purely additive — no change to',
  'the capability\'s requirements, so no delta block.',
  '',
].join('\n')

const LS4_FEATURE_B_SPEC = [
  '# Add due dates',
  '',
  'Lets a user attach a due date to a todo.',
  '',
  '## ADDED Requirements',
  '',
  '### Users can set a due date on a todo',
  '',
  '#### Scenario: set a due date',
  '- WHEN a user picks a date for a todo',
  '- THEN the todo shows the due date',
  '',
  '#### Scenario: clear a due date',
  '- WHEN a user clears the date',
  '- THEN the todo shows no due date',
  '',
].join('\n')

const LS4_LIVING_SPEC = [
  '# Todos capability',
  '',
  '### Users can add a todo',
  '',
  '#### Scenario: add a todo',
  '- WHEN a user types text and submits',
  '- THEN a todo appears in the list',
  '',
].join('\n')

function finishedContext(name) {
  return JSON.stringify({
    workflow: 'speckit',
    specName: name,
    branch: name,
    currentStep: 'implement',
    status: 'implemented',
    history: [],
  }) + '\n'
}

// Arrange — bake a real git repo with one `todos` capability + a real living spec,
// feature A (additive, no delta) and feature B (real ADDED delta). Each feature dir
// gets a finished .spec-context.json (the state mark-complete folds from), and each
// feature lands an in-scope src/todos/** change on its own branch so the fold's
// merge-base diff yields files the resolver claims. Returns { root, featureA, featureB }.
export function bakeLs4Repo(name = 'ls-4', { enabled = true } = {}) {
  const root = join(SANDBOX_ROOT, name)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })

  write(root, join('.specify', 'companion.yml'), [
    'livingSpecs:',
    `  enabled: ${enabled}`,
    '  capabilities:',
    '    - name: todos',
    '      match: ["src/todos/**"]',
    '',
  ].join('\n'))

  write(root, join('capabilities', 'todos', 'spec.md'), LS4_LIVING_SPEC)
  const featureA = 'specs/001-clear-completed'
  const featureB = 'specs/002-add-due-dates'
  write(root, join(featureA, 'spec.md'), LS4_FEATURE_A_SPEC)
  write(root, join(featureA, '.spec-context.json'), finishedContext('001-clear-completed'))
  write(root, join(featureB, 'spec.md'), LS4_FEATURE_B_SPEC)
  write(root, join(featureB, '.spec-context.json'), finishedContext('002-add-due-dates'))
  write(root, join('src', 'todos', 'list.ts'), '// todos\n')

  gitInitCell(root)
  gitCommitCellBaseline(root)

  // Feature A's branch + in-scope change (merge-base diff yields src/todos/**).
  execFileSync('git', ['checkout', '-q', '-b', '001-clear-completed'], { cwd: root })
  writeFileSync(join(root, 'src', 'todos', 'list.ts'), '// todos — clear completed\n')
  execFileSync('git', ['add', '-A'], { cwd: root })
  execFileSync('git', ['commit', '-qm', 'clear completed'], { cwd: root })
  execFileSync('git', ['checkout', '-q', 'main'], { cwd: root })

  // Feature B's branch + in-scope change.
  execFileSync('git', ['checkout', '-q', '-b', '002-add-due-dates'], { cwd: root })
  writeFileSync(join(root, 'src', 'todos', 'list.ts'), '// todos — due dates\n')
  execFileSync('git', ['add', '-A'], { cwd: root })
  execFileSync('git', ['commit', '-qm', 'add due dates'], { cwd: root })

  return { root, featureA, featureB }
}

// Opt-out arrangement: identical shape, enabled:false, with feature B's real delta
// present so the disabled fold has a genuine delta to (not) apply.
export function bakeLs4OptOutRepo(name = 'ls-4-optout') {
  return bakeLs4Repo(name, { enabled: false })
}

// List the relative paths of every file under capabilities/** (sorted), so the
// opt-out's file-tree diff can assert no new capability files were created.
export function capabilitiesTree(root) {
  const base = join(root, 'capabilities')
  if (!existsSync(base)) return []
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory()) walk(p)
      else out.push(relative(root, p))
    }
  }
  walk(base)
  return out.sort()
}

// --- LS·5: brownfield adoption wizard ---------------------------------------
//
// The wizard's drafting is a live AI step (read code surface → write prose), out
// of this harness's scope — that part is marked INCONCLUSIVE, never faked. What
// runs REAL here is the deterministic half: the registry-append helper lands a
// `billing` capability in companion.yml and the shipped resolver then recognizes
// `src/billing/x.ts`; and the STRUCTURE of a drafted spec is asserted against a
// SEEDED draft (authored as the test input, clearly not model output).

export const REGISTER = join(REPO_ROOT, 'speckit-extension', 'scripts', 'register-capability.py')

// Arrange — bake a brownfield repo with a real `src/billing/` area and NO living
// specs config yet (the adoption starting point). enabled defaults to off; the
// register helper creates the block on first append.
export function bakeLs5Repo(name = 'ls-5') {
  const root = join(SANDBOX_ROOT, name)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })

  // A small but real billing surface — exports the wizard would read.
  write(root, join('src', 'billing', 'index.ts'),
    'export { createInvoice } from "./invoice"\nexport { applyDiscount } from "./discount"\n')
  write(root, join('src', 'billing', 'invoice.ts'),
    'export function createInvoice(amount: number) { return { amount, paid: false } }\n')
  write(root, join('src', 'billing', 'discount.ts'),
    'export function applyDiscount(total: number, pct: number) { return total * (1 - pct) }\n')

  gitInitCell(root)
  gitCommitCellBaseline(root)
  return root
}

// Act — run the real register-capability.py against the sandbox via --root,
// capturing real stdout + exit (never paraphrased). Mirrors runResolver's shape.
export function runRegister(root, args) {
  let stdout = ''
  let exit = 0
  try {
    stdout = execFileSync('python3', [REGISTER, '--root', root, ...args], { encoding: 'utf8' })
  } catch (e) {
    stdout = (e.stdout || '') + (e.stderr || '')
    exit = typeof e.status === 'number' ? e.status : 1
  }
  return {
    cwd: rel(root),
    cmd: `python3 ${rel(REGISTER)} --root ${rel(root)} ${args.join(' ')}`,
    exit,
    stdout: stdout.trim(),
    stdoutTail: stdout.trim().split('\n').slice(-20).join('\n'),
  }
}

// Read the registry block from the sandbox's companion.yml (raw text), so the
// evidence can show the appended capability verbatim.
export function readConfig(root) {
  const p = join(root, '.specify', 'companion.yml')
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

// Seed a drafted living spec — the STRUCTURE under test. This is a fixture the
// demo authors as the input to the structure check; it stands in for what the
// live wizard would write, and is labeled `mode: seeded` so it is never passed
// off as model output. It carries every required element so a PASS proves the
// check recognizes a well-formed draft (a real wizard draft must match it).
export function seedDraftedSpec(root, name = 'billing') {
  const body = [
    `# ${name[0].toUpperCase() + name.slice(1)} — Living Spec`,
    '',
    '> [DRAFT] Surface-first draft from existing code — review before trusting.',
    '',
    '## Requirements',
    '',
    '- **FR-001** Users can create an invoice for a given amount. [observed]',
    '- **FR-002** Users can apply a percentage discount to a total. [observed]',
    '- **FR-003** An invoice starts unpaid until settled. [inferred] [NEEDS CLARIFICATION: no settle path is exported — is payment handled elsewhere?]',
    '',
    '## Uncovered',
    '',
    '- src/billing/legacy.bin (binary — not read)',
    '',
  ].join('\n')
  write(root, join('capabilities', name, 'spec.md'), body)
  return body
}

// Deterministic structure check over a drafted spec's text. Returns the same
// {checks:[{id,status,detail}], failed} shape check_living_spec.py uses, so the
// evidence reads uniformly. Asserts the four required draft elements.
export function checkDraftStructure(text) {
  const checks = []
  const add = (id, ok, detail) => checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail })
  const firstLine = (text.split('\n')[0] || '').trim()
  add('title-wellformed', /^#\s+\S/.test(firstLine) && /## Requirements/.test(text),
    `title "${firstLine}" + ## Requirements present`)
  add('draft-banner', /\[DRAFT\]/.test(text), 'whole spec marked [DRAFT]')
  const hasObserved = /\[observed\]/.test(text)
  const hasInferred = /\[inferred\]/.test(text)
  add('observed-and-inferred-tags', hasObserved && hasInferred,
    `observed=${hasObserved}, inferred=${hasInferred}`)
  add('needs-clarification', /\[NEEDS CLARIFICATION:[^\]]*\]/.test(text),
    'low-confidence requirement flagged inline')
  add('uncovered-section', /##\s+Uncovered/.test(text), '## Uncovered section present')
  return { checks, failed: checks.filter((c) => c.status === 'FAIL').length }
}

export { readText }
