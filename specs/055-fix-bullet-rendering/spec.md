# Feature Specification: Fix Bullet Point Rendering in Spec Viewer

**Feature Branch**: `055-fix-bullet-rendering`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "Bulletpoints were rendered incorrectly. The code is not rendering as code when it is after the bulletpoint. The bullet points have too much padding or margin. The count in the bulletpoint is reset everytime."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ordered List Counter Continuity (Priority: P1)

A user opens a spec in the spec viewer that contains an ordered (numbered) list. The list items include inline code and fenced code blocks between items. The user expects the numbered list to display with continuous numbering (1, 2, 3...) rather than resetting to "1" after each item or after embedded code blocks.

**Why this priority**: Numbered lists resetting their counter makes step-by-step instructions unreadable and confusing. Users cannot follow sequential procedures when every step shows as "1."

**Independent Test**: Open a spec containing a numbered list with 3+ items that have fenced code blocks between them. Verify numbers increment continuously (1, 2, 3) without resetting.

**Acceptance Scenarios**:

1. **Given** a spec with an ordered list of 3 items separated by fenced code blocks, **When** the spec viewer renders the markdown, **Then** the list displays as items 1, 2, 3 in sequence
2. **Given** a spec with nested bullet points under numbered items, **When** the spec viewer renders the markdown, **Then** the parent numbered list maintains its count after the nested content

---

### User Story 2 - Code Blocks Render Inside List Items (Priority: P1)

A user views a spec that contains fenced code blocks (triple backticks) within or immediately after a list item. The user expects the code to render with proper syntax highlighting and code formatting, not as plain text.

**Why this priority**: Code blocks appearing as plain text makes technical specifications unreadable. Users cannot distinguish code from prose, defeating the purpose of including code examples.

**Independent Test**: Open a spec containing a numbered list item followed by a fenced code block. Verify the code block renders with code styling (monospace font, background color, syntax highlighting).

**Acceptance Scenarios**:

1. **Given** a spec with a fenced code block after a numbered list item, **When** the spec viewer renders the markdown, **Then** the code block displays with proper code formatting (monospace font, distinct background)
2. **Given** a spec with an inline code snippet within a list item, **When** the spec viewer renders the markdown, **Then** the inline code renders with code styling

---

### User Story 3 - List Item Spacing Is Compact (Priority: P2)

A user views a spec containing bullet points or numbered lists. The user expects the list items to have reasonable, compact spacing — similar to standard markdown rendering — rather than excessive padding or margins that waste vertical space.

**Why this priority**: Excessive spacing between list items makes specs harder to scan and forces unnecessary scrolling. Lists should be visually tight and easy to read.

**Independent Test**: Open a spec with a bullet list of 5+ items. Verify spacing between items is compact and consistent, without large gaps between items.

**Acceptance Scenarios**:

1. **Given** a spec with an unordered bullet list, **When** the spec viewer renders the markdown, **Then** list items have compact vertical spacing consistent with standard markdown rendering
2. **Given** a spec with a numbered list, **When** the spec viewer renders the markdown, **Then** list items have compact vertical spacing without excessive padding or margins

---

### Edge Cases

- What happens when a numbered list has 10+ items with code blocks between them?
- How does the viewer handle deeply nested lists (3+ levels)?
- What happens when a code block appears as the first content inside a list item?
- How are mixed list types handled (numbered list containing bullet sub-lists)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render ordered lists with continuous numbering that does not reset when code blocks appear between list items
- **FR-002**: System MUST render fenced code blocks that appear after or within list items with proper code formatting (monospace font, background styling, syntax highlighting)
- **FR-003**: System MUST render list items (both ordered and unordered) with compact vertical spacing that does not include excessive padding or margins
- **FR-004**: System MUST maintain list counter continuity when list items contain nested content (sub-lists, paragraphs, code blocks)
- **FR-005**: System MUST render inline code within list items with proper code styling

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All ordered lists in specs display with correct sequential numbering regardless of embedded content between items
- **SC-002**: 100% of fenced code blocks within or after list items render with code formatting (monospace font and distinct background)
- **SC-003**: Vertical spacing between list items is visually compact and consistent — no item gap exceeds standard markdown rendering spacing
- **SC-004**: Users can read specs containing mixed lists and code blocks without formatting confusion or misinterpretation

## Assumptions

- The rendering issues are in the CSS styling and/or markdown-to-HTML conversion pipeline within the spec viewer webview
- The markdown source files themselves are correctly formatted (the bug is in rendering, not in the source)
- Standard markdown rendering behavior (as seen in VS Code's built-in markdown preview or GitHub) is the target baseline for correct rendering
- The fix should not break any existing correctly-rendered content in the spec viewer
