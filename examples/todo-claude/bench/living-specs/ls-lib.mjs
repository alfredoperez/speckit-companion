// bench/living-specs/ls-lib.mjs — shared arrange helpers for the Living Specs
// sandbox demos. Thin layer over the existing bench helpers in ../lib.mjs: it
// bakes a throwaway repo with a livingSpecs companion.yml + a capability spec
// fixture, plants code files + a stray orphan spec, and gives the demo runner a
// place to capture real resolver/pytest output. LS·1 is `deterministic` (no AI),
// so it does not install spec-kit — it points the real shipped resolver at the
// sandbox via --root.
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

import { REPO_ROOT, gitInitCell, gitCommitCellBaseline, readText } from '../lib.mjs'

export const LS_DIR = dirname(fileURLToPath(import.meta.url))
export const EVIDENCE_DIR = join(LS_DIR, 'evidence')
export const RESOLVER = join(REPO_ROOT, 'speckit-extension', 'scripts', 'resolve-spec-paths.py')
export const TEST_FILE = join(REPO_ROOT, 'speckit-extension', 'tests', 'test_living_specs.py')
export const SANDBOX_ROOT = join(REPO_ROOT, 'examples', 'bench-sandboxes')

function write(root, rel, body) {
  const p = join(root, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, body)
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
    cwd: root,
    cmd: `python3 ${RESOLVER} --root ${root} ${args.join(' ')}`,
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
    cwd: REPO_ROOT,
    cmd: `python3 -m ${res.mod} ${res.mod === 'pytest' ? TEST_FILE + ' -q' : 'speckit-extension.tests.test_living_specs -v'}`,
    exit: res.exit,
    stdout: res.stdout,
    stdoutTail: res.stdout.split('\n').slice(-12).join('\n'),
  }
}

export function fileTree(root, rels) {
  return rels.filter((r) => existsSync(join(root, r)))
}

export { readText }
