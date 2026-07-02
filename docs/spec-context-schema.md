# `.spec-context.json` Schema

Each spec directory contains a `.spec-context.json` file that tracks workflow state. This is the single source of truth for where a spec is in its lifecycle.

**Type**: `SpecContext` in `src/core/types/specContext.ts` (and the parallel `FeatureWorkflowContext` in `src/features/workflows/types.ts`).

## Fields

### Core (required)

| Field | Type | Description |
|---|---|---|
| `workflow` | `string` | Workflow name (e.g., `"speckit-companion"`, `"speckit"`) |
| `specName` | `string` | Human-readable name derived from directory slug |
| `branch` | `string` | Git branch associated with this spec |
| `selectedAt` | `string` | ISO timestamp when workflow was selected |

### Step tracking

| Field | Type | Description |
|---|---|---|
| `currentStep` | `string` | Active workflow step (e.g., `"specify"`, `"plan"`, `"tasks"`, `"implement"`) |
| `status` | `string` | Canonical lifecycle status (see vocabulary below) |
| `progress` | `string \| null` | In-progress indicator set by external skills (e.g., `"exploring"`, `"phase1"`). When non-null, badge text appends `"..."` |
| `currentTask` | `string \| null` | Current task being executed (e.g., `"T001"`) |
| `history` | `HistoryEntry[]` | Append-only log of step boundaries (start / completion / substep) |

`HistoryEntry`:
```ts
{
  step: 'specify' | 'clarify' | 'plan' | 'tasks' | 'analyze' | 'implement',
  substep: string | null,
  task?: string,   // per-task implement finishes; substep is null on these
  kind: 'start' | 'complete',
  by: 'extension' | 'user' | 'cli' | 'ai',
  at: string  // ISO timestamp
}
```

