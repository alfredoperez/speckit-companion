# Phase 1 Data Model — Timing fidelity v2

No new persisted fields. This documents the *shape change* (per-task/substep entries become single finish events) and the *derived-duration* rule the host computes from them.

## Entity: Timeline event (`history[]` entry)

One append-only entry in `.spec-context.json` `history[]`. Existing schema, unchanged:

| Field | Type | Notes |
|-------|------|-------|
| `step` | enum | `specify\|clarify\|plan\|tasks\|analyze\|implement` |
| `substep` | string \| null | substep name, or the task id for per-task entries |
| `task` | string (optional) | task id (e.g. `T004`) for per-task entries; mirrors `substep` |
| `kind` | enum | `start \| complete` |
| `from` | `{step, substep}` (optional) | present on step `start` entries only; never on completes |
| `by` | enum | `extension \| user \| cli \| ai \| derive` |
| `at` | date-time | ISO-8601; ms precision for deterministic writers |

**What changes under finish-only** (convention, not schema):

| Entry kind | Before | After |
|------------|--------|-------|
| Step-level (specify) | `start` + `complete` (real begin→end) | **unchanged** — genuine span retained |
| Step-level (plan/tasks/clarify/analyze/implement boundaries) | `start` (+ deterministic `complete`) | **unchanged** — deterministic boundaries retained |
| Per-substep (plan `research`/`design`, tasks `generate`) | `start` + `complete` pair (often same instant → burst) | **single `complete`** finish event |
| Per-task (implement `T001`…) | `start` + `complete` pair (hook, same instant → `0s` tick) | **single `complete`** finish event |

Invariants preserved: `history` is append-only; the last entry's `step` equals `currentStep`; `status` matches the step's lifecycle stage; one finish per (task/substep) (idempotent — live call + backstop never double-write).

## Entity: Derived duration (computed, not stored)

Produced by `deriveStepHistory` / `buildSubsteps` in `src/features/specs/stepHistoryDerivation.ts`; consumed by the webview viewer (`timelineEvents.ts`). **Never persisted** — `stepHistory` is in-memory only.

**Finish-delta rule** for an ordered list of finish events `f₁ … fₙ` within a step whose start is `S`:

```
duration(f₁) = f₁.at − S            # first finish anchored to the step start
duration(fᵢ) = fᵢ.at − fᵢ₋₁.at      # subsequent finishes measured from the previous finish
substep/task row:  startedAt = (i==1 ? S : fᵢ₋₁.at),  completedAt = fᵢ.at
```

Edge handling:
- **First finish in a step**: anchored to the step's `start.at` (no prior finish).
- **Single task / single substep**: one row, `S → f₁.at`.
- **Zero tasks/substeps**: no rows; only the step span.
- **Parallel `[P]` batch**: all members share the last finisher's boundary (accepted limitation — documented, not failed by the eval).
- **Legacy start+complete pairs** (pre-migration specs): derivation stays tolerant — a paired `start` still yields a row; finish-only is the new path, not a hard requirement on old data.

## Entity: Template profile (unchanged shape, fixed activation)

`speckit.companion.templateProfile` ∈ `standard | lean | off`, persisted to `.specify/companion.yml`. A profile is "installed" when `.specify/presets/<id>` exists. The reconciler converges to *only the target preset installed* (mutual exclusivity); the only change is the **activation command** for the `add` op (see contracts) — no change to the decision model (`decidePresetOps`).
