# Research: Completing the pipeline closes the loop

## Decision: Make the viewer's in-flight derivation resilient to a lagging status (primary fix for #491)

- **Decision**: In `isStepInFlight`, check whether the step is recorded as completed (a `completed` step badge or a `completedAt` in the derived step history) BEFORE consulting the top-level `status`. Have `FooterActions.tsx` compute its `stepInFlight` flag through this resilient derivation rather than from `inFlightStepFor(status)` alone.
- **Rationale**: The footer catalog already includes the forward action (`shouldShowApprove` does not gate on `status`) when tasks is complete in history; the only thing suppressing the button is the status-derived `stepInFlight` flag. Fixing the flag is the minimal, surface-agnostic fix, and it works even when the on-disk status can't be rewritten (read-only filesystem, IDE-chat host with no hook).
- **Alternatives considered**: Only fixing the writer/hook to always flip status — rejected as insufficient, because the observed run shows the hook does not always fire (agentic self-close via `--finish` is journal-only). The reader must not trust a field that can lag.

## Decision: Add a defensive reconciler settle that heals the on-disk status (#491)

- **Decision**: In `specContextReconciler.reconcile`, when the current step's in-progress status names the same step whose completion is the latest history entry for it, move status forward to that step's settled status. Forward-only; excludes implement.
- **Rationale**: The viewer reconciles context on load. Healing the `status` field means the on-disk record itself becomes coherent, not just the rendered UI, and downstream readers (sidebar, telemetry) see the settled value. The issue named `specContextReconciler.ts` as the writer-side candidate.
- **Alternatives considered**: Changing `--finish` to also flip status — rejected: it breaks the documented finish-only timing contract and many golden/tests depend on `--finish` being journal-only. `--advance` already exists for the flip-status case; the reconciler is the right place to reconcile a record written by a journal-only close.

## Decision: Make fold-back name the exact outcome; add an actionable loaded-but-no-delta signal (#492)

- **Decision**: Move the no-op reason string out of `write-context.py`'s generic OR-line and into `fold_living_spec` so each early-return prints the single condition that fired (living specs off, spec unreadable, no delta block, no capability resolved, already up to date). In the no-delta branch, read `livingSpecs.loaded`; if non-empty, print an actionable message naming those capabilities and how to sync, instead of a silent no-op.
- **Rationale**: The standard pipeline never produces a delta block, so a normally-built feature always hits the no-delta path — today that is silent and the printed reason is an un-disambiguated OR-string, so a reader (human or assistant) guesses wrong (the run in #492 guessed "living specs off" when they were on). Naming the exact reason and surfacing loaded capabilities makes the write half observable and actionable without fabricating spec content.
- **Alternatives considered**: Auto-synthesizing an `## ADDED Requirements` proposal from the feature's ordinary requirements — deferred: it risks writing fabricated or mis-headed content into the durable record. The safe, in-scope fix is observability plus ensuring a real delta block still folds. (This feature's own spec carries real delta blocks, so its completion exercises the fold-writes path.)
