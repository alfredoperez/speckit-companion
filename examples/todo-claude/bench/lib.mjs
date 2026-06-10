// Shared helpers for the turbo-vs-standard bench harness.
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  rmSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'

export const BENCH_DIR = dirname(fileURLToPath(import.meta.url))
export const SANDBOX_DIR = dirname(BENCH_DIR) // examples/todo-claude
export const REPO_ROOT = resolve(SANDBOX_DIR, '..', '..') // speckit-companion
export const SPECS_DIR = join(SANDBOX_DIR, 'specs')
export const COMPANION_CONFIG = join(SANDBOX_DIR, '.specify', 'companion.yml')
export const PRESETS_DIR = join(SANDBOX_DIR, '.specify', 'presets')
export const PRESET_SRC_DIR = join(REPO_ROOT, 'speckit-extension', 'presets')
export const RUN_STATE = join(BENCH_DIR, '.run-state.json')
export const STATS_FILE = join(BENCH_DIR, 'stats.jsonl')
// Append-only trend log — NEVER deduped (stats.jsonl keeps only the latest row per
// cell; this keeps every run forever so `· vs last run` and future comparisons work).
export const HISTORY_FILE = join(BENCH_DIR, 'history.jsonl')
export const REPORT_FILE = join(BENCH_DIR, 'REPORT.md')
export const VITEST_OUT = join(BENCH_DIR, '.last-vitest.json')

// easy = update a route/title · medium = add a feature to todos · hard = a whole new feature
export const SIZES = ['easy', 'medium', 'hard']
// The bench axis is an adoption ladder. Each step adds ONE thing vs the prior:
//   speckit            — plain upstream, no companion, NO capture (blind).
//   companion-logs     — companion installed (capture/logs), SAME stock /speckit-* commands, profile off.
//   companion-standard — companion-standard preset (stock /speckit-* shape + timing + capture).
//   companion-turbo    — companion-turbo preset, lean /speckit-companion-* commands, fast-path OFF.
//   companion-fast-path— same as turbo PLUS complexityFastPath ON.
// (turbo & fast-path differ ONLY by complexityFastPath; standard & turbo differ by preset/commands.)
export const MODES = ['speckit', 'companion-logs', 'companion-standard', 'companion-turbo', 'companion-fast-path']
// Modes with companion installed → capture fires. (speckit is the only blind one.)
export const COMPANION_MODES = ['companion-logs', 'companion-standard', 'companion-turbo', 'companion-fast-path']
export const PRESET_BY_MODE = {
  'speckit': null,
  'companion-logs': null,
  'companion-standard': 'companion-standard',
  'companion-turbo': 'companion-turbo',
  'companion-fast-path': 'companion-turbo',
}
// templateProfile written into each companion cell's .specify/companion.yml.
export const PROFILE_BY_MODE = {
  'companion-logs': 'off',
  'companion-standard': 'standard',
  'companion-turbo': 'turbo',
  'companion-fast-path': 'turbo',
}
export const ALL_PRESET_IDS = ['companion-standard', 'companion-turbo']
export const LEGACY_PRESET_ID = 'sdd-lean' // pre-rename leftover; removed on reconcile

// The five per-variant sandbox FOLDERS are the run folders themselves — you open
// them in VS Code and build the feature in place; there are no throwaway copies.
// They live under examples/bench-sandboxes/ (gitignored; (re)baked by sync-templates).
export const TEMPLATES_DIR = join(REPO_ROOT, 'examples', 'bench-sandboxes')
export const CHECK_CAPTURE = join(
  REPO_ROOT, '.claude', 'skills', 'eval-speckit-extension', 'check_capture.py'
)
export const SPECKIT_EXT_DIR = join(REPO_ROOT, 'speckit-extension')
// The canonical pristine app — the universal diff baseline (every folder was cloned from it).
export const CANONICAL_DIR = SANDBOX_DIR
export const CANONICAL_SRC = join(SANDBOX_DIR, 'src')
// The shared, real constitution every folder must use (specify init reseeds a
// [PROJECT_NAME] placeholder — we overwrite it with this so it's not a variable).
export const CANONICAL_CONSTITUTION = join(SANDBOX_DIR, '.specify', 'memory', 'constitution.md')

