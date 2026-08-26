#!/usr/bin/env node
// Break capture on purpose, so the doctor can be checked for reporting the break.
//
// A tracer validated only on happy paths proves nothing about the case it exists
// for. Both injections here reproduce conditions that have stranded real specs.
import { chmodSync, existsSync, readdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MODES = ['missing-feature-json', 'unwritable-context', 'restore']

const [, , cellDir, mode] = process.argv
if (!cellDir || !MODES.includes(mode)) {
  console.error(`usage: inject.mjs <cell-dir> <${MODES.join('|')}>`)
  process.exit(2)
}

const featureJson = join(cellDir, '.specify', 'feature.json')
const stashed = `${featureJson}.injected`

function contextFiles() {
  const specs = join(cellDir, 'specs')
  if (!existsSync(specs)) return []
  return readdirSync(specs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(specs, d.name, '.spec-context.json'))
    .filter((p) => existsSync(p))
}

if (mode === 'missing-feature-json') {
  if (!existsSync(featureJson)) {
    console.error(`[inject] no ${featureJson} to remove`)
    process.exit(1)
  }
  renameSync(featureJson, stashed)
  console.log('[inject] feature.json stashed — capture calls can no longer resolve a spec')
} else if (mode === 'unwritable-context') {
  const files = contextFiles()
  if (!files.length) {
    console.error('[inject] no .spec-context.json to lock')
    process.exit(1)
  }
  for (const f of files) chmodSync(f, 0o444)
  console.log(`[inject] locked ${files.length} context file(s) read-only`)
} else {
  if (existsSync(stashed)) {
    renameSync(stashed, featureJson)
    console.log('[inject] feature.json restored')
  }
  for (const f of contextFiles()) {
    if ((statSync(f).mode & 0o200) === 0) chmodSync(f, 0o644)
  }
  console.log('[inject] context files writable again')
}
