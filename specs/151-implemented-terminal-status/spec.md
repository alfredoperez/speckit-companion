# Feature Specification: Hide Resume on Terminal Specs (Make `implemented` a First-Class Status)

**Feature Branch**: `151-implemented-terminal-status`
**Created**: 2026-06-11
**Status**: Draft
**Input**: User description: "Hide Resume on terminal specs — make `implemented` a first-class status."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - No Resume button on a finished spec (Priority: P1)

A user has run the pipeline through implement on a spec. The build is done; the spec's terminal status is `implemented`. The user opens the Specs sidebar and looks at that spec's row. They should NOT see a Resume (▶) inline action, because there is nothing left to resume — the work is finished. Resume must remain available on specs that are genuinely still in progress (active / tasks-done).

**Why this priority**: This is the reported defect. The Resume button on a done spec invites a no-op (or worse, a redundant re-run) and contradicts the "implement is finished" signal the rest of the UI already shows.

**Independent Test**: Set a spec's `.spec-context.json` status to `implemented`, open the sidebar, confirm the Resume inline action is absent on that row while still present on an `active` spec row (with the `resumeBeta` setting on).

**Acceptance Scenarios**:

1. **Given** a spec with status `implemented`, **When** the user views it in the Specs sidebar, **Then** the Resume (▶) inline action is hidden.
2. **Given** a spec with status `completed` or `archived`, **When** the user views it in the Specs sidebar, **Then** the Resume (▶) inline action is hidden.
3. **Given** a spec with status `active` or `tasks-done` and the `resumeBeta` setting enabled, **When** the user views it in the Specs sidebar, **Then** the Resume (▶) inline action is shown.

---

### User Story 2 - A finished (but not user-completed) spec is grouped out of Active (Priority: P2)

A user scanning the sidebar groups (Active / Completed / Archived) should not see an `implemented` spec listed under **Active**, because it is no longer in progress. It is done work awaiting the user's explicit Mark Completed decision.

**Why this priority**: Grouping an `implemented` spec under Active misrepresents its state and is the same root cause (`implemented` not being a first-class status) as the Resume bug.

**Independent Test**: Create one spec each in `active` and `implemented` status, render the tree, and assert the `implemented` spec is not in the Active group.

**Acceptance Scenarios**:

1. **Given** a spec with status `implemented`, **When** the sidebar tree is built, **Then** the spec is not bucketed into the Active group.

---

### Edge Cases

- A legacy spec with no status (missing `.spec-context.json`) still defaults to Active and still shows Resume (unchanged behavior).
- An `implemented` spec still renders as "done" in the row/viewer (already true via prior work) — this change must not regress that.
- The change must NOT auto-promote `implemented` to `completed`. `completed` remains the user's explicit Mark Completed action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST treat `implemented` as a first-class terminal spec status, distinct from `active`, `tasks-done`, `completed`, and `archived`.
- **FR-002**: The system MUST NOT show the Resume (▶) inline action on a spec whose status is `implemented`, `completed`, or `archived`.
- **FR-003**: The system MUST continue to show the Resume (▶) inline action on `active` and `tasks-done` specs when the `resumeBeta` setting is enabled.
- **FR-004**: The system MUST NOT group an `implemented` spec under the Active sidebar group.
- **FR-005**: The system MUST NOT automatically advance an `implemented` spec to `completed`. `completed` remains the user's explicit Mark Completed action.
- **FR-006**: The change MUST preserve the existing "renders as done" presentation for `implemented` specs (row icon, viewer label, footer Mark Completed availability).

### Key Entities

- **Spec status**: The lifecycle state of a spec, persisted in `.spec-context.json`. Relevant values: `active`, `tasks-done`, `implemented` (terminal, pipeline-finished), `completed` (terminal, user-finalized), `archived` (terminal, read-only).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 Resume buttons appear on `implemented`, `completed`, or `archived` specs.
- **SC-002**: 100% of `active` / `tasks-done` specs still show Resume when `resumeBeta` is on.
- **SC-003**: 0 `implemented` specs appear in the Active sidebar group.
- **SC-004**: 0 `implemented` specs are auto-promoted to `completed` as a result of this change.
