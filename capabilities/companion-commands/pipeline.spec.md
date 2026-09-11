# Command Pipeline — Living Spec

<!-- reviewed: d589a63e -->

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The two command families coexist, the workflow choice only routes dispatch, and a run sizes itself while never halting the host. Without this, a configuration change could strand a project without commands, or an ambiguous size could under-plan a change.

## Requirements

### Four commands are lifecycle hooks, never user-facing verbs

The manifest binds four commands to spec-kit's own lifecycle events. They are state-writing only: they record where a run reached and MUST NOT create spec directories, author documents, or do any of the work the surrounding command is responsible for. Users do not invoke them directly — the host pipeline fires them — so their bodies are written for a machine trigger, not for a person choosing a next action.

#### Scenario: a pipeline phase finishes
- **WHEN** the host fires the matching lifecycle event
- **THEN** the hook records the step and status and does nothing else

### Both command families are always present; the workflow choice only routes dispatch

The stock family and the namespaced Companion family coexist permanently. Choosing a workflow SHALL add and remove nothing — it selects which family a given spec dispatches, and that choice is recorded on the spec so every later dispatch path resolves consistently. Keeping the stock family present is enforced by an add-only reconciliation that restores it when absent and never removes it, so no configuration change can strand a project without a working command set. Where a Companion command has no counterpart, it passes through unchanged rather than being forced into a mapping.

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

The bodies instruct the agent to treat capture, hook evaluation, and living-spec work as best-effort. A missing interpreter, an absent config, a malformed file, or an unavailable capability SHALL produce a single warning and a skip, never a halt. This tone is uniform across the family precisely so that no command becomes the one that can break a user's run.

#### Scenario: a prerequisite is unavailable
- **WHEN** a command reaches a step whose prerequisite is missing
- **THEN** it warns once, skips that step, and completes its real work

### The pipeline right-sizes itself automatically, and an unresolved size runs the full pipeline

Ceremony is matched to the change without any user-facing setting. A thin classification step emits one size signal from a fixed, single-sourced guardrail, and routing picks a branch from it: a small change folds toward implementation with less ceremony, an oversized change gets a visible warning and then the *same* full pipeline, and anything else runs the full pipeline. Routing MUST never silently skip a phase, and the default branch MUST be the full pipeline so an ambiguous or unresolved size can never under-plan a change.

#### Scenario: the size signal cannot be resolved
- **WHEN** routing has no usable size
- **THEN** the full pipeline runs

#### Scenario: a change clearly exceeds the bar
- **WHEN** the size is oversized
- **THEN** a warning is shown and every phase still runs

Every size the product documents MUST be reachable and MUST behave differently from its neighbours. A size that no classification can produce, or that prescribes exactly what another size prescribes, is a distinction the product advertises and does not make — and it is worse than having one size fewer, because a reader plans around it.

The vocabulary MUST be the same everywhere. Every step that records a size, and every step that reads one, uses one set of words; a step that emits a word its readers do not understand drops the classification in silence and the full ceremony runs regardless.

#### Scenario: the largest size is chosen
- **WHEN** a change is judged well beyond the small bar
- **THEN** that size is recorded, and the resulting documents differ observably from the middle size

#### Scenario: a size is classified on its own rather than during a run
- **WHEN** the standalone classification step reports a size
- **THEN** the value it records is one every reader of the recorded size understands

### A step dispatches to avoid reading, or to get a second pair of eyes, never for parallelism itself

Handing work out is only ever worth its startup for one of two reasons: the worker reads something the main agent would otherwise carry to the end of the run, or it brings a perspective the main agent cannot hold at the same time as its own. A step that reads nothing but the artifacts the pipeline just wrote has no reading to offload, so its authoring pass stays inline however long it takes. This is why specify dispatches when a request names two or more code areas and plan dispatches per area, while tasks does not: tasks reads the plan, the spec and the design artifacts, all of them small, all of them already in hand, and none of them source. The second reason is what the optional adversarial review of the task list is for, and it is a panel of distinct lenses rather than a split of files.

#### Scenario: a step's only inputs are the artifacts already written
- **WHEN** it authors its own artifact
- **THEN** it stays inline, because there is nothing to avoid reading

#### Scenario: a step wants breadth rather than reading
- **WHEN** it dispatches
- **THEN** each worker carries a different lens over the same material, not a different slice of it

### Implement dispatches on how much a phase carries, not on every phase

A worker pays the same startup whatever it is handed, so a phase small enough to read in passing costs more to hand out than to build. Implement SHALL dispatch a story phase only when it owns roughly five files or more, and build the rest inline in phase order, saying which it did which way. Setup, Foundational and Polish are never dispatched: Setup is trivial, Foundational blocks every story, Polish is cross-cutting.

Size is the second gate, not the only one. A run that did not watch specify, plan and tasks happen has not spent the reading, so the first question stays whether the pipeline ran in this same session.

The threshold is measured, not assumed. Across ten replays of two features, a feature whose phases ran to four files and fewer gained no correctness and no wall-clock from fanning out and cost about twice as much; one whose phases ran to six and eight files saved about three minutes. This requirement replaced a rule stating the opposite in bold — that size was explicitly not a factor and a thin phase was dispatched anyway — so it is pinned by a test naming the overturned claims.

#### Scenario: a story phase owns two files
- **WHEN** implement reaches it
- **THEN** it is built inline, and the summary says so

#### Scenario: a story phase owns eight files and the pipeline did not run in this session
- **WHEN** implement reaches it
- **THEN** it is dispatched to its own worker

### A simple-verdict run captures the same context a full run would, on the fast path

When the classify step returns `simple`, specify writes the plan inline as the spec's `## Approach` section and never reaches `plan` or `tasks`. To keep the viewer honest, that fast path SHALL still capture what a full run would: the one-line approach is persisted onto `.spec-context.json` so the Overview APPROACH card reads it; the living-spec load is run **again post-draft** when the pre-draft load recorded nothing (the touched files are known by then, and the record is skipped if already populated); and the folded `plan` and `tasks` boundaries are stamped `by: extension` at step level — not as AI substeps — so the timing display counts specify, plan, and tasks as measured phases. All of it is best-effort and skipped silently when the interpreter is unavailable, and no `completed` status is written — the terminal gate stays its own step.

#### Scenario: classify returns simple

- **WHEN** the specify command finishes a simple-verdict draft
- **THEN** the approach is captured, the folded plan and tasks boundaries are stamped as extension step-level events, and the spec lands at tasks with `status: ready-to-implement`

#### Scenario: the pre-draft load recorded nothing

- **WHEN** the simple run reaches the fold and `livingSpecs.loaded` is still empty
- **THEN** the deterministic recorder runs once against the now-known touched files, and never re-resolves when the load already populated it

## Uncovered

_None — re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
