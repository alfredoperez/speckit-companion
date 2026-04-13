# Phase 1 Data Model

## SpecContext (root document of `.spec-context.json`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `workflow` | `"speckit-terminal" \| "speckit-companion" \| "sdd" \| "sdd-fast" \| string` | yes | Open string for custom workflows. |
| `specName` | `string` | yes | Directory name (e.g. `060-spec-context-tracking`). |
| `branch` | `string` | yes | Git branch at creation. |
| `selectedAt` | `string (ISO 8601)` | no | When this spec was first opened in the viewer. |
| `currentStep` | `"specify" \| "clarify" \| "plan" \| "tasks" \| "analyze" \| "implement"` | yes | Pointer to the active step. |
| `status` | `Status` | yes | See enum below. |
| `stepHistory` | `Record<StepName, StepHistoryEntry>` | yes | Empty object allowed. |
| `transitions` | `Transition[]` | yes | Append-only. Empty array allowed. |
| `*` (unknown) | `unknown` | no | Preserved verbatim across writes. |

### Status enum

`draft | specifying | specified | planning | planned | tasking | ready-to-implement | implementing | completed | archived`

Invariants:
- `archived` is terminal and overrides per-step rendering.
- `completed` implies all `stepHistory` entries that exist have `completedAt` set.
- `*-ing` states require the corresponding step to have `startedAt` set and `completedAt` null.

### StepHistoryEntry

| Field | Type | Required |
|---|---|---|
| `startedAt` | ISO 8601 | yes when entry exists |
| `completedAt` | ISO 8601 \| null | yes (nullable) |
| `substeps` | `SubstepEntry[]` | no |

### SubstepEntry

| Field | Type |
|---|---|
| `name` | `string` |
| `startedAt` | ISO 8601 |
| `completedAt` | ISO 8601 \| null |

### Transition (append-only)

| Field | Type |
|---|---|
| `step` | StepName |
| `substep` | `string \| null` |
| `from` | `{ step: StepName \| null, substep: string \| null }` |
| `by` | `"extension" \| "user" \| "cli"` |
| `at` | ISO 8601 |

## Derived view models (not persisted)

### StepBadgeState

`"not-started" | "in-progress" | "completed"` — derived as:
- `completed` if `stepHistory[step].completedAt` is set.
- `in-progress` if `startedAt` set and `completedAt` null.
- `not-started` otherwise (file presence ignored).

### ViewerState

```
{
  status: Status,
  activeStep: StepName,
  steps: Record<StepName, StepBadgeState>,
  pulse: StepName | null,            // null if status in {completed, archived}
  highlights: StepName[],            // all completed steps
  footer: FooterAction[]             // visibility-filtered, with tooltips
}
```

### FooterAction

| Field | Type |
|---|---|
| `id` | string |
| `label` | string |
| `scope` | `"spec" \| "step"` |
| `visibleWhen` | `(ctx, step) => boolean` |
| `tooltip` | string (auto-suffixed with scope phrase) |

## State transitions (status)

```
draft → specifying → specified → planning → planned → tasking
      → ready-to-implement → implementing → completed → archived
```

Any state may jump to `archived` via explicit user action. Regenerate of a step does not change `status` unless it re-opens an earlier step (then status reverts to that step's `*-ing`).
