# Spec Viewer Reference

The behaviors of the Visual Spec Viewer in detail: reading, reviewing, creating, and the guardrails around destructive actions. For the footer's full state matrix see [viewer-states.md](./viewer-states.md); for the sidebar see [sidebar.md](./sidebar.md).

## Spec-driven phases

Each feature flows through four phases, each a one-click footer action in the viewer:

- **Specify**: define requirements with user stories and acceptance scenarios before any code is written.
- **Plan**: create the technical design (architecture, data models, and research) grouped under one step with sub-document chips.
- **Tasks**: generate an implementation checklist with parallel-execution markers and live progress.
- **Done**: mark the spec complete (or archive it) once implementation lands.

After each action, a toast confirms the result and the viewer auto-advances to the next phase.

## Reading specs

The spec viewer renders specs as rich, structured pages: requirements as labeled rows, acceptance scenarios as clean Given/When/Then sentences, key entities and research decisions as cards, and tasks grouped under their phases. It is built for fast scanning of long-form specs:

- **Title-leading header**: the spec name dominates above a compact `[STATUS] [⌥ branch] · date` cluster, so the page anchor is the first thing your eye lands on. The status badge only carries hover text when the hover adds something the badge doesn't already say.
- **Living specs get capability facts instead**: a living spec has no branch, date or task progress, so its header carries what a capability actually has: its title taken from the document's own heading (so a name like `SpecKit Extension Capture` survives instead of the folder slug), then how many requirements and scenarios it declares, its `N/M covered` test coverage, a `drift` marker (with an **Update** button that folds the changed code back into the spec) when the code moved on since the spec was last committed, the file patterns it claims, and where the spec file lives. Coverage and drift are the same numbers the Living Specs sidebar shows. The claimed patterns answer "why did this spec load for this change?" without opening the registry.
- **Living specs read as components, not a wall of markdown**: when a living spec opens, its repeating structures get scannable treatment so you can size up a draft before reading it. A **draft notice** at the top marks a surface-first draft as a starting point rather than a verified record, a **purpose callout** gives the reason the capability exists the weight to be read first, each requirement renders as a **card** (in authored order, exact wording) with a quiet `inferred` badge only where the spec says so and coverage only where it's known (never a bare `0`), scenario steps separate the **WHEN** condition from the **THEN/AND** outcomes, and the **Uncovered** section opens with a count and groups the files a draft didn't fully read into disclosures you open on demand. Ordinary feature specs are untouched, and anything a component doesn't recognize falls back to plain markdown, so the page always renders.
- **Document rail**: the shell puts the workflow's documents on a vertical rail. The selected document sits on a lifted surface while separate completion marks (done check, in-flight spinner + live percent, pending dot) tell you how far along the run is, so "where am I reading" and "how far along is the run" never share one visual. The rail lists documents only: action steps like Implement and Mark Complete get no entry (their actions live in the footer), and a running implement shows its live percent on the Tasks tab. On narrow panes the rail folds into a horizontal chip strip.
- **Artifacts on the rail**: a step's sub-files (e.g., Plan's `data-model.md`, `quickstart.md`, `research.md`, or a custom workflow's free-named outputs) group under their owning step on the rail, always visible, one click from anywhere.
- **Table of contents**: sticky outline column on the right of the content area. Defaults to h2-only (so phase-heavy `tasks.md` reads as a clean ~7-entry list); a small `+` toggle expands h3 subsections when needed. Auto-hides on narrow panes.
- **Quiet content**: when the structured header has the metadata, in-content duplicates (the `Input:` block, repeated branch chips, literal `Slug:`/`Date:` paragraphs) are suppressed so the body is just the spec content.
- **Diagrams**: mermaid diagrams render inline. Wide diagrams scroll horizontally inside the prose column instead of bleeding past it, and each diagram has its own `−` / Reset / `+` zoom controls.
- **Quiet, intentional footer**: a floating action pill (bottom-right) surfaces only what fits the moment, led by a context line naming the next action: `Regenerate` plus a forward button labelled with the next phase (`Plan` / `Tasks` / `Implement` / `Complete`). While a step generates, the forward button is withdrawn entirely and the context line says the step is running and actions unlock when it settles, so the footer never advances ahead of the work. `Archive` and `Mark Completed` appear only once the spec is closure-eligible (`ready-to-implement` and beyond). See [viewer-states.md](./viewer-states.md) for the full footer state matrix.
- **Optional SpecKit commands per tab**: SpecKit's three refinement commands surface as one-click footer buttons where each is most useful: **Clarify** on Spec, **Checklist** on Plan, **Analyze** on Tasks. No configuration required; a custom command with the same id wins. They disappear once the spec reaches the closure gate.

## Inline review comments

Review spec documents with inline comments. Hover a line and click `+` (or tab to it; the control appears on keyboard focus) to leave a review comment. Add feedback directly on specific lines, refine requirements, and collaborate on specs before implementation begins.

Each comment is **persisted to the spec's `.spec-context.json` the moment you add or remove it**, not only when you refine, so an in-progress review survives closing the tab, is committable, and can be picked up later (next session, another machine, or another reviewer after a pull). When you click the **Refine** button, that document's pending comments are dispatched to the AI for a direct, in-place edit of the source and then marked *applied* (kept as history, no separate files).

