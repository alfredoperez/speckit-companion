# Feature Specification: Inline Comment Composer Card

**Feature Branch**: `097-inline-comment-composer`  
**Created**: 2026-05-21  
**Status**: Draft  
**Input**: User description: "The add comment dialog top button looks weird — restructure the inline comment composer to mimic GitHub's review-comment UI (a single contained card with header, textarea, and right-aligned footer actions) so the affordance feels intentional instead of stacked."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comment composer reads as one cohesive card (Priority: P1)

When a reviewer hovers a line in the spec viewer and opens the inline comment composer, they see a single bordered card that contains everything needed to comment: the context of what they are commenting on, the text input, and the action buttons. No control floats above or outside the card.

**Why this priority**: This is the core of the request. Today a secondary button ("Remove Line") floats above the textarea card and reads as a disconnected control, breaking the visual unit. Fixing the composition is the whole point of the feature and delivers value on its own.

**Independent Test**: Open the composer on a plain paragraph line and confirm the composer is a single bordered card with no detached button stacked above it.

**Acceptance Scenarios**:

1. **Given** a spec is open in the viewer and the spec is editable, **When** the reviewer opens the inline comment composer on a line, **Then** the composer appears as one bordered card with no control rendered outside that border.
2. **Given** the composer is open, **When** the reviewer looks at the card, **Then** the comment input and the action buttons are visually contained within the same card boundary.

---

### User Story 2 - Secondary line action lives inside the card (Priority: P2)

The context-specific action for the line (e.g., "Remove Line", "Remove Story", "Remove Section", "Remove Scenario", "Remove Task", "Toggle") is presented inside the card — in a header row or in the footer — aligned with the other card controls, instead of floating above the input.

**Why this priority**: Relocating the floating action is what removes the "stacked / disconnected" feel. It depends on the card structure from US1 but is the specific behavior the screenshot calls out.

**Independent Test**: Open the composer on each line type (paragraph, user story, section, acceptance scenario, task) and confirm each line type's action(s) render inside the card, aligned with the card's other controls — never above the card.

**Acceptance Scenarios**:

1. **Given** the composer is open on a paragraph line, **When** the reviewer views the card, **Then** the "Remove Line" action appears within the card (header or footer), not floating above the input.
2. **Given** the composer is open on a task line that has multiple actions ("Toggle", "Remove Task"), **When** the reviewer views the card, **Then** all actions are grouped inside the card and aligned with the other controls.
3. **Given** the reviewer activates the relocated secondary action, **When** it is triggered, **Then** it performs exactly the same outcome it did before the restructure (e.g., adds the removal refinement, toggles the task).

---

### User Story 3 - Familiar GitHub-style header and footer layout (Priority: P3)

The card shows a header indicating what is being commented on (the target line or scenario), and the primary actions (Cancel, Add Comment) are right-aligned in the footer — matching the layout reviewers already know from GitHub PR review.

**Why this priority**: This is polish that completes the GitHub mental-model match. The composer is already usable after US1/US2; this makes it feel intentional and familiar.

**Independent Test**: Open the composer on a line and on an acceptance-scenario row and confirm both show a context header and right-aligned primary actions.

**Acceptance Scenarios**:

1. **Given** the composer is open on a line, **When** the reviewer views the card, **Then** a header indicates the comment target (the line) and the primary actions are right-aligned in the footer.
2. **Given** the composer is open on an acceptance-scenario row, **When** the reviewer views the card, **Then** the scenario context is shown in the header and the primary actions are right-aligned in the footer.

---

### Edge Cases

- **Line type with multiple secondary actions** (task = Toggle + Remove Task): all actions fit inside the card without breaking the single-card layout.
- **Row (acceptance scenario) composer**: has no secondary line action — the header shows only the scenario context; the layout stays a cohesive card.
- **Long context text** in the header (e.g., a long scenario sentence): the header wraps or truncates gracefully without pushing controls outside the card.
- **Empty comment submission**: submitting with no text cancels/closes the composer (existing behavior preserved).
- **Spec is completed or archived**: the composer remains disabled/unavailable, as it is today.
- **Narrow viewer width**: the card and its right-aligned footer actions remain readable and contained.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The inline comment composer MUST render as a single bordered card; no control may appear outside that card's border.
- **FR-002**: The floating action button currently rendered above the comment input MUST be removed and its action relocated into the card (header row or footer).
- **FR-003**: Context-specific line actions (Remove Line, Remove Story, Remove Section, Remove Scenario, Remove Task, Toggle) MUST be presented inside the card, visually aligned with the card's other controls.
- **FR-004**: The primary footer actions (Cancel and Add Comment) MUST be right-aligned within the card footer.
- **FR-005**: The card MUST display a header that indicates what is being commented on (the target line or the acceptance scenario).
- **FR-006**: The restructure MUST apply to both the line-mode composer and the row-mode (acceptance-scenario) composer, each presented as a cohesive card.
- **FR-007**: All existing composer behavior MUST be preserved unchanged: line/row anchoring, comment submission, refinement persistence via the scratchpad, the Escape-to-cancel and Cmd/Ctrl+Enter-to-submit shortcuts, auto-focus of the input, and empty-submission cancelling the composer.
- **FR-008**: Activating a relocated secondary action MUST produce the same outcome it produced before the restructure (e.g., adding the removal refinement comment, toggling the task checkbox).
- **FR-009**: This change MUST be a visual restructure only — no new comment capabilities are added.

### Out of Scope

- Write/Preview tabs.
- Formatting toolbar.
- File attachments.
- Comment threading and replies.
- "Start a review" batching of comments.
- Mentions / autocomplete.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The composer reads as a single visual unit — on inspection, zero controls appear detached or floating outside the card border (today there is one).
- **SC-002**: A reviewer familiar with GitHub PR review can locate the comment input, the secondary action, and the submit/cancel actions without instruction.
- **SC-003**: 100% of existing composer behaviors (add comment, cancel, each remove/toggle action, scratchpad persistence, keyboard shortcuts, auto-focus) continue to work after the restructure — no regressions.
- **SC-004**: Commenting on a line takes the same number of clicks as before the change (the restructure adds no extra steps).
- **SC-005**: Both the line composer and the acceptance-scenario row composer present a context header and right-aligned primary actions.
