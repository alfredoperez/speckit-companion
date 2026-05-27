# Data Model: Explicit History Entry Kind Field

**Feature**: 111-history-entry-kind  
**Date**: 2026-05-27  
**Source**: `src/core/types/specContext.ts`, `src/core/types/spec-context.schema.json`

---

## Entities

### `HistoryEntryKind` *(new)*

A string enumeration distinguishing the two roles a history entry can play.

| Value | Meaning |
|-------|---------|
| `"start"` | Records that a step (or substep) was entered. Contains a `from` reference to the prior step/substep. |
| `"complete"` | Records that a step (or substep) was finished. No `from` field — the step itself is unambiguous. |

---

### `HistoryEntry` *(updated)*

The atomic unit of the append-only `history[]` log in `.spec-context.json`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `step` | `StepName` | yes | The step this entry belongs to. |
| `substep` | `string \| null` | yes | Non-null for substep events; null for top-level step events. |
| `kind` | `HistoryEntryKind` | yes | **NEW** — `"start"` or `"complete"`. |
| `from` | `HistoryEntryFrom?` | no | **Changed: now optional.** Present on `start` entries only; absent on `complete` entries. |
| `by` | `HistoryEntryBy` | yes | Who wrote this entry: `"extension"`, `"sdd-skill"`, `"user"`, or `"ai"`. |
| `at` | ISO 8601 datetime string | yes | Real timestamp from `date -u +"%Y-%m-%dT%H:%M:%SZ"`. |

**Validation rules**:
- If `kind === "start"`: `from` SHOULD be present. `from.step` is the prior step (or `null` for the first entry in the history).
- If `kind === "complete"`: `from` MUST be absent (or ignored if present — legacy tolerance).
- `substep` completions follow the same rule: `kind === "complete"` → no `from`.

---

### `HistoryEntryFrom` *(unchanged)*

The prior-step reference attached to `start` entries.

| Field | Type | Notes |
|-------|------|-------|
| `step` | `StepName \| null` | The step the spec was in before this transition. `null` on the very first history entry. |
| `substep` | `string \| null` | The substep the spec was in, or `null`. |

---

### Legacy `HistoryEntry` *(read-only — accepted by normalizer)*

Entries written by extension versions before `111-history-entry-kind`.

| Field | Notes |
|-------|-------|
| No `kind` field | Normalizer infers `kind` from self-loop detection. |
| `from.step === step` (step null, substep null) | → `kind: "complete"`, `from` stripped |
| `from.substep === substep` (substep non-null) | → `kind: "complete"`, `from` stripped |
| Any other `from` shape | → `kind: "start"`, `from` kept |
| Neither condition applies | → `kind: "start"` (safe fallback) |

---

## State Transitions

The `HistoryEntry` model has no state machine of its own — entries are append-only. The meaning of `kind` is:

```
Step lifecycle view:
  [start entry] ──────────────────────── [complete entry]
       │                                        │
  kind="start"                           kind="complete"
  from={prev step}                       from=absent
  at=step start time                     at=step end time
```

For substeps within a step:

```
  [substep start entry] ──── [substep complete entry]
        │                            │
  kind="start"                kind="complete"
  substep="phase1"            substep="phase1"
  from.substep=null           from=absent
```

---

## Schema Diff Summary

```diff
// src/core/types/spec-context.schema.json — historyEntry $def

"required": [
-  "step", "substep", "from", "by", "at"
+  "step", "substep", "kind", "by", "at"
],
"properties": {
  "step": { ... },
  "substep": { ... },
+ "kind": { "type": "string", "enum": ["start", "complete"] },
  "from": { ... },   // no longer required
  "by": { ... },
  "at": { ... }
}
```

```diff
// src/core/types/specContext.ts — HistoryEntry interface

+ export type HistoryEntryKind = 'start' | 'complete';

export interface HistoryEntry {
    step: StepName;
    substep: string | null;
+   kind: HistoryEntryKind;
-   from: HistoryEntryFrom;
+   from?: HistoryEntryFrom;
    by: HistoryEntryBy;
    at: string;
}
```
