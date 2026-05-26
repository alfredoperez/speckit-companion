# Feature Specification: Fix Inline Comment Persistence for spec.md

**Feature Branch**: `107-fix-inline-comment-persistence`  
**Created**: 2026-05-26  
**Status**: Draft  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comments on spec.md Persist and Restore (Priority: P1)

A developer opens the spec viewer on `spec.md`, adds inline review comments, closes the panel, and reopens it. Their comments are restored inline exactly where they left them — the same experience already working for `plan.md` and `tasks.md`.

**Why this priority**: `spec.md` is the first document in every spec workflow. If comments don't persist there, the feature is broken for the most common starting point. This is the direct regression reported in issue #154.

**Independent Test**: Open spec viewer on `spec.md`, add a comment, close the panel, reopen it — comment appears at the same location. Fully validates the fix in isolation.

**Acceptance Scenarios**:

1. **Given** a spec document (`spec.md`) is open in the viewer, **When** a user adds an inline comment, **Then** the comment is immediately written to `.spec-context.json` under `reviewComments`
2. **Given** inline comments were added to `spec.md`, **When** the spec viewer tab is closed and reopened, **Then** all comments are restored at their original locations
3. **Given** a developer commits `.spec-context.json` and a teammate checks out the branch, **When** they open the spec viewer, **Then** the comments appear for the teammate on `spec.md`

---

### User Story 2 - Consistent Behavior Across All Document Types (Priority: P2)

A developer can add comments to any core spec document — `spec.md`, `plan.md`, `tasks.md` — and the persist/restore behavior is identical for all three. There is no undocumented difference between document types.

**Why this priority**: The regression exposed an inconsistency between documents. This story ensures the fix is complete and symmetric, not just patched for one document.

**Independent Test**: Add comments to `spec.md`, `plan.md`, and `tasks.md` in sequence. Close and reopen viewer. All three restore identically. Each document can be tested independently.

**Acceptance Scenarios**:

1. **Given** a user adds comments to `spec.md`, `plan.md`, and `tasks.md`, **When** the viewer is closed and reopened, **Then** comments restore on all three documents
2. **Given** a user switches between document tabs in the viewer, **When** returning to any previously commented document, **Then** its comments are still present
3. **Given** a user adds a comment to `spec.md` and a separate comment to `plan.md`, **When** the spec context file is inspected, **Then** both comments are present under `reviewComments` with their correct `doc` field (`spec` and `plan` respectively)

---

### Edge Cases

- What happens if the viewer is opened on a spec whose `.spec-context.json` has no `reviewComments` field (created before this feature)?
- What happens if the `doc` field on a stored comment doesn't match any currently visible document tab?
- What happens when the source document (`spec.md`) is edited externally while comments are pending — do comments still restore (best-effort re-anchor)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a user adds an inline comment on any core document (`spec.md`, `plan.md`, `tasks.md`), the comment MUST be immediately written to the spec's `.spec-context.json` under `reviewComments` with the correct `doc` value (`spec`, `plan`, or `tasks`)
- **FR-002**: When the spec viewer is opened, it MUST restore all persisted `pending` comments inline for the active document, regardless of which document type is shown
- **FR-003**: The `doc` field on a stored comment MUST correctly identify its source document so that switching between tabs shows only the comments for each respective document
- **FR-004**: A `.spec-context.json` that has no `reviewComments` field (written by an older version) MUST load without error; comments simply start empty
- **FR-005**: The existing Refine workflow MUST continue to work — running refinement marks the submitted comments `applied` in `.spec-context.json` and they are not re-shown as pending on next open

### Key Entities

- **Review Comment**: A persisted reviewer note stored in `.spec-context.json` under `reviewComments[]`, with fields: `id`, `doc` (`spec` | `plan` | `tasks`), `anchor` (heading + block text + line), `comment` text, `status` (`pending` | `applied`), `createdAt`
- **Spec Context** (`.spec-context.json`): The single storage file for a spec's workflow state, including all persisted review comments — no separate companion files are used

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero comment loss — a comment added on `spec.md` is visible again after closing and reopening the viewer, matching the behavior already working for `plan.md` and `tasks.md`
- **SC-002**: Symmetric behavior — adding and restoring comments works identically across `spec.md`, `plan.md`, and `tasks.md` with no document-type exceptions
- **SC-003**: Correct routing — each comment's `doc` field matches the document it was added on, so switching tabs shows only the relevant comments

## Assumptions

- The persistence architecture from spec 101 (`reviewComments[]` on `.spec-context.json`) is correct and complete — no new storage mechanism is needed
- The root cause is a missing or incorrect `doc` type mapping for `spec.md` in either the webview's `currentDoc` detection or the message handler's document-type routing, introduced as a regression
- The `<doc>-extra.md` companion files were already removed in spec 101 and are not part of this fix
