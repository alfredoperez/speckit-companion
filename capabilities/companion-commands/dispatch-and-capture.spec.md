# Dispatch and Capture — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Dispatch and Capture is how a command reaches the agent and how the run records itself: both command families and the workflow choice that routes between them, the lifecycle hooks, the never-fail contract, and the step boundaries every dispatch path stamps.

## Requirements

### Four commands are lifecycle hooks, never user-facing verbs

The manifest binds four commands to spec-kit's own lifecycle events. They are state-writing only: they record where a run reached and MUST NOT create spec directories, author documents, or do any of the work the surrounding command is responsible for. Users do not invoke them directly — the host pipeline fires them — so their bodies are written for a machine trigger, not for a person choosing a next action.

#### Scenario: a pipeline phase finishes
- **WHEN** the host fires the matching lifecycle event
- **THEN** the hook records the step and status and does nothing else

### The pipeline's document shape lives in command bodies, never in document templates

Shape is delivered by overriding the command bodies, not by shipping alternative document scaffolds. This is a mechanism constraint, not a preference: template overrides only resolve when a setup script invokes the resolver, and the specification command copies its template by literal path, so a template override for it would silently do nothing. Command overrides apply uniformly to every command, which makes them the only reliable single mechanism. The accepted cost is that the on-disk templates keep showing the stock shape while the Companion commands simply do not read them.

#### Scenario: a Companion-shaped document is wanted
- **WHEN** the desired shape differs from stock
- **THEN** the change is made in the command body
- **AND** no alternative document template is shipped for it

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

### The feature pointer is written under the exact key the capture calls read

The pointer file the first step writes SHALL name the feature directory under the one key the later capture calls resolve through when they run without an explicit feature directory. Any other key is silently dropped: the writes go nowhere and the run records nothing, with no error anywhere to notice.

#### Scenario: a later step runs without an explicit feature directory
- **WHEN** it resolves the spec through the pointer file
- **THEN** it finds the directory the first step wrote

### Step boundaries are extension-stamped in order on every dispatch path

Each pipeline step's start SHALL be recorded by a script call placed **above the step's extension-hooks fence**, so that hooks and every node run inside the window the step later reports; a stamp sitting partway down the body leaves that work attributed to no step at all. The instruction SHALL be single-sourced as one shared command part fenced into each step frame, never copied per command, so the four bodies cannot drift. A step that mints its own feature directory SHALL stamp the instant that directory exists and before any other work, since it has nothing to stamp against earlier. Plan/tasks completions SHALL be recorded by their after-step hook commands — both `by: extension`, start before complete. The AI SHALL self-close only clarify and analyze at step level; a step whose boundaries the extension stamps must never receive an AI step-level complete, because the idempotent completion append lets the first writer win.

#### Scenario: plan runs on any dispatcher
- **WHEN** the plan command body begins its work
- **THEN** a script-stamped extension start is recorded before any planning output
- **AND** the after-plan hook later records the extension-stamped completion

#### Scenario: a step's hook never fires
- **WHEN** the after-step hook is skipped (missing or unparseable extensions registry)
- **THEN** the next step's extension start still closes the span and the duration stays trusted

#### Scenario: the extension already seeded this step's start
- **WHEN** the command body's own stamp runs after a dispatcher already recorded the step's start
- **THEN** no second start entry is appended and the earlier timestamp stands
