# Spec: Custom Spec Command Button

**Slug**: 027-custom-spec-command | **Date**: 2026-03-29

## Summary

Add a configurable custom command button next to Submit in the spec editor. The button is driven by a new `submitCommand` field on custom workflow configurations, allowing users to trigger alternative pipelines (e.g., `/sdd:auto` instead of `/speckit.specify`) directly from the spec creation UI.

## Requirements

- **R001** (MUST): Custom workflows can define a `submitCommand` field with a `label` and `command` string
- **R002** (MUST): When the selected workflow has a `submitCommand`, a secondary button renders next to Submit with the configured label
- **R003** (MUST): Clicking the custom command button sends the spec content to the terminal using the configured command instead of `stepSpecify`
- **R004** (MUST): When no `submitCommand` is configured, the UI remains unchanged (only Submit button)
- **R005** (SHOULD): The custom command button should have a visually distinct but non-competing style (secondary button appearance)
- **R006** (SHOULD): Keyboard shortcut hint updates to show both submit options when custom command is available

## Scenarios

### Custom workflow with submitCommand configured

**When** user selects a workflow that has `submitCommand: { label: "Auto", command: "sdd:auto" }`
**Then** a secondary button labeled "Auto" appears next to Submit in the footer

### Clicking the custom command button

**When** user clicks the custom command button
**Then** the spec content is sent to the terminal as `/<command> <content>` using the configured command string

### Default workflow selected

**When** user selects the default workflow (or a custom workflow without submitCommand)
**Then** only the Submit button is visible, no custom command button

### Workflow switch toggles button visibility

**When** user switches from a workflow with submitCommand to one without
**Then** the custom command button disappears; switching back restores it

## Out of Scope

- Multiple custom command buttons per workflow
- Custom command button in the spec viewer (only spec editor)
- Modifying the existing Submit button behavior
