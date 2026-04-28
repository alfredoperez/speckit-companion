# Spec: Disable Rendering in Diff View

**Slug**: 090-disable-diff-rendering | **Date**: 2026-04-27

## Summary

The `speckit.workflowEditor` custom editor was registered as the default for every `**/specs/**/*.md` open and unconditionally redirected to the SpecViewer panel. That broke VS Code's git diff editor and overrode the user's expected behavior in the regular file explorer. The fix removes the custom editor entirely — the SpecViewer is now reachable only via the SpecKit sidebar (which already calls `speckit.viewSpecDocument` directly), so file-explorer and Source Control flows fall through to VS Code's built-in editors.

## Requirements

- **R001** (MUST): Clicking a modified spec markdown file in the Source Control panel must open VS Code's text diff editor with no SpecViewer popup.
- **R002** (MUST): Clicking a spec markdown file in VS Code's regular File Explorer must open the file as plain markdown source in the standard text editor — no auto-redirect to SpecViewer.
- **R003** (MUST): Clicking a spec entry in the SpecKit sidebar must continue to open the SpecViewer panel (the explorer tree command path uses `speckit.viewSpecDocument` directly and is unaffected).
- **R004** (MUST): The extension must still activate cleanly without the `onCustomEditor:speckit.workflowEditor` activation event — `onStartupFinished` is sufficient.
- **R005** (SHOULD): The orphaned `speckit.workflowEditor.enabled` configuration setting should be removed so users don't see a no-op toggle.

## Scenarios

### Source Control diff for a modified spec

**When** the user clicks a modified `specs/*/spec.md` in the SCM Changes list
**Then** VS Code's text diff editor opens with HEAD on the left and working tree on the right; no SpecViewer panel appears

### File Explorer click on a spec

**When** the user opens `specs/042-foo/spec.md` from VS Code's regular file explorer
**Then** the file opens in the standard markdown text editor

### SpecKit sidebar click

**When** the user clicks a spec in the SpecKit sidebar tree
**Then** the SpecViewer panel opens (existing direct-command path preserved)

## Out of Scope

- Adding a "show diff" affordance inside the SpecViewer.
- Changing how the SpecViewer renders specs.
- Adding a right-click "Open as SpecViewer" command on plain `.md` files (none currently exists).
