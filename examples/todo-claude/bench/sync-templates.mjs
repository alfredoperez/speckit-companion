// bench/sync-templates.mjs — (re)bake the per-mode sandbox FOLDERS (speckit,
// companion) by running the REAL installers, so each folder gets exactly what
// current tooling produces (hyphenated /speckit-* + /speckit-companion-* skills)
// and we exercise the actual install path.
//   node bench/sync-templates.mjs [--only speckit|companion]
//
// Per folder: clone the app (for src + node_modules), drop the stale spec-kit
// emissions, `specify init` (current stock spec-kit), then for companion variants
// `specify extension add` (+ preset + profile). Gitignored; re-run via /bench-sync.
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  SANDBOX_DIR,
  TEMPLATES_DIR,
  MODES,
  COMPANION_MODES,
  PRESET_BY_MODE,
  PROFILE_BY_MODE,
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

function writeProfile(dir, profile, fastPath = false) {
  const cfg = join(dir, '.specify', 'companion.yml')
  mkdirSync(join(dir, '.specify'), { recursive: true })
  let text = `# Managed by bench/sync-templates.mjs — sandbox template profile.\ntemplateProfile: ${profile}\n`
  if (fastPath) text += `complexityFastPath: true\n`
  writeFileSync(cfg, text)
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

// Install the companion spec-kit extension (+ this variant's preset + profile).
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
  writeProfile(dir, PROFILE_BY_MODE[variant]) // fast-path stays off in every cell
  return { extOk, presetOk, presetId }
}

if (process.argv[1] && process.argv[1].endsWith('sync-templates.mjs')) {
  mkdirSync(TEMPLATES_DIR, { recursive: true })
  console.log(`Baking ${variants.length} variant folder(s) under ${relFromRepo(TEMPLATES_DIR)}/ via the real installers\n`)

  for (const variant of variants) {
    const dir = folderDir(variant)
    process.stdout.write(`• todo-${variant}: clone… `)
    cloneDir(SANDBOX_DIR, dir)
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
    console.log(`${initOk ? 'init✓' : 'init✗'} ${extOk ? 'companion✓' : 'companion✗'} ${presetId ? (presetOk ? `${presetId}✓` : 'preset✗') : 'no-preset'} profile=${PROFILE_BY_MODE[variant]}`)
  }

  console.log(`\nDone. ${variants.length} folder(s) ready (real installers ran).`)
  if (COMPANION_MODES.some((m) => variants.includes(m))) {
    console.log('Companion folders need python3 + the local speckit-extension to drive capture.')
  }
}
