# `.spec-context.json` Schema

Each spec directory contains a `.spec-context.json` file that tracks workflow state. This is the single source of truth for where a spec is in its lifecycle.

**Type**: `FeatureWorkflowContext` in `src/features/workflows/types.ts`

## Fields

### Core (required)

| Field | Type | Description |
|---|---|---|
| `workflow` | `string` | Workflow name (e.g., `"sdd"`) |
| `selectedAt` | `string` | ISO timestamp when workflow was selected |

### Step tracking

| Field | Type | Description |
|---|---|---|
| `currentStep` | `string` | Active workflow step (e.g., `"specify"`, `"plan"`, `"tasks"`, `"implement"`) |
| `progress` | `string \| null` | In-progress indicator set by SDD skills (e.g., `"exploring"`, `"phase1"`). When non-null, badge text appends `"..."` |
| `currentTask` | `string \| null` | Current task being executed (e.g., `"T001"`) |
| `stepHistory` | `Record<string, StepHistoryEntry>` | Map of step name to `{ startedAt, completedAt }` timestamps |

### Metadata

| Field | Type | Description |
|---|---|---|
| `status` | `"active" \| "completed" \| "archived"` | Spec lifecycle status for sidebar grouping |
| `specName` | `string` | Human-readable name derived from directory slug |
| `branch` | `string` | Git branch associated with this spec |
| `createdAt` | `string` | ISO timestamp when spec was first created |
| `checkpointStatus` | `Record<CheckpointId, CheckpointStatus>` | Checkpoint states (`commit`, `pr`) |

### SDD-enriched (optional)

These fields are written by SDD skills during execution. The extension reads them but does not write them.

| Field | Type | Description |
|---|---|---|
| `approach` | `string` | Implementation approach summary |
| `last_action` | `string` | Short description of last completed action |
| `task_summaries` | `Record<string, object>` | Per-task summaries with `status`, `did`, `files`, `concerns` |
| `step_summaries` | `Record<string, object>` | Per-step summaries (specify, plan complexity/risks) |
| `files_modified` | `string[]` | Deduplicated list of all files modified during implementation |
| `decisions` | `array` | Non-trivial decisions made during implementation |
| `concerns` | `array` | Flagged issues from implementation |

## Example

```json
{
  "workflow": "sdd",
  "selectedAt": "2026-04-05T22:00:00.000Z",
  "currentStep": "implement",
  "progress": "phase1",
  "currentTask": "T003",
  "status": "active",
  "specName": "My Feature",
  "branch": "feat/my-feature",
  "stepHistory": {
    "specify": { "startedAt": "...", "completedAt": "..." },
    "plan": { "startedAt": "...", "completedAt": "..." },
    "tasks": { "startedAt": "...", "completedAt": "..." },
    "implement": { "startedAt": "...", "completedAt": null }
  },
  "approach": "Add migration layer and fix race condition",
  "currentTask": "T003",
  "task_summaries": {
    "T001": { "status": "DONE", "did": "...", "files": [...], "concerns": [] }
  }
}
```

## Removed fields

The following fields were removed and should **not** be written:

| Old field | Replacement |
|---|---|
| `step` | `currentStep` |
| `substep` | `progress` |
| `task` | `currentTask` |
| `next` | Derived from `currentStep` + workflow step array at read time |
| `updated` | Derived from latest `stepHistory` timestamp |
