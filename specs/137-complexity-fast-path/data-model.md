# Phase 1 Data Model: Complexity Fast-Path

No new persisted file types. The feature adds one config field, one transient classification verdict (computed in the command body, not stored as its own record), and folded lifecycle entries in the existing `.spec-context.json`.

## Entity: Complexity classification (transient)

The simple/normal verdict for a spec. Computed inside the turbo specify command body; not persisted as a standalone record — its *effect* is persisted as lifecycle entries.

| Field | Type | Notes |
|---|---|---|
| `verdict` | `"simple" \| "normal"` | Drives which path runs. Defaults to `normal` on weak/conflicting signals. |
| `projectedFiles` | integer | Estimated files the change touches. |
| `projectedTasks` | integer | Estimated tasks the change decomposes into. |
| `scopePhraseSignal` | `"smaller" \| "larger" \| "none"` | From phrases like "one-line fix"/"rename" (smaller) vs "rewrite"/"overhaul"/"new system" (larger). |
| `crossedGuardrail` | boolean | True when `projectedFiles > 5` or `projectedTasks > 10`. Triggers the warning. |

**Classification rule** (best-effort, errs toward `normal`):
- `simple` **iff** the fast-path is enabled **and** `projectedFiles ≤ 5` **and** `projectedTasks ≤ 10` **and** `scopePhraseSignal ≠ "larger"`.
- Otherwise `normal`. A "larger" scope phrase forces `normal` even when counts look small (Edge Case: conflicting signals).
- Exactly 5 files / 10 tasks is the `simple` ceiling (not a guardrail crossing).
- `crossedGuardrail` true ⇒ warn, then run `normal`.

## Entity: Size signals (inputs)

The observable inputs to classification, read from the drafted spec (not the raw description alone): projected file count, projected task count, and scope phrases. These are heuristic estimates the AI derives while drafting requirements — there is no separate schema; they are the inputs feeding the classification rule above.

## Entity: Fast-path setting (persisted config)

The opt-out knob controlling whether auto-detection is active.

| Field | Type | Default | Location |
|---|---|---|---|
| `speckit.companion.complexityFastPath` | boolean | `true` | VS Code `settings.json` (editor-level) |
| `complexityFastPath` | boolean | (mirrors resolved value) | `.specify/companion.yml` (project-level mirror, read by the command body) |

**Resolution precedence** (computed in `companionPresetReconciler`): explicit `.specify/companion.yml` value → VS Code setting → `true`. Project-level wins on disagreement (FR-008 / Assumptions).

## Lifecycle fold (existing `.spec-context.json`)

For a fast-tracked spec, `history[]` gains four appended entries beyond the normal specify pair:

```
specify  start    (by: extension)
specify  complete (by: ai)
plan     start    substep="fast-path"  (by: ai)
plan     complete substep="fast-path"  (by: ai)
tasks    start    substep="fast-path"  (by: ai)
tasks    complete substep="fast-path"  (by: ai)
```

After these, `currentStep` = `plan` remains owned by the plan-step writer in the normal flow, but in the fast-path the writer advances to leave the spec **ready for implement** with `status: ready-to-implement` — and the last `history[]` entry's `step` matches `currentStep` (tasks complete → ready-to-implement gate). The `substep="fast-path"` tag distinguishes folded steps from full-pipeline steps for the viewer and the eval.

**Invariants preserved**: `history[]` append-only; last entry's `step` aligns with `currentStep`; `status` matches the lifecycle stage; no auto-completion (the user still triggers implement and the final completed gate).
