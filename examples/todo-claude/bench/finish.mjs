// bench/finish.mjs — measure the armed run and append it to the comparison.
//   node bench/finish.mjs [--spec <dir-name>]
// Reads timing from the run's .spec-context.json, runs build + the size's
// acceptance suite, diffs the implementation vs the prep baseline, appends a
// row to stats.jsonl, and re-renders REPORT.md.
import { existsSync, appendFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  BENCH_DIR,
  SANDBOX_DIR,
  SPECS_DIR,
  RUN_STATE,
  STATS_FILE,
  REPORT_FILE,
  VITEST_OUT,
  SIZES,
  readJson,
  readText,
  parseArgs,
  listSpecDirs,
  specContextMtime,
  git,
  relFromRepo,
  fmtDur,
  fmtDelta,
} from './lib.mjs'

const args = parseArgs(process.argv.slice(2))
const run = readJson(RUN_STATE)
if (!run) {
  console.error('No armed run. Run /bench-prep (node bench/prep.mjs) first.')
  process.exit(1)
}

// ── 1. Resolve which spec dir this run produced ────────────────────────────
function resolveSpecDir() {
  if (args.spec) return String(args.spec)
  const known = new Set(run.knownSpecDirs || [])
  const all = listSpecDirs()
  const fresh = all.filter((d) => !known.has(d))
  const pool = fresh.length ? fresh : all
  // newest .spec-context.json wins
  return pool.sort((a, b) => specContextMtime(b) - specContextMtime(a))[0]
}
const specName = resolveSpecDir()
if (!specName) {
  console.error('Could not find a spec dir for this run. Pass --spec <dir-name>.')
  process.exit(1)
}
const specDir = join(SPECS_DIR, specName)
const ctx = readJson(join(specDir, '.spec-context.json'), {})

// ── 2. Timing from history[] (fallback: legacy stepHistory) ────────────────
const STEPS = ['specify', 'plan', 'tasks', 'implement']
function timingFromHistory(history) {
  const at = (e) => Date.parse(e.at)
  const ats = history.map(at).filter((n) => !Number.isNaN(n))
  const totalSec = ats.length >= 2 ? (Math.max(...ats) - Math.min(...ats)) / 1000 : null
  const perStep = {}
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i]
    const ofStep = history.filter((e) => e.step === step && !Number.isNaN(at(e)))
    if (!ofStep.length) {
      perStep[step] = null
      continue
    }
    const starts = ofStep.filter((e) => e.kind === 'start')
    const completes = ofStep.filter((e) => e.kind === 'complete')
    const start = Math.min(...(starts.length ? starts : ofStep).map(at))
    let end
    if (completes.length) {
      end = Math.max(...completes.map(at))
    } else {
      // no explicit complete: bound by the next step's first start
      const next = history.filter((e) => e.step === STEPS[i + 1] && !Number.isNaN(at(e)))
      end = next.length ? Math.min(...next.map(at)) : Math.max(...ofStep.map(at))
    }
    perStep[step] = end > start ? (end - start) / 1000 : null
  }
  return { totalSec, perStep }
}
function timingFromStepHistory(sh) {
  const perStep = {}
  let min = Infinity
  let max = -Infinity
  for (const step of STEPS) {
    const s = sh[step]
    if (s?.startedAt && s?.completedAt) {
      const a = Date.parse(s.startedAt)
      const b = Date.parse(s.completedAt)
      perStep[step] = (b - a) / 1000
      min = Math.min(min, a)
      max = Math.max(max, b)
    } else {
      perStep[step] = null
    }
  }
  return { totalSec: max > min ? (max - min) / 1000 : null, perStep }
}
const timing = Array.isArray(ctx.history) && ctx.history.length
  ? timingFromHistory(ctx.history)
  : ctx.stepHistory
    ? timingFromStepHistory(ctx.stepHistory)
    : { totalSec: null, perStep: Object.fromEntries(STEPS.map((s) => [s, null])) }

