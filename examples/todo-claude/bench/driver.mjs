// bench/driver.mjs — faithful per-step dispatch for an agent driving a bench cell.
//
// Why this exists (#325): the old drivers followed RAW /speckit.* command bodies +
// fired cap.mjs synchronously. That OMITTED the per-step capture/timing PREAMBLE the
// GUI prepends to every dispatch, and it never WAITED for the step to settle — so
// companion looked ~30% slower (capture overhead counted as work time) and stock
// "completed" for the agent even though the GUI gets stuck. This module makes the
// agent driver a faithful GUI proxy:
//
//   1. buildStepPreamble(step, specDir) returns the SAME preamble the GUI builds,
//      imported from the compiled extension (dist/ai-providers/promptPreamble.js) so
//      it can never drift from the real dispatch path. Prepend it for BOTH modes —
//      stock and companion differ ONLY in the command family, exactly like the GUI.
//   2. waitForSettle(cellDir, step) (in lib.mjs) blocks until .spec-context.json
//      reaches the step's completed-form status before advancing — the same settle
//      signal the GUI's file watchers wait on. Never fire capture synchronously.
//   3. Track capture time as its own line (captureOverheadSec in .run-meta.json) so
//      the speed comparison isolates work-time from the capture tax.
//
// This module is NOT auto-invoked. A human/agent imports it (or follows the recipe in
// README "Faithful dispatch") while building each cell. It performs NO AI calls.
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { REPO_ROOT, STEPS, SETTLED_STATUS_BY_STEP, waitForSettle } from './lib.mjs'

// The compiled, vscode-FREE preamble renderers — the exact text the GUI dispatches.
// Built by `npm run compile` at the repo root (tsc → dist/). Run that first.
const PREAMBLE_JS = join(REPO_ROOT, 'dist', 'ai-providers', 'promptPreamble.js')

let _preamble = null
async function loadPreamble() {
  if (_preamble) return _preamble
  try {
    _preamble = await import(pathToFileURL(PREAMBLE_JS).href)
  } catch (e) {
    throw new Error(
      `[driver] cannot load ${PREAMBLE_JS} — run \`npm run compile\` at the repo root first.\n${e}`
    )
  }
  return _preamble
}

// The per-step preamble the GUI prepends to a single-step dispatch — identical bytes
// for speckit and companion. `dispatchUtc` is the dispatch instant (ISO); defaults to
// now, matching the GUI's nowUtc(). Pass a fixed value to keep a recipe reproducible.
export async function buildStepPreamble(step, specDir, dispatchUtc = new Date().toISOString()) {
  const m = await loadPreamble()
  if (!m.isKnownStep(step)) throw new Error(`[driver] unknown step "${step}"`)
  return m.renderPreamble(step, specDir ?? '', dispatchUtc)
}

// The combined creation+lifecycle preamble the GUI's spec-editor "Create" dispatch
// uses (seeds .spec-context.json and covers the whole run). `workflowName` is the
// chosen workflow ("speckit" | "companion").
export async function buildCreationPreamble(workflowName, specDir, dispatchUtc = new Date().toISOString()) {
  const m = await loadPreamble()
  return m.renderSpecifyCreationLifecyclePreamble(workflowName, specDir ?? null, dispatchUtc)
}

export { STEPS, SETTLED_STATUS_BY_STEP, waitForSettle }
