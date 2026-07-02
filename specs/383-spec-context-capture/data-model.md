# Data Model: reasoning-trail fields on `.spec-context.json`

**Feature**: 383-spec-context-capture. All fields are **optional and additive** (`additionalProperties: true` already tolerates them); absence means "not captured", never an error. De-dup/upsert rules per [research.md](./research.md) D2/D7.

## New fields

| Field | Type | Identity / merge | Written at |
|---|---|---|---|
| `intent` | `string` | overwrite (scalar) | specify complete |
| `expectations` | `string[]` | de-duped append, first-seen order | specify complete |
| `verified` | `VerificationEntry[]` | de-duped append on `what` | implement complete |
| `coverage` | `{ [reqId]: CoverageEntry }` | upsert by requirement id, non-destructive merge | tasks complete (tasks) + implement close (tests) |
| `classification` | `ClassificationEntry` | overwrite (one object) | specify/classify |

## Existing declared-but-unwritten fields gaining a script writer

| Field | Type | Identity / merge | Written at |
|---|---|---|---|
| `decisions` | `DecisionEntry[]` *(today `string[]` in ViewerState — widened, string still accepted)* | de-duped append on `decision` | plan complete + implement close |
| `concerns` | `ConcernEntry[]` (exists) | de-duped append on `note` | any step, on friction |
| `approach` | `string` (exists) | overwrite | plan complete |
| `step_summaries` | `{ [step]: StepSummaryEntry }` (exists, loose) | upsert by step | each step complete |
| `last_action` | `string` (exists) | overwrite | step closes, skip-markers, mark-complete |

## Entity shapes

```ts
interface DecisionEntry {
  decision: string;          // identity key
  why?: string;
  rejected?: string;         // the alternative not taken
}

interface VerificationEntry {
  what: string;              // identity key — what was checked
  result?: string;           // e.g. "13/13 pass", "build clean"
  command?: string;          // e.g. "npm test"
  warnings?: string[];       // seen-and-dismissed warnings
}

interface CoverageEntry {
  tasks?: string[];          // task ids covering the requirement
  tests?: string[];          // test refs: "path.test.ts" or "path.test.ts::case"
}

interface ClassificationEntry {
  projectedFiles?: number;
  projectedTasks?: number;
  scopeSignal?: 'larger' | 'smaller' | 'none';
  verdict: 'simple' | 'normal' | 'oversized';   // mirrors the scalar `size`
}

interface StepSummaryEntry {
  summary: string;
  key_finding?: string;
  risks?: string[];
}
```

**Validation rules**: JSON-or-plain-text coercion (a bare string wraps under the identity key); unknown keys inside an entry are preserved verbatim; lifecycle keys (`history`, `status`, `currentStep`, `transitions`) remain refused by `--set` (`PROTECTED_SET_KEYS` unchanged).

**State transitions**: none — no field participates in the lifecycle state machine; `--mark-complete` remains the only `completed` writer.

**Derivation change (no on-disk shape change)**: step-duration derivation in `specContext.ts` computes spans only between `by: 'extension'`-stamped boundaries; other authors' timestamps order events but never produce a duration.