// ── 3. Correctness: build + the size's acceptance suite ────────────────────
function buildPasses() {
  try {
    execFileSync('npm', ['run', 'build'], { cwd: SANDBOX_DIR, stdio: 'ignore', timeout: 300000 })
    return true
  } catch {
    return false
  }
}
function runAcceptance(size) {
  // Clear any prior report so a vitest crash (config error, missing deps) can't
  // leave a stale .last-vitest.json that we'd misread as this run's result.
  rmSync(VITEST_OUT, { force: true })
  try {
    execFileSync(
      'npm',
      ['run', 'test', '--', `bench/acceptance/${size}.test.tsx`, '--reporter=json', `--outputFile=${VITEST_OUT}`],
      { cwd: SANDBOX_DIR, stdio: 'ignore', timeout: 300000 }
    )
  } catch {
    // non-zero exit on failing tests — the json report still gets written
  }
  const r = readJson(VITEST_OUT, {})
  return {
    passed: r.numPassedTests ?? 0,
    total: r.numTotalTests ?? 0,
  }
}
const buildPass = buildPasses()
const acceptance = runAcceptance(run.size)

// ── 4. Shape / size ────────────────────────────────────────────────────────
const specMd = readText(join(specDir, 'spec.md'))
const planMd = readText(join(specDir, 'plan.md'))
const tasksMd = readText(join(specDir, 'tasks.md'))
const lines = (t) => (t ? t.split('\n').length : 0)
const hasUserStories = /user stor|user scenario/i.test(specMd)
const taskCount = (tasksMd.match(/^\s*-?\s*\[(?:T?\d+|[ xX])\]/gm) || []).length
const detectedMode = hasUserStories ? 'standard' : 'lean'
const modeMismatch = detectedMode !== run.mode

// ── 5. Diff vs the prep baseline (implementation under src/) ───────────────
let filesChanged = 0
let locAdded = 0
let locRemoved = 0
if (run.baselineGitRef) {
  try {
    const rel = relFromRepo(join(SANDBOX_DIR, 'src'))
    const out = git(['diff', '--numstat', run.baselineGitRef, '--', rel])
    for (const line of out.split('\n').filter(Boolean)) {
      const [add, del] = line.split('\t')
      filesChanged++
      locAdded += Number(add) || 0
      locRemoved += Number(del) || 0
    }
  } catch {
    /* baseline gone or git error — leave zeros */
  }
}

// ── 6. Append the row ──────────────────────────────────────────────────────
const row = {
  runId: run.runId,
  size: run.size,
  mode: run.mode,
  detectedMode,
  modeMismatch,
  spec: relFromRepo(specDir),
  specName: ctx.specName || specName,
  startedAt: run.startedAt,
  finishedAt: new Date().toISOString(),
  timing,
  buildPass,
  acceptancePassed: acceptance.passed,
  acceptanceTotal: acceptance.total,
  shape: {
    hasUserStories,
    specLines: lines(specMd),
    planLines: lines(planMd),
    tasksLines: lines(tasksMd),
    taskCount,
  },
  diff: { filesChanged, locAdded, locRemoved },
}
appendFileSync(STATS_FILE, JSON.stringify(row) + '\n')

