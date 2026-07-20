# Companion Commands — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Companion Commands is the prompt surface the extension actually ships: the seventeen commands a user or the workflow engine dispatches, the reusable node and part files those command bodies are assembled from, and the preset that carries the stock command family. It exists because the extension dispatches *text* and gets no callback — so every guarantee about pipeline shape, capture, and completion has to be written into the prompt itself. Without it, the extension has no way to make a run behave, and no way to stop the same rule from being restated in nine places and drifting.

## Requirements

### Command bodies are assembled from single-sourced parts and nodes, and the assembly is the contract

No shipped command body is hand-authored end to end. A rule that applies to more than one command SHALL live in exactly one part file, and a command's structure SHALL be expressed as an ordered list of node files, each carrying its own identity and declared reads and writes. The committed bodies stay whole and self-contained — they are what the agent reads — but they are *generated*, and a gate MUST hold each assembled region byte-identical to its source. Editing a shipped body directly is therefore a defect, not a shortcut: it forks a shared rule silently.

#### Scenario: a shared rule changes
- **WHEN** a rule embedded in several commands is edited
- **THEN** it is edited in its single part file
- **AND** every command body carrying it is reassembled

#### Scenario: a body is edited in place
- **WHEN** a shipped body's assembled region no longer matches its source
- **THEN** the parity gate fails and names the command and the region

### Assembly changes MUST be proved against a frozen baseline

Reshaping how bodies are built MUST NOT change the instructions the agent receives. Commands not intentionally changed SHALL compare equal to a frozen capture of their prior text, after normalizing the assembly markers themselves, so a refactor of the build mechanism is demonstrably behavior-preserving. Re-freezing the baseline is a deliberate, separate act after an intentional wording change — never something the build performs on its own.

#### Scenario: the assembly mechanism is refactored
- **WHEN** the bodies are rebuilt
- **THEN** each unchanged command matches its frozen capture byte-for-byte

#### Scenario: a command's wording is intentionally changed
- **WHEN** the change is deliberate
- **THEN** the baseline is re-frozen explicitly, outside the build

### The manifest is the command inventory's single authority, and every downstream surface is gated against it

The extension manifest declares what commands exist. Every surface derived from that list — the files the installer writes into each agent's directory, the registry, the documentation tables — MUST agree with it in both directions, and a gate SHALL enforce that. Both drift directions matter: a missing entry means a command the user cannot reach, and an orphaned entry means a renamed command whose retired name stays live in the agent's list because reinstallation merges names and never deletes. The gate MUST discover install areas rather than iterating a fixed list, since a hardcoded list quietly stops covering a new agent directory — the same drift one level down. An input it cannot resolve MUST fail loudly rather than shrink the surface it scans.

#### Scenario: a command is renamed
- **WHEN** the manifest names the new command
- **THEN** the gate reports the stale file left behind under the old name

#### Scenario: a new command is added
- **WHEN** the command file exists but the manifest does not declare it
- **THEN** the installer would skip it, and the gate fails

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

### The pipeline right-sizes itself automatically, and an unresolved size runs the full pipeline

Ceremony is matched to the change without any user-facing setting. A thin classification step emits one size signal from a fixed, single-sourced guardrail, and routing picks a branch from it: a small change folds toward implementation with less ceremony, an oversized change gets a visible warning and then the *same* full pipeline, and anything else runs the full pipeline. Routing MUST never silently skip a phase, and the default branch MUST be the full pipeline so an ambiguous or unresolved size can never under-plan a change.

#### Scenario: the size signal cannot be resolved
- **WHEN** routing has no usable size
- **THEN** the full pipeline runs

#### Scenario: a change clearly exceeds the bar
- **WHEN** the size is oversized
- **THEN** a warning is shown and every phase still runs

### Completion is an explicit terminal step with exactly one writer

The Companion pipeline ends at a dedicated completion command; the stock pipeline has no terminal step and simply stops. That command writes the terminal status through the shared writer and never by hand, refuses a spec whose work is outstanding, and is a no-op on a spec already shipped. This is the pipeline's completion gate — a second writer of that status MUST NOT be introduced anywhere.

