# Speckit CLI Detection — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Whether the SpecKit CLI is installed and whether the open workspace was scaffolded by it are separate answers, and neither one failing may break activation.

## Requirements

### A missing or broken CLI degrades the extension, never the host

Every interaction with the external CLI SHALL be treated as optional. Detection MUST resolve to a plain answer rather than an error, and a CLI that is absent, on an old build, or failing MUST leave the extension activated and usable. Nothing here may throw into activation.

#### Scenario: the CLI is not installed
- **WHEN** detection runs on a machine without it
- **THEN** the extension reports "not installed", records that in a context key, and continues activating
- **AND** the affordances that depend on the CLI surface an install route instead of failing

#### Scenario: the CLI exists but does not answer the probe
- **WHEN** the primary detection probe errors
- **THEN** a second, differently-shaped probe is attempted before concluding it is absent

### Detection distinguishes "the tool exists" from "this project uses it"

Whether the CLI is installed on the machine and whether the open workspace has been scaffolded by it SHALL be separate answers, checked separately and exposed separately. A third check — whether the project's constitution still holds placeholder text — SHALL only run once the workspace is known to be initialized.

#### Scenario: an initialized workspace on a machine without the CLI
- **WHEN** detection runs
- **THEN** the workspace reports as initialized while the CLI reports as absent
- **AND** the two drive different affordances

#### Scenario: the workspace was scaffolded for a chat-based assistant
- **WHEN** the canonical scaffolding directory is absent
- **THEN** initialization is still detected from the per-assistant command files the CLI emits

## Uncovered

_None — every file in the area was read._