**Restore is resilient.** Reopen a spec and every pending comment is restored inline, anchored to its source location. A comment remembers its nearest heading and surrounding block, so if the source drifted (a line moved or was edited) it best-effort re-anchors to the nearest matching heading rather than being dropped. A comment is never silently lost.

**Comments annotate, they don't interrupt.** A saved comment rests as one quiet line under the line it's about: a glyph, the comment truncated to a single line, and its state (**Pending** or **Applied**). Open it (click, or Enter/Space when focused) to read it in full and act on it: **Refine** hands that document's pending comments to the AI, **Edit** reopens the composer pre-filled, and **Delete** removes it. Nothing is destructive-by-proximity; there is no permanent `×`. Applied comments stay on their line as a record of what was already asked and are never counted in the Refine badge. On a completed or archived spec, comments stay readable and none of the actions are offered.

**One storage surface, one overview surface.** Comments live entirely in `.spec-context.json`; the old per-document `<doc>-extra.md` scratchpad files and the read-only "Notes" sub-tab have been removed. The overview surface is the Overview's *Review comments* card: a consolidated list across spec/plan/tasks with per-comment status, jump-to-line, and a per-document **Run refinement** action. The inline surface stays the always-on primary path; with the Overview unavailable (setting off or no activity), inline comments still work and still persist.

## Overview: the run's story

A spec with recorded activity **lands on its Overview**: a **durable-context dossier** of everything `.spec-context.json` carries, ordered by what a future session needs. It sits at the top of the document rail as a destination like any other, so moving between it and a document is one click either way. The one-line **run strip** above the content keeps the frequently scanned facts (phase, tasks, requirements traced to tests, checks, concerns, honest active time, PR link) in view in both. A spec whose context holds only a work log opens on its documents instead:

- **Intent**: why the spec exists, set as a lead summary line beneath the header title, with the approach, working area, and sizing beside it.
- **Expectations**: the fence around the work: constraints that must stay true paired with the deliberately out-of-scope list, as peers.
- **Verified**: a ledger of what was checked. Each check keeps its result and evidence command visually connected (warnings surface amber).
- **Decisions**: numbered choices future work should not have to rediscover, each with its reasoning and the rejected alternative.
- **Coverage**: a requirement to task to test traceability table (untraced requirements lead; the full list sits behind a disclosure), plus any open concerns.
- **Run log**: the how-it-happened detail (latest activity, phase timeline, per-task records, files touched, review comments, living specs) collapsed at the bottom. It describes how the run went, so it doesn't outrank why it happened.

Old specs without the newer capture degrade gracefully: only the sections whose data exists render, and a spec with no `.spec-context.json` at all simply has no Overview entry. Visibility is gated by the boolean `speckit.viewer.activityPanel` setting (default on); turning it off makes every spec open directly on its documents.

![Activity Panel](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/activity.png)
*The hero answers "how did the run stand" at a glance: status, honest active time, tasks, coverage, checks. The Plan states the intent, the context the run worked from, and what was explicitly out of scope.*

## Creating specs visually

Create new specs with a dedicated dialog. Write a detailed description, select your workflow, and attach screenshots or mockups for context. The form is a centered, readable-width column with persistent writing guidance below the field, and the **Create Spec** button stays disabled until you've written something.

When the **SpecKit Companion** workflow is selected, an **Auto** button appears next to it that builds the whole spec hands-off. It walks specify, plan, tasks, implement, and completion on its own, with no approval pauses in between, for when you want to describe what you need and walk away. Pick **Create Spec** for the normal step-by-step flow, or **Auto** to run the whole pipeline. (Auto needs the companion spec-kit extension; without it the button warns, and with stock SpecKit selected only Create Spec appears. The step-by-step flow always stays available.)

The dialog is built for keyboard and screen-reader use: errors, in-progress submission, and image attach/remove are announced, every control has a visible focus ring and a meaningful name, the character limit is conveyed beyond color (and over-limit content can't be submitted), and pressing Esc with typed content asks before discarding.

## Safety affordances for destructive actions

Actions that change the spec's lifecycle are protected so a misfired click is easy to walk back:

- **Regenerate** queues behind a 5-second undo toast. Clicking **Undo** or pressing **Esc** cancels the regeneration; otherwise the backend fires when the timer elapses.
- **Archive**, **Complete**, and **Reactivate** each require two clicks. The first click swaps the button label to **"Confirm?"** for 3 seconds; a second click within that window confirms. Otherwise the label reverts silently and nothing happens.
- **Locked future steps**: while a step is running, downstream step tabs lock and surface a tooltip explaining why, so dispatched work cannot be interrupted by an out-of-order click.
- The OS-level **Reduce Motion** preference is honored globally. In-flight step pulses and other infinite animations stop when it's enabled.

## Offline-first UI

Fonts (Geist Variable) and icons (codicons) ship bundled inside the extension `.vsix`. The spec viewer and spec editor render identically on a plane with no internet connection. No runtime requests to CDNs for fonts or icon glyphs.
