# Spec: Viewer Header Layout

**Slug**: 073-viewer-header-layout | **Date**: 2026-04-22

## Summary

Restructure the spec viewer header into two visual rows — a badges row (status + branch) and a title row — and hide the file-name pill (e.g. `spec.md`) that currently renders below the divider. The current single flex-wrap row puts the status badge, title, and branch badge side-by-side, which makes long titles cramped and surfaces redundant filename chrome.

## Requirements

- **R001** (MUST): The structured header renders in two visual rows: row 1 contains the status badge and branch badge; row 2 contains the document title (`{DocType}: {Name}`).
- **R002** (MUST): The file-name pill generated from `**Spec**:` / `**Plan**:` metadata links (`.spec-file-link` / `.spec-file-ref`) is not rendered in the viewer.
- **R003** (MUST): When neither a badge nor a specContextName nor a createdDate is present, the header still renders nothing (preserve the existing empty-state behavior at `SpecHeader.tsx:18`).
- **R004** (MUST): The existing rule that hides the first `#` heading when the structured header is active continues to work (`.spec-header[data-has-context="true"] ~ #markdown-content h1:first-of-type { display: none }`).
- **R005** (SHOULD): The Created-date element remains visible and legible; placement may sit with the title row or as an inline meta element, but must not reintroduce a third dominant row.
- **R006** (SHOULD): Visual styling of the status badge and branch badge (colors, border, typography) is preserved; only their layout placement changes.
- **R007** (MUST): The step tab that is currently being viewed shows a clear visual marker (restored outline + accent label) so users can identify which step the viewer is on at a glance.
- **R008** (MUST): The green ✓ completion indicator on a step tab is **not** removed when that tab is the one being viewed — a step that has both completed and is being viewed displays the ✓ and the "current" marker together.

## Scenarios

### Header with status badge, title, and branch

**When** a spec is open and `.spec-context.json` provides status, specName, and branch
**Then** the viewer renders row 1 with the status badge on the left and the branch badge after it, and row 2 with `{DocType}: {Name}` as the title — the file-name pill below the divider is not shown

### Header with only title (no status)

**When** a spec has no derivable status badge but has a specName
**Then** row 1 is empty (or collapses) and the title still renders on its own row; the branch badge, if present, appears in row 1

### Completed / archived spec

**When** `body[data-spec-status]` is `completed`, `archived`, or `tasks-done`
**Then** the status badge uses its existing colored style and sits in row 1 as usual — the two-row layout does not regress badge coloring

### File-name pill suppression

**When** the underlying markdown contains `**Spec**: [spec.md](./spec.md)` or `**Plan**: [plan.md](./plan.md)` metadata lines
**Then** the preprocessor no longer emits the `.spec-file-link` pill block in the rendered HTML

### Viewed step retains completion indicator

**When** a user clicks a completed step tab (`stepDocExists === true`) and it becomes the viewed tab
**Then** the tab shows both the green ✓ (done state) and a visible "currently viewed" outline/accent — neither marker hides the other

## Out of Scope

- Changes to the stepper, footer action buttons, or non-header viewer regions
- Changes to how `.spec-context.json` is populated or read
- Reworking the markdown metadata preprocessor beyond suppressing the file-name pill output
