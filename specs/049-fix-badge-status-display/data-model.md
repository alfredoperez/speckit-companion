# Data Model: Fix Badge Status Display

## Badge Text Derivation

Source: `computeBadgeText(ctx)` in `phaseCalculation.ts`

### Input Fields (from FeatureWorkflowContext)

| Field | Type | Source |
|-------|------|--------|
| `status` | `string \| undefined` | `.spec-context.json` → `status` |
| `currentStep` | `string \| null \| undefined` | `.spec-context.json` → `currentStep` |
| `progress` | `string \| null \| undefined` | `.spec-context.json` → `progress` |
| `currentTask` | `string \| null \| undefined` | `.spec-context.json` → `currentTask` |
| `stepHistory` | `Record<string, StepHistoryEntry> \| undefined` | `.spec-context.json` → `stepHistory` |

### StepHistoryEntry (existing type, no changes)

| Field | Type | Description |
|-------|------|-------------|
| `startedAt` | `string` | ISO timestamp when step began |
| `completedAt` | `string \| null` | ISO timestamp when step finished; null = in progress |

## Badge Derivation Priority (top wins)

| Priority | Condition | Badge Text | Color |
|----------|-----------|-----------|-------|
| 1 | `status === "completed"` | COMPLETED | green |
| 2 | `status === "archived"` | ARCHIVED | gray |
| 3 | `step === "implement"` + `currentTask` + `progress` | IMPLEMENTING T004... | blue |
| 4 | `step === "implement"` + `currentTask` | IMPLEMENTING T004 | blue |
| 5 | `step === "implement"` + `progress` | IMPLEMENTING... | blue |
| 6 | `step === "implement"` + `completedAt` | IMPLEMENT COMPLETE | blue |
| 7 | `step === "implement"` | IMPLEMENTING | blue |
| 8 | `completedAt` set + no `progress` (specify) | SPECIFY COMPLETE | blue |
| 9 | `completedAt` set + no `progress` (plan) | PLAN COMPLETE | blue |
| 10 | `completedAt` set + no `progress` (tasks) | TASKS COMPLETE | blue |
| 11 | `progress` non-null (specify) | SPECIFYING... | blue |
| 12 | `progress` non-null (plan) | PLANNING... | blue |
| 13 | `progress` non-null (tasks) | CREATING TASKS... | blue |
| 14 | step = specify (idle) | SPECIFYING | blue |
| 15 | step = plan (idle) | PLANNING | blue |
| 16 | step = tasks (idle) | CREATING TASKS | blue |
| 17 | fallback | ACTIVE | blue |
| 18 | no context | *(hidden)* | — |

## Step Label Mapping

| currentStep | In-progress verb | Completion label |
|-------------|-----------------|-----------------|
| `specify` | SPECIFYING | SPECIFY COMPLETE |
| `plan` | PLANNING | PLAN COMPLETE |
| `tasks` | CREATING TASKS | TASKS COMPLETE |
| `implement` | IMPLEMENTING | IMPLEMENT COMPLETE |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `completedAt` set + `progress` non-null | In-progress wins (priority 11-13 over 8-10) |
| No `stepHistory` | Falls through to verb-based (priority 14-16) |
| `currentStep` not in `stepHistory` | Same as no stepHistory — verb-based |
| `status: "tasks-done"` | Not a terminal status; falls through to step-based logic |
| Unknown `currentStep` value | Returns "ACTIVE" (priority 17) |
