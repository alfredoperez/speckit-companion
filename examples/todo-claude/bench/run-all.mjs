// bench/run-all.mjs — engine for the faithful 2-mode bench (run-in-folders model).
//   node bench/run-all.mjs --dry-run                  list the variant folders + arm state
//   node bench/run-all.mjs prep --size easy           clean + arm the folders for a size
//   node bench/run-all.mjs capture --size easy        measure the folders → stats + report, then reset
//
// The variant folders (one per mode in MODES — speckit, companion) ARE the run
// folders — you build the feature in them (in VS Code, or an agent drives them); there
// are no throwaway copies. `capture` reads any rubric + captureOverheadSec the driver
// wrote into each folder's .run-meta.json, then resets the folder.
import { existsSync, writeFileSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  SIZES, MODES, PRESET_BY_MODE, everyCell,
  TEMPLATES_DIR, STATS_FILE, HISTORY_FILE, REPORT_FILE, BENCH_DIR,
  parseArgs, readJson, relFromRepo,
  folderDir, resetFolder,
  measureCell, loadStatsRows, renderReport,
} from './lib.mjs'

const args = parseArgs(process.argv.slice(2))
const cmd = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
const size = args.size ? String(args.size).toLowerCase() : null
const RUNS_SNAP_DIR = join(BENCH_DIR, 'runs')

// `--sizes easy,medium,hard` addresses one folder per cell, so every cell can be
// built at once and the round costs the slowest cell rather than the sum of all
// of them. `--size <one>` keeps the shared per-mode folders the manual VS Code
// loop uses, where the two folders hold one feature at a time.
const sizesArg = args.sizes
  ? String(args.sizes).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
  : null
const badSize = (sizesArg || []).find((x) => !SIZES.includes(x))
if (badSize) { console.error(`--sizes must be from ${SIZES.join(',')} (got ${badSize})`); process.exit(1) }
const PARALLEL = Boolean(sizesArg)
/** The cells this invocation is about, each with the folder that holds it. */
function targets() {
  const cells = PARALLEL ? everyCell(sizesArg, MODES) : MODES.map((mode) => ({ size, mode }))
  return cells.map((c) => ({ ...c, dir: folderDir(c.mode, PARALLEL ? c.size : null) }))
}

function armNote(mode) {
  if (mode === 'speckit') return 'plain upstream · stock /speckit.* · no capture'
  const preset = PRESET_BY_MODE[mode]
  return `companion${preset ? ` · ${preset}` : ' · no preset'} · /speckit.companion.* (+capture, same GUI preamble as speckit)`
}

// ── --dry-run ──────────────────────────────────────────────────────────────
if (args['dry-run']) {
  console.log(`Faithful bench — ${MODES.length} variant folders × ${SIZES.length} sizes\n`)
  for (const mode of MODES) {
    const tmpl = existsSync(folderDir(mode)) ? '✓' : '✗ MISSING (run sync-templates / /bench-sync)'
    console.log(`  ${tmpl}  todo-${mode.padEnd(24)} ${armNote(mode)}`)
  }
  console.log('\nPer-cell folders (one per size × mode, so every cell can run at once):')
  for (const { size: s, mode } of everyCell()) {
    const dir = folderDir(mode, s)
    console.log(`  ${existsSync(dir) ? '✓' : '·'}  todo-${`${s}-${mode}`.padEnd(24)}`)
  }
  console.log(`\nFolders: ${relFromRepo(TEMPLATES_DIR)}/todo-* (gitignored).`)
  console.log(`  --size <one>          the two shared folders, one size at a time (the VS Code loop)`)
  console.log(`  --sizes <a,b,c>       one folder per cell, all of them at once`)
  process.exit(0)
}

if (!PARALLEL && (!size || !SIZES.includes(size))) {
  console.error(`Need --size <${SIZES.join('|')}> or --sizes <a,b,c> for one folder per cell`)
  process.exit(1)
}

