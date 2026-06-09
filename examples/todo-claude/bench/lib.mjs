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
export const REPORT_FILE = join(BENCH_DIR, 'REPORT.md')
export const VITEST_OUT = join(BENCH_DIR, '.last-vitest.json')

// easy = update a route/title · medium = add a feature to todos · hard = a whole new feature
export const SIZES = ['easy', 'medium', 'hard']
// The bench's A/B axis is the template profile: turbo vs standard.
export const MODES = ['turbo', 'standard']
export const PRESET_BY_MODE = { turbo: 'companion-turbo', standard: 'companion-standard' }
export const ALL_PRESET_IDS = ['companion-standard', 'companion-turbo']
export const LEGACY_PRESET_ID = 'sdd-lean' // pre-rename leftover; removed on reconcile

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
