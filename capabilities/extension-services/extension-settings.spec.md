# Extension Settings — Living Spec

## Purpose

Covers what the extension does outside any spec: the always-available entry points, and keeping the stock command family installed.

## Requirements

### The overview view is the flat list of the extension's non-spec entry points
<!-- touches: apps/vscode/src/features/settings/overviewProvider.ts -->

The overview view SHALL list the always-available actions (pipeline builder, settings, bug and feature reports, marketplace rating) as single entries that each run their command on click.

#### Scenario: the user clicks an overview entry
- **WHEN** "Report a Bug" is clicked
- **THEN** the bug-report command runs and nothing expands

### The stock command family is added when missing and never removed
<!-- touches: apps/vscode/src/features/settings/companionPresetReconciler.ts -->

At activation the extension SHALL install the stock command family from the bundled preset when it is absent and SHALL never remove it, whatever else is installed, so choosing a workflow only routes dispatch and never strands a project.

#### Scenario: the stock family is missing from a checkout
- **WHEN** the extension activates
- **THEN** the stock family is installed from the bundled path

#### Scenario: a leftover preset from an old install is removed
- **WHEN** the extension activates
- **THEN** the leftover is removed and the stock family is re-enabled, not removed

### A failing preset command never blocks activation
<!-- touches: apps/vscode/src/features/settings/companionPresetReconciler.ts -->

When the spec-kit CLI a preset operation needs is missing or fails, the failure SHALL be logged and activation SHALL complete normally.

#### Scenario: the spec-kit CLI is not installed
- **WHEN** the preset check runs at activation
- **THEN** the failure is logged and the extension activates

## Uncovered

_None. Every file in the area was read._
