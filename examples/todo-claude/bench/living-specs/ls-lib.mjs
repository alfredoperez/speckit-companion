// bench/living-specs/ls-lib.mjs — shared arrange helpers for the Living Specs
// sandbox demos. Thin layer over the existing bench helpers in ../lib.mjs: it
// bakes a throwaway repo with a livingSpecs companion.yml + a capability spec
// fixture, plants code files + a stray orphan spec, and gives the demo runner a
// place to capture real resolver/pytest output. LS·1 is `deterministic` (no AI),
// so it does not install spec-kit — it points the real shipped resolver at the
// sandbox via --root.
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
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

export { readText }
