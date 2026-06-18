// bench/sync-templates.mjs — (re)bake the per-mode sandbox FOLDERS (speckit,
// companion) by running the REAL installers, so each folder gets exactly what
// current tooling produces (hyphenated /speckit-* + /speckit-companion-* skills)
// and we exercise the actual install path.
//   node bench/sync-templates.mjs [--only speckit|companion]
//
// Per folder: clone the app (for src + node_modules), drop the stale spec-kit
// emissions, `specify init` (current stock spec-kit), then for companion variants
// `specify extension add` (+ preset + profile). Gitignored; re-run via /bench-sync.
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

// A clean vitest config for the baked cell — no bench framing, setup lifted to
// the root, only the app's own src tests in the default run. At grade time the
// grader injects the acceptance oracle AND a throwaway config that includes it
// (see runAcceptance in lib.mjs) — a positional path alone is filtered out by
// this `include`, so it can't carry the oracle.
const CLEAN_VITEST_CONFIG = `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
`

// A baked cell must read as a plain app — NOTHING about the bench anywhere a
// spec run could see it (the model auto-reads CLAUDE.md and may open config/
// README). It would otherwise read the acceptance oracle / prompts / past stats
// and code to the hidden grade, or treat the app as a "bench target." So: lift
// the one needed setup file to the root, drop bench/ entirely, write a clean
// vitest config, and strip the bench framing from CLAUDE.md + remove the
// bench-centric README. The grader runs from the SOURCE bench dir and injects
// the oracle into the cell only at scoring time.
// Replace the `<!-- name START -->…<!-- name END -->` span (markers included) with `replacement`; throws if the pair is absent.
export function stripMarkedRange(md, name, { replacement = '', trimSurroundingBlankLines = false } = {}) {
  const start = `<!-- ${name} START -->`
  const end = `<!-- ${name} END -->`
  const s = md.indexOf(start)
  const e = md.indexOf(end)
  if (s === -1 || e === -1 || e < s) {
    throw new Error(
      `[bench] CLAUDE.md strip marker '${name}' missing or malformed — the source CLAUDE.md drifted; ` +
        `re-add the <!-- ${name} START -->…<!-- ${name} END --> markers around the bench framing.`,
    )
  }
  let from = s
  let to = e + end.length
  if (trimSurroundingBlankLines) {
    while (from > 0 && md[from - 1] === '\n') from--
    while (to < md.length && md[to] === '\n') to++
  }
  const joiner = trimSurroundingBlankLines && replacement === '' ? '\n\n' : replacement
  return md.slice(0, from) + joiner + md.slice(to)
}

function presentAsCleanApp(dir) {
  const benchSetup = join(dir, 'bench', 'vitest.setup.ts')
  if (existsSync(benchSetup)) cpSync(benchSetup, join(dir, 'vitest.setup.ts'))
  rmSync(join(dir, 'bench'), { recursive: true, force: true })
  writeFileSync(join(dir, 'vitest.config.ts'), CLEAN_VITEST_CONFIG)

  const claudePath = join(dir, 'CLAUDE.md')
  if (existsSync(claudePath)) {
    let md = readFileSync(claudePath, 'utf8')
    // Strip bench framing by explicit source markers (loud failure if they drift), not free-text literals.
    md = stripMarkedRange(md, 'BENCH-PHRASE', { replacement: '' })
    md = stripMarkedRange(md, 'BENCH-VITEST', { replacement: 'Vitest (component + unit tests)' })
    md = stripMarkedRange(md, 'BENCH-SECTION', { replacement: '', trimSurroundingBlankLines: true })
    writeFileSync(claudePath, md)
  }
  rmSync(join(dir, 'README.md'), { force: true })

  const giPath = join(dir, '.gitignore')
  if (existsSync(giPath)) {
    const kept = readFileSync(giPath, 'utf8')
      .split('\n')
      .filter((l) => !/bench/i.test(l))
      .join('\n')
    writeFileSync(giPath, kept)
  }
}
import {
  SANDBOX_DIR,
  TEMPLATES_DIR,
  MODES,
  COMPANION_MODES,
  PRESET_BY_MODE,
  PRESET_SRC_DIR,
  SPECKIT_EXT_DIR,
  parseArgs,
  cloneDir,
  gitInitCell,
  gitCommitCellBaseline,
  folderDir,
  writeVscodeSettings,
  seedConstitution,
  relFromRepo,
} from './lib.mjs'

