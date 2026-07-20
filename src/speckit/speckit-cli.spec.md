# Speckit CLI — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This capability is the extension's relationship with an external tool it does not own: the SpecKit CLI and its companion CLI extension. It exists so the editor can detect, install, upgrade, and stay out of the way of that CLI — and so a missing, outdated, or failing CLI degrades the experience instead of breaking the editor.

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

### The companion CLI extension has exactly one install path and one target

The companion spec-kit extension is a CLI extension, not an editor extension, so it SHALL be installed only by running the CLI's own extension-add command. Its install target MUST live in a single place so a release changes nothing here, and the command MUST NOT carry flags the CLI does not accept. Install is already an install-or-update, so re-running it MUST be safe.

#### Scenario: the user installs from any surface
- **WHEN** the install action runs from a banner, the sidebar, or the upgrade menu
- **THEN** the same command is built from the same shared definition

#### Scenario: the user is on a CLI build without the extension subcommand
- **WHEN** the install runs
- **THEN** the prerequisite is printed — not executed — before the install command, so the resulting failure is self-explanatory

### The install nudge is gated on presence, not on opt-in

The prompt to install the companion CLI extension SHALL be shown when the prompt preference is on **and** the extension is absent. It MUST NOT be gated behind any workflow opt-in, since the audience that has not opted in is exactly the one that needs the discovery. An explicit opt-out MUST suppress it entirely, with no residual warning.

#### Scenario: the extension is already installed
- **WHEN** the gate is evaluated
- **THEN** no prompt is shown regardless of the preference

#### Scenario: the user has opted out
- **WHEN** the gate is evaluated with the extension absent
- **THEN** nothing is shown — no banner and no fallback warning

### Two products share one release list and must never be confused

This repository publishes two independently-versioned products into a single releases list. Any release lookup SHALL filter to the tag shape belonging to the product being asked about, and MUST reject drafts and prereleases. A lookup that resolves "the latest release" across both namespaces is a defect shape that has shipped before and MUST NOT be reintroduced anywhere — including links opened for the user.

#### Scenario: an update check runs
- **WHEN** releases are enumerated
- **THEN** only tags matching the editor extension's own shape are considered, and the highest version among them wins
- **AND** the other product's releases, drafts, and prereleases are ignored

### Update checks are throttled, skippable, and never noisy on failure

The update check SHALL run at most once per interval unless explicitly forced, SHALL respect a version the user chose to skip, and SHALL fail silently to the log when the network or the API is unavailable.

#### Scenario: the user skips a version
- **WHEN** that version is later seen again
- **THEN** no notification is shown
- **AND** a newer version than the skipped one still notifies

#### Scenario: the releases API is unreachable
- **WHEN** the check runs
- **THEN** the failure is logged and no user-facing error appears

### Task progress is derived from the task document and only reported on transitions

Phase completion SHALL be computed by parsing the task document into phases and counting only genuine task checkboxes — items inside code blocks are documentation, not work. A notification MUST fire only when a phase newly becomes complete relative to the last observed state, and the cache MUST be seeded on first sight of a file so opening an already-finished project announces nothing.

#### Scenario: an already-complete task file is opened
- **WHEN** its state is first observed
- **THEN** the cache is seeded and no completion is announced

#### Scenario: the final task of a phase is checked
- **WHEN** the file changes
- **THEN** that phase alone is reported as newly complete, and re-saving the file reports nothing further

## Uncovered

_None — every file in the area was read._
