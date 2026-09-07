# Speckit CLI Commands — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Install, initialize and upgrade run the CLI in a visible terminal, and re-scaffolding names the assistant the user actually configured.

## Requirements

### The extension drives the CLI through a visible terminal, never silently

Install, initialize, and upgrade actions SHALL run as commands in a terminal the user can see, because they are long-running, may prompt, and may fail in ways only their own output explains. The extension MUST NOT claim these succeeded — after dispatching it tells the user what is happening and offers to reload once they judge it complete.

#### Scenario: the user triggers an upgrade
- **WHEN** the action runs
- **THEN** a named terminal opens showing the command and its output
- **AND** the extension offers a reload rather than asserting the upgrade finished

#### Scenario: a workspace path contains shell metacharacters
- **WHEN** a command must run in the workspace directory
- **THEN** the directory is supplied as structured terminal configuration rather than interpolated into the command text

### Re-scaffolding targets the assistant the user actually configured

When the extension asks the CLI to regenerate a project's scaffolding, the assistant identifier it passes SHALL be derived from the configured provider — and, for the chat-routing provider, from the detected host editor. The resolution MUST be explicit for every supported provider: each one the product ships SHALL have its own entry, so the identifier passed matches the assistant the user actually chose. The resolution MUST also be total — a value the product does not recognize at all resolves to a safe default rather than passing through an identifier the CLI would reject. The default exists only for genuinely unknown values; a supported provider that falls through to it is a defect, not a fallback, because the workspace is then scaffolded for the wrong assistant. No dispatch site may hardcode an identifier.

#### Scenario: the workspace is upgraded under a chat-routing provider
- **WHEN** the upgrade command is built
- **THEN** the identifier is chosen from the detected host editor
- **AND** an unrecognized host falls back to a known-valid identifier

#### Scenario: a supported provider has no entry of its own
- **WHEN** the identifier is resolved for it
- **THEN** reaching the default is a defect rather than acceptable behavior
- **AND** the provider must be given its own explicit entry
