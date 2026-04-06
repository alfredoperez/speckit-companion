# Spec: Fix SDD Auto Mode

**Slug**: 050-fix-sdd-auto-mode | **Date**: 2026-04-05

## Summary

Workflow commands configured in `customWorkflows[].commands` (e.g., an "Auto Mode" button mapped to `/sdd:auto`) are never rendered in the spec viewer. The viewer only reads `customCommands` for enhancement buttons, so clicking the footer always fires the current step's default command (e.g., `sdd:specify`) instead of the workflow command the user intended.

## Requirements

- **R001** (MUST): Workflow commands from `customWorkflows[].commands` matching the current step must appear as enhancement buttons in the spec-viewer footer
- **R002** (MUST): Clicking a workflow command button must execute its configured command (e.g., `/sdd:auto`) in the AI terminal, not the step's default command
- **R003** (MUST): Workflow commands with `step: "all"` must appear on every step tab
- **R004** (SHOULD): Workflow commands and `customCommands` buttons should coexist — both sources contribute to the footer buttons
- **R005** (SHOULD): When the webview receives a content update message (tab switch), the new step's workflow command buttons must render correctly

## Scenarios

### Workflow command button appears on matching step

**When** a workflow has `commands: [{ name: "auto", title: "Auto Mode", command: "/sdd:auto", step: "specify" }]`
**Then** the spec-viewer footer shows an "Auto Mode" enhancement button when viewing the specify tab

### Workflow command executes correct command

**When** the user clicks the "Auto Mode" workflow command button
**Then** the terminal receives `/sdd:auto <specDir>`, not `/sdd:specify <specDir>`

### Workflow commands merge with customCommands

**When** both `customCommands` and `customWorkflows[].commands` define buttons for the same step
**Then** both sets of buttons appear in the footer

### Step-scoped vs all-scoped commands

**When** a workflow command has `step: "plan"` and the user is viewing the specify tab
**Then** the button does not appear; it only appears on the plan tab

## Out of Scope

- Changing the `customCommands` schema or behavior
- Adding new button styles or positions beyond the existing enhancement button area
- Workflow editor UI for managing workflow commands
