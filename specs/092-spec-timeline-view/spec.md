# Spec: Per-Spec Timeline View

**Slug**: 092-spec-timeline-view | **Date**: 2026-04-28

## Summary

Surface the chronological history of every spec — specify, plan, tasks, implement, done, archive — as a vertical timeline inside the spec viewer. The data already lives in `.spec-context.json` under `transitions`, but inspecting it today means opening the JSON file. This spec adds a first-class UI for that history so a contributor can answer "when did this spec move through each phase?" at a glance, without leaving the viewer. Closes [#110](https://github.com/alfredoperez/speckit-companion/issues/110).

## Requirements

- **R001** (MUST): The spec viewer renders a vertical timeline of transitions for the currently open spec, sourced from the spec's `.spec-context.json` `transitions` array.
- **R002** (MUST): Each timeline entry shows the step name (`specify`, `plan`, `tasks`, `analyze`, `implement`, `done`), the substep (when present), the actor (`by`: `extension` / `user` / `cli` / `sdd`), and the timestamp.
- **R003** (MUST): Timestamps render in two formats — a relative form ("3 hours ago", "2 days ago") that is the primary glance value, and an absolute ISO-local form available on hover/title attribute.
- **R004** (MUST): The timeline is reachable from the spec viewer with a single interaction (e.g. a header button, navigation-bar entry, or dedicated tab). The exact placement is decided in `/sdd:plan` and must not require leaving the spec or opening the JSON file.
- **R005** (MUST): Entries are ordered chronologically with the oldest at the top and the newest at the bottom, so a top-down read tells the spec's lifecycle story in order.
- **R006** (MUST): Empty transitions (missing or zero-length array) render a clear empty state ("No transitions recorded yet") rather than a blank panel.
- **R007** (SHOULD): Each entry is visually anchored to its step — color and icon match the step badge already used in the navigation bar / step tabs — so a reader can scan by step without reading text.
- **R008** (SHOULD): The timeline updates live when `.spec-context.json` changes on disk (existing file watcher fires when another `/sdd:*` skill, the CLI, or the user writes a new transition). The user does not need to reload the viewer.
- **R009** (SHOULD): Multiple substep entries that share a step group together — indented under or collapsible inside a single step heading — so the macro story (specify → plan → tasks → implement → done) stays scannable when there are many substep rows.
- **R010** (SHOULD): The actor (`by`) is shown with a small affordance (badge or icon) so externally-triggered transitions ("by: cli") are visually distinguishable from extension-triggered ones ("by: extension").
- **R011** (MAY): The timeline annotates non-transition lifecycle events that are already recorded in `.spec-context.json` (e.g. `prUrl` first set, `archived: true`) when they can be inferred without storing additional state.

## Scenarios

### Open timeline on an in-progress spec

**When** the user opens a spec at the `implement` step whose `.spec-context.json` has six transitions logged (specify → plan → tasks → implement → implement:phase1 → implement:code-review)
**Then** the timeline shows six entries, top-to-bottom oldest-first, each labelled with step + substep + actor + relative timestamp

### Hover reveals absolute timestamp

**When** the user hovers the relative-time text "2 days ago" on the specify entry
**Then** a tooltip reveals the absolute timestamp (e.g. `2026-04-26 16:02:51`) so they can correlate with logs or commits

### Live update from external write

**When** the timeline is open for spec `092-spec-timeline-view` and another process appends a transition to `.spec-context.json` (e.g. `/sdd:plan` running in a terminal)
**Then** the timeline appends the new entry within a short interval without the user reloading the spec viewer

### Spec with no transitions yet

**When** the user opens the timeline on a spec whose `.spec-context.json` has an empty or missing `transitions` array
**Then** the panel shows an empty state ("No transitions recorded yet") instead of a blank area

### Substep grouping under a step

**When** the specify step recorded four substeps (parsing, exploring, detecting, writing-spec) before transitioning to tasks
**Then** the four specify substeps appear grouped under one specify heading — indented or collapsible — so the high-level lifecycle stays one row per step

### Externally-triggered transition is distinguishable

**When** the timeline contains a transition with `by: "cli"` next to one with `by: "extension"`
**Then** the user can tell at a glance which transition came from outside the extension (small badge / icon / muted label), without reading the field

## Non-Functional Requirements

- **NFR001** (MUST): Reading the transitions array must reuse the existing `.spec-context.json` reader (`specContextReader`) — no parallel parser. Unknown / legacy fields must be preserved per the canonical type contract.
- **NFR002** (MUST): The timeline UI uses VS Code theme variables (`--vscode-*`) so dark, light, and high-contrast themes all render correctly without per-theme overrides.
- **NFR003** (SHOULD): Timeline rendering must not block initial spec content render — render lazily (on first reveal of the timeline) if it would noticeably delay the markdown view.
- **NFR004** (SHOULD): Live updates piggyback on the existing file watcher used by `specContextReader` / `fileWatchers`; no new polling loop.

## Out of Scope

- Editing or deleting transition entries from the UI. The timeline is read-only — `.spec-context.json` stays the source of truth.
- A cross-spec timeline ("what happened across all specs this week"). This spec is one spec at a time.
- Exporting the timeline (CSV, markdown, image). Revisit if users ask.
- Changing the on-disk transition schema or how `/sdd:*` skills emit transitions. The timeline reads what's already written.
- A per-task timeline (when each `T###` started/finished). The transitions array doesn't track that today; out of scope until/unless task-level tracking lands separately.
- Filtering / searching the timeline. Specs typically have <30 transitions; revisit only if real specs grow past that.
