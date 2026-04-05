# Data Model: Context-Driven Badges and Dates

## Existing Entities (no changes needed)

### FeatureWorkflowContext (`.spec-context.json`)

Already contains all fields needed for badge and date derivation:

```typescript
interface FeatureWorkflowContext {
    workflow: string;
    selectedAt: string;                             // ISO timestamp
    currentStep?: string;                           // "specify" | "plan" | "tasks" | "implement" | "done"
    status?: SpecStatus;                            // "active" | "completed" | "archived"
    stepHistory?: Record<string, StepHistoryEntry>; // Per-step timestamps
    // SDD-enriched fields
    step?: string;
    next?: string | null;
    task?: string | null;
    updated?: string;                               // ISO timestamp, set by AI agents
    // ... other SDD fields omitted
}

interface StepHistoryEntry {
    startedAt: string;      // ISO timestamp
    completedAt: string | null;
}
```

### Badge Derivation (existing, unchanged)

Source: `computeBadgeText(ctx)` in `phaseCalculation.ts`

| Priority | Condition | Badge Text |
|----------|-----------|------------|
| 1 | `status === "completed"` | COMPLETED |
| 2 | `status === "archived"` | ARCHIVED |
| 3 | `step === "implement" && task` | IMPLEMENTING {task} |
| 4 | `step === "implement"` | IMPLEMENTING |
| 5 | `next === "plan"` | CREATE PLAN |
| 6 | `next === "tasks"` | CREATE TASKS |
| 7 | `next === "implement"` | IMPLEMENT |
| 8 | `next === "done"` | COMPLETED |
| 9 | `step === "specify"` | SPECIFYING |
| 10 | `step === "plan"` | PLANNING |
| 11 | `step === "tasks"` | CREATING TASKS |
| 12 | fallback (context exists) | ACTIVE |
| 13 | no context | `null` (hidden) |

## Modified Entity

### NavState (extension → webview)

Add two optional date fields:

```typescript
interface NavState {
    // ... existing fields unchanged ...
    badgeText?: string | null;       // existing
    createdDate?: string | null;     // NEW: formatted date string or null
    lastUpdatedDate?: string | null; // NEW: formatted date string or null
}
```

## New Derivation Logic

### Date Computation

**Created date** — derived from `stepHistory`:
1. If `stepHistory.specify.startedAt` exists → format as display date
2. Else if any `stepHistory[*].startedAt` exists → use earliest
3. Else → `null` (omitted from display)

**Last Updated date** — derived from `stepHistory` + `updated`:
1. If `context.updated` exists → use it (most recent AI agent activity)
2. Else collect all `startedAt` and `completedAt` from `stepHistory` → use most recent
3. If only one timestamp exists (same as Created) → `null` (omit "Last Updated" to avoid redundancy)
4. Else → `null`

**Format**: `"Apr 1, 2026"` — `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`

## State Transitions

No new state transitions. Dates are derived (read-only) from existing `stepHistory` entries which are already written by `updateStepProgress()` and `setSpecStatus()`.

```
User action          → spec-context.json write     → NavState recomputed → Viewer updates
─────────────────────────────────────────────────────────────────────────────────────────
Start specify step   → stepHistory.specify.startedAt set   → createdDate appears
Advance to plan      → stepHistory.plan.startedAt set      → lastUpdatedDate appears
Complete spec        → status = "completed"                → badge shows COMPLETED
Archive spec         → status = "archived"                 → badge shows ARCHIVED
Reactivate spec      → status = "active"                   → badge reverts to step label
```

## Validation Rules

- ISO timestamps must be parseable by `new Date()`. If unparseable → treat as missing (omit date)
- Malformed `.spec-context.json` → treat as absent (omit all badge and date elements)
- Missing `stepHistory` → no dates shown
- Missing `currentStep` and `status` → no badge shown (already handled by `computeBadgeText`)
