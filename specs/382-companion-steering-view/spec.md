# Feature Specification: Companion home in the Steering view

**Feature Branch**: `382-companion-steering-view`
**Created**: 2026-06-26
**Status**: Draft
**Issue**: #381

## Overview

Give SpecKit Companion a visible home in the Steering sidebar view. Today a developer can install the companion spec-kit extension and use its `/speckit.companion.*` commands, but nothing in the Steering view tells them whether the extension is installed, where its configuration lives, or which commands it provides. This feature adds a **Companion** group node to the Steering view that answers all three at a glance: it shows the Companion configuration file's setting groups, lists the available Companion commands for discovery, and — when the extension is not installed — surfaces a clear "not installed" indicator with a one-click install action.

## User Scenarios & Testing

### User Story 1 - See Companion install state and install in one click (Priority: P1)

A developer opens the Steering view in a project where the companion spec-kit extension is not installed. The new Companion group node makes it obvious the extension is missing and offers an inline install action so they can adopt it without leaving the sidebar.

**Why this priority**: This is the entry point. Without a clear install affordance, the rest of the node never populates and the developer has no path to adoption from the Steering view.

**Independent Test**: Open the Steering view in a project with no `.specify/extensions/companion/` directory. Confirm the Companion node appears, shows a "Not installed" indicator, and offers an inline install action that triggers the existing install flow.

**Acceptance Scenarios**:

1. **Given** a project where the companion extension is not installed, **When** the developer opens the Steering view, **Then** a Companion group node appears with a "Not installed" indicator and no Configuration/Commands children.
2. **Given** the Companion node shows "Not installed", **When** the developer activates its inline install action, **Then** the existing companion install command runs.
3. **Given** the developer completes the install, **When** the Steering view reflects the new state, **Then** the "Not installed" indicator clears and the node uses the Companion (moss) icon.

### User Story 2 - Discover and open Companion configuration (Priority: P2)

A developer with the companion extension installed wants to review or edit how Companion behaves in this project. Under the Companion node they find a Configuration group listing the top-level setting groups from the Companion configuration file, and clicking any of them opens that file.

**Why this priority**: Configuration discovery is the main day-two value once installed, but it depends on Story 1's installed state.

**Independent Test**: In an installed project with a Companion configuration file present, expand the Companion node, confirm a Configuration group lists the file's top-level setting groups, and confirm clicking one opens the configuration file.

**Acceptance Scenarios**:

1. **Given** the companion extension is installed and a Companion configuration file exists, **When** the developer expands the Companion node, **Then** a Configuration group appears listing one entry per top-level setting group in that file.
2. **Given** the Configuration group is shown, **When** the developer clicks a setting-group entry, **Then** the Companion configuration file opens in the editor.
3. **Given** the companion extension is installed but no Companion configuration file exists, **When** the developer expands the Companion node, **Then** no Configuration group is shown and no error is raised.

### User Story 3 - Discover the Companion command set (Priority: P2)

A developer wants to know which Companion commands are available. Under the Companion node they find a Commands group listing every `/speckit.companion.*` command the installed extension provides, each with its description, so new commands appear automatically as the extension evolves.

**Why this priority**: Command discovery is valuable but, like configuration, only meaningful once installed.

**Independent Test**: In an installed project, expand the Companion node and confirm the Commands group lists every command from the installed extension's manifest with its description, and that the list is read from the manifest rather than hand-maintained.

**Acceptance Scenarios**:

1. **Given** the companion extension is installed, **When** the developer expands the Companion node, **Then** a Commands group lists each command the installed extension's manifest declares, with the command's description available on hover.
2. **Given** the installed extension's manifest gains a new command, **When** the developer reloads the Steering view, **Then** the new command appears automatically without any code change to the host extension.

### User Story 4 - The node stays current (Priority: P3)

A developer changes Companion install state or edits the configuration file. The Steering view reflects the change without a manual full reload of the window.

**Why this priority**: Freshness is a quality refinement on top of the core display.

**Independent Test**: With the Steering view open, install or remove the companion extension (or edit the configuration file) and confirm the Companion node refreshes.

**Acceptance Scenarios**:

1. **Given** the Steering view is open, **When** the companion extension is installed or removed, **Then** the Companion node refreshes to reflect the new install state.
2. **Given** the Steering view is open, **When** the Companion configuration file is created, changed, or deleted, **Then** the Configuration group refreshes.