The writer no longer emits a `from` pointer (it is fully derivable from the previous entry's step). Records written before this change still carry `from`; readers tolerate it via the schema's permissive `additionalProperties`, so they keep validating and rendering — only the writers stopped producing it.

### Metadata

| Field | Type | Description |
|---|---|---|
| `createdAt` | `string` | ISO timestamp when spec was first created |
| `checkpointStatus` | `Record<CheckpointId, CheckpointStatus>` | Checkpoint states (`commit`, `pr`) |

### Reasoning trail (optional, script-written — #392)

The run's reasoning trail, written through `write-context.py` capture flags by the Companion command bodies at their lifecycle points. All additive, de-duped/upserted, and best-effort — a missing value is "not captured", never an error.

| Field | Type | Written at | Flag |
|---|---|---|---|
| `intent` | `string` | specify complete | `--set intent=…` |
| `expectations` | `string[]` | specify complete | `--expectation` (repeatable, de-duped) |
| `approach` | `string` | plan complete | `--set approach=…` |
| `decisions` | `{decision, why?, rejected?}[]` (bare strings tolerated) | plan complete + implement close | `--decision` (JSON-or-text, de-duped on `decision`) |
| `verified` | `{what, result?, command?, warnings?}[]` | implement complete | `--verified` (JSON-or-text, de-duped on `what`) |
| `concerns` | `{note, step?, kind?}[]` | any step, on friction | `--concern` (JSON-or-text, de-duped on `note`) |
| `coverage` | `Record<reqId, {tasks?, tests?}>` | tasks complete (tasks) + implement close (tests) | `--coverage-req <id> --tasks/--tests` (non-destructive upsert) |
| `classification` | `{projectedFiles?, projectedTasks?, scopeSignal?, verdict}` | specify sizing | `--classification '<json>'` (verdict required; exit 2 on caller error) |
| `step_summaries` | `Record<step, {summary, key_finding?, risks?}>` | each step close | `--step-summary` (keyed by `--step`) |
| `last_action` | `string` | step closes + skip-markers | `--set last_action=…` |

Skip-markers keep audits honest: a gated-off path (living specs, hooks) records `last_action = "<what> evaluated — skipped (<why>)"` so "correctly did nothing" is distinguishable from "capture broke".

### Skill-enriched (optional)

Remaining skill-authored fields the extension reads but no script writes:

| Field | Type | Description |
|---|---|---|
| `task_summaries` | `Record<string, object>` | Per-task summaries with `status`, `did`, `files`, `concerns` (script-written per task) |
| `files_modified` | `string[]` | Deduplicated list of all files modified during implementation |

All declared fields are formally **declared** (optional) in the canonical
`SpecContext` type and `spec-context.schema.json`; remaining skill fields
stay tolerated via `additionalProperties: true`.

### Derived in-memory (never persisted)

The viewer computes per-step timing from `history[]` on every render:

```ts
stepHistory: Record<string, {
  startedAt: string,
  completedAt: string | null,
  substeps?: { name, startedAt, completedAt }[],
  durationTrusted?: boolean
}>
```

This is what badges, the running-step pulse, the activity timeline, and
elapsed-timer notifications consume. It is **not** written to disk.

**Duration honesty (#392):** `durationTrusted` is true only when *both* span
boundaries were stamped by the extension's own clock (`by: 'extension'`).
AI/cli-journaled timestamps order events correctly but record when the write
ran, not when the work happened — so renderers must not present an elapsed
time for an untrusted span (fast-path folds and back-to-back task journals
are the canonical false-duration cases).

## Example

```json
{
  "workflow": "speckit-companion",
  "specName": "My Feature",
  "branch": "feat/my-feature",
  "selectedAt": "2026-04-05T22:00:00.000Z",
  "currentStep": "implement",
  "status": "implementing",
  "progress": "phase1",
  "currentTask": "T003",
  "history": [
    { "step": "specify",   "substep": null, "kind": "start",    "by": "extension", "at": "2026-04-05T22:00:01Z" },
    { "step": "specify",   "substep": null, "kind": "complete",  "by": "extension", "at": "2026-04-05T22:05:12Z" },
    { "step": "plan",      "substep": null, "kind": "start",     "by": "extension", "at": "2026-04-05T22:05:12Z" },
    { "step": "plan",      "substep": null, "kind": "complete",  "by": "extension", "at": "2026-04-05T22:11:34Z" },
    { "step": "tasks",     "substep": null, "kind": "start",     "by": "extension", "at": "2026-04-05T22:11:34Z" },
    { "step": "tasks",     "substep": null, "kind": "complete",  "by": "extension", "at": "2026-04-05T22:18:02Z" },
    { "step": "implement", "substep": null, "kind": "start",     "by": "extension", "at": "2026-04-05T22:18:02Z" },
    { "step": "implement", "substep": null, "task": "T001", "kind": "complete", "by": "ai", "at": "2026-04-05T22:21:40Z" }
  ],
  "approach": "Add migration layer and fix race condition",
  "task_summaries": {
    "T001": { "status": "DONE", "did": "...", "files": [], "concerns": [] }
  }
}
```

## Invariants

- `history` is APPEND-ONLY. Never reorder, never delete, never edit prior entries.
- The last `history[]` entry's `step` MUST equal `currentStep`. Advancing
  `currentStep` requires appending the matching start-entry in the same
  write. `currentStep` ahead of `history` is the failure mode that makes
  the viewer show a phantom "Generating <step>…" indefinitely.
- `status` matches the lifecycle stage of `currentStep` (in-progress form
  while a step is mid-flight, completed form once its completion entry is
  appended).
- Unknown top-level fields are preserved across writes.

## Removed / renamed fields

The following fields were removed from the persisted shape:

| Old field | Replacement |
|---|---|
| `transitions` | Renamed to `history` |
| `stepHistory` | Derived in-memory from `history[]`; no longer persisted |
| `step` | `currentStep` |
| `substep` | `progress` |
| `task` | `currentTask` |
| `next` | Derived from `currentStep` + workflow step array at read time |
| `updated` | Dropped — the ms-stamped `history[]` `at` values are strictly more precise; no reader consumes it |
| `from` (on history entries) | Dropped — derivable from the previous entry's step. Legacy records keep it; readers tolerate it |

Files written by older versions that still carry `stepHistory`,
`transitions`, an `updated` marker, or a `from` pointer on history entries
are accepted on read (validated as undeclared extras via permissive
`additionalProperties`). The legacy `transitions` array is actively dropped
(rewritten to `history`); a top-level `updated` marker or a per-entry `from`
pointer, by contrast, is **preserved** on records that already carry it — new
writers simply stop *adding* them rather than stripping what's already there.

> **Note:** `next` and `updated` are still written by external CLI skills for workflow use (resume/auto-advance and status display). The extension ignores these fields — they are skill-specific and not part of the SpecKit schema.
