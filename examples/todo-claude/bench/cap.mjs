// bench/cap.mjs — terse capture wrapper around write-context.py for bench drivers.
// Run from INSIDE the cell root (cwd = the cell). Resolves the feature dir from
// .specify/feature.json and the companion writer locally, so a driver issues
// `node <repo>/examples/todo-claude/bench/cap.mjs plan complete` instead of the
// full python invocation. The companion mode uses this; speckit runs no capture.
//
//   specify start | specify complete
//   plan start | plan substep <name> | plan complete
//   tasks start | tasks substep <name> | tasks complete
//   implement start | implement complete
//   task <TaskID>                      (per-task finish, finish-only, by ai)
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const root = process.cwd()
const W = join(root, '.specify', 'extensions', 'companion', 'scripts', 'write-context.py')
if (!existsSync(W)) {
  console.error(`[cap] no companion writer at ${W} — run from a companion cell root`)
  process.exit(1)
}
let fd
try { fd = JSON.parse(readFileSync(join(root, '.specify', 'feature.json'), 'utf8')).feature_directory } catch { /* */ }
if (!fd) { console.error('[cap] no .specify/feature.json feature_directory — run specify first'); process.exit(1) }

const [step, action, name] = process.argv.slice(2)
const STATUS = { specify: 'specified', plan: 'planned', tasks: 'ready-to-implement', implement: 'implemented' }

let args
if (step === 'task') {
  // `task <TaskID>` — one finish event, by ai
  if (!action) { console.error('[cap] task needs a TaskID'); process.exit(1) }
  args = ['--feature-dir', fd, '--task', action, '--kind', 'complete', '--by', 'ai']
} else if (action === 'start') {
  args = ['--feature-dir', fd, '--step', step, '--kind', 'start', '--by', 'extension']
} else if (action === 'substep') {
  if (!name) { console.error('[cap] substep needs a name'); process.exit(1) }
  args = ['--feature-dir', fd, '--step', step, '--substep', name, '--kind', 'complete', '--by', 'ai']
} else if (action === 'complete') {
  // specify + implement are closed by the extension; plan/tasks self-close by ai.
  const by = step === 'specify' || step === 'implement' ? 'extension' : 'ai'
  args = ['--feature-dir', fd, '--step', step, '--status', STATUS[step], '--kind', 'complete', '--by', by]
} else {
  console.error('[cap] usage: <specify|plan|tasks|implement> start|substep <name>|complete  |  task <TaskID>')
  process.exit(1)
}
execFileSync('python3', [W, ...args], { stdio: 'inherit' })
