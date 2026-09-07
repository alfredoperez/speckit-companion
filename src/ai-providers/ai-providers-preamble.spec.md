# Preamble — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

What the spec-context preamble instructs the assistant to write, and who it says closes each step.

## Requirements

### The creation preamble seeds every fact the new spec's record must be born with

A spec's record does not exist when its creation is dispatched, so the only way a fact known at dispatch time reaches that record is for the creation preamble to instruct the assistant to write it. The preamble therefore seeds both the workflow the run will follow and the correlation identifier the dispatching surface minted for it, and a seeded field SHALL be emitted only when the dispatcher supplied it, so a surface with nothing to seed produces the same instruction as before.

Seeding the identifier is what lets the events for one spec be joined: a surface that mints an id, reports it, and then lets the spec be created without it leaves the record to mint a different one later, and the run's own events no longer refer to the same spec. Seeding it also marks the spec as having been created through a form, which is how a spec first observed on disk can be told apart from one already accounted for.

#### Scenario: the dispatching surface minted a correlation identifier
- **WHEN** the creation preamble is built for that dispatch
- **THEN** the instruction writes that identifier into the new spec's record alongside the workflow
- **AND** later events for the spec carry the same identifier rather than a freshly minted one

#### Scenario: creation is dispatched with no identifier to seed
- **WHEN** the preamble is built
- **THEN** it omits the identifier field entirely rather than writing an empty one

The settled status the preamble names for a step is read from the shared step→status map. A step the project added sits outside that map and has no settled status of its own, so for such a step the preamble SHALL name `implemented` — the status the pipeline settles at — rather than emit nothing and leave the record unable to close.

#### Scenario: the dispatched step is one the project added
- **WHEN** the preamble seeds the settled status for a step outside the lifecycle set
- **THEN** it names `implemented`
- **AND** the instruction is otherwise identical to one built for a shipped step

### The dispatch preamble names the main agent as the per-task serializing writer

The implement preamble SHALL instruct that per-task journaling is performed by the main agent — one task at a time, in the foreground, including tasks whose work was fanned out — and that workers never write the shared context file. The slim companion preamble SHALL describe step closure as extension-stamped (bodies record starts, hooks and scripts record completes), reserving AI self-close for clarify/analyze.

#### Scenario: implement is dispatched with the full preamble
- **WHEN** the AI fans tasks out to workers
- **THEN** the preamble directs the main agent to journal each returned task itself, serially

#### Scenario: a companion command is dispatched
- **WHEN** the slim preamble is rendered
- **THEN** it defers step closure to the body-and-hook model and never asks the AI to self-close plan or tasks

#### Scenario: the same step is dispatched without companion installed
- **WHEN** specify, plan, or tasks is dispatched in stock mode, where no command body or hook stamps the boundary
- **THEN** the preamble instructs the AI to write that step's completion itself
- **AND** the step reaches its finished status instead of sticking at its in-flight one
