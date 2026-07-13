# Feature Specification: Adopt the Codex Redesign in the Spec Viewer

**Feature Branch**: `394-adopt-codex-design`
**Created**: 2026-07-13
**Status**: Draft
**Input**: Adopt the Codex redesign proposal (the winning entry of the multi-provider design investigation, currently living as Storybook stories under `webview/src/spec-viewer/__redesign__/codex/`) into the shipped spec viewer, without breaking any current functionality: status reactivity, markdown content rendering, custom workflows, living specs, themes, Activity data, TOC, and message-driven navigation must all keep working.

## Overview

The spec viewer earned a redesign investigation, two AI providers proposed competing directions on real spec data, and the Codex proposal won. It exists today only as Storybook stories: an owned light/dark palette, a small component library, an "Overview-first" shell where the run's captured story is the landing view, a data-display skin that treats a spec as structured operational data, and a centered three-column reading layout. This feature moves that design from stories into the product. The hard requirement is that the redesign is a reskin-and-relayout of the same living machine — every behavior the viewer has today (reacting to run status, rendering every kind of spec content, following custom workflows, both themes, review comments) must survive the adoption unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read any spec in the new design without losing content (Priority: P1)

A developer opens any spec document — specification, plan, tasks, research, data model, quickstart, checklist, or contract — and sees the Codex treatment: bounded story sections, compact requirement scan rows, decision cards, semantic completion colors, real tables, and code on an owned high-contrast surface. Nothing that rendered before is missing or unreadable, in either the light or dark editor theme.

**Why this priority**: Content fidelity is the floor. A redesign that drops or degrades any content type is a regression, not an upgrade.

**Independent Test**: Open the committed demo specs and a rich real spec (392/172) on each document type, in both themes, and compare against the current viewer for content completeness and readability.

**Acceptance Scenarios**:

1. **Given** a spec containing user stories, requirements, entities, checklists, technical context, constitution rows, decisions, callouts, tables, code blocks, and task lines, **When** it renders in the redesigned viewer, **Then** every one of those content types is visible and styled by the new design, with none falling back to broken or unstyled markup.
2. **Given** the light editor theme, **When** any document renders, **Then** headings, body text, metadata, status colors, and code are readable (no washed-out text, no dark-only code island).
3. **Given** a document with an empty metadata bar or template-instruction comments, **When** it renders, **Then** those remnants are hidden from the reading view.

### User Story 2 - The viewer still reacts to the run lifecycle (Priority: P1)

A developer works a spec through its lifecycle — specifying, specified, planning, planned, creating tasks, ready to implement, implementing, implemented, completed, archived — and the redesigned shell reflects every state exactly as the current viewer does: the status badge, the step completion marks, the in-flight indicators, and the footer/CTA affordances all change at the same moments they do today.

**Why this priority**: Lifecycle reactivity is the product. The viewer is a companion to a live run, not a markdown preview; breaking a single state transition breaks the core promise.

**Independent Test**: Walk the committed demo fixtures (one per canonical state) plus a live run, and check each state against the documented state machine for badge text, step marks, and available actions.

**Acceptance Scenarios**:

1. **Given** a spec at each canonical status, **When** the viewer opens it, **Then** the badge, step completion marks, and primary/secondary actions match the documented state machine for that status.
2. **Given** a running step, **When** the run progresses (context file updates), **Then** the in-flight indicator, task completion counts, and Activity data update live without reopening the viewer.
3. **Given** a decision point (a step finished, approval pending), **When** the viewer renders, **Then** the primary call-to-action carries the workflow-derived next-step label and triggers the same dispatch it does today.

### User Story 3 - The run's story is the front page (Priority: P2)

A developer opens a spec that has recorded activity and lands on the Overview: the captured intent, context, boundaries, decisions, evaluation, coverage, and work evidence — presented in the Codex activity design with the long approach text progressively disclosed. The documents remain one click away on a persistent rail, and the old hidden Activity toggle disappears as a concept.

**Why this priority**: This is the redesign's biggest structural improvement, but it depends on Stories 1–2 being solid first.

**Independent Test**: Open a completed rich spec and a mid-run spec; confirm the landing view is the Overview with real captured data, and every document is reachable from the rail.

**Acceptance Scenarios**:

1. **Given** a spec with recorded history, decisions, and verification, **When** the viewer opens, **Then** the Overview is the default view and shows that captured data.
2. **Given** a spec with no recorded activity, **When** the viewer opens, **Then** it lands on a sensible document view instead of an empty Overview.
3. **Given** the Overview, **When** the developer selects a document on the rail, **Then** the document renders without a full page reload and the rail marks the selection.

### User Story 4 - Custom workflows drive the shell (Priority: P2)

A team with a custom workflow (its own ordered steps, custom labels, action-only steps, step-owned sub-files, extra commands) opens their spec and the redesigned navigation renders **their** workflow: their step names on the rail, their next-step label on the primary action, their extra commands in an "Other actions" menu. Nothing assumes the four stock steps.

**Why this priority**: Custom workflows are a shipped, documented capability; the redesign must not regress them. It follows the shell work of Story 3.

**Independent Test**: Open the committed custom-workflow example projects (e.g. the GSD-style flow) and verify steps, labels, progression, and actions all follow the workflow definition.

**Acceptance Scenarios**:

1. **Given** a workflow with steps that differ from the stock four in count, names, and order, **When** its spec opens, **Then** the rail shows the workflow's own steps with correct created/current/pending states.
2. **Given** a workflow step that produces free-named or numbered documents, **When** those documents exist, **Then** they appear under their owning step and open from the rail.
3. **Given** workflow-defined extra commands, **When** the viewer renders, **Then** they are reachable from the "Other actions" affordance and dispatch unchanged.

### User Story 5 - The reading layout holds at any width (Priority: P3)

A developer reads a spec in a narrow editor split and on a wide monitor. The three-column grid (document rail, capped reading column, contextual run facts) degrades gracefully: gutters grow instead of prose stretching on wide screens; the context column yields around 800px; the rail becomes a horizontal strip on narrow panes. Review comments stay anchored to their lines throughout, and pending feedback collects into the refinement queue.

**Why this priority**: Polish that completes the design; valuable but only after content, lifecycle, and shell hold.

**Independent Test**: Resize the viewer across 700–1600px and verify column behavior, prose cap, TOC/rail behavior, and comment anchoring at each breakpoint.

**Acceptance Scenarios**:

1. **Given** a wide viewport, **When** a document renders, **Then** the reading column stays capped (~72ch) and only gutters grow.
2. **Given** a viewport around 800px, **When** the viewer renders, **Then** the context column disappears and reading remains comfortable.
3. **Given** inline review comments on a document, **When** the layout reflows, **Then** comments stay anchored to their lines and the refinement queue still collects pending feedback.

## Edge Cases

