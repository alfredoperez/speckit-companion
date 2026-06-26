# Sidebar Reference

Detailed reference for the SpecKit Companion sidebar. For an overview, see the [main README](../README.md#sidebar-at-a-glance).

## Spec groups

Specs are grouped into three collapsible sections based on their status (stored in `.spec-context.json`). Each group header displays a count, e.g. `Active (3)`, `Completed (12)`, `Archived (8)`.

- **Active** — Specs in progress, ordered by numeric prefix (newest first) by default, expanded by default. This group also holds **implemented** specs — ones where the pipeline finished the implement step but you have not yet confirmed them done. They stay in Active (not Completed) so the still-needs-your-Mark-as-Completed state stays visible, which matters most for stock specs that never auto-complete. They are told apart from in-progress specs by icon tint — see [Spec tree icons](#spec-tree-icons).
- **Completed** — Specs you have explicitly marked done (status `completed`), collapsed by default. An `implemented` spec does **not** appear here until you confirm it.
- **Archived** — Specs moved to archive, collapsed by default.

The Specs view title bar exposes **Filter**, **Sort**, an **Upgrade…** picker, a **collapse/expand all** toggle, and **Create New Spec** (rightmost). A **clear filter** icon appears only while a filter is active. The collapse/expand icon swaps to reflect the next action; state is in-memory only and is not persisted across sessions. The spec-kit upgrade commands are consolidated behind a single icon — see [Maintenance actions](#maintenance-actions) below.

## Filter and sort

**Filter specs** — click the filter icon in the Specs view title bar to open a prompt and fuzzy-filter specs by slug or feature name. Matches are case-insensitive and subsequence-based, e.g. `ftr` matches `filter-specs-tree`. The query is persisted to workspace state and restored on the next activation. A clear-filter icon appears next to the filter icon while a filter is active; an empty-result message offers a one-click clear when no specs match.

**Sort specs** — click the sort icon in the Specs view title bar to pick how specs are ordered within each group:

- **Number** (numeric prefix, default)
- **Name** (A–Z by slug or spec name)
- **Date Created** (newest first)
- **Date Modified** (most recently edited)
- **Status** (by workflow step)

Ties fall back to numeric prefix then name so output is deterministic. The chosen mode is persisted to workspace state; group order (Active → Completed → Archived) is fixed.

## Maintenance actions

The spec-kit upgrade commands are consolidated behind a single **Upgrade…** icon (`$(cloud-download)`) in the Specs view title bar. Clicking it opens a picker with three options. **Upgrade All** and **Upgrade Project** resolve the `--ai` agent from your configured `speckit.aiProvider` (see [`docs/how-it-works.md`](how-it-works.md)) and re-scaffold with `specify init --here --force`; **Upgrade CLI** only upgrades the globally installed spec-kit CLI.

- **Upgrade All** (`speckit.upgradeAll`) — upgrades the spec-kit CLI, then re-scaffolds the project. The "just do it" choice.
- **Upgrade Project** (`speckit.upgradeProject`) — re-runs `specify init` in place to refresh this workspace's scaffolding only.
- **Upgrade CLI** (`speckit.upgradeCli`) — upgrades only the globally installed spec-kit CLI.

The icon is visible when either spec-kit is detected in the workspace or the CLI is installed. All three individual commands remain available from the Command Palette under `SpecKit: Upgrade …`.

## Resume (inline action)

Resume is part of the **SpecKit Companion Workflow** beta, hidden by default. Enable `speckit.companion.speckitCompanionWorkflow` (Beta Features settings group) to show it; toggling the setting updates visibility immediately, with no window reload. The same setting also adds the Create-Spec workflow picker, so one switch turns on both. When enabled, active specs show an inline **Resume** action (`$(play)`) on hover. Clicking it dispatches `/speckit.companion.resume` for that spec: the pipeline continues from the recorded step — with prior decisions in scope — and the next command is dispatched to your configured AI provider in the family the spec has been running (`/speckit.companion.<step>` for Companion specs, `/speckit.<step>` for stock specs). Inside the implement step it continues at the next unchecked task. Resume appears only on active specs (active / tasks-done), not on completed or archived ones, mirroring the lifecycle. Once the dispatched step's capture hook writes state, the sidebar updates the row's step, badge, and last-transition line without a manual refresh.

## Set status… (recovery escape hatch)

If an out-of-order or double click ever leaves a spec stranded — the lifecycle buttons won't let you continue and the only fix used to be hand-editing `.spec-context.json` — **Set status…** gets it moving again. It's available on every spec row, both as a hover/inline action (`$(settings-gear)`) and in the right-click menu. Choosing it opens a picker of the eight canonical lifecycle statuses (specifying, specified, planning, planned, ready-to-implement, implementing, implemented, completed); pick one and confirm the `"Force status to {status}?"` prompt, and the spec is forced to that status. Forcing a working status also re-points the spec's current step to that status's own phase (e.g. forcing "planning" puts the spec back on the Plan step), so the viewer's continue buttons and the spinning step indicator line up with where you just said the spec is — that's what actually un-strands it, instead of leaving the badge claiming one thing while the buttons still act on the old step. The override goes through the same sanctioned writer the rest of the lifecycle uses — it records the change as a history event authored by you, never a raw JSON edit — and the sidebar refreshes immediately so the row reflects the new status. Because it bypasses the normal lifecycle gates, the confirm is always shown; a completed spec is only ever moved by your explicit pick, never silently downgraded.

## Step and last-transition on the row

Each spec row's description shows its **current step** and a one-line **last transition** (e.g. `plan — Plan started · 2h ago`), derived from the canonical append-only `history[]`. Relative time is measured from the most recent history entry, not from when the step started. Hovering shows the same in the tooltip alongside the status. Duplicate-named specs show their parent directory in the description instead, to disambiguate.

## Right-click and multi-select

Right-click a spec to access **Set status…**, **Mark as Completed**, **Archive**, **Reactivate**, **Delete**, **Reveal in File Explorer** (opens the spec's folder in Finder, File Explorer, or the default file manager), **Copy Path**, and **Copy Name**. Menu items reflect the spec's lifecycle group — e.g., "Reactivate" appears only on completed or archived specs. **Mark as Completed** appears on active, tasks-done, and **implemented** specs: an implemented spec sits in the Active group but still needs your confirmation, so right-clicking it offers Mark as Completed to flip it to confirmed-completed (without it, the only way to confirm was the viewer footer).

**Copy Path** copies the workspace-relative spec directory (e.g. `specs/089-copy-spec-path-name`) to the clipboard; **Copy Name** copies just the slug (e.g. `089-copy-spec-path-name`). Both show a brief auto-dismiss notification and live in a `9_clipboard` group below the modification and reveal entries — useful when referencing a spec in PRs, chat, or external tools. They appear on specs in any lifecycle (active, tasks-done, completed, archived) and are not shown on document children, related docs, or group headers.

**Multi-select** specs with shift-click or cmd/ctrl-click and bulk-archive, complete, or reactivate from the same right-click menu.

## Group header bulk actions

Right-click a group header to apply a lifecycle transition to every spec in the group at once. The visible items reflect the group:

- **Active** — *Mark all as Completed*, *Archive all*
- **Completed** — *Reactivate all*, *Archive all*
- **Archived** — *Reactivate all*

Each action shows a confirmation dialog of the form `"{Action} all {N} {group} specs?"` (e.g., `"Archive all 12 active specs?"`) before any `.spec-context.json` files are written. Specs already in the target status are silently skipped, and if the post-skip set is empty no dialog is shown. When a filter is active, the count reflects only the visible specs — the action operates exclusively on the visible set.

## Lifecycle button matrix

The spec viewer footer shows lifecycle buttons based on the spec's current status:

- **Active** (tasks incomplete): Regenerate, Archive, + primary CTA (Plan / Tasks / Implement depending on next step)
- **Active** (tasks 100% complete): Archive + Complete (primary)
- **Completed**: Archive + Reactivate
- **Archived**: Reactivate only

The lifecycle flow is **Active → Completed → Archived**, with **Reactivate** available on Completed and Archived specs to return them to Active.

## History logging

Every workflow step change is automatically recorded in the `history` array inside `.spec-context.json`. Each entry captures the previous step, new step, source (`extension`, `cli`, `ai`, or `user`), and timestamp. External changes (for example, from terminal CLI tools) are detected via file watcher and logged to the SpecKit output channel.

## Badge and dates

Both badge text and dates are derived from `.spec-context.json` (the single source of truth for workflow state):

- The **badge** in the metadata bar shows the current workflow state (e.g., `SPECIFYING`, `PLANNING`, `IMPLEMENTING`, `COMPLETED`). Hidden when no context exists.
- **Created** and **Last Updated** dates are derived from `history[]` timestamps (via the viewer's in-memory per-step timing). Gracefully omitted when context is missing or incomplete.
- Specs with only a `.spec-context.json` (no markdown files yet) still appear in the explorer, so in-progress specs are always visible.

## Header badge color tiers (since v0.13.0)

Every canonical status is mapped to a distinct color treatment so badges read at a glance without re-reading the label.

- **In-progress** (`SPECIFYING`, `PLANNING`, `TASKING`, `IMPLEMENTING`) — accent-tinted with a gentle border breath animation.
- **Intermediate-done** (`SPECIFIED`, `PLANNED`, `READY-TO-IMPLEMENT`, `COMPLETED`) — success-subtle (quiet green tint).
- **Idle** (`DRAFT`, `ARCHIVED`) — muted token, low visual weight.

## Spec tree icons

- Green beaker icon — confirmed-completed spec
- Yellow beaker icon — implemented spec (pipeline finished implement, awaiting your Mark-as-Completed confirmation); it sits in the Active group, where the tint distinguishes it from still-in-progress specs
- Blue beaker icon — spec with an active workflow step
- Green check — completed step (requires the step's file to exist on disk; a hand-crafted or out-of-sync `.spec-context.json` that claims completion without the file shows the default empty icon instead)
- Green pulsing glow — step actively being worked on
- Blue dot — current step

## Running steps

When a workflow step command is running for a spec, the spec node displays a spinning progress indicator instead of its default icon. Running steps also show a live elapsed timer (e.g. `3m 22s`) beneath the step label in the viewer, and a notification fires when a dispatched step finishes — toggle via `speckit.notifications.stepComplete`.

## Spec Explorer (living specs)

The **Spec Explorer** view is a project-wide home for *living specs* — the long-lived capability documents that describe how a part of your codebase behaves, separate from the per-feature specs in the Specs view above. It appears in the SpecKit activity-bar container **only when the companion spec-kit extension is installed** (`.specify/extensions/companion/` exists on disk); projects that don't use living specs never see it. It starts collapsed.

The tree has two groups:

- **Capabilities** — one node per capability defined in the `livingSpecs` block of `.specify/companion.yml`. Each node is labelled with the capability name and, as its description, where its spec lives: **centralized** (the default `capabilities/<name>/spec.md`) or **colocated** (an explicit `spec` path next to the code). A capability whose spec file doesn't exist yet is still listed, shown with a hollow icon and a `not created` note — it has no open action rather than a broken click. Expanding a capability reveals its **tiers**: the **Spec** itself, plus an **Architecture** and a **Coverage** child, each shown only when that sibling file exists on disk.
- **Orphans** — `*.spec.md` files in the project that no capability claims. The feature `specs/` folder, reserved tier siblings (`*.arch.md` / `*.coverage.md`), claimed spec paths, and any file inside a configured capability's folder are excluded, so only genuinely-unowned specs appear here. The group is omitted entirely when there are none.

Clicking any capability spec, tier, or orphan opens that file in the editor.

**Empty and hidden states.** When living specs are turned off (`livingSpecs.enabled` is not `true`) the view shows a calm `Living specs are turned off` message; when they're on but no capabilities or orphans are found it shows `No living specs yet`. Neither is an error. The view refreshes automatically when `.specify/companion.yml`, the `capabilities/` tree, or any `*.spec.md` changes on disk, and when the companion extension is installed or removed — no window reload required.