export function seedConstitution(dir) {
  if (!existsSync(CANONICAL_CONSTITUTION)) return
  const dst = join(dir, '.specify', 'memory', 'constitution.md')
  mkdirSync(dirname(dst), { recursive: true })
  run('cp', [CANONICAL_CONSTITUTION, dst])
}

export function folderDir(style) {
  return join(TEMPLATES_DIR, `todo-${style}`)
}

// Pin the SpecKit Companion settings per folder via .vscode/settings.json, so
// opening it in VS Code already has the right profile/provider selected — no
// manual setup, and the workspace value can't be clobbered by a global setting.
export function writeVscodeSettings(dir, mode) {
  const s = {
    'speckit.aiProvider': 'claude',
    'speckit.companion.templateProfile': mode === 'speckit' ? 'off' : PROFILE_BY_MODE[mode],
    // Pin fast-path in EVERY folder so the user's global setting can't leak in.
    // Only the dedicated companion-fast-path mode runs WITH it; everything else false.
    'speckit.companion.complexityFastPath': mode === 'companion-fast-path',
  }
  mkdirSync(join(dir, '.vscode'), { recursive: true })
  writeFileSync(join(dir, '.vscode', 'settings.json'), JSON.stringify(s, null, 2) + '\n')
}

export function readJson(p, fallback = null) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}

export function readText(p, fallback = '') {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return fallback
  }
}

export function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const eq = a.indexOf('=')
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1)
    } else {
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        out[a.slice(2)] = next
        i++
      } else {
        out[a.slice(2)] = true
      }
    }
  }
  return out
}

export function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
}

