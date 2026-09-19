# Command Assembly — Living Spec

<!-- reviewed: d589a63e -->

## Purpose

Shipped command bodies are generated from single-sourced parts and nodes, and gates hold them to their sources, the manifest and a frozen baseline, so a shared rule cannot drift across bodies and a renamed command cannot leave its old name live.

## Requirements

### Command bodies are assembled from single-sourced parts and nodes, and the assembly is the contract

A rule shared by more than one command SHALL live in one part file, and each assembled region of a committed body MUST match its source byte for byte. Editing a shipped body by hand forks the shared rule, so the parity gate treats it as a defect.

#### Scenario: a shared rule changes
- **WHEN** the rule is edited in its part file and the bodies are rebuilt
- **THEN** every command body carrying it holds the new text

#### Scenario: a body is edited in place
- **WHEN** a shipped body's assembled region no longer matches its source
- **THEN** the parity gate fails naming the command and the region

### Assembly changes MUST be proved against a frozen baseline

A change to how bodies are built MUST NOT change the text of any command not deliberately reworded: each SHALL equal its frozen capture after the assembly markers are normalized. Re-freezing is a separate, deliberate act, never done by the build.

#### Scenario: the assembly mechanism is refactored
- **WHEN** the bodies are rebuilt
- **THEN** each unchanged command matches its frozen capture byte for byte

#### Scenario: a command's wording is intentionally changed
- **WHEN** the bodies are rebuilt
- **THEN** the baseline check fails until the baseline is re-frozen explicitly

### The manifest is the command inventory's single authority, and every downstream surface is gated against it

Installed agent files, the extension registry and the documentation tables MUST agree with the manifest's command list in both directions. A missing entry is a command the user cannot reach, and an orphan is a retired name that stays live because reinstalling never deletes.

#### Scenario: a command is renamed
- **WHEN** the manifest names the new command and the old agent file is still installed
- **THEN** the gate fails naming the orphaned file

#### Scenario: a command file exists that the manifest does not declare
- **WHEN** the gate runs
- **THEN** it fails, because the installer would never ship that command

### Companion's document shape comes from its command bodies, not the stock templates

A Companion authoring step SHALL carry the shape of the document it writes in its own instructions, so the stock templates on disk do not change its output. When a project reshapes a section, the body SHALL carry a note pointing at the resolved copy for that section only, and a project that reshaped nothing gets a byte-identical body.

#### Scenario: the stock spec template is edited
- **WHEN** a Companion specify run writes the spec
- **THEN** its shape is unchanged by the edit

#### Scenario: a project replaces one section of the plan template
- **WHEN** the bodies are built
- **THEN** the plan body tells the agent to follow the resolved copy for that section and keeps its own shape for the rest

### A command that injects a step into a numbered body MUST NOT restart the numbering

A node adding a step to a command whose numbering continues after it SHALL use a sub-bullet or an unnumbered note. Nodes are concatenated, so the check is made on the assembled body.

#### Scenario: a node adds a step mid-command
- **WHEN** the assembled body is read
- **THEN** its top-level step numbers run without a repeat

### The prompting contract is held by a static gate, not by convention

A scan SHALL fail any command on the never-halts roster (the four lifecycle hooks, the living-spec drift, sync and coverage reports, mark-complete, status, resume and classify) that gains an instruction to stop and ask the user. It ignores negated mentions and fenced templates, and a roster file it cannot find fails the scan.

#### Scenario: a prompt instruction slips into a never-halts command
- **WHEN** a roster command gains a non-negated ask-the-user instruction
- **THEN** the gate fails naming the command and quoting the line

#### Scenario: a roster file is missing
- **WHEN** the scan runs
- **THEN** it fails, rather than passing over fewer commands

### The clarify command must still ask

The same scan SHALL fail when the clarify command body no longer contains an instruction to ask the user, because asking is that command's purpose.

#### Scenario: the clarify carrier stops asking
- **WHEN** its ask instruction is removed
- **THEN** the gate fails

### A shipped body never names a command in a spelling the host cannot resolve

A shipped command, node or preset SHALL name a command without a leading slash, and every body that prints or dispatches a name SHALL carry the rule to use the spelling the project installed. A scan over the shipped corpus enforces this, including names held as data in scripts, because hand sweeps kept leaving residue.

#### Scenario: a body names a command behind a slash
- **WHEN** the scan reads the shipped corpus
- **THEN** it fails naming the file and the line

#### Scenario: the part that teaches the rule
- **WHEN** the scan reaches its examples of both the dotted and dashed spellings
- **THEN** it leaves them alone

### Optional instrumentation is delivered by re-rendering the bodies, never left dormant in them

Instrumentation text SHALL be present only in a body rendered with it switched on, never as an inactive passage, so the off render matches the frozen baseline. It reaches the next dispatched command, never one already running.

#### Scenario: the switch is off
- **WHEN** the bodies are assembled
- **THEN** they contain no instrumentation text and match the frozen baseline byte for byte

#### Scenario: a parity gate runs while the switch is on locally
- **WHEN** the gate assembles the bodies to compare them
- **THEN** it compares the off render, so a local switch never fails the gate

## Uncovered

_None._