#### Scenario: implementation finishes
- **WHEN** the terminal step runs
- **THEN** the spec is promoted to completed through the single writer
- **AND** the recorded current step stays at the last real step

#### Scenario: work remains
- **WHEN** the terminal step runs against an unfinished spec
- **THEN** it refuses and reports, without failing the host

### Living-spec commands are opt-in, non-halting, and honest about what they did not examine

The commands that adopt, move, report drift on, and report coverage for living specs SHALL act only when the project has opted in, SHALL never fail the run, and — for the reporting pair — SHALL make no edits. Their output MUST state both what was examined and what was skipped with a reason, so a clean marker can never be read as a verdict on the whole configuration. A finding is a signal a surrounding workflow may act on; these commands do not gate.

#### Scenario: the project has not opted in
- **WHEN** one of these commands runs
- **THEN** it reports nothing and exits successfully

#### Scenario: part of the configured set could not be examined
- **WHEN** the report is rendered
- **THEN** it names both counts and the reason for the skip

### Projects extend commands at node boundaries, never by editing bodies

Because a body is generated, a project customizing it would be overwritten. Instead, a project SHALL declare its own work against a command's node boundaries in a configuration file, and the assembled body carries the prose that makes the agent the runtime for those declarations — running each boundary's attachments in declared order. A recipe may also override which nodes a command runs. Attachments referencing a boundary the active node set does not contain MUST warn and be skipped rather than silently doing nothing, and the whole mechanism inherits the never-fail-the-host contract.

#### Scenario: a project attaches work to a node boundary
- **WHEN** the command reaches that node
- **THEN** the project's attachments run in declared order at that boundary

#### Scenario: an attachment names a boundary that is not in the active node set
- **WHEN** the configuration is merged
- **THEN** it warns and skips rather than failing or silently ignoring

### Commands direct capable providers to parallelize, while bookkeeping stays serialized

Where a provider can spawn workers, the bodies SHALL make concurrency the expected strategy rather than an optional optimization, and SHALL express independence structurally — waves of tasks that share no files or dependencies, with explicit join points — rather than relying on the agent to infer it from inline markers. Concurrency MUST NOT extend to the shared record: prose that fans work out MUST name who serializes the write, because "journal each as it finishes" under concurrent workers reads as a race. Hosts without workers run sequentially and produce identical artifacts.

#### Scenario: a wave of independent tasks is reached
- **WHEN** the provider supports workers
- **THEN** the wave's tasks run concurrently and the next wave waits for it

#### Scenario: the provider cannot spawn workers
- **WHEN** the same wave is reached
- **THEN** it runs sequentially with no error and the same result

### A command that injects a step into a numbered body MUST NOT restart the numbering

Node bodies are concatenated, so numbering is a property of the *assembled* command, not of any one node. A node adding a step to a command whose numbering continues downstream SHALL use a sub-bullet or an unnumbered note rather than opening a fresh top-level number, and the check is made against the assembled body.

#### Scenario: a node adds a step mid-command
- **WHEN** the assembled body is reviewed
- **THEN** the step numbering runs continuously with no repeated number

## Uncovered

Read in full: the extension manifest, all part files, the node order and a sample of node bodies across all four pipeline commands, the completion and resume command bodies, one hook command body, and the inventory/parity/assembly gate contracts. Not read:

- The full bodies of `speckit.companion.specify.md`, `.plan.md`, `.tasks.md`, `.implement.md`, `.auto.md`, `.living-adopt.md` (the six largest, together roughly 118 KB) — their contracts were taken from `docs/template-profiles.md`, `docs/capture-and-timing.md`, the manifest descriptions, and the node files they assemble from.
- `speckit.companion.after-plan.md`, `.after-tasks.md`, `.after-implement.md` — read one hook body in full and treated the other three as the same shape per the manifest.
- `speckit.companion.status.md`, `.classify.md`, `.living-move.md`, `.living-drift.md`, `.living-coverage.md`.
- All seven `presets/companion-standard/commands/*.md` carrier bodies and `preset.yml`.
- Most individual node bodies under `nodes/` — read the order files, frontmatter shape, and three representative bodies.
- `speckit-extension/workflows/speckit-companion.workflow.yml`.
