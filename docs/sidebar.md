# Sidebar Reference

Detailed reference for the SpecKit Companion sidebar. For an overview, see the [main README](../README.md#sidebar-at-a-glance).

## Spec groups

Specs are grouped into three collapsible sections based on their status (stored in `.spec-context.json`). Each group header displays a count, e.g. `Active (3)`, `Completed (12)`, `Archived (8)`.

- **Active** — Specs in progress, ordered by numeric prefix (newest first) by default, expanded by default.
- **Completed** — Specs marked as done, collapsed by default.
- **Archived** — Specs moved to archive, collapsed by default.

The Specs view title bar exposes a **collapse/expand all** toggle (alongside the `+` and refresh buttons) that flips every spec in place between expanded and collapsed. The icon swaps to reflect the next action; state is in-memory only and is not persisted across sessions.

## Filter and sort

**Filter specs** — click the filter icon in the Specs view title bar to open a prompt and fuzzy-filter specs by slug or feature name. Matches are case-insensitive and subsequence-based, e.g. `ftr` matches `filter-specs-tree`. The query is persisted to workspace state and restored on the next activation. A clear-filter icon appears next to the filter icon while a filter is active; an empty-result message offers a one-click clear when no specs match.

**Sort specs** — click the sort icon in the Specs view title bar to pick how specs are ordered within each group:

- **Number** (numeric prefix, default)
- **Name** (A–Z by slug or spec name)
- **Date Created** (newest first)
- **Date Modified** (most recently edited)
- **Status** (by workflow step)

Ties fall back to numeric prefix then name so output is deterministic. The chosen mode is persisted to workspace state; group order (Active → Completed → Archived) is fixed.

## Right-click and multi-select

Right-click a spec to access **Mark as Completed**, **Archive Spec**, and **Reveal in File Explorer** (opens the spec's folder in Finder, File Explorer, or the default file manager).

**Multi-select** specs with shift-click or cmd/ctrl-click and bulk-archive, complete, or reactivate from the same right-click menu.

## Lifecycle button matrix

The spec viewer footer shows lifecycle buttons based on the spec's current status:

- **Active** (tasks incomplete): Regenerate, Archive, + primary CTA (Plan / Tasks / Implement depending on next step)
- **Active** (tasks 100% complete): Archive + Complete (primary)
- **Completed**: Archive + Reactivate
- **Archived**: Reactivate only

The lifecycle flow is **Active → Completed → Archived**, with **Reactivate** available on Completed and Archived specs to return them to Active.

## Transition logging

Every workflow step change is automatically recorded in the `transitions` array inside `.spec-context.json`. Each entry captures the previous step, new step, source (`extension` or `sdd`), and timestamp. External changes (for example, from SDD tools) are detected via file watcher and logged to the SpecKit output channel.

## Badge and dates

Both badge text and dates are derived from `.spec-context.json` (the single source of truth for workflow state):

- The **badge** in the metadata bar shows the current workflow state (e.g., `SPECIFYING`, `PLANNING`, `IMPLEMENTING`, `COMPLETED`). Hidden when no context exists.
- **Created** and **Last Updated** dates are derived from `stepHistory` timestamps. Gracefully omitted when context is missing or incomplete.
- Specs with only a `.spec-context.json` (no markdown files yet) still appear in the explorer, so SDD in-progress specs are always visible.

## Header badge color tiers (since v0.13.0)

Every canonical status is mapped to a distinct color treatment so badges read at a glance without re-reading the label.

- **In-progress** (`SPECIFYING`, `PLANNING`, `TASKING`, `IMPLEMENTING`) — accent-tinted with a gentle border breath animation.
- **Intermediate-done** (`SPECIFIED`, `PLANNED`, `READY-TO-IMPLEMENT`, `COMPLETED`) — success-subtle (quiet green tint).
- **Idle** (`DRAFT`, `ARCHIVED`) — muted token, low visual weight.

## Spec tree icons

- Green beaker icon — completed spec
- Blue beaker icon — spec with an active workflow step
- Green check — completed step
- Green pulsing glow — step actively being worked on
- Blue dot — current step

## Running steps

When a workflow step command is running for a spec, the spec node displays a spinning progress indicator instead of its default icon. Running steps also show a live elapsed timer (e.g. `3m 22s`) beneath the step label in the viewer, and a notification fires when a dispatched step finishes — toggle via `speckit.notifications.stepComplete`.
