# Spec: Custom Workflow UX Improvements

**Branch**: 014-custom-workflow-ux | **Date**: 2026-02-27

## Summary

The custom workflows feature has three UX issues: (1) an aggressive popup warning fires on activation when the default workflow setting doesn't match a configured workflow, (2) the footer enhancement buttons (Clarify, Checklist, Analyze) always render even when the workflow has no custom sub-commands mapped to those actions, and (3) the Steering tree view doesn't surface the command files that custom workflow steps reference (e.g., `.claude/commands/sdd.specify.md`). This spec addresses all three to make custom workflows feel polished and discoverable.

## Requirements

- **R001** (MUST): Replace the `showWarningMessage` popup in `validateWorkflowsOnActivation` (line 295) and `getOrSelectWorkflow` (line 160) with non-intrusive feedback — either a status bar item, output channel log, or inline tree view indicator — so users aren't interrupted on every activation.
- **R002** (MUST): Footer enhancement buttons (Clarify on spec, Checklist on plan, Analyze on tasks) must only render when the active workflow defines a corresponding sub-command for that step. If no sub-command is configured, the button must be hidden entirely — not disabled.
- **R003** (MUST): The `WorkflowConfig` type must support optional per-step sub-commands (e.g., `sub-specify`, `sub-plan`, `sub-tasks`) so workflows can declare custom enhancement actions alongside step commands.
- **R004** (SHOULD): The Steering Explorer tree view should show a "Workflow Commands" category listing the command files referenced by the active workflow's step and sub-step settings, making them easily discoverable and openable.

## Scenarios

### Non-intrusive default workflow warning

**When** the extension activates and `speckit.defaultWorkflow` references a workflow name that doesn't exist in the configured custom workflows
**Then** a message is logged to the SpecKit output channel (not a popup) and the built-in default workflow is used silently.

### Enhancement button visibility

**When** a user views a spec document in the spec viewer and the active workflow does not define a `sub-specify` command
**Then** the Clarify button in the footer is not rendered.

**When** a user views a spec document and the active workflow defines `sub-specify: "sdd.clarify"`
**Then** the Clarify button renders and executes the mapped `sdd.clarify` command on click.

### Steering tree shows workflow commands

**When** the active workflow has step commands pointing to files (e.g., `step-specify: "sdd.specify"`) and those files exist in `.claude/commands/`
**Then** the Steering Explorer shows a "Workflow Commands" expandable node listing each referenced command file with an icon and click-to-open action.

## Out of Scope

- Workflow editor UI for creating/editing workflows (already exists as a separate feature)
- Changes to the workflow selection picker or quick-pick flow
- Support for multiple concurrent workflows per feature
- Checkpoint configuration changes
