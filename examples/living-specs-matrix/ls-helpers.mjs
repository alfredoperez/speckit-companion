// Local helpers for the living-spec correctness matrix.
//
// The matrix used to borrow these four from the bench harness that lived one
// directory up. The harness moved to its own repository (speckit-bench); the
// matrix stayed, because it is evidence about the extension rather than a
// benchmark of it. These are the pieces it actually used.
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..', '..')

export function readText(p, fallback = '') {
  try { return readFileSync(p, 'utf8') } catch { return fallback }
}

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

// Give a sandbox its own git repo so the capture writer's `git rev-parse
// --show-toplevel` resolves to the sandbox and not the parent repo.
export function gitInitCell(cellDir) {
  try { run('git', ['init', '-q', '-b', 'main', cellDir]) } catch { /* git absent */ }
}

// Commit a baseline so create-new-feature.sh can branch off it during a run.
// Inline the identity so it works with no global git config.
export function gitCommitCellBaseline(cellDir) {
  try {
    run('git', ['-C', cellDir, 'add', '-A'])
    run('git', ['-C', cellDir, '-c', 'user.email=matrix@local', '-c', 'user.name=matrix', 'commit', '-q', '-m', 'baseline'])
  } catch { /* git absent or nothing to commit */ }
}

// Run the lifecycle-capture eval (the /eval-speckit-extension checker) against a
// spec dir. Returns null when there is no .spec-context.json to read.
export function runCaptureEval(specDir) {
  const checker = resolve(REPO_ROOT, '.claude', 'skills', 'eval-speckit-extension', 'check_capture.py')
  let raw = ''
  try {
    raw = run('python3', [checker, '--json', specDir])
  } catch (e) {
    raw = (e && e.stdout) || ''
  }
  let rep
  try { rep = JSON.parse(raw) } catch { rep = null }
  if (!rep || !Array.isArray(rep.checks)) return null
  const pass = rep.checks.filter((c) => c.status === 'PASS').length
  const failing = rep.checks.filter((c) => c.status === 'FAIL').map((c) => c.id)
  return { pass, fail: rep.failed ?? failing.length, failing, checks: rep.checks }
}