export function listSpecDirs() {
  if (!existsSync(SPECS_DIR)) return []
  return readdirSync(SPECS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

export function specContextMtime(name) {
  const p = join(SPECS_DIR, name, '.spec-context.json')
  try {
    return statSync(p).mtimeMs
  } catch {
    return 0
  }
}

// Set the sandbox's templateProfile (source of truth the extension/GUI reads),
// preserving any other keys already in .specify/companion.yml.
export function setTemplateProfile(profile) {
  let text
  if (existsSync(COMPANION_CONFIG)) {
    text = readFileSync(COMPANION_CONFIG, 'utf8')
    if (/^templateProfile:.*$/m.test(text)) {
      text = text.replace(/^templateProfile:.*$/m, `templateProfile: ${profile}`)
    } else {
      text = `${text.trimEnd()}\ntemplateProfile: ${profile}\n`
    }
  } else {
    text = `# Managed by bench/prep.mjs — sandbox template profile.\ntemplateProfile: ${profile}\n`
  }
  mkdirSync(dirname(COMPANION_CONFIG), { recursive: true })
  writeFileSync(COMPANION_CONFIG, text)
}

// A preset is "installed" when its install dir exists under .specify/presets/.
export function isPresetInstalled(id) {
  return existsSync(join(PRESETS_DIR, id))
}

// Mirror of companionPresetReconciler.decidePresetOps: converge to "only the
// target preset installed", removes before the add, plus legacy cleanup.
export function decidePresetOps(mode) {
  const target = PRESET_BY_MODE[mode]
  const removes = []
  let add = null
  for (const id of ALL_PRESET_IDS) {
    if (id === target) {
      add = { id, action: isPresetInstalled(id) ? 'enable' : 'add' }
    } else if (isPresetInstalled(id)) {
      removes.push({ id, action: 'remove' })
    }
  }
  if (isPresetInstalled(LEGACY_PRESET_ID)) {
    removes.push({ id: LEGACY_PRESET_ID, action: 'remove' })
  }
  return add ? [...removes, add] : removes
}

export function relFromRepo(p) {
  return relative(REPO_ROOT, p)
}

export function fmtDur(sec) {
  if (sec == null || Number.isNaN(sec)) return '—'
  const s = Math.round(sec)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}m ${r}s` : `${m}m`
}

export function fmtDelta(std, turbo, asDur = false) {
  if (std == null || turbo == null || Number.isNaN(std) || Number.isNaN(turbo)) return '—'
  const d = std - turbo
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  const mag = asDur ? fmtDur(Math.abs(d)) : String(Math.abs(d))
  return d === 0 ? '0' : `${sign}${mag}`
}

// ── Multi-cell orchestration helpers (3-style round) ───────────────────────

function run(cmd, cmdArgs, opts = {}) {
  return execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: 'pipe', ...opts })
}

// Clone a directory fast. On APFS, `cp -cR` is a copy-on-write reflink — instant
// and near-zero disk until files diverge — so even node_modules (~107M) is cheap.
// Falls back to a plain recursive copy off-APFS.
// Robustly remove a dir even when it holds a .git with read-only pack objects
// (node rmSync can hit ENOTEMPTY on APFS there).
export function removeDir(dest) {
  if (!existsSync(dest)) return
  try { run('chmod', ['-R', 'u+w', dest]) } catch { /* */ }
  try { run('rm', ['-rf', dest]) } catch { rmSync(dest, { recursive: true, force: true }) }
}

export function cloneDir(src, dest) {
  removeDir(dest)
  mkdirSync(dirname(dest), { recursive: true })
  try {
    run('cp', ['-cR', src, dest])
  } catch {
    run('cp', ['-R', src, dest])
  }
}

// Give a folder its own git repo so the capture writer's `git rev-parse
// --show-toplevel` resolves to the folder (not the parent repo), and any git the
// pipeline runs stays isolated. No commit needed — node_modules is gitignored.
export function gitInitCell(cellDir) {
  try { run('git', ['init', '-q', '-b', 'main', cellDir]) } catch { /* git absent — capture falls back to feature.json */ }
}

// Reset a run folder to pristine for the next round: restore the mutable working
// surface (src/, index.html) from the canonical app and clear the generated spec.
// Leaves .specify/ (the armed companion state), node_modules, and .git intact.
export function resetFolder(dir) {
  rmSync(join(dir, 'src'), { recursive: true, force: true })
  run('cp', ['-cR', CANONICAL_SRC, join(dir, 'src')])
  try { run('cp', [join(CANONICAL_DIR, 'index.html'), join(dir, 'index.html')]) } catch { /* */ }
  rmSync(join(dir, 'specs'), { recursive: true, force: true })
  mkdirSync(join(dir, 'specs'), { recursive: true })
  rmSync(join(dir, '.specify', 'feature.json'), { force: true })
  rmSync(join(dir, '.run-meta.json'), { force: true })
}

// Make a cell pure-upstream: remove every companion artifact so the stock
// `/speckit.*` commands run with no capture hooks and no preset overrides.
export function stripCompanion(cellDir) {
  for (const rel of [
    join('.specify', 'extensions.yml'),
    join('.specify', 'extensions'),
    join('.specify', 'companion.yml'),
    join('.specify', 'presets'),
  ]) {
    rmSync(join(cellDir, rel), { recursive: true, force: true })
  }
  // Drop the companion command emissions, keep the stock speckit.* ones.
  const cmds = join(cellDir, '.claude', 'commands')
  if (existsSync(cmds)) {
    for (const f of readdirSync(cmds)) {
      if (f.startsWith('speckit.companion.')) rmSync(join(cmds, f), { force: true })
    }
  }
}

// files-changed / +LOC / −LOC of a folder's src/ vs the canonical pristine src,
// via `git diff --no-index` (works outside a repo; exits 1 when there's a diff).
export function diffAgainstBaseline(folderDir) {
  let out = ''
  try {
    out = run('git', ['diff', '--no-index', '--numstat', CANONICAL_SRC, join(folderDir, 'src')], { stdio: ['ignore', 'pipe', 'ignore'] })
  } catch (e) {
    out = (e && e.stdout) || ''
  }
  let filesChanged = 0, locAdded = 0, locRemoved = 0
  for (const line of String(out).split('\n').filter(Boolean)) {
    const [add, del] = line.split('\t')
    filesChanged++
    locAdded += Number(add) || 0
    locRemoved += Number(del) || 0
  }
  return { filesChanged, locAdded, locRemoved }
}

// Recursively list files under a dir, relative to it.
function listFilesRec(dir, baseRel = '', acc = []) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    const rel = baseRel ? `${baseRel}/${e.name}` : e.name
    if (e.isDirectory()) listFilesRec(join(dir, e.name), rel, acc)
    else acc.push(rel)
  }
  return acc
}

