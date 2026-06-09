// bench/prep.mjs — arm a turbo-vs-standard bench run.
//   node bench/prep.mjs --size <easy|medium|hard> --mode <turbo|standard>
// Sets the sandbox mode, snapshots a baseline so finish can attribute the run,
// and prints the prompt to paste + the exact pipeline commands for the mode.
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  BENCH_DIR,
  SANDBOX_DIR,
  PRESET_SRC_DIR,
  RUN_STATE,
  SIZES,
  MODES,
  parseArgs,
  git,
  listSpecDirs,
  setTemplateProfile,
  decidePresetOps,
} from './lib.mjs'

const args = parseArgs(process.argv.slice(2))
const size = String(args.size || '').toLowerCase()
const mode = String(args.mode || '').toLowerCase()

if (!SIZES.includes(size) || !MODES.includes(mode)) {
  console.error(
    `Usage: node bench/prep.mjs --size <${SIZES.join('|')}> --mode <${MODES.join('|')}>`
  )
  process.exit(1)
}

// 1. Set the sandbox templateProfile (source of truth the GUI/extension reads).
setTemplateProfile(mode)

// 2. Reconcile presets via the specify CLI (mirrors companionPresetReconciler):
//    converge to "only the companion-<mode> preset installed". add uses --dev
//    against the in-repo preset source (the catalog path isn't published yet).
function trySpecify(specifyArgs) {
  try {
    execFileSync('specify', specifyArgs, {
      cwd: SANDBOX_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    })
    return true
  } catch {
    return false
  }
}
const ops = decidePresetOps(mode)
const done = []
let presetOk = true
for (const op of ops) {
  let ok
  if (op.action === 'add') {
    ok = trySpecify(['preset', 'add', op.id, '--dev', join(PRESET_SRC_DIR, op.id)])
  } else {
    ok = trySpecify(['preset', op.action, op.id])
  }
  if (ok) done.push(`${op.action} ${op.id}`)
  else presetOk = false
}
const presetNote = done.length
  ? `${done.join(', ')}${presetOk ? '' : ' (some ops failed)'}`
  : presetOk
    ? `companion-${mode} already active`
    : 'preset CLI unavailable — see mode notes below'

// 3. Snapshot the baseline for attribution.
let baselineGitRef = ''
try {
  baselineGitRef = git(['rev-parse', 'HEAD'])
} catch {
  baselineGitRef = ''
}
const startedAt = new Date().toISOString()
const stamp = startedAt.replace(/[-:T.]/g, '').slice(0, 14)
const runState = {
  runId: `${size}-${mode}-${stamp}`,
  size,
  mode,
  startedAt,
  baselineGitRef,
  knownSpecDirs: listSpecDirs(),
}
writeFileSync(RUN_STATE, JSON.stringify(runState, null, 2))

// 4. Print prompt + mode-specific commands.
const promptPath = join(BENCH_DIR, 'prompts', `${size}.md`)
const prompt = readFileSync(promptPath, 'utf8')

const turboCmds = [
  '/speckit.companion.specify  "<paste the prompt above>"   (always-turbo — recommended)',
  '/speckit.companion.plan',
  '/speckit.companion.tasks',
  '/speckit.companion.implement',
  '   …or stock /speckit.* (the companion-turbo preset is active, so they emit the turbo shape).',
]
const standardCmds = [
  '/speckit.specify  "<paste the prompt above>"',
  '/speckit.plan',
  '/speckit.tasks',
  '/speckit.implement',
  '   The companion-standard preset is active, so stock /speckit.* emit the standard shape.',
  '   Never /speckit.companion.* — those are always turbo.',
]
const cmds = mode === 'turbo' ? turboCmds : standardCmds

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 BENCH ARMED · size=${size} · mode=${mode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 templateProfile: ${mode}  ·  presets: ${presetNote}
 run id: ${runState.runId}
 baseline: ${baselineGitRef ? baselineGitRef.slice(0, 12) : '(no git ref)'}

 ── PROMPT TO PASTE (specify step) ─────────────────────────────
${prompt}
 ── RUN IN VS CODE (this mode: ${mode}) ─────────────────────────
${cmds.map((c) => `   ${c}`).join('\n')}

 When the pipeline finishes (through implement), come back and run:
   /bench-finish      (or: node bench/finish.mjs)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
