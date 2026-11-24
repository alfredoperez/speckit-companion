# Workflow Builder: add a hook from a focused modal

## User Scenarios & Testing

### User Story 1 - Add a hook from the spot you clicked (Priority: P1)

A developer looks at a node on the board, hovers it (or tabs to it), and sees a "+ before" control on its top edge and a "+ after" control on its bottom edge. Pressing one opens a centred modal titled with the place, "Add before Execute the tasks", with "in implement" under it. The search field has the focus. They type "test", the skill list narrows, the first match is highlighted, and Enter adds it. The modal closes and the focus goes back to the "+" they pressed.

**Why this priority**: it is the whole point of the slice: the place is chosen by where you clicked, and adding takes one field and one key.

**Independent Test**: render the board, press "+ before" on a node, type a skill name, press Enter, and check one add-hook message carries that node, `before`, `skill` and the name.

**Acceptance Scenarios**:

1. **Given** a node on the board, **When** the person hovers it or moves the keyboard focus onto it, **Then** "+ before" and "+ after" controls show on its edges, and both can be reached with Tab.
2. **Given** the person presses "+ after" on a node, **When** the modal opens, **Then** its title reads "Add after <node name>", the line under it reads "in <step>", and the search field is focused.
3. **Given** the modal is open on Skill with several matches, **When** the person presses Down, Up and Enter, **Then** the highlight moves and Enter adds the highlighted skill.
4. **Given** the modal is open, **When** the person presses Escape or Cancel, **Then** nothing is written, the modal closes and the focus returns to the "+" that opened it.
5. **Given** the modal is open, **When** the person presses Tab from the last control, **Then** the focus wraps to the first control inside the modal.

### User Story 2 - Choose a skill knowing where it comes from (Priority: P1)

The skill list says where each skill lives: "from this project", "from <plugin>", or "yours". A skill the assistant cannot call, or one that is turned off, carries a quiet note saying so. A name typed that matches nothing is still offered, with the plain warning "not installed".

**Why this priority**: picking a skill without knowing its source is how a hook ends up calling something missing.

**Independent Test**: feed a catalog with a project, a plugin and a user skill, one not callable; check each row's note; type an unknown name and check it can be added and says "not installed".

**Acceptance Scenarios**:

1. **Given** the project sends a skill catalog, **When** Skill is chosen, **Then** each row shows its source line from the catalog and nothing else is invented.
2. **Given** a catalog entry that is not callable or not enabled, **When** it is listed, **Then** its row carries a quiet note naming that.
3. **Given** no catalog arrives, **When** Skill is chosen, **Then** the plain list of skill names is shown with no source line.
4. **Given** the typed text matches no listed skill exactly, **When** the list is shown, **Then** a row for the typed name reads "not installed" and adding it is allowed.

### User Story 3 - Add several, or write an instruction (Priority: P2)

With "Keep open to add another" ticked, Add writes the hook, the modal stays, a line at its top says "Added <name>", and the field empties for the next one. Choosing Instruction swaps the search for a text box; Shell command takes one line; Node file searches this project's node files.

**Why this priority**: adding two hooks in a row is common, and the other three kinds must stay reachable.

**Independent Test**: tick the box, add a skill, then switch to Instruction, type a sentence and add it; check two add-hook messages and that the modal is still open.

**Acceptance Scenarios**:

1. **Given** "Keep open to add another" is ticked, **When** Add is pressed, **Then** the hook is written, the modal stays open, and "Added <name>" is announced.
2. **Given** Instruction is chosen, **When** the person types and presses Add, **Then** an instruction hook with that text is written.
3. **Given** the project registers commands, **When** Instruction is chosen, **Then** the commands are listed and picking one fills the instruction that runs it.

### User Story 4 - Edit a hook in the same modal (Priority: P2)

Opening an existing hook, from its row on the board or from the node popover, opens the same modal prefilled with its kind and value, titled "Edit hook", with its place, its order among its neighbours, Remove and Save.

**Why this priority**: two different forms for adding and editing the same thing would drift apart.

**Independent Test**: open a hook from the board, change its value, Save; check one write that replaces it in place.

**Acceptance Scenarios**:

1. **Given** a hook on the board, **When** it is opened, **Then** the modal shows its kind and value and a Save button.
2. **Given** an edited hook moved to another place, **When** Save is pressed, **Then** one move carries the edit.
3. **Given** an edited hook, **When** Move up, Move down or Remove is pressed, **Then** the same writes as before are sent.

### User Story 5 - Other ways in, and a narrow panel (Priority: P3)

