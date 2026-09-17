# Command Pipeline — Living Spec

<!-- reviewed: d589a63e -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The two command families coexist, the workflow choice only routes dispatch, and a run sizes itself without ever halting the host. This keeps a configuration change from stranding a project and an unclear size from under-planning a change.

## Requirements

### Four commands are lifecycle hooks, never user-facing verbs

The manifest binds four commands to spec-kit's lifecycle events, and they SHALL only record the step and status a run reached. They MUST NOT create spec directories, author documents, or do the surrounding command's work. The host pipeline fires them, so their bodies are written for a machine trigger, not a person.

#### Scenario: a pipeline phase finishes
- **WHEN** the host fires the matching lifecycle event
- **THEN** the hook records the step and status and does nothing else

### Both command families are always present; the workflow choice only routes dispatch

Choosing a workflow SHALL add and remove nothing: it selects which family a spec dispatches, and that choice is recorded on the spec so every later dispatch resolves the same way. An add-only reconciliation SHALL restore the stock family when absent and never remove it. A Companion command with no stock counterpart passes through unchanged.

#### Scenario: a spec was created under one workflow
- **WHEN** a later step is dispatched from any surface
- **THEN** the spec's recorded workflow decides which family's command runs

#### Scenario: the spec-kit extension is not installed
- **WHEN** a namespaced command would be dispatched
- **THEN** it downgrades to its stock counterpart with a visible warning rather than failing

#### Scenario: the stock family is missing from a checkout
- **WHEN** the extension activates
- **THEN** the stock family is restored, and nothing is ever removed

### Every command degrades rather than failing the host

Capture, hook evaluation and living-spec work SHALL be best-effort in every body. A missing interpreter, absent config, malformed file or unavailable capability SHALL produce one warning and a skip, never a halt.

#### Scenario: a prerequisite is unavailable
- **WHEN** a command reaches a step whose prerequisite is missing
- **THEN** it warns once, skips that step, and completes its real work

### The pipeline right-sizes itself automatically, and an unresolved size runs the full pipeline

A classification step SHALL emit one size signal from a single-sourced guardrail, with no user-facing setting. A small change folds toward implementation, an oversized change gets a warning and then the same full pipeline, and anything else runs the full pipeline. Routing MUST never silently skip a phase, and the default branch MUST be the full pipeline.

#### Scenario: the size signal cannot be resolved
- **WHEN** routing has no usable size
- **THEN** the full pipeline runs

#### Scenario: a change clearly exceeds the bar
- **WHEN** the size is oversized
- **THEN** a warning is shown and every phase still runs

Every documented size MUST be reachable and MUST behave differently from its neighbours, because readers plan around an advertised distinction.

Every step that records or reads a size MUST use the same vocabulary. A word its readers do not understand drops the classification silently and the full ceremony runs.

#### Scenario: the largest size is chosen
- **WHEN** a change is judged well beyond the small bar
- **THEN** that size is recorded, and the resulting documents differ observably from the middle size

#### Scenario: a size is classified on its own rather than during a run
- **WHEN** the standalone classification step reports a size
- **THEN** the value it records is one every reader of the recorded size understands

### A step dispatches to avoid reading, or to get a second pair of eyes, never for parallelism itself

A step SHALL dispatch only when the worker reads something the main agent would otherwise carry to the end of the run, or brings a distinct perspective. A step whose inputs are only artifacts the pipeline just wrote stays inline: specify dispatches when a request names two or more code areas, plan dispatches per area, and tasks does not. The optional adversarial task review is a panel of distinct lenses, not a split of files.

#### Scenario: a step's only inputs are the artifacts already written
- **WHEN** it authors its own artifact
- **THEN** it stays inline, because there is nothing to avoid reading

#### Scenario: a step wants breadth rather than reading
- **WHEN** it dispatches
- **THEN** each worker carries a different lens over the same material, not a different slice of it

### Implement dispatches on how much a phase carries, not on every phase

Implement SHALL dispatch a story phase only when it owns roughly five files or more, build the rest inline in phase order, and say which it did which way. Setup, Foundational and Polish are never dispatched.

Size is the second gate: the first stays whether specify, plan and tasks ran in this same session.

The threshold is measured: in ten replays, phases of four files or fewer gained nothing from fanning out and cost about twice as much, while six to eight file phases saved about three minutes. A test naming the overturned "size is not a factor" rule pins this.

#### Scenario: a story phase owns two files
- **WHEN** implement reaches it
- **THEN** it is built inline, and the summary says so

#### Scenario: a story phase owns eight files and the pipeline did not run in this session
- **WHEN** implement reaches it
- **THEN** it is dispatched to its own worker

### A simple-verdict run captures the same context a full run would, on the fast path

When classify returns `simple`, specify writes the plan inline as `## Approach` and skips `plan` and `tasks`, but SHALL still capture what a full run would. It persists the one-line approach onto `.spec-context.json`, reruns the living-spec load post-draft only when the pre-draft load recorded nothing, and stamps the folded `plan` and `tasks` boundaries `by: extension` at step level, not as AI substeps. All of it is best-effort, skipped silently without the interpreter, and writes no `completed` status.

#### Scenario: classify returns simple

- **WHEN** the specify command finishes a simple-verdict draft
- **THEN** the approach is captured, the folded plan and tasks boundaries are stamped as extension step-level events, and the spec lands at tasks with `status: ready-to-implement`

#### Scenario: the pre-draft load recorded nothing

- **WHEN** the simple run reaches the fold and `livingSpecs.loaded` is still empty
- **THEN** the deterministic recorder runs once against the now-known touched files, and never re-resolves when the load already populated it

## Uncovered

_None. Re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