// Changed src/ files (added/modified/deleted) vs the pristine snapshot, with the
// current content of each — the substrate for convention + blast-radius checks.
export function changedSrcFiles(folderDir) {
  const cur = join(folderDir, 'src')
  const curFiles = new Set(listFilesRec(cur))
  const baseFiles = new Set(listFilesRec(CANONICAL_SRC))
  const changed = []
  for (const f of curFiles) {
    const a = readText(join(cur, f))
    if (!baseFiles.has(f)) changed.push({ path: f, status: 'added', content: a })
    else if (a !== readText(join(CANONICAL_SRC, f))) changed.push({ path: f, status: 'modified', content: a })
  }
  for (const f of baseFiles) if (!curFiles.has(f)) changed.push({ path: f, status: 'deleted', content: '' })
  return changed
}

// Deterministic convention checks against the app's CLAUDE.md rules. Returns a
// list of violation strings (empty = clean).
export function conventionChecks(changed) {
  const v = []
  for (const f of changed) {
    if (f.status === 'deleted') continue
    if (/\.test\.[jt]sx?$/.test(f.path)) continue // tests legitimately touch localStorage/state in setup
    if (/\blocalStorage\b/.test(f.content) && !/lib\/storage\.ts$/.test(f.path)) {
      v.push(`direct localStorage in ${f.path} (must go through lib/storage)`)
    }
    if (/\b(useReducer|createContext)\b/.test(f.content) && !/^store\//.test(f.path)) {
      v.push(`shared-state primitive (reducer/context) in ${f.path} (belongs in store/)`)
    }
  }
  return v
}