## Edge Cases

- The Companion configuration file is absent: the Configuration group is omitted, not shown empty or as an error.
- The installed manifest is missing or unparseable: the Commands group degrades to empty rather than crashing the view.
- A setting-group entry's open action must resolve to a file inside the workspace root; a configuration value that points outside the root must not open an out-of-workspace file.
- The Companion node must report itself expandable only when it actually has children — a not-installed node has none.
- The feature must not depend on the host-extension source tree (`speckit-extension/`) being present at runtime, since it is absent from the packaged extension.

## Requirements

### Functional Requirements

- **FR-001**: The Steering view MUST show a Companion group node whenever a workspace is open.
- **FR-002**: The Companion node MUST reflect install state using the on-disk companion-extension presence signal (the `isCompanionInstalled` check on `.specify/extensions/companion/`), not preset presence.
- **FR-003**: When the companion extension is not installed, the Companion node MUST show a "Not installed" indicator and MUST offer an inline action that invokes the existing companion install command.
- **FR-004**: When the companion extension is not installed, the Companion node MUST NOT present Configuration or Commands children and MUST report itself non-expandable.
- **FR-005**: When the companion extension is installed, the Companion node MUST use the Companion moss icon and MUST NOT show the "Not installed" indicator.
- **FR-006**: When installed and a Companion configuration file exists, the Companion node MUST present a Configuration group whose children are the top-level setting groups of that file, each of which opens the configuration file when activated.
- **FR-007**: When installed, the Companion node MUST present a Commands group whose children are the commands declared by the installed extension's manifest, each labelled by command name with its description available on hover.
- **FR-008**: The command list MUST be sourced from the installed extension's manifest at runtime, not from a list hand-maintained in the host extension, so new commands appear automatically.
- **FR-009**: The Configuration group's open action MUST validate the target path is within the workspace root and MUST drop or refuse any entry resolving outside it.
- **FR-010**: The Companion node MUST refresh when install state changes or when the Companion configuration file is created, changed, or deleted.
- **FR-011**: The feature MUST degrade gracefully (no error surfaced to the user) when the configuration file or installed manifest is absent or unparseable, and MUST NOT depend on the host-extension source tree being present at runtime.
- **FR-012**: A new moss icon asset MUST be authored and wired as the Companion node's icon when installed.

### Key Entities

- **Companion node**: the Steering-view group representing SpecKit Companion; carries install state, an icon, and (when installed) two child groups.
- **Configuration group**: derived from the Companion configuration file's top-level setting groups; each child opens that file.
- **Commands group**: derived from the installed extension manifest's provided-commands list; each child represents one command and its description.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a project without the companion extension, the Steering view shows the Companion node with a "Not installed" indicator and a working inline install action in 100% of opens.
- **SC-002**: In an installed project with a configuration file, the Configuration group lists exactly the top-level setting groups present in that file, and each entry opens the configuration file.
- **SC-003**: In an installed project, the Commands group lists exactly the commands declared by the installed manifest, with zero hand-maintained command entries in the host extension.
- **SC-004**: Changing install state or editing the configuration file updates the Companion node without a manual window reload.
- **SC-005**: With the configuration file or manifest absent or malformed, the Steering view renders without surfacing an error.

## Assumptions

- The installed companion extension exposes its manifest at `.specify/extensions/companion/extension.yml`, which is the natural runtime source for the command list (and is only read when installed).
- The Companion configuration file is `.specify/companion.yml`; its top-level keys are the "setting groups" surfaced under Configuration.
- VS Code has no true per-tree-item badge, so the "not installed" indicator is realised with a warning-themed icon plus a description label and an inline menu action — the closest supported affordances.
- The existing install command `speckit.companion.installSpecKitExtension` and the `speckit.companion.installed` context key are reused; no new detection or install command is introduced.

## Verbatim Constraints

- Install command: `speckit.companion.installSpecKitExtension`
- Install-state context key: `speckit.companion.installed`
- Install-state helper: `isCompanionInstalled`
- Companion configuration file: `.specify/companion.yml`
- Installed manifest path: `.specify/extensions/companion/extension.yml`
- Manifest commands list key: `provides.commands`
- Icon asset: `assets/icons/moss.svg`
