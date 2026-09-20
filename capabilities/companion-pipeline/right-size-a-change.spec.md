# Right-size a change: Living Spec

## Purpose

Not every change deserves four documents and two review stops. The pipeline sizes each change once, records the verdict, and every later step reads it, so a small change gets a short path and a large one gets more warning, never less work.

## Requirements

### Every change gets one recorded size
<!-- touches: apps/speckit-extension/nodes/specify/classify-size.md, apps/speckit-extension/nodes/specify/persist-size.md, apps/speckit-extension/presets/_parts/sizing.md, apps/speckit-extension/commands/speckit.companion.classify.md -->

After drafting the spec, specify SHALL size the change as `simple`, `normal` or `oversized` and record the verdict with the estimates behind it. `simple` means at most 5 files and at most 10 tasks with no wording that signals larger scope. `oversized` means roughly double that bar or work across several subsystems. Everything else, and any weak or conflicting signal, is `normal`. The bar is fixed in the commands, not a setting.

#### Scenario: exactly at the bar
- **WHEN** the change projects to 5 files and 10 tasks
- **THEN** it is `simple` and no warning is printed

#### Scenario: small but worded as a rewrite
- **WHEN** the change fits the bar and the request calls it a migration
- **THEN** the guardrail line `[companion] Change exceeds the small-change guardrail (5 files / 10 tasks)` is printed and the run continues as `normal`

### A simple change folds plan and tasks into specify
<!-- touches: apps/speckit-extension/nodes/specify/branch.md, apps/speckit-extension/nodes/specify/finalize.md, apps/speckit-extension/nodes/specify/handoff.md -->

On a `simple` verdict specify SHALL write three lean files in one pass: the spec with an Approach section, a `plan.md` that points at that Approach, and a `tasks.md` holding the real checklist. The plan and tasks steps are recorded as satisfied, the spec lands at `ready-to-implement`, and the next step is implement. The task checklist lives only in `tasks.md`. A `normal` or `oversized` verdict writes the spec only.

#### Scenario: a typo fix
- **WHEN** specify classifies the change `simple`
- **THEN** `plan.md` and `tasks.md` exist when specify ends, progress counts the real checkboxes, and the handoff names `speckit.companion.implement`

#### Scenario: a normal change
- **WHEN** the verdict is `normal`
- **THEN** no `plan.md` or `tasks.md` is written by specify and the handoff names `speckit.companion.plan`

### Plan and tasks trim for simple and signpost for oversized
<!-- touches: apps/speckit-extension/nodes/plan/size-budget.md, apps/speckit-extension/nodes/tasks/size-budget.md, apps/speckit-extension/nodes/plan/side-files.md -->

Plan and tasks SHALL read the recorded size before writing, and a missing size means `normal`. At `simple`, plan keeps its Summary, folds research and the data model into `plan.md`, and writes `contracts/` only when the feature exposes an interface. Tasks drops the per-story framing but keeps every task line. At `oversized` both produce the full output and open with a short Scale note. Size never trims an oversized change.

#### Scenario: plan runs on a simple spec
- **WHEN** the recorded size is `simple`
- **THEN** no `research.md` or `data-model.md` is written and the run is not treated as incomplete for it

#### Scenario: no size was recorded
- **WHEN** plan runs on a spec with no `size` field
- **THEN** it produces the full plan and every design document

### The workflow routes on the verdict and never skips silently
<!-- touches: apps/speckit-extension/workflows/speckit-companion.workflow.yml, apps/speckit-extension/presets/_parts/routing.md, apps/speckit-extension/commands/speckit.companion.classify.md -->

In the `speckit-companion` workflow a read-only classify step SHALL print `[companion] size=<verdict>` and expose the size to the routing step. `simple` runs plan, tasks and implement with no review gates. `oversized` prints a visible warning and then runs the full gated pipeline. `normal`, and any value the router cannot resolve, runs the full gated pipeline.

#### Scenario: the size cannot be read
- **WHEN** the routing step gets an empty or unknown size
- **THEN** the full pipeline with both review gates runs

#### Scenario: an oversized change
- **WHEN** the verdict is `oversized`
- **THEN** a warning line is shown first and no phase is skipped

### A project can change what a verdict does
<!-- touches: apps/speckit-extension/nodes/specify/_order.yml, apps/speckit-extension/scripts/decision_routes.py, apps/speckit-extension/scripts/build-pipeline.py -->

A project SHALL be able to override, per verdict, which steps it folds and what notice it prints, under `commands.specify.decisions` in `.specify/companion.yml`. The build reports every verdict the project changed and tells the assistant in the command body. A verdict that folds a step that does not exist stops the build.

#### Scenario: a team wants simple changes to keep the plan step
- **WHEN** the project sets `simple` to fold only `tasks` and builds
- **THEN** the build names `classify-size.simple` as changed and a simple run still runs plan

## Uncovered

- The workflow's `simple` path still runs plan and tasks as separate steps without gates, while a self-advancing `simple` run skips them because specify already folded them. Both are shipped behaviour and nothing reconciles them.
