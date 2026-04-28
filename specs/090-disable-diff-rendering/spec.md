# Spec: Disable Rendering in Diff View

**Slug**: 090-disable-diff-rendering | **Date**: 2026-04-27

## Summary

The `speckit.workflowEditor` custom editor intercepts every open of `**/specs/**/*.md` and redirects to the SpecViewer panel, which breaks VS Code's git diff view — users see the rendered spec instead of the textual diff. The fix is to skip the redirect when the open is part of a diff/non-`file` URI context, letting VS Code fall back to its built-in text editor so the diff renders normally.

## Requirements

- **R001** (MUST): When `WorkflowEditorProvider.resolveCustomTextEditor` is invoked for a document whose URI scheme is not `file` (e.g. `git:`), it must NOT execute `speckit.viewSpecDocument` and must NOT dispose itself in a way that disrupts the host diff editor.
- **R002** (MUST): When the active tab at invocation time is a diff input (`vscode.TabInputTextDiff`), the redirect must be skipped for both sides of the diff (working-tree `file:` side and HEAD `git:` side).
- **R003** (MUST): The normal flow — clicking a spec markdown file in the explorer or SCM file label so it opens as a single editor — must continue to redirect to the SpecViewer (no regression to existing behavior).
- **R004** (SHOULD): When the redirect is skipped, the custom editor webview should display the document's raw markdown text as plain text so the user is never left with an empty panel if VS Code does land on the custom editor in a diff context.

## Scenarios

### Opening a spec from the file explorer

**When** the user clicks `specs/042-foo/spec.md` in the file explorer or specs sidebar
**Then** the SpecViewer webview panel opens (existing behavior preserved)

### Opening git diff for a modified spec

**When** the user clicks the diff icon in Source Control for a modified `specs/042-foo/spec.md`
**Then** VS Code's text diff editor opens showing left (HEAD) and right (working tree) versions as plain text, and the SpecViewer panel does NOT pop open

### Opening a HEAD version directly

**When** another extension or command opens a document with scheme `git:` for a spec markdown file
**Then** the workflow editor does not redirect to the SpecViewer

## Out of Scope

- Adding a "show diff" affordance inside the SpecViewer itself.
- Changing how the SpecViewer renders specs in normal (non-diff) flow.
- Supporting custom diff rendering of specs (side-by-side rendered preview).
