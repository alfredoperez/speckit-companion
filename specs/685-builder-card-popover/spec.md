# Feature Specification: Builder card with its hooks inside, and a node popover

**Feature Branch**: `feat/builder-redesign-core`
**Created**: 2026-11-24
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - A node and its hooks read as one card (Priority: P1)

Someone opens the Workflow Builder and scans a lane. Each node is one card: its name, then at most two quiet marks (the file it writes, a diamond when it can stop the run, a dot and "yours" when the project changed it). The work that runs before the node sits inside the top of the card, the work that runs after sits inside the bottom, and each of those hook rows shows its kind as an icon and its name. Hooks on a whole phase or a whole step sit as slim rows in the same style at the top of that phase or lane.

**Why this priority**: The separate hook blocks with their source headings made a lane hard to scan; this is the core of the redesign.

**Independent Test**: Open a board where a node has a before hook and an after hook; one outlined card holds both rows around the node's name.

**Acceptance Scenarios**:

1. **Given** a node with one before hook and one after hook, **When** the board draws, **Then** one card shows the before row, the node row and the after row in that order.
2. **Given** a node with no hooks, **When** the board draws, **Then** its card is a single line.
3. **Given** a node that writes `plan.md`, is a gate and was changed by the project, **When** the board draws, **Then** the card shows at most two of those marks.
4. **Given** a hook on a phase, **When** the board draws, **Then** a slim row in the hook style sits at the top of that phase.
5. **Given** one of the project's hooks, **When** it is dragged to another node, clicked, or removed, **Then** the move, the edit form and the removal still work as before.

### User Story 2 - Each hook says whether it ran (Priority: P1)

Each hook row carries a status slot read only from real data. A skill hook whose skill is missing or cannot be called says "not installed" or a short form of the reason. Otherwise, when the project has a spec run on record, the row says "ran" or "skipped" from that run, or "not seen" when the run holds no entry for it. With no run at all the slot is empty.

**Why this priority**: The whole point of the hook record is to answer "did my hook run"; the board is where people look.

**Independent Test**: Feed the board a run record with one hook ran and one skipped, and a third hook absent; the three rows read "ran", "skipped" and "not seen".

**Acceptance Scenarios**:

1. **Given** a hook with a problem reason, **When** the board draws, **Then** its status reads "not installed" (or its short reason) whatever the run says.
2. **Given** a run record with this hook marked ran, **When** the board draws, **Then** its status reads "ran".
3. **Given** a run record without this hook, **When** the board draws, **Then** its status reads "not seen".
4. **Given** no spec run in the project, **When** the board draws, **Then** no status is drawn.
5. **Given** the run recorded a different kind or skill at this hook's place, **When** the board draws, **Then** the status reads "not seen" and the details say the hook changed since.

### User Story 3 - A popover gives a node's details and every action (Priority: P2)

Clicking a node opens a popover beside it instead of a side pane. It names the node, says whether it is as shipped or yours, lists what it writes and needs, and lists its hooks with their outcome and reason, each with Edit and Remove. Its footer offers Edit node, Add hook and a More menu that keeps every action the old side pane had: open the file, move up or down, move to another phase, replace with a variant, remove from the run, and go back to the shipped node. When the builder is narrow, the same content opens as a bottom sheet.

**Why this priority**: The details move closer to the card; the actions already exist and must stay reachable.

**Independent Test**: Click a node, use the keyboard alone to reach More, and remove the node from the run.

**Acceptance Scenarios**:

1. **Given** the board, **When** a node is clicked, **Then** a popover for that node opens and takes focus.
2. **Given** an open popover, **When** Escape is pressed or the close button is used, **Then** it closes and focus returns to the node.
3. **Given** an open popover, **When** Edit node is chosen, **Then** the node's instructions open for editing as they did before.
4. **Given** an open popover, **When** a More action is chosen, **Then** the same message the old side pane sent is sent.
5. **Given** a narrow builder, **When** a node is clicked, **Then** a bottom sheet opens and Tab stays inside it until it closes.

### Edge Cases

- A hook whose problem and run outcome disagree: the problem wins.
- A parked hook keeps its "parked" word and is not draggable or editable.
- Another extension's hooks stay read-only, keep their source mark and "asks first".
- A popover for a node that disappears after a rebuild closes itself.
- A node clicked while another's popover is open moves the popover.
- The run record arrives after the board: statuses fill in without a reload.
- Reduced motion: the popover and sheet appear without animation.

## Requirements

### Functional Requirements

- **FR-001**: The board MUST draw each node as one card holding its before hooks, the node row and its after hooks.
- **FR-002**: A node row MUST show its name and at most two marks from: written file (mono), gate diamond, and "yours".
- **FR-003**: A hook row MUST show a kind icon, the hook's name and a status slot.
- **FR-004**: Phase and step hooks MUST draw as slim rows in the hook style at the top of their phase or lane, saying which side they run on.
- **FR-005**: The status MUST be the short problem when the hook has one; otherwise "ran", "skipped" or "not seen" from the last run; otherwise nothing.
- **FR-006**: The builder MUST ask the host for the last run's hook outcomes whenever it receives a pipeline graph.
- **FR-007**: Dragging, editing and removing the project's own hooks MUST keep working from the card.
- **FR-008**: Clicking a node MUST open a popover beside it with the node's facts, its hooks with outcome and reason, and Edit node, Add hook and More.
- **FR-009**: The popover's More menu MUST offer every action the side Inspector offered for a node.
- **FR-010**: Under the narrow width the popover MUST open as a bottom sheet that traps focus.
- **FR-011**: Opening MUST move focus into the popover; closing MUST restore it to the node; Escape MUST close it.
- **FR-012**: Every color MUST come from the host theme tokens; no hard-coded color.

### Key Entities

- **Hook status** (new, derived): a word, a tone and an optional reason for one hook, computed from the hook's problem and the run record.
- **Hook run record** *(existing)*: the last run's per-hook outcomes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A node with two hooks occupies one outlined card instead of three separate blocks.
- **SC-002**: 100% of hook statuses on the board trace to a problem field or a run record entry; none are drawn without one.
- **SC-003**: Every node action reachable from the old side pane is reachable from the popover by keyboard.
- **SC-004**: The existing builder test suite passes with its card and hook assertions updated to the new structure.

## Non-goals

- Changing what a hook is or how hooks are written to the configuration.
- Redesigning the hook form, the lanes, the header or the stock board.
- A "Move" button on each hook in the popover; moving a hook stays in the hook form and by drag.
- Editing step-level hooks from the board.

## Change-level rules

- No new dependency.
- No change to the host protocol shapes.
- Host tokens only; follows the VS Code theme, light and dark.

## Verification plan

1. Unit tests for the status derivation over problem, ran, skipped, not seen, changed and no run.
2. Board tests: one card per node with slots in order; marks capped at two; phase hook rows at the top.
3. Popover tests: opens on click, focus in and restored, Escape closes, More sends each action.
4. Storybook stories for the card states and the popover.

## Assumptions

- "A run exists" means the run record names a spec.
- The step's own instructions keep opening in the side pane, since a step is not a node card.
- Edit node opens the existing instructions pane, which is where the instruction text is edited.
- The short forms of a problem are "not installed", "plugin off", "can't call" and "unchecked".
