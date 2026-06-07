# Phase 1 Data Model: Status + Resume

No new persisted schema. This feature reads existing `.spec-context.json` fields and derives two in-memory views. Persisted shape is unchanged from spec 060 / #203.

## Entities

### SpecContext (existing — read-only here)

The canonical `.spec-context.json` document (`src/core/types/specContext.ts:147`). Fields this feature reads:

| Field | Type | Use |
|-------|------|-----|
| `currentStep` | `StepName` (`specify`\|`clarify`\|`plan`\|`tasks`\|`analyze`\|`implement`) | Anchors next-step resolution |
| `status` | `Status` (11 canonical values, `draft`…`archived`) | Distinguishes in-progress vs completed states for next-action |
| `history[]` | `HistoryEntry[]` | Source for "last transition"; append-only, never rewritten |
| `decisions[]` | `string[]` (tolerated passthrough) | Printed by status; carried into scope by resume |
| `specName` | `string` | Display label |

This feature performs **no writes** to `SpecContext`. State advances only through the normal capture hooks fired by the dispatched pipeline command.

### ResumeResolution (new — in-memory / script output, not persisted)

Computed by `status-context.py` and consumed by both commands and (indirectly) the sidebar.

| Field | Type | Description |
|-------|------|-------------|
| `source` | `"state" \| "derived"` | Whether values came from `.spec-context.json` or file-derivation fallback |
| `currentStep` | `StepName` | Resolved current step |
| `status` | `Status` | Resolved current status |
| `decisions` | `string[]` | Recorded decisions in scope (empty array if none) |
| `nextStep` | `StepName \| null` | Next pipeline step; `null` when complete |
| `nextCommand` | `string \| null` | e.g. `/speckit.plan`; `null` when complete |
| `nextActionLabel` | `string` | Human label, e.g. "Generate tasks" or "Pipeline complete" |
| `nextTask` | `string \| null` | When inside the tasks/implement step, the next unchecked task id/line; else `null` |
| `complete` | `boolean` | True when no step remains to advance to |

**Validation rules**:
- When `status ∈ {completed, archived, implemented}` → `complete = true`, `nextStep = nextCommand = null`.
- When `currentStep = implement` and not all tasks checked → `nextTask` = first unchecked task in `tasks.md` order; `nextCommand = /speckit.implement`.
- When `source = "derived"` and no pipeline files exist → resolution reports "nothing to summarize" (status) / "nothing to resume" (resume) rather than erroring.

### LastTransition (new — in-memory derived view, not persisted)

Computed by `lastTransition.ts` from the final `HistoryEntry` in `ctx.history[]`.

| Field | Type | Description |
|-------|------|-------------|
| `label` | `string` | e.g. "planned", "implement started" — from the entry's `step` + `kind` |
| `at` | `string` (ISO 8601) | The entry's `at` timestamp |
| `relative` | `string` | Relative time from `at` (e.g. "2h ago", "just now") — measured against the entry, not `now − step start` |

Empty `history[]` → `null` (sidebar shows step/status only, no transition line).

## State transitions

This feature **observes** the canonical state machine (Specify → Plan → Tasks → Implement; Active → Completed → Archived) but does not own any new transitions. Resume triggers an existing transition indirectly by dispatching the next pipeline command, whose own `after_*` capture hook writes the resulting `history[]` entry.
