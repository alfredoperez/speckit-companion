# Spec: Stale Warning Banner

**Slug**: 025-stale-warning-banner | **Date**: 2026-03-26

## Summary

Warn users when downstream workflow artifacts (plan, tasks) are outdated relative to their upstream artifact (spec) by showing a dismissible warning banner and tab badges. This prevents the most common spec-driven development mistake: implementing from stale documents after a spec has been regenerated.

## Requirements

- **R001** (MUST): Compare file modification timestamps across the workflow chain (spec → plan → tasks). If any upstream file has a strictly newer `mtime` than a downstream file, mark the downstream file as stale.
- **R002** (MUST): Display a yellow/orange warning banner between the navigation bar and content area when viewing a stale document. Banner must include a contextual message (e.g., "Plan was generated before the current spec") and a "Regen" action button.
- **R003** (MUST): Show a `!` stale badge on tab buttons in the navigation bar for any stale document, visible regardless of which tab is active.
- **R004** (MUST): The "Regen" button in the banner must trigger the same regeneration behavior as the existing footer "Regenerate" button for that step.
- **R005** (MUST): Staleness indicators (banner + badges) must auto-update when file changes are detected (via the existing file watcher / `updateContent` flow).
- **R006** (SHOULD): Staleness detection must use `vscode.workspace.fs.stat()` to read `FileStat.mtime` for each workflow document.
- **R007** (SHOULD): Support custom workflows with N steps — staleness cascades so step N is stale if ANY of steps 1 through N-1 have a newer mtime.

## Scenarios

### Viewing a stale plan

**When** user clicks the "Plan" tab and `spec.md` has a newer mtime than `plan.md`
**Then** a warning banner appears: "Plan was generated before the current spec. Consider regenerating." with a [Regen] button, and the Plan tab shows a `!` badge.

### Viewing the upstream spec

**When** user views `spec.md` (the first workflow step)
**Then** no banner is shown (upstream docs are never stale).

### Tasks stale due to plan regeneration

**When** `plan.md` has been regenerated (newer mtime) but `tasks.md` has not
**Then** the Tasks tab shows a `!` badge, and viewing Tasks shows the banner referencing the plan.

### Cascading staleness

**When** `spec.md` is regenerated (newer than both plan and tasks)
**Then** both Plan and Tasks tabs show `!` badges. Viewing either shows the appropriate banner.

### Regenerating clears staleness

**When** user clicks "Regen" on the stale banner (or uses footer Regenerate)
**Then** the document is regenerated, file watcher detects the update, staleness is recalculated, and the banner disappears if the doc is no longer stale.

### File does not exist

**When** a downstream document does not exist yet (no file on disk)
**Then** it is NOT marked as stale — it's simply empty/missing.

### Multiple panels

**When** two spec viewer panels are open for different specs
**Then** each panel tracks staleness independently for its own spec directory.

## Out of Scope

- Staleness detection for related docs (research.md, contracts.md, etc.) — only core workflow documents participate.
- Content-based diff detection (only file mtime is used).
- Persisting staleness state across VS Code restarts — it's recomputed on each panel open/refresh.
- Inline diff or changelog showing what changed in the upstream document.
