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
  SIZES, MODES, PRESET_BY_MODE,
  TEMPLATES_DIR, STATS_FILE, HISTORY_FILE, REPORT_FILE, BENCH_DIR,
  parseArgs, readJson, relFromRepo,
  folderDir, resetFolder,
  measureCell, loadStatsRows, renderReport,
} from './lib.mjs'

const args = parseArgs(process.argv.slice(2))
const cmd = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
const size = args.size ? String(args.size).toLowerCase() : null
const RUNS_SNAP_DIR = join(BENCH_DIR, 'runs')

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
    console.log(`  ${tmpl}  todo-${mode.padEnd(20)} ${armNote(mode)}`)
  }
  console.log(`\nFolders: ${relFromRepo(TEMPLATES_DIR)}/todo-* (gitignored). Run one size at a time across the ${MODES.length} folders.`)
  process.exit(0)
}

if (!size || !SIZES.includes(size)) {
  console.error(`Need --size <${SIZES.join('|')}>`)
  process.exit(1)
}

// ── prep ─────────────────────────────────────────────────────────────────
if (cmd === 'prep') {
  for (const mode of MODES) {
    const dir = folderDir(mode)
    if (!existsSync(dir)) { console.error(`✗ no folder for ${mode} — run /bench-sync`); process.exit(1) }
    resetFolder(dir) // reset working files only; the install is left as /bench-sync set it
    writeFileSync(join(dir, '.run-meta.json'), JSON.stringify({ runId: `${size}-${mode}`, size, mode }, null, 2))
    console.log(`armed  ${`${size}-${mode}`.padEnd(28)} ${relFromRepo(dir)}`)
  }
  // Surface the realistic feature ask — the lead text + plain-English Behavior,
  // but DROP the `Required affordance` block (the exact test-ids are the bench's
  // hidden grading key, not something a real user would type).
  let prompt = ''
  try {
    const md = readFileSync(join(folderDir(MODES[0]), 'bench', 'prompts', `${size}.md`), 'utf8')
    const body = (md.match(/^---\s*$([\s\S]*?)^---\s*$/m)?.[1] ?? md)
    prompt = body.split(/\n\*\*Required affordance/i)[0].trim()
  } catch { /* */ }
  console.log(`\n── PASTE INTO specify (same in all ${MODES.length} folders) ───────────────\n${prompt}\n─────────────────────────────────────────────────────────────`)

  // Open each folder in its own VS Code window (unless --no-open). Best-effort.
  if (!args['no-open']) {
    let opened = 0
    for (const mode of MODES) {
      try { execFileSync('code', ['-n', folderDir(mode)], { stdio: 'ignore', timeout: 20000 }); opened++ } catch { /* code CLI absent */ }
    }
    console.log(opened === MODES.length ? `\nOpened ${opened} VS Code windows.` : `\n⚠️ opened ${opened}/${MODES.length} windows (\`code\` CLI may be missing — open them by hand).`)
  }
  console.log(`Run specify→plan→tasks→implement in each, then: /bench-capture ${size}`)
  process.exit(0)
}

// ── capture ──────────────────────────────────────────────────────────────
if (cmd === 'capture') {
  mkdirSync(RUNS_SNAP_DIR, { recursive: true })
  for (const mode of MODES) {
    const dir = folderDir(mode)
    if (!existsSync(dir)) { console.error(`skip ${size}-${mode} — no folder`); continue }
    const meta = readJson(join(dir, '.run-meta.json'), {})
    const startedAt = meta.startedAt || null
    const finishedAt = meta.finishedAt || null
    const wallClockSec = startedAt && finishedAt ? (Date.parse(finishedAt) - Date.parse(startedAt)) / 1000 : null
    const captureOverheadSec = typeof meta.captureOverheadSec === 'number' ? meta.captureOverheadSec : null
    const row = { ...measureCell({ cellDir: dir, size, mode, runId: `${size}-${mode}`, startedAt, finishedAt, wallClockSec, captureOverheadSec, quality: meta.quality || null }), capturedAt: new Date().toISOString() }
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
  if (!args['no-reset']) for (const mode of MODES) { if (existsSync(folderDir(mode))) resetFolder(folderDir(mode)) }
  console.log(`\n→ report ${relFromRepo(REPORT_FILE)}${args['no-reset'] ? '' : ' · folders reset for next round'}`)
  process.exit(0)
}

console.error('Usage: node bench/run-all.mjs --dry-run | prep --size <s> | capture --size <s> [--no-reset]')
process.exit(1)
