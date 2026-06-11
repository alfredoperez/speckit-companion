# Implementation Plan: Script-written task_summaries + live implement percentage label

**Branch**: `150-script-task-summaries` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

## Summary

Two independent surfaces fix GitHub issue #256:

1. **Capture (Python + command body)** — make `write-context.py` write the `task_summaries`
   map itself when journaling a task finish, so the Activity panel's Tasks card is populated
   by the same script call that already records the history finish event. Stop relying on a
   skippable hand-authored `.spec-context.json` edit.
2. **UI (CSS)** — restyle the implement `NN%` pill into a right-aligned label whose color
   ramps toward the success/goal color as completion approaches 100%.

## Technical Context

- **Language/stack**: TypeScript (extension host + Preact webview), Python 3 (stdlib only)
  for the capture scripts, CSS for the spec-viewer theme.
- **Capture reader contract** (the crux): `stateDerivation.ts` exposes
  `taskSummaries: pickRecord<TaskSummary>(ctx, 'task_summaries')`; `TasksCard.tsx` keys off
  `Object.keys(summaries)` (task ids) and reads `t.status`, `t.did`, `t.files`, `t.concerns`.
  `TaskSummary = { status: string; did?: string; files?: string[]; concerns?: string[] }`.
  The script must write exactly this shape, keyed by task id. Verified against
  `specs/138-harden-capture-shape/.spec-context.json` whose `task_summaries.T00x` entries are
  `{ "status": "DONE", "did": "...", "files": [...] }`.
- **Percentage source**: `phaseCalculation.ts` `calculateTaskCompletion` counts `- [x]`
  boxes in `tasks.md` (file-watched); `StepTab.tsx` renders `${taskCompletionPercent}%` in
  `.step-status`. This is independent of capture — a color ramp is purely presentational.

## Approach

### Part 1 — `write-context.py` writes `task_summaries`

- Add a helper that upserts `ctx["task_summaries"][task_id] = {status, did?, files?}` (omit
  empty `did`/`files`; preserve any existing keys; status defaults to `DONE`).
- Add `--did` and `--files` (comma-separated) CLI args. In the `--task` branch, parse files,
  call `journal_task_finish` (unchanged history behavior), then upsert the summary.
- Keep the cross-step-terminal guard, idempotency, and `currentTask`/`status` bookkeeping.
- A finish without `--did`/`--files` still writes a `{status: "DONE"}` entry so the task at
  least appears in the panel.

### Part 2 — command body / timing partial

- Edit `presets/_shared/timing-partial.md`: replace "append `task_summaries.<TaskID>`, then
  run …" with a single script call that carries `--did`/`--files`, one per task as it
  finishes (NOT batched, NOT a hand-authored JSON edit).
- Propagate the identical block verbatim to every command body that embeds it (18 files),
  so `check-shape-parity.py` stays green.

### Part 3 — CSS color ramp

- Drive the `%` label color from a CSS custom property the component sets per render
  (`--impl-progress`), interpolating from an in-progress color to `--success` via
  `color-mix`. Right-align it. Keep the live `taskCompletionPercent` as the only input.

## Constitution Check

- Scripts stay stdlib-only and best-effort (never fail the host command).
- No reader-side type change required — the script writes the existing `TaskSummary` shape.
- Parity guard (`check-shape-parity.py`) and lifecycle tests must stay green.

## Project Structure

- `speckit-extension/scripts/write-context.py` — new summary writer + CLI flags.
- `speckit-extension/tests/test_context.py` — new test asserting the summary shape + history.
- `speckit-extension/presets/_shared/timing-partial.md` + 18 embedding command bodies.
- `webview/styles/spec-viewer/_navigation.css` + `StepTab.tsx` — percentage label ramp.
