# Spec: Clickable File References in Spec Viewer

**Branch**: 013-clickable-file-refs | **Date**: 2026-02-27

## Summary

Inline code spans in the spec viewer that contain text matching a workspace filename pattern (e.g. `card.component.ts`, `utils/helpers.ts`) should be rendered as clickable links. Clicking opens the file in the VS Code editor beside the viewer panel.

## Requirements

- **R001** (MUST): Inline code spans whose content matches a filename pattern (has a file extension, optionally with a path) must be rendered as a clickable anchor/button instead of plain `<code>`.
- **R002** (MUST): Clicking a file reference link sends a message to the extension which searches the workspace for the file and opens it in `ViewColumn.Beside`.
- **R003** (MUST): If no matching file is found in the workspace, show a VS Code warning notification and do not throw.
- **R004** (SHOULD): File references must be visually distinct from regular inline code (e.g. underline or link color) but retain `<code>`-style monospace font.
- **R005** (SHOULD): Non-filename inline code (e.g. `` `const x = 1` ``, `` `npm install` ``) must not be affected and must continue rendering as plain `<code>`.

## Scenarios

### Filename in inline code opens the file

**When** a spec contains `` `card.component.ts` `` and the user clicks the rendered code span
**Then** VS Code opens `card.component.ts` in the editor column beside the spec viewer

### File with relative path is resolved

**When** a spec contains `` `src/utils/helpers.ts` `` and the user clicks it
**Then** the extension searches the workspace for `**/helpers.ts` (using the basename) and opens the first match

### No match found in workspace

**When** the user clicks `` `nonexistent-file.ts` `` and no such file exists in the workspace
**Then** a warning notification appears: "File not found in workspace: nonexistent-file.ts"

### Non-filename code is unaffected

**When** a spec contains `` `npm install` `` or `` `const x = 1` ``
**Then** the span renders as a plain `<code>` element without link styling or click behaviour

## Out of Scope

- Fuzzy or partial filename matching beyond glob `**/basename`
- Hover tooltips showing file path previews
- Support for filenames without extensions (e.g. `Makefile`, `Dockerfile`)
- Multi-match disambiguation UI (first match is opened silently)
