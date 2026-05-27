# Feature Specification: Fix Comment Line Height

**Feature Branch**: `110-fix-comment-line-height`
**Created**: 2026-05-26
**Status**: Draft
**Input**: User description: "Review comments are breaking formatting and adding extra height to task / other lines"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Attach Comment Without Layout Disruption (Priority: P1)

A developer reviews a spec or tasks document in the spec viewer and attaches an inline comment to a line. The surrounding lines — including task checkboxes above and below — retain their normal vertical spacing and formatting, exactly as if no comment were present.

**Why this priority**: This is the core defect. Every other user story is secondary to restoring neutral layout behavior when a comment exists. It is the most visible regression.

**Independent Test**: Open the tasks document in the spec viewer, attach an inline comment to any task line, and confirm that adjacent lines have identical height to lines with no comment. Delivers a visually correct comment experience on the most affected document type.

**Acceptance Scenarios**:

1. **Given** a tasks document is open in the spec viewer, **When** a comment is attached to a task checkbox line, **Then** the line's height and vertical spacing are identical to an uncommented task line.
2. **Given** a spec or plan document is open, **When** a comment is attached to a heading or paragraph line, **Then** no extra vertical padding or margin appears on that line or any adjacent line.
3. **Given** a comment is attached to a line, **When** the user scrolls past it, **Then** no layout jitter or reflow occurs on the surrounding content.

---

### User Story 2 - Comment Chrome Does Not Affect Line Rhythm (Priority: P2)

A developer views a document that already has multiple inline comments on various line types (task, heading, paragraph). All comment markers are visible, but none of them increase the line's rendered height or shift adjacent lines.

**Why this priority**: Without this, every comment applied over time would incrementally degrade the document's readability. Fixing it for the insertion case (P1) must also cover documents opened with pre-existing comments.

**Independent Test**: Load a spec with three or more pre-existing inline comments on different line types. Confirm that every commented line has the same measured height as its uncommented equivalent. Delivers readable docs for all existing comment data.

**Acceptance Scenarios**:

1. **Given** a document with pre-existing comments on task, heading, and paragraph lines, **When** the spec viewer renders it, **Then** all line heights match their uncommented counterparts.
2. **Given** a comment marker is displayed in the document margin/gutter, **When** no interaction occurs, **Then** the marker occupies space outside the line's vertical flow (absolutely positioned or in a non-flow container).

---

### User Story 3 - Visual Regression Coverage via Storybook (Priority: P3)

A developer working on the comment UI opens the Storybook and sees stories that render comment markers and the inline-comment composer across the relevant line types (task checkbox, heading, plain paragraph), in both commented and uncommented states.

**Why this priority**: Without Storybook coverage the fix can silently regress. This story makes the visual contract verifiable during development without needing to run the full extension.

**Independent Test**: Run Storybook and navigate to the comment stories. Confirm stories exist for: comment marker on task line, comment marker on paragraph line, inline-comment composer open on a task line, and same states without a comment. Delivers a visual regression safety net.

**Acceptance Scenarios**:

1. **Given** Storybook is running, **When** the developer navigates to the comment-marker story, **Then** stories for task-line and paragraph-line variants (with and without comment) are present and render without layout overflow.
2. **Given** the inline-comment composer story is open, **When** it is displayed on a task line, **Then** surrounding simulated lines show no extra height compared to lines without a composer.

---

### Edge Cases

- What happens when a comment is the only content on a very short line (e.g., a single-word heading)?
- How does the layout behave when many comments are stacked on consecutive task lines?
- Does the fix hold when the spec viewer is resized to a narrow width?
- What happens to comment markers on lines that are inside a collapsed section (if collapsing is supported)?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A line with an inline comment MUST have the same rendered height as the equivalent line without a comment, across all document types (spec, plan, tasks).
- **FR-002**: Comment chrome (marker icon, composer trigger) MUST NOT add vertical padding, margin, or height to the line container it is associated with.
- **FR-003**: Comment chrome MUST be rendered outside the normal vertical flow of the line (e.g., absolutely positioned in a gutter or overlay) so it does not push adjacent lines.
- **FR-004**: The layout fix MUST apply consistently across line types: task checkboxes, headings (H1–H4), and plain paragraphs.
- **FR-005**: The layout fix MUST apply both when a comment is first attached and when the document is loaded with pre-existing comments.
- **FR-006**: Storybook MUST include stories for the comment marker UI in commented and uncommented states on at least two line types (task line and paragraph line).
- **FR-007**: Storybook MUST include a story for the inline-comment composer rendered on a task line, showing that surrounding lines retain normal height.

### Key Entities

- **Comment Marker**: The visual indicator rendered inline (in a gutter or overlay) to signal that a comment exists on a line. Must not affect the line's box model.
- **Inline Comment Composer**: The UI element that opens when a user attaches or edits a comment. Its display must not introduce layout shift on the host line or adjacent lines.
- **Line Container**: The DOM element wrapping each rendered markdown line in the spec viewer. Its height must remain dictated solely by its text content, not by comment chrome.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every commented line in the spec viewer renders at the same height as its uncommented equivalent — measurable by visual inspection in Storybook stories (commented vs. uncommented side-by-side renders produce identical line heights).
- **SC-002**: Storybook contains at least four comment-related stories (marker on task line, marker on paragraph line, composer on task line, baseline uncommented task line) and all stories render without layout overflow or visible height discrepancy.
- **SC-003**: No existing Storybook stories for spec/plan/tasks document rendering exhibit layout regressions after the fix is applied.
- **SC-004**: Manual verification across spec, plan, and tasks documents shows zero visible height delta between commented and uncommented lines before and after scrolling.

## Assumptions

- The fix is purely a layout/CSS correction — no changes to comment data persistence, the comment composer's behavior, or the refinement flows are in scope.
- The comment composer's behavioral work (spec 107 / inline-comment-composer) is a separate track; this spec covers only the visual layout side-effect.
- Storybook is already set up in the project; new stories follow the existing story conventions.
- "Same height" is defined as no measurable difference visible to the human eye at 100% zoom, not a pixel-perfect CSS measurement requirement.
