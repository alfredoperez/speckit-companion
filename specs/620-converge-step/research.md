# Research: Record and show Spec Kit's converge step

## What converge is

Read from `.claude/skills/speckit-converge/SKILL.md`, the stock command spec-kit installed here. It must run only after implement has run on the current `tasks.md`. Its only write is appending a `## Phase N: Convergence` section of new unchecked tasks to `tasks.md`; when nothing is left it leaves `tasks.md` byte-identical and reports "Converged". It fires `hooks.before_converge` before it starts and `hooks.after_converge` after it reports.

## Decisions

**Decision**: converge sits after implement in the step order, as a sub-phase of implement that owns no status.
**Rationale**: spec-kit says it runs only after implement, and the run-record living spec already has the shape for a step that records only its own boundaries (clarify and analyze). Giving it implement's statuses would let a converge start drag an `implemented` spec back to `implementing`, which the "never dragged backward" rule forbids.
**Alternatives considered**: a status of its own (`converging`), rejected because every surface keyed on the status list would need a new state for an optional step; mapping it to implement's statuses, rejected for the regression above.

**Decision**: converge is recorded by two spec-kit hooks, `before_converge` and `after_converge`, pointing at two new companion capture commands.
**Rationale**: spec-kit's own converge command already fires both, so the start and the finish are stamped by the extension at the real boundaries, which is what makes the span trusted. This is the same mechanism the four `after_*` capture hooks use.
**Alternatives considered**: a companion-standard preset override of the stock converge command, rejected because the preset is pinned to seven stock commands and its goldens are frozen; a Companion converge command or node, out of scope by the user's decision.

**Decision**: when converge appends tasks, the spec stays `implemented`.
**Rationale**: converge records only its own boundaries. The spec stays `implemented` while the appended tasks are worked; the status command names the next one and the task percent drops, so the person sees the new work without converge rewriting the lifecycle. A capture never reopens a finished spec, which is the existing forward-only rule.
**Alternatives considered**: moving the spec back to `implementing` on a non-converged result, rejected because a hook cannot tell which outcome converge reached and the forward-only guard would refuse it anyway.

**Decision**: converge is not an expected phase, but a measured converge span counts toward the run's total active time.
**Rationale**: a run that skipped converge must still read fully timed, so the coverage denominator stays specify, plan, tasks, implement. Once the run is fully measured, converge's own span is real work on the feature, so the total extends to include it, while the gap between implement's finish and converge's start is still billed to nothing.
**Alternatives considered**: leaving the total at specify-start to implement-end, rejected because the Overview would show a converge time that the total silently drops.

**Decision**: the rail shows converge on the entry that hosts implement's percent.
**Rationale**: the rail lists documents only, converge writes into `tasks.md`, and implement already borrows that entry. A converge in flight is detected from history (a start with no finish after it), because the status is settled at `implemented` and the status-based in-flight check would say nothing is running.
**Alternatives considered**: a new rail entry for converge, rejected because the rail has no action-step entries by design.

**Decision**: starting converge moves `currentStep` to `converge`, and every reader treats `converge` as belonging to `implement` through one helper, `lifecycleStepFor` in `specContext.ts`.
**Rationale**: the writer already moves `currentStep` on any start, and the viewer can only show a step in flight when it is the current step. The editor's repair pass would otherwise roll `currentStep` back to `implement` (the step that owns `implemented`) on every read, and its drift check would warn when a later task close puts `currentStep` back on implement after a converge entry. Reading converge as implement in those two places, the footer's implement gates and reactivate keeps one rule in one place.
**Alternatives considered**: leaving `currentStep` on implement, rejected because converge could then never read as in flight.

**Decision**: in Python, `converge` joins `CANONICAL_STEPS` and `STEP_ORDER` (after implement), and `_is_more_advanced` refuses a converge write only at `completed` or `archived`.
**Rationale**: the vocabulary consistency test pins both Python literals to the TypeScript list. Without the exemption the regression guard would refuse every converge write at `implemented`, which is exactly when converge runs.
**Alternatives considered**: keeping converge out of `STEP_ORDER`, rejected because the mirror would then disagree with `STEP_NAMES`.

**Decision**: the status command reports the next unticked task when the current step is `converge` and tasks are open, even at `implemented`.
**Rationale**: that is the case converge exists for, appended tasks. Implement keeps today's "Pipeline complete" at `implemented` so existing callers see no change.

**Decision**: the record keeps one converge start and one finish per spec.
**Rationale**: the writer already refuses a second start or finish for any step. Repeated converge passes keep the first span; changing that is a writer-wide rule, not this feature.

**Decision**: the new hook commands are registered everywhere `check-command-emissions.py` looks: `extension.yml`, the README hook table, `docs/commands.md`, and the committed `.specify/extensions/.registry` (refreshed by reinstalling the extension, which also adds the hooks to `.specify/extensions.yml`).