// ── 7. Re-render REPORT.md ─────────────────────────────────────────────────
function loadRows() {
  return readText(STATS_FILE)
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}
function latest(rows, size, mode) {
  return rows
    .filter((r) => r.size === size && r.mode === mode)
    .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))[0]
}
function cell(r, get, fmt = (x) => (x == null ? '—' : String(x))) {
  return r ? fmt(get(r)) : '—'
}
function sizeTable(rows, size) {
  const L = latest(rows, size, 'lean')
  const S = latest(rows, size, 'standard')
  if (!L && !S) return ''
  const dur = (r, step) => (step === 'total' ? r?.timing?.totalSec : r?.timing?.perStep?.[step])
  const rowsOut = [
    ['Total time', cell(L, (r) => fmtDur(dur(r, 'total'))), cell(S, (r) => fmtDur(dur(r, 'total'))), L && S ? fmtDelta(dur(S, 'total'), dur(L, 'total'), true) : '—'],
    ['· specify', cell(L, (r) => fmtDur(dur(r, 'specify'))), cell(S, (r) => fmtDur(dur(r, 'specify'))), ''],
    ['· plan', cell(L, (r) => fmtDur(dur(r, 'plan'))), cell(S, (r) => fmtDur(dur(r, 'plan'))), ''],
    ['· tasks', cell(L, (r) => fmtDur(dur(r, 'tasks'))), cell(S, (r) => fmtDur(dur(r, 'tasks'))), ''],
    ['· implement', cell(L, (r) => fmtDur(dur(r, 'implement'))), cell(S, (r) => fmtDur(dur(r, 'implement'))), ''],
    ['Build', cell(L, (r) => (r.buildPass ? '✓' : '✗')), cell(S, (r) => (r.buildPass ? '✓' : '✗')), ''],
    ['Acceptance', cell(L, (r) => `${r.acceptancePassed}/${r.acceptanceTotal}`), cell(S, (r) => `${r.acceptancePassed}/${r.acceptanceTotal}`), ''],
    ['Spec shape', cell(L, (r) => (r.shape.hasUserStories ? 'standard (US)' : 'lean (no US)')), cell(S, (r) => (r.shape.hasUserStories ? 'standard (US)' : 'lean (no US)')), ''],
    ['spec.md lines', cell(L, (r) => r.shape.specLines), cell(S, (r) => r.shape.specLines), L && S ? fmtDelta(S.shape.specLines, L.shape.specLines) : '—'],
    ['plan.md lines', cell(L, (r) => r.shape.planLines), cell(S, (r) => r.shape.planLines), L && S ? fmtDelta(S.shape.planLines, L.shape.planLines) : '—'],
    ['tasks.md lines', cell(L, (r) => r.shape.tasksLines), cell(S, (r) => r.shape.tasksLines), L && S ? fmtDelta(S.shape.tasksLines, L.shape.tasksLines) : '—'],
    ['Task count', cell(L, (r) => r.shape.taskCount), cell(S, (r) => r.shape.taskCount), L && S ? fmtDelta(S.shape.taskCount, L.shape.taskCount) : '—'],
    ['Files changed', cell(L, (r) => r.diff.filesChanged), cell(S, (r) => r.diff.filesChanged), L && S ? fmtDelta(S.diff.filesChanged, L.diff.filesChanged) : '—'],
    ['LOC (+/−)', cell(L, (r) => `+${r.diff.locAdded}/−${r.diff.locRemoved}`), cell(S, (r) => `+${r.diff.locAdded}/−${r.diff.locRemoved}`), ''],
  ]
  const mismatch = [L, S].filter(Boolean).filter((r) => r.modeMismatch)
  const warn = mismatch.length
    ? `\n> ⚠️ shape/mode mismatch: ${mismatch.map((r) => `${r.mode} run produced a ${r.detectedMode} spec`).join('; ')}\n`
    : ''
  return (
    `### ${size}\n\n` +
    `| Metric | lean | standard | Δ (std − lean) |\n` +
    `|---|---|---|---|\n` +
    rowsOut.map((c) => `| ${c[0]} | ${c[1]} | ${c[2]} | ${c[3]} |`).join('\n') +
    `\n${warn}`
  )
}
function render(rows) {
  const sections = SIZES.map((s) => sizeTable(rows, s)).filter(Boolean)
  const log = rows
    .slice()
    .sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt))
    .map((r) => `- \`${r.runId}\` → ${r.spec} · build ${r.buildPass ? '✓' : '✗'} · acceptance ${r.acceptancePassed}/${r.acceptanceTotal} · ${fmtDur(r.timing?.totalSec)}`)
    .join('\n')
  return (
    `# Lean-vs-Standard Bench — Report\n\n` +
    `Generated by \`bench/finish.mjs\` from \`bench/stats.jsonl\`. Each size compares the latest **lean** and **standard** run.\n\n` +
    `${sections.join('\n')}\n` +
    `## All runs\n\n${log || '_none yet_'}\n`
  )
}
writeFileSync(REPORT_FILE, render(loadRows()))

// ── 8. Summary ─────────────────────────────────────────────────────────────
console.log(`
✓ Captured ${run.runId}
  spec        ${row.spec}${modeMismatch ? `  ⚠️ shape looks ${detectedMode}, not ${run.mode}` : ''}
  total       ${fmtDur(timing.totalSec)}  (specify ${fmtDur(timing.perStep.specify)}, plan ${fmtDur(timing.perStep.plan)}, tasks ${fmtDur(timing.perStep.tasks)}, implement ${fmtDur(timing.perStep.implement)})
  build       ${buildPass ? '✓ pass' : '✗ fail'}
  acceptance  ${acceptance.passed}/${acceptance.total}
  diff        ${filesChanged} file(s), +${locAdded}/−${locRemoved} under src/
  → report    ${relFromRepo(REPORT_FILE)}
`)