The phase menu's "Add hook", the node popover's "Add hook" and the node pane's "Add hook" open the same modal with the place already set. When the builder is narrow the modal is a full-height sheet with a Close button.

**Why this priority**: every route to adding a hook must lead to one place, and the panel is often docked narrow.

**Independent Test**: from the phase menu pick "Add hook" and check the title names the phase; render narrow and check the sheet class.

**Acceptance Scenarios**:

1. **Given** the phase menu, **When** "Add hook" is picked, **Then** the modal opens titled "Add before the <phase> phase".
2. **Given** the builder is narrow, **When** the modal opens, **Then** it fills the height as a sheet and keeps the same controls.

### Edge Cases

- The node popover closes as the modal opens, so the focus returns to the node's own button when the "+" is gone.
- An empty field cannot be added: Add stays disabled and Enter does nothing.
- A menu open inside the modal takes Escape for itself, so one Escape closes the menu, not the modal.
- Switching kinds empties the value and the note, so a value typed for one kind is never written as another.
- A rebuild while the modal is open keeps it open, with what was typed.
- Reduced motion: the modal appears with no animation.

## Requirements

### Functional Requirements

- **FR-001**: Each node MUST carry "+ before" and "+ after" buttons on its edges, shown on hover and on keyboard focus, and always in the Tab order.
- **FR-002**: Pressing one MUST open a modal titled "Add before|after <node name>" with "in <step>" under it, with the search field focused.
- **FR-003**: The modal MUST offer four kinds as buttons: Skill, Instruction, Shell command, Node file.
- **FR-004**: For Skill and Node file the modal MUST list matches for the typed text; Up and Down move the highlight, Enter adds the highlighted row.
- **FR-005**: The Skill list MUST come from the project's skill catalog when present, with each row's source ("from this project", "from <plugin>", "yours"), and fall back to plain names when absent.
- **FR-006**: A skill the assistant cannot call, or one not enabled, MUST carry a quiet note saying so.
- **FR-007**: A typed name not in the list MUST still be addable, with the warning "not installed".
- **FR-008**: The modal MUST have "Keep open to add another", Cancel and Add; with the box ticked, Add MUST keep the modal open and announce "Added <name>".
- **FR-009**: Escape and Cancel MUST close the modal without writing, and the focus MUST return to the control that opened it.
- **FR-010**: The modal MUST keep the focus inside it while open.
- **FR-011**: Editing a hook MUST open the same modal prefilled, keeping its place, order, Remove and Save actions.
- **FR-012**: The phase menu's, the node popover's and the node pane's "Add hook" MUST open the modal with the place already set.
- **FR-013**: When the builder is narrow the modal MUST be a full-height sheet.
- **FR-014**: Every write the old side form could send (add, edit, move, reorder, remove) MUST still be sent the same way.

### Key Entities

- **Skill choice** *(existing)*: a skill a hook can name, with its source, where it lives, whether the assistant can call it and whether it is enabled.
- **Hook** *(existing)*: what runs before or after a node or phase, of one of four kinds.

### Success Criteria

- **SC-001**: A skill hook can be added from the board in three actions: press "+", type, press Enter.
- **SC-002**: Every control in the modal is reachable by keyboard, and the focus never leaves the modal while it is open.
- **SC-003**: 100% of the hook writes the side form could send are still sent by the modal, proven by tests.
- **SC-004**: No source, status or warning is drawn that the project did not send.

## Non-goals

- The board's "Added. Build to apply. Undo" line under the node: the existing status line keeps saying it.
- Adding hooks on a stock Spec Kit project's board.
- Changing what the host writes.

## Change-level rules

- No new dependency, no host change, no protocol change.
- Colours come from the host theme tokens; accent fill only on Add.

## Verification plan

1. Unit tests: open from "+", type and Enter, catalog notes, unknown name, keep open, edit and remove, Escape returns focus.
2. In the Extension Development Host, hover a node, press "+ before", add a skill, then narrow the panel and add again from the sheet.

## Assumptions

- "+ before" adds at the end of the node's before hooks, and "+ after" at the end of its after hooks, as the old seams did.
- The old dashed seams between nodes are replaced by the edge buttons; dropping a dragged hook on a card's upper or lower half still places it.
- The place can still be changed inside the modal from a quiet "Runs before <place>" line, so nothing the side form could do is lost.
- A plugin skill's source reads "from <where>" using the catalog's own `where` text.

## Verbatim Constraints

- `+ before`, `+ after`, `Add before <node>`, `in <step>`, `Skill`, `Instruction`, `Shell command`, `Node file`, `Keep open to add another`, `Cancel`, `Add`, `not installed`, `from this project`, `yours`, `Up and down move · Enter adds · Esc closes`