// Files changed outside the area a given size is expected to touch (soft signal).
const SCOPE = {
  easy: [/^components\/Header\./, /^App\./],
  medium: [/^components\/(TodoItem|TodoList|AddTodo)\./, /^pages\/TodosPage\./, /^store\//, /^types\./, /^lib\//, /^App\./],
  hard: [/^pages\//, /^components\//, /^store\//, /^lib\/storage\./, /^types\./, /^App\./, /^main\./],
}
export function blastRadius(size, changed) {
  const allow = SCOPE[size] || []
  const files = changed.filter((c) => c.status !== 'deleted').map((c) => c.path)
  const outOfScope = files.filter((p) => !allow.some((re) => re.test(p)))
  return { files, outOfScope }
}

// Full existing-app test suite (src/**, NOT the hidden bench oracle) — catches a
// run that built the feature but regressed add/toggle/delete.
function runRegression(cwd) {
  const out = join(cwd, '.last-regress.json')
  rmSync(out, { force: true })
  try {
    execFileSync('npm', ['run', 'test', '--', 'src', '--reporter=json', `--outputFile=${out}`],
      { cwd, stdio: 'ignore', timeout: 300000 })
  } catch { /* failing tests still write json */ }
  const r = readJson(out, {})
  return { passed: r.numPassedTests ?? 0, total: r.numTotalTests ?? 0 }
}

// Run the lifecycle-capture eval (the /eval-speckit-extension checker) against a
// spec dir. Returns null when there's no .spec-context.json (the speckit style).
export function runCaptureEval(specDir) {
  if (!existsSync(join(specDir, '.spec-context.json'))) return null
  let raw = ''
  try {
    raw = run('python3', [CHECK_CAPTURE, '--json', specDir], { stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    raw = (e && e.stdout) || ''
  }
  const rep = readJsonStr(raw)
  if (!rep || !Array.isArray(rep.checks)) return { pass: 0, fail: 0, failing: [], error: 'no report' }
  const pass = rep.checks.filter((c) => c.status === 'PASS').length
  const failing = rep.checks.filter((c) => c.status === 'FAIL').map((c) => c.id)
  return { pass, fail: rep.failed ?? failing.length, failing, checks: rep.checks }
}

function readJsonStr(s) {
  try { return JSON.parse(s) } catch { return null }
}

// Find the spec dir a run produced inside an arbitrary cell's specs/ (newest
// .spec-context.json wins; falls back to newest dir by name).
export function newestSpecDir(specsDir) {
  if (!existsSync(specsDir)) return null
  const dirs = readdirSync(specsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  if (!dirs.length) return null
  const mtime = (d) => {
    try { return statSync(join(specsDir, d, '.spec-context.json')).mtimeMs } catch { return 0 }
  }
  return dirs.sort((a, b) => mtime(b) - mtime(a))[0]
}

// Total ceremony: every file the spec produced (spec/plan/tasks AND research,
// data-model, quickstart, contracts/**, checklists/**, …) — recursively, lines
// summed. The per-file line counts only see the big three; this is the real
// artifact volume. Excludes the machine-written .spec-context.json (not prose).
export function specArtifacts(specDir) {
  if (!specDir || !existsSync(specDir)) return { files: 0, lines: 0, byFile: {} }
  const byFile = {}
  let files = 0
  let lines = 0
  const walk = (abs, rel) => {
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const childAbs = join(abs, e.name)
      const childRel = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) { walk(childAbs, childRel); continue }
      if (e.name === '.spec-context.json') continue
      const n = (readText(childAbs) || '').split('\n').length
      byFile[childRel] = n
      files += 1
      lines += n
    }
  }
  walk(specDir, '')
  return { files, lines, byFile }
}

// ── Measurement (shared by finish.mjs single-cell + run-all.mjs round) ─────

export const STEPS = ['specify', 'plan', 'tasks', 'implement']

export function timingFromHistory(history) {
  const at = (e) => Date.parse(e.at)
  const ats = history.map(at).filter((n) => !Number.isNaN(n))
  const totalSec = ats.length >= 2 ? (Math.max(...ats) - Math.min(...ats)) / 1000 : null
  const perStep = {}
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i]
    const ofStep = history.filter((e) => e.step === step && !Number.isNaN(at(e)))
    if (!ofStep.length) { perStep[step] = null; continue }
    const starts = ofStep.filter((e) => e.kind === 'start')
    const completes = ofStep.filter((e) => e.kind === 'complete')
    const start = Math.min(...(starts.length ? starts : ofStep).map(at))
    let end
    if (completes.length) {
      end = Math.max(...completes.map(at))
    } else {
      const next = history.filter((e) => e.step === STEPS[i + 1] && !Number.isNaN(at(e)))
      end = next.length ? Math.min(...next.map(at)) : Math.max(...ofStep.map(at))
    }
    perStep[step] = end > start ? (end - start) / 1000 : null
  }
  return { totalSec, perStep }
}

function nullTiming() {
  return { totalSec: null, perStep: Object.fromEntries(STEPS.map((s) => [s, null])) }
}

function buildPasses(cwd) {
  try {
    execFileSync('npm', ['run', 'build'], { cwd, stdio: 'ignore', timeout: 300000 })
    return true
  } catch { return false }
}

function runAcceptance(cwd, size) {
  const out = join(cwd, '.last-vitest.json')
  rmSync(out, { force: true })
  try {
    execFileSync('npm', ['run', 'test', '--', `bench/acceptance/${size}.test.tsx`, '--reporter=json', `--outputFile=${out}`],
      { cwd, stdio: 'ignore', timeout: 300000 })
  } catch { /* failing tests still write the json report */ }
  const r = readJson(out, {})
  return { passed: r.numPassedTests ?? 0, total: r.numTotalTests ?? 0 }
}

// Measure one finished cell into a stats row. `mode === 'speckit'` has no
// .spec-context.json, so timing comes only from the orchestrator wall-clock.
export function measureCell({ cellDir, size, mode, runId, startedAt, finishedAt, wallClockSec, quality = null }) {
  const specsDir = join(cellDir, 'specs')
  const specName = newestSpecDir(specsDir)
  const specDir = specName ? join(specsDir, specName) : null
  const ctx = specDir ? readJson(join(specDir, '.spec-context.json'), {}) : {}

  const timing = Array.isArray(ctx.history) && ctx.history.length
    ? timingFromHistory(ctx.history)
    : nullTiming()

  const buildPass = buildPasses(cellDir)
  const acceptance = runAcceptance(cellDir, size)
  const regression = runRegression(cellDir)
  const changed = changedSrcFiles(cellDir)
  const conventions = conventionChecks(changed)
  const blast = blastRadius(size, changed)

  const specMd = readText(join(specDir || cellDir, 'spec.md'))
  const planMd = readText(join(specDir || cellDir, 'plan.md'))
  const tasksMd = readText(join(specDir || cellDir, 'tasks.md'))
  const lines = (t) => (t ? t.split('\n').length : 0)
  const hasUserStories = /user stor|user scenario/i.test(specMd)
  const taskCount = (tasksMd.match(/^\s*-?\s*\[(?:T?\d+|[ xX])\]/gm) || []).length
  const sideFiles = ['research.md', 'data-model.md', 'quickstart.md', 'contracts', 'checklists']
    .filter((f) => specDir && existsSync(join(specDir, f)))
  const artifacts = specArtifacts(specDir)

  const diff = diffAgainstBaseline(cellDir)
  const capture = mode === 'speckit' ? null : runCaptureEval(specDir || cellDir)

  return {
    runId, size, mode,
    spec: specName || null,
    specName: ctx.specName || specName || null,
    startedAt, finishedAt, wallClockSec,
    timing,
    buildPass,
    acceptancePassed: acceptance.passed,
    acceptanceTotal: acceptance.total,
    regressionPassed: regression.passed,
    regressionTotal: regression.total,
    conventions,
    blast,
    quality,
    shape: { hasUserStories, specLines: lines(specMd), planLines: lines(planMd), tasksLines: lines(tasksMd), taskCount, sideFiles, artifactFiles: artifacts.files, artifactLines: artifacts.lines },
    diff,
    capture,
  }
}

// ── 3-way report rendering (speckit | standard | turbo) ────────────────────

export function loadStatsRows() {
  return readText(STATS_FILE).split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l) } catch { return null }
  }).filter(Boolean)
}

