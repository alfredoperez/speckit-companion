# Feature Specification: Plan cards that respond on the Copilot app board

**Feature Directory**: `specs/636-board-states-card`
**Created**: 2026-10-11
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Picking a state on the board shows that state (Priority: P1)

A developer reads a plan on the Copilot app board. The plan has a states card: a small diagram of the states a thing moves through. In VS Code, picking a state shows its sentence, where it can go next and its screen. On the board the diagram is drawn but picking does nothing, so the board falls back to a plain list under it. After this change picking a state works on the board the way it does in VS Code.

**Why this priority**: it is the one plan card whose whole value is in picking, and it is the part of the issue still missing.

**Independent Test**: open a plan with a states card on the board, pick the second state, and read the card. It shows that state's name and sentence, marks it as picked, and shows its next moves.

**Acceptance Scenarios**:

1. **Given** a plan with a states card on the board, **When** the developer picks a state, **Then** the card shows that state's name and sentence and marks the state as picked.
2. **Given** the same card, **When** the developer picks a state that has next moves, **Then** the moves are listed under the sentence.
3. **Given** the same card, **When** the developer picks a second state, **Then** the first is no longer marked and the card shows the second.
4. **Given** the same card, **When** the board refreshes because a file changed, **Then** picking still works on the redrawn card.

### User Story 2 - A file name on the board does not look like a link (Priority: P2)

In VS Code a file name in a plan opens the file. The board cannot open a file, but it draws the same chip, with a pointer and a hover colour. After this change the chip reads as a name: no pointer, no hover, and the keyboard skips it.

**Why this priority**: a control that looks live and does nothing wastes a click. It misleads but breaks nothing.

**Independent Test**: open a plan with a file name on the board, hover it and tab through the page. The pointer stays an arrow, the chip does not change colour, and focus never lands on it.

**Acceptance Scenarios**:

1. **Given** a plan with a file name on the board, **When** the developer hovers it, **Then** the pointer and the chip's colours do not change.
2. **Given** the same plan, **When** the developer tabs through the page, **Then** focus never lands on a file name.

## Edge Cases

- A plan with two states cards: picking in one leaves the other alone.
- A state with no next moves and no screen: the card shows its name and sentence only.
- The comment and strike buttons on a calls row stay hidden, as they are today.
- VS Code keeps behaving exactly as it does now.

## Requirements

### Functional Requirements

- **FR-001**: Picking a state on a states card on the board MUST show that state's name and sentence in the card.
- **FR-002**: Picking a state MUST mark it as the picked one and unmark the one picked before.
- **FR-003**: Picking a state MUST show its next moves and its screen when it has them.
- **FR-004**: The board and VS Code MUST run the same picking code, not two copies.
- **FR-005**: Picking MUST keep working after the board redraws a document.
- **FR-006**: A file name on the board MUST NOT show a pointer, a hover colour, or take keyboard focus.
- **FR-007**: The comment and strike controls on a calls row MUST stay hidden on the board.

## Success Criteria

### Measurable Outcomes

- **SC-001**: On the board, one click on a state changes the card's caption to that state's name, every time.
- **SC-002**: The picking behaviour exists in one place in the source.
- **SC-003**: Zero file names on the board can be reached with the Tab key.
- **SC-004**: Every existing check of the board and of the viewer still passes.

## Assumptions

- Comment and strike stay VS Code only. The owner chose to hide them on the board, and they already are.
- The board cannot open a file, so a file name is made inert, not wired.
- A new board picture of a states card is taken in release QA with the other pictures, not here.
- Whether a plan run started from the board writes plan blocks is checked in release QA, in the real app.
