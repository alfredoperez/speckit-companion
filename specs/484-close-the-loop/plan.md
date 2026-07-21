# Implementation Plan: Completing the pipeline closes the loop

## Summary

Two lifecycle desyncs break the "finish and move on" promise. First, when the tasks step finishes, the viewer keeps the panel locked because it reads the top-level `status` field (still `tasking`) instead of the run's `history[]`, which already records the completion. Second, completing a feature folds nothing back into the living spec and prints a four-way OR-string that can't say why. The fix makes the viewer's in-flight derivation resilient to a lagging status (a recorded completion settles the step), adds a defensive reconciler settle that heals the on-disk `status`, and makes fold-back name the exact outcome — including an actionable signal when capabilities were loaded but no delta block exists.

## Project Structure

```
webview/src/spec-viewer/
  stepInFlight.ts                      # isStepInFlight — check history completion before status
  components/FooterActions.tsx         # derive stepInFlight resiliently, not from status alone
  __tests__/stepInFlight.test.ts       # status-settles eval (reader side)
src/features/specs/
  specContextReconciler.ts             # settle a lagging in-progress status from history
  __tests__/specContextReconciler.test.ts
speckit-extension/scripts/
  living_spec_fold.py                  # name the exact no-op reason; actionable loaded-but-no-delta signal
  write-context.py                     # drop the generic OR-string; let the fold own its message
speckit-extension/tests/
  test_living_specs.py                 # fold-back-writes eval + exact-reason eval
  test_context.py                      # after_tasks settles status regression lock
docs/viewer-states.md                  # status-lag resilience note
speckit-extension/{README.md,CHANGELOG.md}
```

**Structure Decision**: No new modules. The reader fix lives in the existing single derivation (`isStepInFlight`) so every surface reads one answer; the writer/reconciler fix stays in the existing lifecycle writer; the fold-back fix stays in the existing fold module.

## Constitution Check

No project constitution file is present (`.specify/memory/constitution.md` absent), so there is no formal gate to satisfy. The change respects the repo's standing invariants captured in the living specs: one derivation per fact (viewer-ui, spec-viewer, specs), forward-only status with a single terminal writer (capture-runtime, specs), and best-effort capture that never fails the host command.

## Phase 0 — Research

See `research.md`. Key decisions: reader-resilience is primary (works even on a read-only filesystem), reconciler settle is defensive, and fold-back gains observability rather than automatic delta synthesis.

## Phase 1 — Design

See `data-model.md`. The change reshapes no persisted schema — it changes how existing fields (`status`, `history[]`, `livingSpecs.loaded`) are interpreted and what fold-back reports. No new contracts/ directory: the feature exposes no new consumer-facing interface.

## Key Decisions

- **Order the in-flight check completion-first.** `isStepInFlight` currently lets `status` win over a recorded completion. Reordering it so a `completed` badge or a `completedAt` in history returns "not in flight" before consulting status makes a lagging status unable to lock the panel.
- **Settle forward-only in the reconciler.** Only move an in-progress status (`tasking`) to its settled form (`ready-to-implement`) when history records that same step's completion, and never for the implement step (reaching `completed` stays the user's action).
- **Fold-back owns its own message.** Move the reason string into `living_spec_fold.py` so each early-return names the one condition that fired; drop the generic OR-string from `write-context.py`.