export function loadHistoryRows() {
  return readText(HISTORY_FILE).split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l) } catch { return null }
  }).filter(Boolean)
}

// 0–100 health composite for one cell: correctness (45) + rubric (30) + capture (25).
// Cohort-independent on purpose — a cell's score only moves when ITS OWN correctness,
// quality, or visibility moves, so a drop between runs is a real regression signal.
// Capture is the companion-vs-barebones gap: stock speckit is blind → 0 there, so an
// all-green speckit cell tops out at 75 while a captured companion cell reaches 100.
// Ceremony/efficiency stays in its own rows — folding it in would wobble per cohort.
export function computeOverall(r) {
  if (!r) return null
  const ratio = (p, t) => (t ? Math.max(0, Math.min(1, p / t)) : 0)
  const correctness = (r.buildPass ? 1 : 0) * ratio(r.acceptancePassed, r.acceptanceTotal) * ratio(r.regressionPassed, r.regressionTotal)
  const q = r.quality || {}
  const rb = ['readability', 'conventions', 'scope'].map((k) => q[k]).filter((n) => typeof n === 'number')
  const rubric = rb.length ? rb.reduce((a, b) => a + b, 0) / (rb.length * 5) : 0
  const capture = r.capture ? ratio(r.capture.pass, r.capture.pass + r.capture.fail) : 0
  return Math.round(45 * correctness + 30 * rubric + 25 * capture)
}

function latest(rows, size, mode) {
  return rows.filter((r) => r.size === size && r.mode === mode)
    .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))[0]
}

