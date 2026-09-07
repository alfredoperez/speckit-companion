# Command Assembly — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Command Assembly is how the shipped command bodies are built and gated: single-sourced parts and nodes, the frozen baseline, the manifest inventory and the parity gates that hold every downstream surface to it.

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

### A command that injects a step into a numbered body MUST NOT restart the numbering

Node bodies are concatenated, so numbering is a property of the *assembled* command, not of any one node. A node adding a step to a command whose numbering continues downstream SHALL use a sub-bullet or an unnumbered note rather than opening a fresh top-level number, and the check is made against the assembled body.

#### Scenario: a node adds a step mid-command
- **WHEN** the assembled body is reviewed
- **THEN** the step numbering runs continuously with no repeated number

### The command inventory records what each command's run must produce

Alongside the command list, the shipped inventory SHALL record, per command, the artifacts a run is expected to produce and which node produces each — derived from the same node order the bodies were assembled from, and marking the ones a fold may legitimately skip. Without it, a step that quietly stopped writing its document is indistinguishable from one that wrote it.

#### Scenario: a run is checked against what it claimed
- **WHEN** the expected artifacts are read
- **THEN** they describe the pipeline that was actually assembled

### Optional instrumentation is delivered by re-rendering the bodies, never left dormant in them

A switch that adds instruction text to command bodies MUST change which bodies get rendered, not toggle a passage inside them. With the switch off the text MUST be absent from the assembled body entirely, so an off render stays byte-identical to the frozen baseline and the parity gate keeps its meaning. The switch SHALL be declared in the project's own configuration and read through the existing loader, inheriting its failure table, and it MUST NOT introduce a second mechanism for changing command text. Because a body is a static file the agent reads, the switch necessarily affects the next dispatched command and never one already in flight.

#### Scenario: the switch is off
- **WHEN** the bodies are assembled
- **THEN** they contain no instrumentation text and match the frozen baseline byte for byte

#### Scenario: a parity gate runs while the switch is on locally
- **WHEN** the gate assembles the bodies to compare them
- **THEN** it compares the off render, so a local switch can never fail the gate

## Uncovered

Read in full: the extension manifest, all part files, the node order and a sample of node bodies across all four pipeline commands, the completion and resume command bodies, one hook command body, and the inventory/parity/assembly gate contracts. Not read:

- The full bodies of `speckit.companion.specify.md`, `.plan.md`, `.tasks.md`, `.implement.md`, `.auto.md`, `.living-adopt.md` (the six largest, together roughly 118 KB) — their contracts were taken from `docs/template-profiles.md`, `docs/capture-and-timing.md`, the manifest descriptions, and the node files they assemble from.
- `speckit.companion.after-plan.md`, `.after-tasks.md`, `.after-implement.md` — read one hook body in full and treated the other three as the same shape per the manifest.
- `speckit.companion.status.md`, `.classify.md`, `.living-move.md`, `.living-drift.md`, `.living-coverage.md`.
- All seven `presets/companion-standard/commands/*.md` carrier bodies and `preset.yml`.
- Most individual node bodies under `nodes/` — read the order files, frontmatter shape, and three representative bodies.
- `speckit-extension/workflows/speckit-companion.workflow.yml`.
