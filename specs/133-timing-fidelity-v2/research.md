# Phase 0 Research — Timing fidelity v2

Decisions for the three choices with more than one reasonable answer. Grounded in `docs/capture-and-timing.md` and the current code (`write-context.py`, `promptBuilder.ts`, `companionPresetReconciler.ts`, `stepHistoryDerivation.ts`, `check_capture.py`).

## D1 — Where the honest per-task finish is stamped

**Decision**: The assistant runs a *script* — `write-context.py --task <id> --kind complete` — live as each task finishes (the primary, honest-cadence path). The `after_implement` hook's `sync_tasks()` is a finish-only **backstop** that journals only tasks not already captured live.

**Rationale**: The reliability principle in `docs/capture-and-timing.md` is "run a script is reliable; hand-author JSON with a live timestamp is best-effort." The previous fix (#213) moved per-task capture entirely to the end-of-step hook to escape the AI's burst-prone hand-authored JSON — but that trades away live cadence (all finishes land in one tight end-of-step window → ~0 ms deltas). This feature recovers honest cadence *without* re-introducing hand-authored JSON by having the assistant run a **script call** per task: the script reads the real clock (ms precision, no format drift) and a script call is the kind of action the assistant performs reliably. Deltas between those finishes are real.

**Alternatives considered**:
- *Hook-only finish-only (no live calls)*: simplest, fully deterministic, but finishes burst at end-of-step → `task-cadence` deltas ≈ 0, failing the "honest deltas" acceptance. Rejected as the primary path; kept as the backstop where live capture didn't happen.
- *Keep start+complete per task*: the `0s` start==complete tick is intrinsic to a pair stamped at one instant. Rejected — finish-only removes the pair, which removes the tick.

## D2 — Reconciler activation mechanism

**Decision**: For the `add` op, the reconciler installs from the locally-bundled path: `specify preset add --dev .specify/extensions/companion/presets/<id>`. `enable`/`remove` stay id-form (they act on the already-registered preset).

**Rationale**: `companionPresetReconciler.ts` currently builds `specify preset ${action} ${id}` for every op (`presetCommandFor`). The catalog-form `add <id>` silently no-ops because the presets are **bundled**, not published to a catalog (confirmed: they live at `.specify/extensions/companion/presets/{companion-standard,companion-lean,_shared}` in an installed project, mirroring the `.specify/extensions/companion/scripts/` convention the capture hooks already use). `--dev <path>` registers the bundled preset under its `preset.yml` id, after which `isPresetInstalled` (which checks `.specify/presets/<id>`) and the id-form `enable`/`remove` work as written. This is the documented fix in both `docs/capture-and-timing.md` ("Activation seam") and the issue.

**Alternatives considered**:
- *Publish the presets to a catalog* so catalog-form `add <id>` resolves. Larger scope (a publishing pipeline + catalog entry), and a remote dependency for what is local-only behavior. Rejected for this feature; the bundled-path install is self-contained.
- *Have the reconciler write the preset files directly* (bypass the CLI). Rejected — duplicates the CLI's install logic and drifts from how every other preset op flows.

## D3 — Backstop guard relaxation (same-step vs. cross-step)

**Decision**: Relax the no-backward-clobber guard for **same-step** writes only: `sync_tasks` may journal per-task finishes when `currentStep` is already `implement` even if `status` is `implemented`. The cross-step terminal guard (don't drag a `completed`/`archived` spec back to an earlier step) stays.

**Rationale**: Today `sync_tasks` calls `_is_more_advanced(ctx, "implement")`, which returns `True` when `status ∈ {implemented, completed, archived}`. If the assistant self-closed implement (old behavior, or a stray `ai` complete), `status` becomes `implemented` and the backstop bails — losing the per-task journal. The fix narrows the guard so that being *at* the implement step (same step) does not block per-task journaling; only a genuinely more-advanced *cross-step* state (a shipped/archived spec) still blocks. Idempotency (`_journaled_tasks`) already prevents duplicating tasks the live path captured, satisfying "no duplicates."

**Alternatives considered**:
- *Remove the guard entirely in `sync_tasks`*: would let a hook firing on a `completed`/`archived` spec resurrect implement. Rejected — keep the cross-step terminal protection.
- *Make the assistant never self-close implement (rely on instruction only)*: already the instruction, but a backstop must not depend on perfect assistant discipline — that's the whole point of US3.

## D4 — On-disk schema impact (confirmation, not a choice)

**Finding**: No schema change. `kind` is already `["start","complete"]` and `task` is already a string in `src/core/types/spec-context.schema.json`. Finish-only emits a single `kind:"complete"` entry per task/substep — valid under the current schema. The change is a *convention* (one finish entry instead of a pair) plus updated **derivation** (`stepHistoryDerivation.ts`) and **eval** semantics, not a new field or enum value.

## D5 — Parallel `[P]` task limitation (accepted, documented)

**Finding**: The delta model attributes a parallel batch to whichever task finishes last (parallel tasks have no distinct sequential boundary). Accepted for the common sequential case per the spec; will be documented in `docs/capture-and-timing.md` and the timing partial rather than solved. The eval should not fail on it.
