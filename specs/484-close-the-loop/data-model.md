# Data Model: Completing the pipeline closes the loop

No persisted schema changes. The feature reinterprets existing `.spec-context.json` fields and changes what fold-back reports.

## Fields read (unchanged shape)

- **`status`** (`Status`) — the top-level lifecycle status. Can lag behind `history[]` when a step self-closes via journal-only `--finish`. No longer trusted as the sole signal for "is this step in flight".
- **`history[]`** (`HistoryEntry[]`) — the append-only source of truth. A `{ step, kind: 'complete' }` entry (or a legacy `from.step === step` completion) for the current step means that step is settled.
- **`currentStep`** (`StepName`) — the step the spec sits on.
- **`livingSpecs.loaded`** (`string[]`) — capabilities the feature loaded at specify time. Now also consulted by fold-back to produce an actionable "loaded but nothing to fold" signal.
- **`livingSpecs.synced`** (`string[]`) — capabilities fold-back wrote into. Unchanged.

## Derived state (in-memory, reshaped interpretation)

- **`isStepInFlight(step, run)`** — returns `false` when the step's completion is recorded (badge `completed` or `completedAt` present), before consulting `status`.
- **Reconciler settle** — an in-progress status whose owning step is `currentStep` and whose completion is the latest history entry for that step is moved forward to the step's settled status (`tasking → ready-to-implement`, `planning → planned`, `specifying → specified`). Never applied to implement; never moves backward.

## Fold-back outcomes (reported, not persisted)

The fold names exactly one outcome: `folded` (writes the delta, records synced), `disabled`, `spec-unreadable`, `no-capability-resolved`, `no-delta-block` (with an actionable variant when `livingSpecs.loaded` is non-empty), or `already-up-to-date`.
