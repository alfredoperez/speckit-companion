// bench/reset-implement.mjs — reset the companion cell to the "Tags tasks-done,
// nothing implemented" state so you can re-run /speckit.companion.implement over
// and over while iterating on the fan-out wording. Restores src/ to the canonical
// baseline and drops the preserved fixture spec (specs/001-tags) back in fresh.
//
//   node bench/reset-implement.mjs
//
// Orthogonal to node changes: when you edit the implement node, re-assemble +
// reinstall the extension into the cell separately; this only resets the work state.
import { rmSync, mkdirSync, cpSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { BENCH_DIR, SANDBOX_DIR, folderDir } from './lib.mjs'

const cell = folderDir('companion')
const fixture = join(BENCH_DIR, 'fixtures', 'tags-tasked')
const canonicalSrc = join(SANDBOX_DIR, 'src')
const spec = 'specs/001-tags'

if (!existsSync(cell)) { console.error(`cell not found: ${cell} — run /bench-sync first`); process.exit(1) }
if (!existsSync(fixture)) { console.error(`fixture missing: ${fixture}`); process.exit(1) }

// 1. src/ back to the clean baseline (drops every Tags file + every edit implement made)
rmSync(join(cell, 'src'), { recursive: true, force: true })
cpSync(canonicalSrc, join(cell, 'src'), { recursive: true })
cpSync(join(SANDBOX_DIR, 'index.html'), join(cell, 'index.html'))

// 2. the spec dir back to the preserved tasks-done state (fresh tasks.md, clean
//    .spec-context.json at ready-to-implement, no events log)
rmSync(join(cell, spec), { recursive: true, force: true })
mkdirSync(join(cell, spec), { recursive: true })
cpSync(fixture, join(cell, spec), { recursive: true })

// 3. point the active-feature pointer at it
writeFileSync(join(cell, '.specify', 'feature.json'), JSON.stringify({ feature_directory: spec }) + '\n')

console.log(`reset ✓  ${cell}`)
console.log('  src/ → baseline · specs/001-tags → tasks-done (ready-to-implement)')
console.log('  now run: /speckit-companion-implement <cell>/specs/001-tags')