// ── prep ─────────────────────────────────────────────────────────────────
if (cmd === 'prep') {
  for (const { size: cellSize, mode, dir } of targets()) {
    if (!existsSync(dir)) {
      console.error(`✗ no folder for ${cellSize}-${mode} — run /bench-sync${PARALLEL ? ` --sizes ${sizesArg.join(',')}` : ''}`)
      process.exit(1)
    }
    resetFolder(dir) // reset working files only; the install is left as /bench-sync set it
    writeFileSync(join(dir, '.run-meta.json'),
      JSON.stringify({ runId: `${cellSize}-${mode}`, size: cellSize, mode }, null, 2))
    console.log(`armed  ${`${cellSize}-${mode}`.padEnd(28)} ${relFromRepo(dir)}`)
  }
  // Surface the realistic feature ask — the lead text + plain-English Behavior,
  // but DROP the `Required affordance` block (the exact test-ids are the bench's
  // hidden grading key, not something a real user would type).
  // Read from the canonical bench folder: the bake strips `bench/` out of every
  // cell so the model never sees the oracle, so the cell has no prompts to read.
  function promptFor(cellSize) {
    const promptFile = join(BENCH_DIR, 'prompts', `${cellSize}.md`)
    const md = readFileSync(promptFile, 'utf8')
    const body = (md.match(/^---\s*$([\s\S]*?)^---\s*$/m)?.[1] ?? md)
    const prompt = body.split(/\n\*\*Required affordance/i)[0].trim()
    if (!prompt) { console.error(`✗ empty feature prompt in ${relFromRepo(promptFile)}`); process.exit(1) }
    return prompt
  }

  for (const cellSize of PARALLEL ? sizesArg : [size]) {
    console.log(`\n── PASTE INTO specify · ${cellSize} (same in both its folders) ─────────\n`
      + `${promptFor(cellSize)}\n────────────────────────────────────────────────────────────`)
  }

  // Open each folder in its own VS Code window (unless --no-open). Best-effort.
  if (!args['no-open']) {
    const dirs = targets().map((t) => t.dir)
    let opened = 0
    for (const dir of dirs) {
      try { execFileSync('code', ['-n', dir], { stdio: 'ignore', timeout: 20000 }); opened++ } catch { /* code CLI absent */ }
    }
    console.log(opened === dirs.length ? `\nOpened ${opened} VS Code windows.` : `\n⚠️ opened ${opened}/${dirs.length} windows (\`code\` CLI may be missing — open them by hand).`)
  }
  console.log(`Run specify→plan→tasks→implement in each, then: /bench-capture ${PARALLEL ? sizesArg.join(',') : size}`)
  process.exit(0)
}

// ── capture ──────────────────────────────────────────────────────────────
if (cmd === 'capture') {
  mkdirSync(RUNS_SNAP_DIR, { recursive: true })
  for (const { size: cellSize, mode, dir } of targets()) {
    if (!existsSync(dir)) { console.error(`skip ${cellSize}-${mode} — no folder`); continue }
    const meta = readJson(join(dir, '.run-meta.json'), {})
    const startedAt = meta.startedAt || null
    const finishedAt = meta.finishedAt || null
    const wallClockSec = startedAt && finishedAt ? (Date.parse(finishedAt) - Date.parse(startedAt)) / 1000 : null
    const captureOverheadSec = typeof meta.captureOverheadSec === 'number' ? meta.captureOverheadSec : null
    const row = { ...measureCell({ cellDir: dir, size: cellSize, mode, runId: `${cellSize}-${mode}`, startedAt, finishedAt, wallClockSec, captureOverheadSec, quality: meta.quality || null }), capturedAt: new Date().toISOString() }
    appendFileSync(STATS_FILE, JSON.stringify(row) + '\n')
    appendFileSync(HISTORY_FILE, JSON.stringify(row) + '\n') // append-only; never deduped
    writeFileSync(join(RUNS_SNAP_DIR, `${row.runId}.json`), JSON.stringify(row, null, 2))
    console.log(`measured ${row.runId.padEnd(28)} build ${row.buildPass ? '✓' : '✗'} · accept ${row.acceptancePassed}/${row.acceptanceTotal} · regress ${row.regressionPassed}/${row.regressionTotal} · capture ${row.capture ? `${row.capture.pass}✓/${row.capture.fail}✗` : 'n/a'}`)
  }
  // dedupe to last-per-runId so re-captures win, then render.
  const byId = new Map()
  for (const r of loadStatsRows()) byId.set(r.runId, r)
  const deduped = [...byId.values()]
  writeFileSync(STATS_FILE, deduped.map((r) => JSON.stringify(r)).join('\n') + '\n')
  writeFileSync(REPORT_FILE, renderReport(deduped))
  // reset folders for the next round (do this AFTER measuring + judging).
  if (!args['no-reset']) for (const { dir } of targets()) { if (existsSync(dir)) resetFolder(dir) }
  console.log(`\n→ report ${relFromRepo(REPORT_FILE)}${args['no-reset'] ? '' : ' · folders reset for next round'}`)
  process.exit(0)
}

console.error('Usage: node bench/run-all.mjs --dry-run | prep --size <s> | capture --size <s> [--no-reset]')
process.exit(1)
