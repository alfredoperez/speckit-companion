# SpecKit Extension Commands — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This capability is the authored prompt layer of the spec-kit extension: the `/speckit.companion.*` command bodies that an AI host actually executes, the composable node model those bodies are assembled from, and the `companion-standard` preset that carries the same guarantees onto stock `/speckit.*` commands. Without it there is no Companion pipeline — the extension would ship only scripts and a manifest, with nothing telling the model what to do at each step.

## Requirements

### Command bodies are generated from single-source parts, never hand-edited in place

Every shared block that appears in more than one command body MUST live in exactly one part file and be expanded into the command bodies by the build step, and the committed bodies MUST remain whole and self-contained so a host reads one file with no include resolution. A part fence that is unbalanced, or that names a part with no backing file, MUST be a hard build failure rather than a silent no-op.

#### Scenario: Editing a shared block

- **WHEN** an author changes a block that several command bodies share
- **THEN** the change is made once in the part file
- **AND** re-running the build rewrites every fenced region that references that part
- **AND** a parity check fails if any committed region has drifted from its part

### Node-composed commands assemble deterministically to a frozen baseline

A command that is decomposed into nodes MUST be assembled from a non-reorderable frame plus the ordered node bodies, and the assembled output MUST match the committed golden byte-for-byte. Node decomposition is a refactor of authoring, not a change to what the host sees.

#### Scenario: Re-assembling a decomposed command

- **WHEN** the assembler runs in check mode against the node tree
- **THEN** each decomposed command is rebuilt in memory from its frame and its ordered nodes
- **AND** any difference from the frozen golden fails the check with a diff
- **AND** the shared part fences inside the assembled text are filled by the same mechanism the non-decomposed bodies use

### A project may re-order or drop nodes without breaking the pipeline

A project MUST be able to override a command's node order from its own configuration, and the loader MUST reject an override that leaves a retained node depending on a node the override dropped. Malformed configuration MUST degrade to the shipped defaults rather than failing the run.

#### Scenario: An override drops a node another node depends on

- **WHEN** a project's node list omits a node that a retained node declares it reads
- **THEN** the configuration is rejected with an error naming the node and its missing dependency
- **AND** the run does not proceed on a silently broken pipeline

#### Scenario: Configuration cannot be parsed

- **WHEN** the project configuration file is malformed
- **THEN** the shipped default order and hooks are used
- **AND** a warning is surfaced instead of an exception

### Node hooks and stock spec-kit extension hooks both fire, and neither can fail the command

Companion's own per-node `before`/`after` hooks and the host project's stock spec-kit extension hooks MUST both run on a Companion step. Hook discovery and execution MUST never fail the host command — anything missing or malformed is skipped and the step continues.

#### Scenario: A project declares a hook at a node that is not in the active order

- **WHEN** hooks are merged for the command
- **THEN** that anchor's hooks are skipped with a warning
- **AND** the remaining hooks still run in their declared order

### Every command body carries the same timing contract

Each pipeline command body MUST embed the shared timing rules, so lifecycle durations stay accurate regardless of which dispatcher invoked the step — terminal CLI, host-editor chat, or the GUI. Timing MUST be recorded only by running the writer script; hand-editing the context file is forbidden by the contract the body states.

#### Scenario: A step finishes its work

- **WHEN** the model completes a step or a task
- **THEN** it records a single finish event through the writer script
- **AND** it does not author a paired start-and-complete for that task or substep
- **AND** it does not edit the context JSON directly

### The preset carries the timing contract onto unmodified stock commands

The `companion-standard` preset MUST override the stock pipeline commands with bodies that are otherwise faithful to upstream, differing only by the embedded Companion contract blocks. Commands the preset does not list MUST remain on their stock definitions.

#### Scenario: A workspace installs the preset

- **WHEN** the preset is active
- **THEN** the listed stock pipeline commands resolve to the preset's bodies
- **AND** unlisted commands still resolve to stock
- **AND** the pipeline's phases, files, and sections are unchanged from upstream

