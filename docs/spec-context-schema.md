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

### Skill-enriched (optional)

Skill-authored fields. The extension reads them but does not write them.

| Field | Type | Description |
|---|---|---|
| `approach` | `string` | Implementation approach summary |
| `last_action` | `string` | Short description of last completed action |
| `task_summaries` | `Record<string, object>` | Per-task summaries with `status`, `did`, `files`, `concerns` |
| `step_summaries` | `Record<string, object>` | Per-step summaries (specify, plan complexity/risks) |
| `files_modified` | `string[]` | Deduplicated list of all files modified during implementation |
| `decisions` | `array` | Non-trivial decisions made during implementation |
| `concerns` | `array` | Flagged issues from implementation |

The three viewer-relevant skill-authored fields — `last_action`,
`task_summaries`, `step_summaries` — are formally **declared** (optional) in
the canonical `SpecContext` type and `spec-context.schema.json`; remaining
skill fields stay tolerated via `additionalProperties: true`.

### Derived in-memory (never persisted)

The viewer computes per-step timing from `history[]` on every render:

```ts
stepHistory: Record<string, {
  startedAt: string,
  completedAt: string | null,
  substeps?: { name, startedAt, completedAt }[]
}>
```

This is what badges, the running-step pulse, the activity timeline, and
elapsed-timer notifications consume. It is **not** written to disk.

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
`additionalProperties`) and the redundant fields are simply not re-emitted on
the next write.

> **Note:** `next` and `updated` are still written by external CLI skills for workflow use (resume/auto-advance and status display). The extension ignores these fields — they are skill-specific and not part of the SpecKit schema.
