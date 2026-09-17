# Speckit CLI Detection — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The extension finds the SpecKit CLI it does not own and the projects it scaffolded, drives it through a visible terminal, and passes it the user's configured assistant. A missing or failing CLI degrades the extension instead of breaking activation.

## Requirements

### A missing or broken CLI degrades the extension, never the host
<!-- touches: src/speckit/detector.ts -->

Every interaction with the external CLI SHALL be treated as optional, and detection MUST resolve to a plain answer, not an error. An absent, outdated, or failing CLI MUST leave the extension activated and usable, and nothing here may throw into activation.

#### Scenario: the CLI is not installed
- **WHEN** detection runs on a machine without it
- **THEN** the extension reports "not installed", records that in a context key, and continues activating
- **AND** the affordances that depend on the CLI show an install route instead of failing

#### Scenario: the CLI exists but does not answer the probe
- **WHEN** the primary detection probe errors
- **THEN** a second, differently-shaped probe runs before concluding it is absent

### Detection distinguishes "the tool exists" from "this project uses it"
<!-- touches: src/speckit/detector.ts -->

Whether the CLI is installed and whether the workspace is scaffolded by it SHALL be checked and exposed as separate answers. A third check, whether the constitution still holds placeholder text, SHALL run only once the workspace is known to be initialized.

#### Scenario: an initialized workspace on a machine without the CLI
- **WHEN** detection runs
- **THEN** the workspace reports as initialized while the CLI reports as absent
- **AND** the two drive different affordances

#### Scenario: the workspace was scaffolded for a chat-based assistant
- **WHEN** the canonical scaffolding directory is absent
- **THEN** initialization is still detected from the per-assistant command files the CLI emits

The placeholder check SHALL read only the constitution's body. The CLI's report at the top of a finished constitution lists the replaced placeholders, and reading it would keep flagging a constitution the user already wrote.

#### Scenario: a finished constitution still names its placeholders in a comment
- **WHEN** the placeholder check runs over it
- **THEN** commented-out content is excluded before the check
- **AND** the constitution reports as set up

### The extension drives the CLI through a visible terminal, never silently
<!-- touches: src/speckit/cliCommands.ts, src/speckit/detector.ts -->

Install, initialize, and upgrade SHALL run as commands in a terminal the user can see, because they are long-running, may prompt, and may fail. The extension MUST NOT claim they succeeded: after dispatch it tells the user what is happening and offers a reload once they judge it complete.

#### Scenario: the user triggers an upgrade
- **WHEN** the action runs
- **THEN** a named terminal opens showing the command and its output
- **AND** the extension offers a reload instead of asserting the upgrade finished

#### Scenario: a workspace path contains shell metacharacters
- **WHEN** a command must run in the workspace directory
- **THEN** the directory is passed as structured terminal configuration, not interpolated into the command text

### Re-scaffolding targets the assistant the user actually configured
<!-- touches: src/speckit/specKitAgent.ts, src/speckit/cliCommands.ts -->

The assistant identifier passed to the CLI for re-scaffolding SHALL be derived from the configured provider, and for the chat-routing provider from the detected host editor. Every shipped provider MUST have its own explicit entry, and an unrecognized value MUST resolve to a safe default the CLI accepts; a supported provider reaching that default is a defect. No dispatch site may hardcode an identifier.

#### Scenario: the workspace is upgraded under a chat-routing provider
- **WHEN** the upgrade command is built
- **THEN** the identifier is chosen from the detected host editor
- **AND** an unrecognized host falls back to a known-valid identifier

#### Scenario: a supported provider has no entry of its own
- **WHEN** the identifier is resolved for it
- **THEN** reaching the default is a defect, not acceptable behavior
- **AND** the provider must be given its own explicit entry

## Uncovered

_None. Every file in the area was read._