- A spec with a `.spec-context.json` but no recorded history (fresh or externally-authored spec) — Overview must not render as an empty page (falls back to a document view).
- A living-spec capability opened from the Spec Explorer — living mode has no workflow stepper or footer; the redesigned shell must keep suppressing them and render tiers as tabs.
- A custom workflow whose only navigable step reuses a stock name, or whose steps are all action-only — rail derivation must not misclassify it as the stock workflow.
- A document deleted while displayed, or a context file that goes stale mid-view — existing recovery affordances (stale banner, run-recovery notice, file-deleted state) must surface in the new shell.
- High-contrast editor themes — the owned palette must not fight the host's high-contrast mode.
- A spec at `specifying` with only partial content — in-flight rendering (spinners, partial documents) must not break the new layout.
- Very long single documents (15K+ markdown) — the capped reading column and TOC must stay performant and usable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The viewer MUST adopt the Codex hybrid theme: an owned, tested light/dark semantic palette for canvas, surfaces, ink, statuses, and syntax, while inheriting the host editor's font families and accessibility mode.
- **FR-002**: All text roles (headings, body, secondary, metadata, status labels) MUST meet WCAG AA contrast in both the light and dark palette, including status washes and code.
- **FR-003**: Code blocks MUST render on an owned high-contrast surface that is readable in both themes (the dark-only highlighting stylesheet must no longer produce unreadable light-mode code).
- **FR-004**: The existing UI primitives (buttons, badges, step tabs, cards, chips) MUST migrate onto the Codex component roles without changing their component APIs or message behavior.
- **FR-005**: The shell MUST present the Overview (the redesigned Activity view: intent, context, boundaries, decisions, evaluation, coverage, work evidence, with the approach progressively disclosed) as the default landing view for specs with recorded activity, and fall back to a document view when no activity exists.
- **FR-006**: A persistent document rail MUST answer "where am I" (documents and their selection) while separate completion marks answer "how far along is the run" — the two concepts must not share one visual treatment.
- **FR-007**: The rail and step derivation MUST be workflow-driven: arbitrary ordered steps, custom labels, action-only steps, step-owned sub-files, and related artifacts render from the workflow definition, with no hard-coded assumption of the stock four steps.
- **FR-008**: The primary call-to-action MUST carry the workflow-derived next-step label (the existing label-derivation seam) and dispatch exactly as today; workflow-defined extra commands MUST remain reachable via an "Other actions" affordance.
- **FR-009**: Every lifecycle state in the documented viewer state machine MUST render its correct badge, step marks, and action set in the new shell; no state transition may be lost or reordered.
- **FR-010**: All markdown content types the pipeline emits (spec metadata, user stories, requirements, entities, checklists, technical context, constitution rows, decisions, callouts, tables, code, tree/mermaid blocks, task lines) MUST be styled by the new design via their existing emitted classes, with no markdown pipeline restructuring.
- **FR-011**: The reading view MUST hide empty metadata-bar remnants and template-instruction blocks, and give branch metadata guaranteed contrast.
- **FR-012**: The layout MUST use the centered three-column grid (document rail ≤208px, reading column capped at 72ch, context column ≤260px) with the documented responsive behavior (context column yields ~800px; rail becomes a horizontal strip on narrow panes).
- **FR-013**: Inline review comments MUST keep working: line-anchored display, the comment composer, persistence, and the pending-feedback refinement queue, on top of the existing persisted review-comments path.
- **FR-014**: Living-specs mode MUST keep its current behavior in the new shell: no workflow stepper or footer, capability tiers as tabs, readable rendering.
- **FR-015**: Message-driven navigation MUST remain unchanged at the protocol level: the same messages the extension and webview exchange today keep their meaning, so the extension side needs no protocol changes.
- **FR-016**: Existing recovery and safety affordances (stale banner, run-recovery notice, file-deleted state, in-flight indicators) MUST surface correctly in the new shell.
- **FR-017**: Storybook stories for every visually-changed component MUST be updated (or added) in the same change, and the documentation that describes viewer behavior and appearance (the viewer state machine doc, README viewer sections and screenshots) MUST be updated to match the shipped design.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the canonical lifecycle states render the documented badge, step marks, and action set correctly in the new shell (verified against each demo fixture and the state-machine doc).
- **SC-002**: 100% of the markdown content types listed in FR-010 render styled (not unstyled fallbacks) on the rich reference specs, in both themes.
- **SC-003**: Every audited text role meets WCAG AA (≥4.5:1 body, ≥3:1 large/micro labels) in both palettes, measured on the rendered viewer.
- **SC-004**: The committed custom-workflow example advances end-to-end (steps render, progression works, next-step label correct) with zero behavioral differences attributable to the redesign.
- **SC-005**: The full existing automated test suite passes without behavioral test rewrites (styling-only test updates allowed), and the Storybook build passes with updated stories.
- **SC-006**: On viewports from 700px to 1600px, prose line length never exceeds the cap and no horizontal page scrolling occurs.

## Assumptions

- Adoption is CSS/tokens plus webview component-layer work on existing seams; the markdown pipeline's emitted HTML and the extension↔webview message protocol are stable interfaces (per the Codex rationale, all data-display fixes target existing emitted classes).
- The Codex direction's "inherit host fonts" supersedes the current bundled display font as the leading typeface; the viewer keeps working if the bundled font remains as fallback.
- The redesign ships directly (no user-facing toggle between old and new design); the old CSS it replaces is removed rather than kept behind a flag.
- The `__redesign__/codex/` stories remain in the repo as the design reference during adoption and are reconciled (folded into real component stories) by the end of the work.
- The old Activity toggle's *data* (history, decisions, coverage, comments) is fully carried by the Overview; no capability of the panel is dropped, only its entry point changes.
- Scope is the spec-viewer webview only: the sidebar tree, spec-editor webview, and workflow-editor webview are out of scope.

## Out of Scope

- Redesigning the sidebar (Specs tree), the spec-editor webview, or the workflow editor.
- Changing the extension-side state derivation, capture scripts, or `.spec-context.json` schema.
- Restructuring the markdown pipeline or its emitted class contract.
- New end-user settings for theming or layout.
