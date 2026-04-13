# Spec: Extension-Side Lifecycle Writes for .spec-context.json

**Slug**: 061-extension-lifecycle-writes | **Date**: 2026-04-13

## Summary

Wire `.spec-context.json` lifecycle writes (step start/complete, substeps, canonical status) directly into the extension's command handlers and viewer message handlers. Spec 060 shipped the reader/writer/backfill plumbing but never called it at step-launch time, so timestamps and transitions depend entirely on the AI CLI cooperating. This spec makes the extension itself the source of truth, guaranteeing the lifecycle is recorded even when the AI never touches the file.

## Requirements

- **R001** (MUST): Each `speckit.<step>` command (`specify`, `plan`, `tasks`, `implement`, `clarify`, `analyze`) calls `setStepStarted(step, 'extension')` on the target spec's `.spec-context.json` before dispatching the prompt to the terminal.
- **R002** (MUST): Step-start writes happen synchronously relative to the command handler — a failure to dispatch the terminal prompt must not prevent the write, and a write failure must be logged but must not block the dispatch.
- **R003** (MUST): When the terminal spawned for a step closes (`vscode.window.onDidCloseTerminal` for a terminal tracked by the extension), call `setStepCompleted(step, 'extension')` for the step that terminal was launched for.
- **R004** (MUST): The viewer Approve action, when received via `messageHandlers`, writes `setStepCompleted(step, 'extension')` for the step being approved.
- **R005** (MUST): The viewer Regenerate action writes `setStepStarted(step, 'extension')` so the step history reflects the re-open.
- **R006** (MUST): `completeSpec`, `archiveSpec`, and `reactivateSpec` message handlers use the canonical status vocabulary (`completed`, `archived`, and the active-state derivation from `currentStep`) — not the legacy `active|completed|archived` strings written by the current `setSpecStatus`.
- **R007** (MUST): All writes use the existing atomic-rename + append-only-transitions writer (`writeSpecContext` / `updateSpecContext`); no raw `fs.writeFile` of `.spec-context.json`.
- **R008** (SHOULD): Where the extension runs its own multi-phase checks (checklist validation, regenerate, approve), emit `setSubstepStarted` / `setSubstepCompleted` with names from `CANONICAL_SUBSTEPS`.
- **R009** (SHOULD): `fileWatchers.ts` may watch for the step's expected output file (`plan.md`, `tasks.md`, etc.) and fire `setStepCompleted` as a fallback when terminal-close detection misses. Polish, not blocker.
- **R010** (MUST): No edits to `.claude/**` or `.specify/**`. All behavior lives under `src/**`.

## Scenarios

### Step launch records `startedAt` before AI runs

**When** the user triggers `speckit.plan` on spec `061-extension-lifecycle-writes`
**Then** `specs/061-extension-lifecycle-writes/.spec-context.json` has `stepHistory.plan.startedAt` set and a new `transitions` entry with `step: "plan"`, `by: "extension"` — visible in the sidebar/header before the AI terminal responds.

### Terminal close records `completedAt`

**When** the terminal spawned by `speckit.plan` closes (AI finished, user closed it, or process exited)
**Then** the handler writes `stepHistory.plan.completedAt` via `setStepCompleted(..., 'extension')` and appends a matching transition. Status derives to `planned`.

### Viewer Approve writes completion

**When** the user clicks Approve in the spec viewer for the `tasks` step
**Then** `messageHandlers` calls `setStepCompleted('tasks', 'extension')`; status becomes `ready-to-implement`; the stepper visibly advances without waiting for the AI.

### Viewer Regenerate re-opens a step

**When** the user clicks Regenerate on `plan`
**Then** `setStepStarted('plan', 'extension')` runs, `stepHistory.plan.completedAt` is cleared via a fresh entry, status returns to `planning`, and a transition is appended.

### Canonical status from status commands

**When** the user clicks Complete/Archive/Reactivate in the viewer
**Then** the message handler writes canonical status (`completed`, `archived`, or the active-state status derived from current step) through `updateSpecContext`, replacing the legacy `setSpecStatus` write.

### AI also writes — no corruption

**When** both the extension and the AI CLI write `.spec-context.json` for the same step within the same second
**Then** both writes succeed (atomic rename), `transitions` contains both append entries in the order they landed, `stepHistory[step]` reflects the later timestamp, and no entry is lost or rewritten.

### Terminal reuse

**When** the user runs `speckit.specify` then immediately `speckit.plan` in the same reused terminal
**Then** `setStepStarted` fires at each command invocation (not tied to terminal lifecycle). `setStepCompleted` is best-effort: if `onDidCloseTerminal` only fires once at the end, only the last step gets a close-driven completion — approve/regenerate/output-file fallbacks cover the earlier ones.

## Out of Scope

- AI-side cooperation. If the AI also writes lifecycle data, the reader tolerates it; if it doesn't, this spec still guarantees the record.
- Webview renderer polish (substep labels, pulse animations, footer scope tooltips) — tracked in a sibling spec.
- Output-file watcher auto-completion is optional polish (R009) — the spec ships without it if terminal-close + viewer Approve prove sufficient.
- Prompt-text guidance asking the AI to annotate substeps — that belongs to surface #2 and is a separate spec.
