# Command Pipeline — Living Spec

<!-- reviewed: d589a63e -->

## Purpose

A Companion run sizes itself, dispatches workers only where a script says the work splits, and never halts the host, so an unclear size never under-plans a change.

## Requirements

### Four commands are lifecycle hooks, never user-facing verbs
<!-- touches: apps/speckit-extension/commands/speckit.companion.after-specify.md, apps/speckit-extension/commands/speckit.companion.after-plan.md, apps/speckit-extension/commands/speckit.companion.after-tasks.md, apps/speckit-extension/commands/speckit.companion.after-implement.md -->

The four commands bound to spec-kit's lifecycle events SHALL only record the step and status a run reached. They MUST NOT create spec directories, author documents, or do the surrounding command's work.

#### Scenario: a pipeline phase finishes
- **WHEN** the host fires the matching lifecycle event
- **THEN** the hook records the step and status and does nothing else

### Every command degrades rather than failing the host
<!-- touches: apps/speckit-extension/presets/_parts/orchestrator.md -->

Capture, hook evaluation and living-spec work SHALL be best-effort in every body: a missing interpreter, absent config, malformed file or unavailable capability produces one warning and a skip, never a halt.

#### Scenario: a prerequisite is unavailable
- **WHEN** a command reaches a step whose prerequisite is missing
- **THEN** it warns once, skips that step, and completes its real work

### The pipeline right-sizes itself automatically, and an unresolved size runs the full pipeline
<!-- touches: apps/speckit-extension/nodes/specify/classify-size.md, apps/speckit-extension/presets/_parts/routing.md -->

Specify SHALL classify each change as simple, normal or oversized from one shared guardrail, with no user setting. Routing MUST never skip a phase silently, so a size it cannot resolve runs the full pipeline.

#### Scenario: the size signal cannot be resolved
- **WHEN** routing has no usable size
- **THEN** every phase runs

### An oversized change runs every phase, with a warning and a scale note
<!-- touches: apps/speckit-extension/nodes/specify/classify-size.md, apps/speckit-extension/nodes/plan/size-budget.md, apps/speckit-extension/nodes/tasks/size-budget.md -->

An oversized verdict SHALL print a warning and run the full pipeline, and its plan and task list SHALL open with a scale note naming how many files and areas the change spans. Every advertised size must behave observably differently, because readers plan around the distinction.

#### Scenario: a change clearly exceeds the small bar
- **WHEN** it is classified oversized
- **THEN** a warning is shown, every phase runs, and the plan opens with a scale note that a normal plan lacks

### Every step that records or reads a size uses the same words
<!-- touches: apps/speckit-extension/presets/_parts/sizing.md, apps/speckit-extension/nodes/specify/persist-size.md, apps/speckit-extension/commands/speckit.companion.classify.md -->

Specify, the standalone classify command and every reader of the recorded size SHALL use one vocabulary, because a word a reader does not know drops the classification silently and the full ceremony runs.

#### Scenario: a size is classified on its own rather than during a run
- **WHEN** the classify command reports a size
- **THEN** the value is one every reader of the recorded size understands

### A step dispatches what a script splits out for it, to avoid reading or to get a second pair of eyes
<!-- touches: apps/speckit-extension/nodes/plan/gather-context.md, apps/speckit-extension/nodes/plan/side-files.md, apps/speckit-extension/nodes/implement/implement-exec.md, apps/speckit-extension/nodes/implement/complete.md -->

Which workers a step sends SHALL be decided by the brief script, not the model: plan sends one reader per recorded code area (at most four) and, above simple size, one writer per design document; implement sends workers for each Foundational wave of four or more tasks and one reviewer for its living-spec deltas. Fewer than two briefs means the step works inline, and tasks never dispatches.

#### Scenario: the script prints no briefs
- **WHEN** a step reaches its dispatch point
- **THEN** it stays inline

#### Scenario: a Foundational wave holds four or more tasks
- **WHEN** implement reaches it
- **THEN** its tasks go to workers dispatched together, and no task after its join line starts until they all return

### Implement dispatches on how much a phase carries, not on every phase
<!-- touches: apps/speckit-extension/nodes/implement/implement-exec.md -->

Implement SHALL dispatch a user-story phase only when it owns five or more files, build the rest inline in phase order, and say which it did which way. The phase's own file count alone decides it, even in an auto run. Replays showed phases of four files or fewer gained nothing from a worker and cost about twice as much.

#### Scenario: a story phase owns two files
- **WHEN** implement reaches it
- **THEN** it is built inline, and the summary says so

#### Scenario: a story phase owns eight files
- **WHEN** implement reaches it
- **THEN** it is dispatched to its own worker

### A simple-verdict run captures the same context a full run would, on the fast path
<!-- touches: apps/speckit-extension/nodes/specify/finalize.md -->

When the verdict is simple, specify writes the plan inline as an Approach section and skips plan and tasks, but SHALL still record the approach, stamp the folded plan and tasks boundaries as extension step-level events, and run the living-spec load once post-draft when the pre-draft load recorded nothing.

#### Scenario: classify returns simple
- **WHEN** specify finishes a simple-verdict draft
- **THEN** the approach is recorded, the plan and tasks boundaries are stamped, and the spec lands at tasks with status ready-to-implement

#### Scenario: the pre-draft load already recorded capabilities
- **WHEN** the simple run reaches the fold
- **THEN** the load is not run a second time

## Uncovered

_None._
