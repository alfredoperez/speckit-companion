# Feature Specification: Drag a hook between anchors

**Feature Branch**: `feat/665-drag-actions-between-hooks`
**Created**: 2026-10-01
**Status**: Draft
**Input**: Issue #665, "A node is fluid: drag it between hooks, anchors and steps, or unlink it entirely". Move a project's own hook from one anchor to another, or to another place at the same anchor, by dragging it on the Pipeline Builder board or from the keyboard.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Drag a hook to another anchor (Priority: P1)

Someone attached a test command after one node and now wants it to run before another. They grab the hook's row on the board and drop it on the other node's side, a seam, or another hook block. The configuration is rewritten with the hook at its new place, the board redraws from the file, and the status line says where it went.

**Why this priority**: moving work between anchors is the gesture the issue asks for. Today it means opening the form or the file.

**Independent Test**: on a board with one project hook, drag it onto a different node's card and confirm the configuration holds it under the new anchor and side and nowhere else.

**Acceptance Scenarios**:

1. **Given** a project hook after node A, **When** it is dropped on the upper half of node B's card, **Then** the configuration holds it before B, it is gone from after A, and the status line says it moved to before B.
2. **Given** a project hook, **When** it is dropped on an empty seam or on another anchor's hook block, **Then** it joins the end of that anchor's hooks on that side.
3. **Given** the only hook at an anchor is moved away, **When** the configuration is written, **Then** the emptied anchor key is removed and every comment elsewhere in the file is unchanged.

---

### User Story 2 - Reorder hooks at one anchor (Priority: P1)

Two hooks run after the same node, and the second has to run first. Dropping one on the upper or lower half of the other puts it above or below it, which is the order they run in.

**Why this priority**: hooks at one anchor run top to bottom in declared order, so order is behaviour, not layout.

**Independent Test**: with two hooks at one anchor, drop the second on the upper half of the first and confirm their order in the configuration is swapped.

**Acceptance Scenarios**:

1. **Given** hooks X then Y after node A, **When** Y is dropped on the upper half of X, **Then** the configuration lists Y then X after A.
2. **Given** a hook dropped on itself, **When** the drop lands, **Then** nothing is written.

---

### User Story 3 - Move a hook from the keyboard (Priority: P1)

A keyboard or screen-reader user opens a hook (Enter on its row) and moves it with Move up and Move down on the form's Order row, or picks another place in the form's Runs fields and saves. Each move is one write, the form stays open on the same hook, and the form's live region reads the outcome once the write answers.

**Why this priority**: dragging is pointer-only. Without this the feature excludes keyboard users.

**Independent Test**: tab to a hook, open it, press Move up, and confirm the configuration changed and the live region said so only after the write answered.

**Acceptance Scenarios**:

1. **Given** the second of two hooks at an anchor is open in the form, **When** Move up is pressed, **Then** it becomes the first, the form still shows it, and the live region reads the status line's text.
2. **Given** the first hook at an anchor is open, **When** the Order row is read, **Then** Move up is disabled and says it is already first.
3. **Given** a hook's Runs fields are changed to another anchor and saved, **When** the write runs, **Then** it is one move: a refusal leaves the hook exactly where it was.

---

### User Story 4 - Refused moves say why (Priority: P2)

Hooks registered by a spec-kit extension, and the project's parked hooks while the shipped workflow is in force, are drawn on the board but are not the panel's to move. Dragging one out is refused with a reason, and nothing accepts a drop on them. A drop the configuration could not express, or a drop into another step's lane, is refused before anything is written.

**Why this priority**: a gesture that silently does nothing reads as broken.

**Independent Test**: start a drag on an extension's hook and confirm the status line names who registered it and that nothing moves.

**Acceptance Scenarios**:

1. **Given** a hook registered by the git extension, **When** a drag starts on it, **Then** the drag does not start and the status line says it was registered by the git extension and is not moved here.
2. **Given** a project hook being dragged, **When** it is held over an extension's hook row, **Then** the row does not accept the drop.
3. **Given** a project hook in plan, **When** it is dropped in the implement lane, **Then** nothing is written and the status line says a hook moves within its own step.
4. **Given** a move whose target anchor the step no longer has, or whose name resolves to a different boundary than the one dropped on, **When** the writer receives it, **Then** it refuses, the file is untouched, the board redraws from disk, and the reason is in the status line and the live region.

### Edge Cases

- The board is stale and the hook's index no longer exists in the file: the writer refuses ("there is no hook N") and writes nothing.
- A phase and a node share a name: a drop on the phase's block that would resolve to the node is refused.
- The narrow stacked layout: rows, cards and seams accept drops the same way; the form's Order row wraps inside the panel.
- Reduced motion: no drag feedback depends on a transition.
- A move while the shipped workflow is in force is refused by the writer with its existing reason.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A project hook's row on the board MUST be draggable, and dropping it on another anchor's card half, seam, or hook block MUST move it there in one configuration write.
- **FR-002**: Dropping a project hook on the upper or lower half of another project hook at the same or another anchor MUST place it directly above or below that hook.
- **FR-003**: The move MUST be one atomic writer operation: the entry is taken from its old place and put at its new one in a single write, and a refusal MUST leave the file untouched.
- **FR-004**: The moved entry MUST keep its exact text, and every other line of the configuration, comments included, MUST be unchanged except an anchor key the move emptied.
- **FR-005**: The writer MUST refuse a move to an anchor the step does not have, a move whose anchor resolves to a different boundary than the one requested, and a move from an index that does not exist.
- **FR-006**: Hooks registered by a spec-kit extension and parked hooks MUST NOT accept drops, and starting a drag on one MUST show the reason in the status line instead of dragging.
- **FR-007**: A drop into another step's lane MUST be refused in the panel, before any write, with the reason in the status line.
- **FR-008**: The hook form MUST offer Move up and Move down on an Order row for an existing project hook, each disabled with its reason at the matching edge.
- **FR-009**: Saving the hook form at a different anchor or side MUST use the same atomic move, carrying any edit to the hook's content in the same write.
- **FR-010**: The status line and the form's live region MUST announce a move only once its write answers, reading the outcome on success and the reason on refusal.
- **FR-011**: Drag and the keyboard path MUST work in the narrow stacked layout and with reduced motion.