### Right-sizing is built-in default behavior, not a toggle

The pipeline MUST classify a change's size and route on that signal as ordinary default behavior, with the thresholds authored in the command body and the workflow rather than exposed as a user setting. An oversized change MUST still run the full pipeline with a visible warning — routing MUST never silently skip a phase.

#### Scenario: A change is classified oversized

- **WHEN** the routing step reads an oversized classification
- **THEN** a warning is surfaced
- **AND** the full pipeline still runs

#### Scenario: A change is classified small

- **WHEN** the routing step reads a small classification
- **THEN** the pipeline folds toward implement with less ceremony
- **AND** an unresolved or absent classification falls back to the full pipeline

### The workflow choice is binary and recorded on one setting

There MUST be exactly two workflow choices offered on the `speckit.defaultWorkflow` setting — the stock spec-kit pipeline and the Companion pipeline. No third profile, size mode, or fast-path variant is selectable; the former per-profile and fast-path toggles are retired and MUST NOT be reintroduced as live options.

#### Scenario: A user picks a pipeline

- **WHEN** the workflow setting is read
- **THEN** it resolves to either the stock pipeline or the Companion pipeline
- **AND** any other persisted historical value is migrated rather than honored as a live choice

### `mark-complete` is the pipeline's only terminal step and the only writer of completion

The Companion pipeline MUST end at `/speckit.companion.mark-complete`, which writes the completed status through the single dedicated writer path. No other command may write completion, and completion MUST be refused unless the spec has already reached the implemented state.

#### Scenario: A pipeline run reaches its end

- **WHEN** implementation (and any commit step) has finished
- **THEN** the terminal step runs and the spec lands at completed status
- **AND** a spec that is not yet implemented is refused rather than marked complete

### Steps hand off to the next step where the host allows it, and degrade cleanly where it does not

Each pipeline step MUST tell the host how the run continues: on a host that keeps acting, dispatch the next step's command; at a declared review gate, stop and wait for approval. On a one-shot host the handoff simply does not fire and the run MUST remain valid and resumable via `/speckit.companion.resume`.

#### Scenario: A one-shot host finishes a step

- **WHEN** the environment stops after a single step
- **THEN** the step's progress is recorded and the run stops without error
- **AND** the pipeline can be advanced later by the developer or the companion panel

#### Scenario: An unattended run reaches a checkpoint hook

- **WHEN** the run is flagged unattended
- **THEN** human-wait gates are bypassed while background and artifact-producing hooks still fire
- **AND** the flag is carried forward into every dispatched step

### Read-only and adoption commands never halt the pipeline

The status, drift, and coverage reporting commands, and the brownfield adoption wizard, MUST be opt-in and read-only with respect to pipeline progression — they report and never block or fail a run. Adoption MUST record what it could not read rather than inventing coverage.

#### Scenario: A reporting command finds missing or unreadable inputs

- **WHEN** the capability registry, specs, or git history are absent or partial
- **THEN** the command reports what it could determine
- **AND** the pipeline is not halted or failed

## Uncovered

- Full prompt bodies of the command and node files were deliberately not read (surface-first: frontmatter, headings, node order, frames, and part files only). Requirements about what a body instructs the model to *produce* in detail — the exact spec/plan/tasks section structure, the adopt wizard's drafting rules, the drift and coverage report formats — are therefore not covered here.
- `presets/companion-standard/commands/*.md` bodies were not read; only `preset.yml`, the preset README, and the shared `_parts/` blocks were.
- The workflow definition `workflows/speckit-companion.workflow.yml` was read only for its step ids and routing shape, not its full gate/step semantics. It also sits outside the three directories this capability covers.
- The `scripts/` directory (including `write-context.py`, `companion_config.py`, `build-commands.py`, `assemble-nodes.py`) is outside this capability's area; it was consulted only to confirm the assembly and configuration contracts asserted above.