const args = parseArgs(process.argv.slice(2))
const only = args.only ? String(args.only).toLowerCase() : null
const variants = only ? MODES.filter((m) => m === only) : MODES
if (!variants.length) {
  console.error(`--only must be one of ${MODES.join('|')}`)
  process.exit(1)
}

function specify(cwd, cmdArgs) {
  try {
    execFileSync('specify', cmdArgs, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 240000 })
    return true
  } catch (e) {
    console.error(`  ⚠️ specify ${cmdArgs.join(' ')} failed: ${(e && e.shortMessage) || e}`)
    return false
  }
}

// Install / refresh current stock spec-kit (Claude integration → hyphenated skills).
export function installSpeckit(dir) {
  rmSync(join(dir, '.specify'), { recursive: true, force: true })
  rmSync(join(dir, '.claude'), { recursive: true, force: true })
  rmSync(join(dir, 'specs'), { recursive: true, force: true })
  mkdirSync(join(dir, 'specs'), { recursive: true })
  const ok = specify(dir, ['init', '--here', '--integration', 'claude', '--force', '--no-git'])
  seedConstitution(dir) // overwrite init's [PROJECT_NAME] placeholder with the shared real one
  return ok
}

// Install the companion spec-kit extension (+ this variant's preset). Fast-path is
// a built-in default of the single Companion pipeline now — no profile/toggle to bake.
export function installCompanion(dir, variant) {
  const extOk = specify(dir, ['extension', 'add', SPECKIT_EXT_DIR, '--dev', '--force'])
  const presetId = PRESET_BY_MODE[variant]
  let presetOk = true
  if (presetId) {
    // Refresh idempotently: remove if already installed, then add (preset add
    // errors on an existing preset — fine on a fresh bake, fails on re-prep).
    if (existsSync(join(dir, '.specify', 'presets', presetId))) specify(dir, ['preset', 'remove', presetId])
    presetOk = specify(dir, ['preset', 'add', presetId, '--dev', join(PRESET_SRC_DIR, presetId)])
  }
  return { extOk, presetOk, presetId }
}

if (process.argv[1] && process.argv[1].endsWith('sync-templates.mjs')) {
  mkdirSync(TEMPLATES_DIR, { recursive: true })
  console.log(`Baking ${variants.length} variant folder(s) under ${relFromRepo(TEMPLATES_DIR)}/ via the real installers\n`)

  for (const variant of variants) {
    const dir = folderDir(variant)
    process.stdout.write(`• todo-${variant}: clone… `)
    cloneDir(SANDBOX_DIR, dir)
    presentAsCleanApp(dir) // the model must never see the oracle/prompts/stats or any bench framing
    gitInitCell(dir) // own git root so the capture writer resolves the folder, not the parent repo
    process.stdout.write('specify init… ')
    const initOk = installSpeckit(dir)
    writeVscodeSettings(dir, variant)

    if (variant === 'speckit') {
      gitCommitCellBaseline(dir) // so create-new-feature.sh can branch during a run
      console.log(initOk ? 'stock spec-kit ✓ (plain upstream)' : 'init ✗')
      continue
    }
    process.stdout.write('extension add… ')
    const { extOk, presetOk, presetId } = installCompanion(dir, variant)
    gitCommitCellBaseline(dir) // so create-new-feature.sh can branch during a run
    console.log(`${initOk ? 'init✓' : 'init✗'} ${extOk ? 'companion✓' : 'companion✗'} ${presetId ? (presetOk ? `${presetId}✓` : 'preset✗') : 'no-preset'}`)
  }

  console.log(`\nDone. ${variants.length} folder(s) ready (real installers ran).`)
  if (COMPANION_MODES.some((m) => variants.includes(m))) {
    console.log('Companion folders need python3 + the local speckit-extension to drive capture.')
  }
}
