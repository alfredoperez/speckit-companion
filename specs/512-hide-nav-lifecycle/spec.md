# Feature Specification: Hide Implement and Mark Complete from the viewer's side nav

**Feature Branch**: `512-hide-nav-lifecycle`
**Created**: 2026-07-21
**Status**: Draft
**Input**: GitHub issue [#500](https://github.com/alfredoperez/speckit-companion/issues/500)

The spec viewer's side navigation (the document rail) currently lists Implement and Mark Complete alongside the real documents. Neither opens anything readable — implement writes no artifact of its own, and mark complete is a lifecycle action — so they sit in the rail as dead entries. Navigation should list only things you can open and read; the lifecycle actions already live in the footer, which is where they belong.

## User Scenarios & Testing

### User Story 1 - Every rail entry opens a document (Priority: P1)

A developer opens a spec in the viewer and scans the side rail to move between the spec, plan, and tasks documents. Every entry they see is a document: clicking it shows content. Implement and Mark Complete no longer appear as rail entries, so there is nothing to click that leads nowhere.

**Why this priority**: This is the whole feature — removing the dead nav entries that mislead readers.

**Independent Test**: Open any spec that has reached the tasks step and confirm the rail lists only Spec, Plan, and Tasks (plus Overview and artifact groups), with no Implement or Mark Complete entries, and that each entry opens its document.

**Acceptance Scenarios**:

1. **Given** a spec with spec.md, plan.md, and tasks.md, **When** the viewer opens, **Then** the pipeline rail shows exactly the three document entries and no Implement or Mark Complete entry.
2. **Given** the rail is showing, **When** the user clicks any rail entry, **Then** a document opens — no rail click is a no-op or a lifecycle action.
3. **Given** a spec at any lifecycle status (specifying through completed), **When** the viewer renders, **Then** no action-only step appears in the rail regardless of status.

### User Story 2 - Progress and activity stay visible while implementing (Priority: P2)

While implementation runs, the developer still sees task progress and the running indicator in the viewer — the information the Implement rail entry used to host moves to the document entries instead of disappearing with it.

**Why this priority**: Hiding the entry must not hide the signal it carried; otherwise the fix trades one confusion for another.

**Independent Test**: Start implementing a spec and confirm the task completion percent and any running indication are still visible in the viewer without an Implement rail entry.

**Acceptance Scenarios**:

1. **Given** a spec mid-implementation with some tasks checked, **When** the viewer renders, **Then** the task completion percent is shown on the last document entry (Tasks) rather than on a hidden Implement entry.
2. **Given** the implement step is currently running, **When** the viewer renders, **Then** the rail's document entries render normally — no entry is wrongly locked or marked running because of the hidden step.

### User Story 3 - Custom workflows get the same treatment (Priority: P3)

A user with a custom workflow that defines its own action-only steps (steps that produce no document) sees the same behavior: those steps never become rail entries, while their document-producing steps still do.

**Why this priority**: The rule is "documents only", not a hard-coded pair of names; custom workflows should not regress into the same dead-entry problem.

**Independent Test**: Configure a custom workflow with an action-type step and confirm it does not appear in the rail while its document steps do.

**Acceptance Scenarios**:

1. **Given** a custom workflow with a step that produces no document, **When** the viewer renders that spec, **Then** that step has no rail entry and the workflow's document steps all do.

### Edge Cases

- The implement step is the currently running step: the rail must not lock or highlight the wrong tab when the running step has no rail entry.
- Artifact files parented under a hidden step (related docs whose parent is implement): their artifact group must still render with a sensible label.
- A workflow where the last document step is followed by several action steps: the completion percent lands on the last document entry, not dropped.
- Living-spec mode and the Overview entry are untouched — the change applies only to the pipeline rail's step entries.

## Requirements

### Functional Requirements

- **FR-001**: The viewer's side nav pipeline rail MUST render entries only for steps that produce a readable document; action-only steps (Implement, Mark Complete, and any custom step without a document) MUST NOT appear as rail entries.
- **FR-002**: Footer behavior MUST remain unchanged — Approve → Implement dispatch and the Mark Completed / Archive closure actions keep working exactly as today.
- **FR-003**: The task completion percent MUST remain visible during implementation, shown on the last document-producing rail entry when no Implement entry is rendered.
- **FR-004**: Rail state logic (running indicator, future-step locking, current selection) MUST behave correctly when the active or running step has no rail entry — no tab is wrongly locked, highlighted, or skipped.
- **FR-005**: The underlying workflow definition and lifecycle MUST be unaffected — the hidden steps still exist, still run, and still record history; only their rail rendering is removed.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Zero rail entries that open no document, across all built-in workflow states (a click-through of every rail entry on a stock and a Companion spec yields a document 100% of the time).
- **SC-002**: During an implementation run, the task completion percent is visible in the rail at all times (pass/fail check on a mid-implement spec).
- **SC-003**: All existing footer actions pass their current manual checks unchanged (Approve → Implement, Mark Completed, Archive).
- **SC-004**: No visual or behavioral regression in living-spec mode, the Overview entry, or artifact groups (pass/fail on the demo fixture specs).

## Assumptions

- "Action-only step" is identified by the step metadata the viewer already carries (steps categorized as actions / producing no document), so the rule generalizes to custom workflows without new configuration.
- The completion percent already falls back to the last entry when no implement entry exists; keeping that signal on the Tasks entry is the expected home for it.
- No setting is wanted to re-show the hidden entries — the issue asks for removal, not a toggle.

## Approach

- `webview/src/spec-viewer/components/NavigationBar.tsx` — filter `category === 'action'` steps out of the pipeline rail's `coreDocs.map(...)`; compute the percent-host and running/lock indices against the rendered (filtered) list so the hidden steps can't shift or lock tabs.
- `webview/src/spec-viewer/components/StepTab.tsx` — only if the filtered indices change its props' meaning; expected minimal or no change.
- `webview/src/spec-viewer/components/NavigationBar.stories.tsx` — update stories to the new rail (no Implement / Mark Complete entries; percent on Tasks) so the visual baseline matches.
- `webview/src/spec-viewer/components/__tests__/` — cover the filtering: action steps never render, percent host falls to the last document tab, running-step lock stays correct when the running step is hidden.
- `docs/viewer-states.md` + README "Reading Specs" — reflect that the rail lists documents only; lifecycle actions live in the footer.
- No extension-side changes: `coreDocs` keeps carrying action steps (footer and state logic still need them); the filter is render-only in the rail.