### Key Entities

- **Project hook**: one entry under a step's hooks, addressed by side, anchor and its index among that anchor's entries.
- **Move**: a hook's old address, its new side and anchor, and its new index (or the end).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A hook can be moved between anchors, or reordered at one, with one gesture and no file editing.
- **SC-002**: 100% of refused moves leave the configuration byte-identical and show a reason.
- **SC-003**: Every move available by pointer is available from the keyboard.
- **SC-004**: A move's configuration diff touches only the moved entry's line(s) and any emptied anchor key.

## Assumptions

- Moves stay within one step. Moving a hook to another step is out of scope and refused with a reason; it can be added there instead.
- Step-level hooks are not drawn on the board today, so they are neither drag sources nor targets.
- The form's Runs fields remain the keyboard route to another anchor; no second "Move to…" menu is added.
- A move has no Undo; moving it back is one more gesture.

## MODIFIED Requirements
<!-- capability: attach-a-hook -->

### A hook can be changed, moved or taken out

Clicking one of the project's hooks SHALL open the form filled from it, with **Remove** offered. Saving without moving it SHALL replace it in place. Saving it to another anchor or side SHALL move it in one write, carrying any change to what it runs, and close the form, and a move that is refused SHALL leave the configuration exactly as it was. A hook an extension registered, or a parked hook, SHALL offer no edit.

#### Scenario: a move carries an edit
- **WHEN** a hook after one node is given a new command and saved to run before another node
- **THEN** the configuration holds it only before the new node, running the new command, and the form closes

#### Scenario: a move is refused
- **WHEN** a hook is saved to another anchor while the shipped workflow is in force
- **THEN** the hook stays where it was, no second copy appears, and the panel says why

## ADDED Requirements
<!-- capability: attach-a-hook -->

### A project hook can be dragged to another place on its step

One of the project's hooks SHALL drop onto another hook's upper or lower half, a node card's upper or lower half, a dotted slot, a hook block or a phase heading, and run from there after one write.

#### Scenario: moving to another node
- **WHEN** a hook after one node is dropped on the upper half of another node's card
- **THEN** the configuration holds it before that node and not after the first, and the status line says where it went

#### Scenario: reordering at one anchor
- **WHEN** the third hook after a node is dropped on the upper half of the first
- **THEN** it runs first there and the status line says it moved up

### A move changes only the moved hook's lines

A move SHALL keep the moved entry's exact text and leave every other line of the configuration as it was, comments included, apart from an anchor key the move emptied.

#### Scenario: moving an anchor's only hook
- **WHEN** the only hook at an anchor is moved to another anchor in a file with comments
- **THEN** the diff touches only that entry's lines and removes the emptied anchor key, and every comment is unchanged

### The hook form moves a hook one place up or down

The hook form SHALL offer **Move up** and **Move down** on an **Order** row for a project hook, each moving it one place within its side and anchor and keeping the form open on it, and each SHALL be unavailable with its reason at the matching edge.

#### Scenario: moving from the keyboard
- **WHEN** Move up is pressed on the second of two hooks in its form
- **THEN** it becomes the first and the form still shows it

#### Scenario: already first
- **WHEN** the form is open on the first hook at its anchor
- **THEN** Move up is unavailable and says the hook is already first

### A move is announced only once its write answers

The status line and the form's live region SHALL say nothing about a move until its write answers, then read the outcome on success and the reason on refusal.

#### Scenario: a refused move from the form
- **WHEN** Move down is pressed and the write is refused
- **THEN** the live region never says the hook moved and reads the refusal's reason

### Extension and parked hooks neither drag nor take a drop

A hook an extension registered, or a parked hook, SHALL take no drop, and a drag started on one SHALL not start and SHALL show the reason in the status line.

#### Scenario: dragging an extension's hook
- **WHEN** a drag starts on a hook the git extension registered
- **THEN** nothing moves and the status line says the git extension registered it and it is not moved in this panel

### A drop in another step's lane is refused before anything is written

A hook SHALL move only within its own step, and a drop in another step's lane SHALL write nothing and say why in the status line.

#### Scenario: dropping in another step
- **WHEN** a hook of the plan step is dropped in the implement lane
- **THEN** the configuration is unchanged and the status line says a hook moves within its own step

### A move to a place the step does not have is refused before it is written

The writer SHALL refuse a move to a node or phase the step does not have, or to a name that resolves to a different boundary than the one dropped on, and leave the file as it was.

#### Scenario: a phase that shares a node's name
- **WHEN** a hook is dropped on the `orchestrate` phase of a step that also has an `orchestrate` node
- **THEN** the move is refused with the reason and the file is byte for byte unchanged
