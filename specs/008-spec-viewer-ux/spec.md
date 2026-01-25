# Feature Specification: Spec Viewer UX Polish

**Feature Branch**: `008-spec-viewer-ux`
**Created**: 2026-01-25
**Status**: Draft
**Input**: User description: "Improve visual consistency, spacing, and interaction behaviors in the spec viewer webview - fix excessive dividers, reduce padding/margins, improve typography hierarchy, fix comment interactions, and ensure state-appropriate UI controls"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cleaner Visual Layout (Priority: P1)

As a user reviewing a specification document, I want a clean visual layout without excessive dividers and padding so that I can focus on the content rather than being distracted by visual noise.

**Why this priority**: Visual clutter is the most reported issue affecting every screen and every user interaction. Fixing this improves the entire user experience across all features.

**Independent Test**: Can be fully tested by opening any spec document and verifying reduced visual noise - no excessive dividers, consistent spacing, and content-focused layout.

**Acceptance Scenarios**:

1. **Given** a spec document is displayed, **When** the user views any section, **Then** there are no double or unnecessary dividers between elements
2. **Given** the Input section is displayed, **When** the user views it, **Then** it has a single accent-colored left border without extra dividers above or below
3. **Given** any list item is displayed, **When** the user views it, **Then** the vertical padding is minimal (no excessive 40px padding)
4. **Given** H2 headings are displayed, **When** the user measures the margins, **Then** top margin is reduced from 28px to approximately 24px and bottom margin from 14px to approximately 8px
5. **Given** H3 headings are displayed, **When** the user views them, **Then** they have appropriately smaller font size and reduced line height

---

### User Story 2 - Improved Comment Interaction (Priority: P1)

As a user adding refinement comments, I want the comment interface to be intuitive and non-disruptive so that I can quickly annotate requirements without UI confusion.

**Why this priority**: Comment functionality is core to the refinement workflow. Broken or confusing interactions prevent users from completing their primary task.

**Independent Test**: Can be fully tested by attempting to add, cancel, and interact with comments on various line types.

**Acceptance Scenarios**:

1. **Given** the add comment panel is open for a line, **When** the user looks at that line, **Then** the hover-action button to add a comment is hidden (since one is already being added)
2. **Given** the add comment panel is displayed, **When** the user views it, **Then** it spans the full content width without extra padding or shadow
3. **Given** the "Remove" quick action is displayed, **When** the user reads it, **Then** it shows "Remove Line" for clarity
4. **Given** the user clicks "Remove Line" quick action, **When** the action executes, **Then** a comment is automatically added with instruction to remove the line (not just closing the panel)
5. **Given** the add comment panel shows quick actions and text area, **When** the user views between them, **Then** there is no divider separating them
6. **Given** the add comment button position, **When** the user looks for it on hover, **Then** it appears at the top-left of the hoverable area

---

### User Story 3 - Typography Hierarchy Improvements (Priority: P2)

As a user reading specification documents, I want consistent and appropriately-sized typography so that the document hierarchy is clear and readable.

**Why this priority**: Typography affects readability across all documents. While not blocking functionality, it significantly impacts user experience and document comprehension.

**Independent Test**: Can be fully tested by opening spec, plan, and tasks documents and verifying heading sizes follow a consistent hierarchy.

**Acceptance Scenarios**:

1. **Given** an H2 heading in a spec document, **When** compared to reference styling, **Then** it uses approximately 18px font size with 24px top margin and 8px bottom margin
2. **Given** an H2 heading in a tasks document, **When** the user views it, **Then** it is not excessively large (reduced from current oversized state)
3. **Given** code blocks with syntax highlighting, **When** the user views them, **Then** the font size is slightly smaller than body text (at least 1px smaller)
4. **Given** inline code elements, **When** the user hovers over them, **Then** they have an add-comment action available (either by line or for the whole block)

---

### User Story 4 - Acceptance Criteria Format Change (Priority: P2)

As a user reviewing acceptance scenarios, I want them displayed as readable text lists instead of tables so that adding comments to individual criteria is easier.

**Why this priority**: Tables make it difficult to add line-specific comments. This structural change enables better refinement workflows.

**Independent Test**: Can be fully tested by viewing any user story's acceptance scenarios and verifying they render as formatted lists.

**Acceptance Scenarios**:

1. **Given** acceptance scenarios exist in a user story, **When** they are rendered, **Then** they display as a bulleted/numbered list (not a table)
2. **Given** an acceptance scenario list item, **When** it is rendered, **Then** the Given/When/Then keywords are visually emphasized (bold)
3. **Given** acceptance scenarios as a list, **When** the user hovers over individual items, **Then** they can add comments to specific scenarios

---

### User Story 5 - State-Appropriate UI Controls (Priority: P2)

As a user viewing a completed spec, I want the UI to reflect the completion state by hiding irrelevant editing controls so that the interface is not confusing.

**Why this priority**: Showing editing controls on completed documents creates confusion about whether edits are possible or expected.

