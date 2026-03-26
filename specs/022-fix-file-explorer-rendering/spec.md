# Spec: Fix File Explorer Spec Rendering

**Slug**: 022-fix-file-explorer-rendering | **Date**: 2026-03-26

## Summary

When a user clicks a spec markdown file in the VS Code file explorer, it opens with the `WorkflowEditorProvider` (custom text editor) instead of the `SpecViewerProvider`. This results in a visually different and less polished rendering compared to opening the same file from the SpecKit sidebar. The two renderers should be unified so opening from the file explorer produces the same experience as opening from the sidebar.

## Requirements

- **R001** (MUST): Clicking a spec file (`**/specs/**/*.md`) in the file explorer must open it with the same SpecViewerProvider used by the sidebar, producing identical rendering.
- **R002** (MUST): The workflow progress bar, action buttons (Checklist, Edit Source, Regenerate, Go to Next Phase), and styling must be consistent regardless of how the file is opened.
- **R003** (SHOULD): The `WorkflowEditorProvider` custom editor should either be removed or repurposed so it no longer intercepts spec file opens from the file explorer.
- **R004** (MUST): Opening spec files from the SpecKit sidebar must continue to work as it does today.

## Scenarios

### Opening spec file from file explorer

**When** user clicks a `.md` file under a `specs/` directory in the VS Code file explorer
**Then** the SpecViewerProvider webview panel opens with full styling, workflow circles, and action buttons — identical to sidebar-initiated opens.

### Opening spec file from sidebar (no regression)

**When** user clicks a spec entry in the SpecKit sidebar tree view
**Then** the SpecViewerProvider opens as before with no changes in behavior or appearance.

### Non-spec markdown files

**When** user clicks a markdown file that is NOT under a `specs/` directory
**Then** VS Code opens it with the default markdown editor (no interception).

## Out of Scope

- Redesigning the spec viewer UI itself
- Adding new features to the spec viewer
- Changing the workflow editor for non-spec use cases (e.g., steering docs)
