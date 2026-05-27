# Feature Specification: Task-Line Rendering Polish

**Feature Branch**: `112-task-line-rendering-polish`  
**Created**: 2026-05-27  
**Status**: Draft  

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Stable Task Row Layout on Hover (Priority: P1)

A developer reviewing a spec in the spec viewer notices that hovering over any task row does not cause the text or other row content to shift or reflow. The inline-comment trigger (`+` button) appearing on hover is invisible to layout — it occupies no additional space that wasn't already reserved.

**Why this priority**: Content shift on hover is the most visually jarring of the two issues. It makes the viewer feel unstable and is immediately noticeable for every task line the user hovers over.

**Independent Test**: Can be fully tested by hovering over any task line in the spec viewer and verifying that no content shifts, text reflows, or row height changes occur before and after the `+` button appears.

**Acceptance Scenarios**:

1. **Given** a spec with task lines is open in the viewer, **When** the user hovers over a task row, **Then** the task text does not shift horizontally or vertically and the row height does not change.
2. **Given** a task row is in the idle (non-hovered) state, **When** the user moves the mouse onto the row, **Then** the `+` inline-comment trigger appears without reflowing any content.
3. **Given** a task row is hovered, **When** the user moves the mouse away, **Then** the `+` trigger disappears without causing any layout shift.
4. **Given** a task row with an existing inline comment, **When** the user hovers, **Then** the row remains stable and the comment indicator does not shift.

---

### User Story 2 — No Trailing Line Break After Wrapping Task Descriptions (Priority: P1)

A developer reviewing a spec with long task descriptions (multi-line wrapping) sees a consistent vertical gap after each task row — identical to the gap after single-line tasks and to uncommented paragraphs. There is no extra empty-line gap following a task whose description wraps to a second line.

**Why this priority**: The extra trailing break after wrapping tasks visually breaks the rhythm of the task list and undermines the height-parity guarantee from spec 110. This affects every multi-word/code-span task in real specs.

**Independent Test**: Can be fully tested by opening a spec with at least one long task description (containing code spans or a lengthy sentence) and comparing the gap below it to the gap below a single-line task.

**Acceptance Scenarios**:

1. **Given** a spec with a task whose description contains multiple code spans and wraps across two or more lines, **When** the spec viewer renders it, **Then** the vertical gap below the task is identical to the gap below a single-line task.
2. **Given** a spec with a mix of single-line and multi-line (wrapping) task descriptions, **When** the viewer renders the task list, **Then** vertical spacing is visually uniform throughout the list.
3. **Given** an uncommented paragraph immediately following a wrapping task, **When** rendered, **Then** the spacing matches the spacing between any other paragraph pair.
4. **Given** spec 110's height-parity guarantee (commented and uncommented lines at identical heights), **When** a wrapping task is rendered, **Then** the existing height-parity behavior is not regressed.

---

### User Story 3 — Storybook Coverage for Task Row States (Priority: P2)

A developer working on spec-viewer styles opens Storybook and finds stories that exercise task line rendering: idle vs. hovered states for both single-line and wrapping-content task rows, and a paragraph row story for baseline comparison. Any future regression in these states is caught visually before it ships.

**Why this priority**: Without automated visual coverage, the two rendering bugs can silently regress. Storybook stories are the safety net for future CSS changes.

**Independent Test**: Can be fully tested by opening Storybook and verifying that task-row stories render correctly for all covered states without any visible shift or extra spacing.

**Acceptance Scenarios**:

1. **Given** Storybook is running, **When** the task-line story is opened, **Then** both idle and hover states for a single-line task are shown side by side.
2. **Given** Storybook is running, **When** the wrapping-content variant is opened, **Then** a task with a long description renders without extra trailing space in both idle and hover states.
3. **Given** Storybook is running, **When** any task-row story is in hover state, **Then** no content shift is visible compared to the idle state.

---

### Edge Cases

- What happens when a task description contains only inline code spans that wrap?
- How does the hover-stable layout behave when the viewport is narrow enough to cause most tasks to wrap?
- What happens to the row layout if a task has both an inline comment and a very long description?
- How does the fix interact with the existing height-parity logic from spec 110 when both issues are present on the same task row?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Task rows in the spec viewer MUST NOT shift their content (text position, row height) when the inline-comment trigger (`+` button) appears or disappears on hover.
- **FR-002**: The inline-comment trigger slot MUST reserve its layout width regardless of whether the button is visible, OR the trigger MUST be absolutely positioned over reserved padding so it does not participate in normal document flow.
- **FR-003**: Task rows with descriptions that wrap across multiple lines MUST render with the same vertical gap below them as single-line task rows.
- **FR-004**: The fix to trailing line breaks MUST NOT introduce any stray `<br>` elements, margin, or padding that creates an asymmetry between task rows and uncommented paragraph rows.
- **FR-005**: The existing height-parity behavior between commented and uncommented lines (from spec 110) MUST be preserved after both fixes are applied.
- **FR-006**: Storybook stories MUST cover: (a) single-line task row in idle state, (b) single-line task row in hover state, (c) wrapping-content task row in idle state, (d) wrapping-content task row in hover state, (e) paragraph row for baseline comparison.

### Scope Boundaries

**In scope**:
- `webview/src/spec-viewer/markdown/` — task-item HTML structure (source of trailing break issue)
- `webview/styles/spec-viewer/_tasks.css` — task line layout
- `webview/styles/spec-viewer/_line-actions.css` — inline-comment trigger positioning
- Storybook stories under `webview/src/spec-viewer/` exercising the task line

**Out of scope**:
- How inline comments are stored or the inline-comment composer behavior
- Any new affordances on task lines
- Any extension-side state changes

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Hovering any task row produces zero pixels of content shift — the task text bounding box is identical in idle and hover states.
- **SC-002**: The vertical gap below a wrapping task row is within 1px of the gap below a single-line task row and an uncommented paragraph row.
- **SC-003**: All six Storybook stories (idle/hover × single-line/wrapping + paragraph baseline) pass visual review with no regressions.
- **SC-004**: No regression to spec 110's height-parity work — commented and uncommented lines continue to render at identical heights across all task and paragraph combinations.

## Assumptions

- The `+` inline-comment trigger is rendered inside the task row's flex/grid container and currently shifts layout because it is only present in the DOM on hover.
- The trailing line break after wrapping tasks originates in either the markdown task-item renderer output (a stray `<br>` or block-level element) or a margin/padding rule in `_tasks.css` that only manifests when content wraps.
- No changes to the markdown AST pipeline or comment storage are needed — this is a pure HTML/CSS fix at the render layer.
- Storybook is already set up in the project and new stories follow the existing pattern in `webview/src/spec-viewer/`.
