# Speckit CLI Detection — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The extension does not own the SpecKit CLI. This capability exists so the editor can find that CLI and the projects it scaffolded, drive it through a terminal the user can watch, and hand it the assistant the user actually configured. Without it a missing or failing CLI would break activation instead of degrading it.

## Requirements

### A missing or broken CLI degrades the extension, never the host
<!-- touches: src/speckit/detector.ts -->

Every interaction with the external CLI SHALL be treated as optional. Detection MUST resolve to a plain answer rather than an error, and a CLI that is absent, on an old build, or failing MUST leave the extension activated and usable. Nothing here may throw into activation.

#### Scenario: the CLI is not installed
- **WHEN** detection runs on a machine without it
- **THEN** the extension reports "not installed", records that in a context key, and continues activating
- **AND** the affordances that depend on the CLI surface an install route instead of failing

#### Scenario: the CLI exists but does not answer the probe
- **WHEN** the primary detection probe errors
- **THEN** a second, differently-shaped probe is attempted before concluding it is absent

### Detection distinguishes "the tool exists" from "this project uses it"
<!-- touches: src/speckit/detector.ts -->

Whether the CLI is installed on the machine and whether the open workspace has been scaffolded by it SHALL be separate answers, checked separately and exposed separately. A third check — whether the project's constitution still holds placeholder text — SHALL only run once the workspace is known to be initialized.

#### Scenario: an initialized workspace on a machine without the CLI
- **WHEN** detection runs
- **THEN** the workspace reports as initialized while the CLI reports as absent
- **AND** the two drive different affordances

#### Scenario: the workspace was scaffolded for a chat-based assistant
- **WHEN** the canonical scaffolding directory is absent
- **THEN** initialization is still detected from the per-assistant command files the CLI emits

### The extension drives the CLI through a visible terminal, never silently
<!-- touches: src/speckit/cliCommands.ts, src/speckit/detector.ts -->

Install, initialize, and upgrade actions SHALL run as commands in a terminal the user can see, because they are long-running, may prompt, and may fail in ways only their own output explains. The extension MUST NOT claim these succeeded — after dispatching it tells the user what is happening and offers to reload once they judge it complete.

#### Scenario: the user triggers an upgrade
- **WHEN** the action runs
- **THEN** a named terminal opens showing the command and its output
- **AND** the extension offers a reload rather than asserting the upgrade finished

#### Scenario: a workspace path contains shell metacharacters
- **WHEN** a command must run in the workspace directory
- **THEN** the directory is supplied as structured terminal configuration rather than interpolated into the command text

### Re-scaffolding targets the assistant the user actually configured
<!-- touches: src/speckit/specKitAgent.ts, src/speckit/cliCommands.ts -->

When the extension asks the CLI to regenerate a project's scaffolding, the assistant identifier it passes SHALL be derived from the configured provider — and, for the chat-routing provider, from the detected host editor. The resolution MUST be explicit for every supported provider: each one the product ships SHALL have its own entry, so the identifier passed matches the assistant the user actually chose. The resolution MUST also be total — a value the product does not recognize at all resolves to a safe default rather than passing through an identifier the CLI would reject. The default exists only for genuinely unknown values; a supported provider that falls through to it is a defect, not a fallback, because the workspace is then scaffolded for the wrong assistant. No dispatch site may hardcode an identifier.

#### Scenario: the workspace is upgraded under a chat-routing provider
- **WHEN** the upgrade command is built
- **THEN** the identifier is chosen from the detected host editor
- **AND** an unrecognized host falls back to a known-valid identifier

#### Scenario: a supported provider has no entry of its own
- **WHEN** the identifier is resolved for it
- **THEN** reaching the default is a defect rather than acceptable behavior
- **AND** the provider must be given its own explicit entry

## Uncovered

_None — every file in the area was read._
