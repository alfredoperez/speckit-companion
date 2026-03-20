# Spec: Fix Workflow Step Bugs

**Branch**: 019-fix-workflow-step-bugs | **Date**: 2026-03-19

## Summary

The flexible workflow steps feature (018) has several bugs discovered during testing with a custom SDD workflow. Custom step commands are not dispatched correctly, icons are mismatched for steps whose `name` differs from the legacy hardcoded type strings, the `implement` step renders as a file document even though it has no output file, and subfile indentation in the sidebar tree is too shallow.

## Requirements

- **R001** (MUST): Icon mapping in `SpecItem` must use a lookup that maps both legacy names (`spec`, `plan`, `tasks`) and new step names (`specify`, `implement`, `design`, etc.) to appropriate VS Code ThemeIcons. Unrecognized step names must fall back to a sensible default icon (e.g., `terminal` for action-only steps, `file` for file-producing steps).
- **R002** (MUST): Steps that have no `file` property AND whose default file (`{name}.md`) does not exist should render as action-only items in the sidebar — using a distinct icon (e.g., `play`) and no status indicator, since they don't produce output documents.
- **R003** (MUST): When a custom workflow is active and a step command is triggered from the sidebar, the resolved command must match the step's `command` field from the workflow config (e.g., `sdd-spec` not `speckit.specify`). The `getOrSelectWorkflow` auto-selection must respect `speckit.defaultWorkflow` setting.
- **R004** (SHOULD): Subfile/related-doc tree items should have visually distinct indentation from their parent step items — increase indent depth or add a visual cue so hierarchy is clear at a glance.
- **R005** (SHOULD): The `buildWorkflowDetail()` in workflow selector should display step info from the `steps` array (not legacy `step-*` keys) when showing workflow details in the quick pick.
- **R006** (MUST): Step icons should be customizable per step via an optional `icon` property in `WorkflowStepConfig`, falling back to a built-in icon map when not specified.

## Scenarios

### Icon Mapping Fix

**When** a workflow has step `name: "specify"` and no `icon` override
**Then** the sidebar shows the `chip` icon (same as legacy `spec` type)

**When** a workflow has step `name: "implement"` with no `file`
**Then** the sidebar shows a `play` (or `rocket`) icon with no status dot

**When** a workflow has step with `icon: "telescope"`
**Then** the sidebar shows the `telescope` ThemeIcon

### Command Dispatch Fix

**When** user has `speckit.defaultWorkflow: "agent-teams-lite"` and the workflow config has `{ name: "specify", command: "sdd-spec" }`
**Then** clicking the specify step dispatches `/sdd-spec <specDir>` in the terminal

**When** no `.speckit.json` exists for the feature and `defaultWorkflow` is set to a custom workflow
**Then** the custom workflow is auto-selected (not the built-in default)

### Subfile Indentation

**When** a step has related docs or subfiles as children
**Then** child items appear with clearly deeper indentation than parent step items

## Out of Scope

- Redesigning the workflow config schema (already handled by spec 018)
- Adding a visual workflow editor for step configuration
- Per-step checkpoint configuration
