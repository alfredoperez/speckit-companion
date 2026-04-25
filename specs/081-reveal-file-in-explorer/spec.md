# Spec: Reveal File In Explorer

**Slug**: 081-reveal-file-in-explorer | **Date**: 2026-04-25

## Summary

Spec 069 added `speckit.specs.reveal` and wired it to the right-click menu on **spec folder** nodes (`viewItem == spec`). Right-clicking a **file** node inside a spec (`spec.md`, `plan.md`, `tasks.md`, or related docs) currently shows no equivalent reveal option — the user has to manually walk up to the parent spec to use it. This spec extends the existing `speckit.specs.reveal` command to handle file nodes too, so right-clicking any tree item yields a "Reveal in File Explorer" entry that highlights that exact item in Finder / Explorer.

## Requirements

- **R001** (MUST): Right-clicking a `spec-document-*` node (`spec`, `plan`, `tasks`, or any workflow-step-named document) in the SpecKit specs tree shows a "Reveal in File Explorer" context-menu entry.
- **R002** (MUST): Right-clicking a `spec-related-doc` node (e.g., `research.md`, `quickstart.md`) shows the same entry.
- **R003** (MUST): Clicking the entry on a file node calls VS Code's built-in `revealFileInOS` with the *file's* URI (not the parent folder), so the file is highlighted/selected in Finder (macOS) or Explorer (Windows) / native file manager (Linux).
- **R004** (MUST): Behaviour for `viewItem == spec` (spec-folder nodes) is unchanged — still reveals the spec directory.
- **R005** (SHOULD): If the file no longer exists on disk (e.g., deleted), show a friendly error "Cannot reveal: {path} does not exist" — same behaviour the current handler already has for missing folders.

## Scenarios

### Reveal a core spec document

**When** the user right-clicks `spec.md` under a spec in the SpecKit explorer tree and selects "Reveal in File Explorer"
**Then** Finder opens with `specs/{NNN}-{slug}/spec.md` highlighted/selected.

### Reveal a related document

**When** the user right-clicks `research.md` (a related doc shown as a child of a step) and selects "Reveal in File Explorer"
**Then** Finder opens with that file highlighted.

### Reveal an empty/uncreated document

**When** the user right-clicks a `spec-document-*` node whose file doesn't exist yet (e.g., `plan.md` with description "not created")
**Then** an error toast shows "Cannot reveal: {absolute path} does not exist". No fallback to parent folder.

### Reveal a spec folder (existing behaviour)

**When** the user right-clicks a spec node (the folder root) and selects "Reveal in File Explorer"
**Then** Finder opens with the spec directory highlighted — exactly as 069 already does.

## Out of Scope

- New command identifier — reuse `speckit.specs.reveal` from 069.
- Multi-select reveal — single-item action only (matches 069).
- Linux-specific tweaks beyond what `revealFileInOS` already provides (xdg-open behaviour is upstream's concern).
