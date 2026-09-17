# Command Assembly — Living Spec

<!-- reviewed: d589a63e -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Every shipped command body is generated from single-sourced parts and nodes, and gates hold the bodies, the manifest and the frozen baseline to each other. This keeps a shared rule from drifting across bodies and a renamed command from leaving its old name live.

## Requirements

### Command bodies are assembled from single-sourced parts and nodes, and the assembly is the contract

A rule shared by more than one command SHALL live in exactly one part file, and a command's structure SHALL be an ordered list of node files, each with its own identity and declared reads and writes. The committed bodies stay whole and self-contained but are generated, and a gate MUST hold each assembled region byte-identical to its source. Editing a shipped body directly is a defect, because it silently forks a shared rule.

#### Scenario: a shared rule changes
- **WHEN** a rule embedded in several commands is edited
- **THEN** it is edited in its single part file
- **AND** every command body carrying it is reassembled

#### Scenario: a body is edited in place
- **WHEN** a shipped body's assembled region no longer matches its source
- **THEN** the parity gate fails and names the command and the region

### Assembly changes MUST be proved against a frozen baseline

Reshaping how bodies are built MUST NOT change the instructions the agent receives: commands not intentionally changed SHALL equal a frozen capture of their prior text, after normalizing the assembly markers. Re-freezing the baseline is a deliberate, separate act after an intentional wording change, and the build never does it on its own.

#### Scenario: the assembly mechanism is refactored
- **WHEN** the bodies are rebuilt
- **THEN** each unchanged command matches its frozen capture byte-for-byte

#### Scenario: a command's wording is intentionally changed
- **WHEN** the change is deliberate
- **THEN** the baseline is re-frozen explicitly, outside the build

### The manifest is the command inventory's single authority, and every downstream surface is gated against it

Every surface derived from the manifest's command list (installed agent files, the registry, the documentation tables) MUST agree with it in both directions, and a gate SHALL enforce that. A missing entry is a command the user cannot reach, and an orphaned entry is a retired name that stays live because reinstallation never deletes. The gate MUST discover install areas rather than iterate a fixed list, and an input it cannot resolve MUST fail loudly rather than shrink the surface it scans.

#### Scenario: a command is renamed
- **WHEN** the manifest names the new command
- **THEN** the gate reports the stale file left behind under the old name

#### Scenario: a new command is added
- **WHEN** the command file exists but the manifest does not declare it
- **THEN** the installer would skip it, and the gate fails

### The pipeline's document shape lives in command bodies, never in document templates

Document shape SHALL be delivered by overriding command bodies, not by shipping alternative document templates. Template overrides only resolve when a setup script calls the resolver, and the specification command copies its template by literal path, so a template override there would do nothing. The on-disk templates keep showing the stock shape, and the Companion commands do not read them.

#### Scenario: a Companion-shaped document is wanted
- **WHEN** the desired shape differs from stock
- **THEN** the change is made in the command body
- **AND** no alternative document template is shipped for it

### A command that injects a step into a numbered body MUST NOT restart the numbering

A node adding a step to a command whose numbering continues downstream SHALL use a sub-bullet or an unnumbered note, not a fresh top-level number. The check is made against the assembled body, because node bodies are concatenated.

#### Scenario: a node adds a step mid-command
- **WHEN** the assembled body is reviewed
- **THEN** the step numbering runs continuously with no repeated number

### The prompting contract is held by a static gate, not by convention

On every change, a scan SHALL check the never-halts commands (the four lifecycle hooks, the living-spec reports and sync, completion, status, resume, and classify) for instructions that stop to ask the user, and SHALL require the clarify-type carrier to ask. The scan reads command sources as text, ignoring negated mentions and fenced templates. A roster file it cannot find fails loudly rather than shrinking the surface it checks.

#### Scenario: a prompt instruction slips into a never-halts command

- **WHEN** a command on the never-halts roster gains a non-negated ask-the-user instruction
- **THEN** the quality gate fails naming the command and quoting the offending line

#### Scenario: the clarify carrier stops asking

- **WHEN** the clarify-type command body no longer contains an ask instruction
- **THEN** the quality gate fails, because asking is that command's purpose

### A shipped body never names a command in a spelling the host cannot resolve

A shipped body SHALL name a command without a leading slash, so the name reads as an id to translate, and every body that prints or dispatches a name SHALL carry the rule to use the spelling the project installed. The part that teaches that rule is the one place both the dot and dashed spellings appear. A scan over the shipped bodies SHALL enforce this, including command names held as data in the status script, because hand sweeps kept leaving residue.

#### Scenario: a body names a command behind a slash

- **WHEN** the scan reads the shipped commands, nodes and presets
- **THEN** it fails naming the file and the line

#### Scenario: the part that teaches the rule

- **WHEN** the scan reaches it
- **THEN** its examples of both spellings are left alone

### Optional instrumentation is delivered by re-rendering the bodies, never left dormant in them

A switch that adds instruction text MUST change which bodies get rendered, not toggle a passage inside them, and with the switch off the text MUST be absent so the off render matches the frozen baseline. The switch SHALL be declared in the project's own configuration, read through the existing loader with its failure table, and MUST NOT add a second mechanism for changing command text. It affects the next dispatched command, never one already in flight.

#### Scenario: the switch is off
- **WHEN** the bodies are assembled
- **THEN** they contain no instrumentation text and match the frozen baseline byte for byte

#### Scenario: a parity gate runs while the switch is on locally
- **WHEN** the gate assembles the bodies to compare them
- **THEN** it compares the off render, so a local switch can never fail the gate

## Uncovered

_None. Re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