export function renderReport(rows) {
  const cap = (r) => (r?.capture ? `${r.capture.pass}✓/${r.capture.fail}✗` : r ? 'n/a' : '—')
  const qual = (r) => {
    const q = r?.quality
    if (!q) return r ? '—' : '—'
    const nums = ['readability', 'conventions', 'scope'].map((k) => q[k]).filter((n) => typeof n === 'number')
    if (!nums.length) return '—'
    return `${(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)}/5`
  }
  const dur = (r, step) => (step === 'total' ? r?.timing?.totalSec : r?.timing?.perStep?.[step])
  const cell = (r, fn) => (r ? fn(r) : '—')
  const fmtDelta = (n) => (n > 0 ? `▲+${n}` : n < 0 ? `▼${n}` : '=')

  // Append-only history → the composite this cell scored in the PREVIOUS run.
  const history = loadHistoryRows()
  const prevComposite = (size, mode, cur) => {
    if (!cur?.capturedAt) return null
    const prior = history
      .filter((h) => h.size === size && h.mode === mode && h.capturedAt && Date.parse(h.capturedAt) < Date.parse(cur.capturedAt))
      .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt))[0]
    return prior ? computeOverall(prior) : null
  }

  const metric = [
    ['Wall-clock', (r) => fmtDur(r.wallClockSec)],
    ['History total', (r) => fmtDur(dur(r, 'total'))],
    ['· specify', (r) => fmtDur(dur(r, 'specify'))],
    ['· plan', (r) => fmtDur(dur(r, 'plan'))],
    ['· tasks', (r) => fmtDur(dur(r, 'tasks'))],
    ['· implement', (r) => fmtDur(dur(r, 'implement'))],
    ['Build', (r) => (r.buildPass ? '✓' : '✗')],
    ['Acceptance', (r) => `${r.acceptancePassed}/${r.acceptanceTotal}`],
    ['Regression', (r) => `${r.regressionPassed ?? '—'}/${r.regressionTotal ?? '—'}`],
    ['Conventions', (r) => (r.conventions ? (r.conventions.length ? `${r.conventions.length} ✗` : '✓') : '—')],
    ['Out-of-scope files', (r) => (r.blast ? r.blast.outOfScope.length : '—')],
    ['Quality (rubric)', (r) => qual(r)],
    ['Capture eval', (r) => cap(r)],
    ['Spec shape', (r) => (r.shape.hasUserStories ? 'standard (US)' : 'lean (no US)')],
    ['spec.md lines', (r) => r.shape.specLines],
    ['plan.md lines', (r) => r.shape.planLines],
    ['tasks.md lines', (r) => r.shape.tasksLines],
    ['Artifact files (all)', (r) => (r.shape.artifactFiles ?? '—')],
    ['Artifact total lines', (r) => (r.shape.artifactLines ?? '—')],
    ['Task count', (r) => r.shape.taskCount],
    ['Side files', (r) => (r.shape.sideFiles?.length ? r.shape.sideFiles.join(', ') : '—')],
    ['Files changed', (r) => r.diff.filesChanged],
    ['LOC (+/−)', (r) => `+${r.diff.locAdded}/−${r.diff.locRemoved}`],
  ]

  function sizeTable(size) {
    const cells = MODES.map((m) => latest(rows, size, m))
    if (!cells.some(Boolean)) return ''
    const headRow = `| Metric | ${MODES.join(' | ')} |`
    const sep = `|${['---', ...MODES.map(() => '---')].join('|')}|`
    const body = metric.map(([label, fn]) =>
      `| ${label} | ${cells.map((r) => cell(r, fn)).join(' | ')} |`).join('\n')

    // Overall composite + its two comparison axes (need cohort + history, so not in `metric`).
    const overall = cells.map((r) => computeOverall(r))
    const base = overall[MODES.indexOf('speckit')]
    const overallRow = `| **Overall (health)** | ${overall.map((v) => (v == null ? '—' : v)).join(' | ')} |`
    const vsSpeckitRow = `| · vs speckit | ${MODES.map((m, i) =>
      m === 'speckit' ? 'base' : (overall[i] == null || base == null ? '—' : fmtDelta(overall[i] - base))).join(' | ')} |`
    const vsLastRow = `| · vs last run | ${cells.map((r, i) => {
      const prev = prevComposite(size, MODES[i], r)
      return (r == null || prev == null || overall[i] == null) ? '—' : fmtDelta(overall[i] - prev)
    }).join(' | ')} |`
    const overallBlock = `${overallRow}\n${vsSpeckitRow}\n${vsLastRow}`

    const notes = []
    for (const r of cells.filter(Boolean)) {
      if (r.conventions?.length) notes.push(`- **${r.mode} conventions:** ${r.conventions.join('; ')}`)
      if (r.blast?.outOfScope?.length) notes.push(`- **${r.mode} out-of-scope:** ${r.blast.outOfScope.join(', ')}`)
      if (r.quality?.justification) notes.push(`- **${r.mode} rubric:** ${r.quality.justification}`)
    }
    return `### ${size}\n\n${headRow}\n${sep}\n${body}\n${overallBlock}\n${notes.length ? '\n' + notes.join('\n') + '\n' : ''}`
  }

  const sections = SIZES.map(sizeTable).filter(Boolean)
  const log = rows.slice().sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt))
    .map((r) => `- \`${r.runId}\` → ${r.mode}/${r.size} · build ${r.buildPass ? '✓' : '✗'} · acceptance ${r.acceptancePassed}/${r.acceptanceTotal} · capture ${r.capture ? `${r.capture.pass}✓/${r.capture.fail}✗` : 'n/a'} · ${fmtDur(r.wallClockSec)}`)
    .join('\n')

  return `# Adoption-Ladder Bench — Report\n\n` +
    `Generated from \`bench/stats.jsonl\`. Each size shows the latest run per variant: ` +
    `**speckit** (plain, no companion) → **companion-logs** (capture, same commands) → ` +
    `**companion-standard** (standard preset) → **companion-turbo** (lean) → ` +
    `**companion-fast-path** (turbo + fast-path).\n\n` +
    `${sections.join('\n')}\n## All runs\n\n${log || '_none yet_'}\n`
}