**Independent Test**: Can be fully tested by viewing a spec with "Spec Completed" status and verifying edit-related controls are hidden.

**Acceptance Scenarios**:

1. **Given** a spec has status "Spec Completed", **When** the document is displayed, **Then** the DRAFT badge is not shown
2. **Given** a spec has status "Spec Completed", **When** the user hovers over lines, **Then** the add-comment hover button is not displayed
3. **Given** a spec has status "Spec Completed", **When** the user views the footer, **Then** CTA buttons related to refinement/editing are hidden or disabled

---

### User Story 6 - Clarify Button Tooltip (Priority: P3)

As a user discovering the Clarify feature, I want a helpful tooltip so that I understand what the button does before clicking it.

**Why this priority**: Low impact - affects discoverability but not core functionality.

**Independent Test**: Can be fully tested by hovering over the Clarify button and verifying a tooltip appears.

**Acceptance Scenarios**:

1. **Given** the Clarify button is visible, **When** the user hovers over it, **Then** a tooltip appears with text like "Refine any requirements further"

---

### Edge Cases

- What happens when a user tries to add multiple comments on the same line in rapid succession?
- How does the system handle very long acceptance scenario text when rendered as a list instead of table?
- What happens when code blocks contain very long lines - does commenting still work?
- How does the reduced padding affect touch targets on tablet/touch devices?

## Requirements *(mandatory)*

### Functional Requirements

#### Visual Layout

- **FR-001**: System MUST NOT display double dividers or unnecessary horizontal rules between content sections
- **FR-002**: System MUST display the Input section with a single accent-colored left border (brighter/more prominent than current)
- **FR-003**: System MUST render list items with reduced vertical padding (remove the 40px padding currently applied)
- **FR-004**: System MUST apply reduced margins to H2 elements (approximately 24px top, 8px bottom instead of 28px/14px)
- **FR-005**: System MUST apply appropriately reduced styling to H3 elements (smaller font and line height)
- **FR-006**: System MUST render empty lines without hover effects (pointer-events: none)

#### Comment Interactions

- **FR-007**: System MUST hide the line-level add-comment hover button when a comment panel is already open for that line
- **FR-008**: System MUST display the add comment panel at full content width without extra padding or box shadow
- **FR-009**: System MUST label the remove quick action as "Remove Line" instead of just "Remove"
- **FR-010**: System MUST add a removal comment when the "Remove Line" quick action is clicked (instead of just closing the panel)
- **FR-011**: System MUST NOT display a divider between quick actions and the comment text area
- **FR-012**: System MUST position the add-comment hover button at top-left of the hoverable area

#### Typography

- **FR-013**: System MUST render code blocks with font size at least 1px smaller than body text
- **FR-014**: System MUST provide add-comment functionality for code blocks (by line or for the entire block)
- **FR-015**: System MUST apply consistent H2 sizing in tasks documents (not oversized)

#### Content Format

- **FR-016**: System MUST render acceptance scenarios as formatted lists instead of tables
- **FR-017**: System MUST emphasize Given/When/Then keywords in acceptance scenarios (bold formatting)

#### State Management

- **FR-018**: System MUST hide the DRAFT badge when spec status is "Spec Completed"
- **FR-019**: System MUST hide add-comment hover buttons when spec status is "Spec Completed"
- **FR-020**: System MUST hide or disable refinement-related footer CTAs when spec status is "Spec Completed"

#### Tooltips

- **FR-021**: System MUST display a tooltip on the Clarify button with text explaining its purpose

### Key Entities

- **SpecDocument**: A specification document with a status field that determines UI behavior (Draft, Spec Completed, etc.)
- **CommentPanel**: The inline UI component for adding refinement comments, with quick actions and text input
- **LineItem**: Individual lines of content that can receive hover actions and comments

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can scan a full spec document without visual distractions from excessive dividers (0 unnecessary dividers visible)
- **SC-002**: Users can add a comment to any line in under 3 clicks (hover → click add → type)
- **SC-003**: All heading levels (H1, H2, H3) have visually distinct sizes with consistent spacing ratios
- **SC-004**: Users can add comments to individual acceptance criteria (not possible with table format)
- **SC-005**: Completed specs show 0 edit-related controls that would confuse users about edit capability
- **SC-006**: All interactive elements have appropriate tooltips or labels for discoverability

## Assumptions

- The spec viewer webview already has the infrastructure for hover actions and comment panels
- CSS custom properties are used for theming and can be adjusted for spacing/sizing
- The acceptance criteria are currently rendered via markdown table parsing which can be modified
- The status of a spec is available to the webview rendering logic
- The existing codebase follows the modular pattern documented in CLAUDE.md

## Out of Scope

- Changes to the actual comment submission/refinement workflow backend
- Modifications to how comments are stored or processed
- New features not related to visual polish and interaction improvements
- Mobile-specific responsive design changes
- Accessibility improvements beyond what's mentioned (focus states, screen readers, etc.)
