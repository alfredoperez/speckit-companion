# Feature Specification: Builder structure — add, move and remove through the modal and the popover

**Feature Branch**: `feat/builder-redesign-core`
**Created**: 2026-11-24
**Status**: Draft
**Input**: Workflow Builder: add a node or a step, move and remove nodes through the add modal and the node's popover.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a node from the lane (Priority: P1)

A person looking at a lane wants the step to do one more thing. They press "+ Add to implement" in the lane's header, pick Node in the first row of choices, search the nodes on offer, see which are shipped optional nodes and which they removed earlier, and add one at the end of a phase they choose.

**Why this priority**: adding a node was buried in a phase's "+" menu; the lane button is the one obvious way in.

**Independent Test**: open the modal from a lane, choose Node, pick a node, press Add node, and check the builder asks the host to put that node at the end of the chosen phase.

**Acceptance Scenarios**:

1. **Given** a step with nodes on offer, **When** the person presses "+ Add to <step>", **Then** a modal titled "Add to <step>" opens with a choice row Hook · Node · Step and focus inside it.
2. **Given** the Node choice, **When** the person types in the search, **Then** only matching nodes on offer are listed, each with its name, its id, and whether it is a shipped optional node or one removed from this run.
3. **Given** a node is chosen, **When** the person presses Add node, **Then** the node is added at the end of the phase shown in "Goes at the end of" and the modal closes unless "Keep open to add another" is ticked.
4. **Given** a step with nothing on offer, **When** the person chooses Node, **Then** the modal says nothing is on offer and where a node file of their own would go.

### User Story 2 - Move a node through its popover (Priority: P1)

A person opens a node's popover and presses "Move…". The body becomes a short list of places: up, down and each other phase. Places the run would refuse are greyed and say why, and a held neighbour is marked. Choosing a legal place moves the node.

**Why this priority**: moving was hidden in a "More" menu with no reasons, and a refused move only spoke after it failed.

**Independent Test**: open a node whose "up" would put it before a node it reads; check that row is inert and gives the reason, and that a legal row sends the move.

**Acceptance Scenarios**:

1. **Given** a node that reads the node above it, **When** the move list opens, **Then** "Up, above <name>" is inert and reads "It reads <name>, so it cannot run before it."
2. **Given** a node that another node below it reads, **When** the move list opens, **Then** "Down" is inert and names the node that reads it.
3. **Given** a move that would shift a held node, **When** the move list opens, **Then** that place is inert and says the held node keeps its place.
4. **Given** the node itself is held, **When** the move list opens, **Then** no place is offered and the held reason is shown.
5. **Given** a legal place, **When** the person picks it (by pointer or Enter), **Then** the move is sent and the result is announced once the write answers.
6. **Given** the popover is a bottom sheet (narrow builder), **When** the move list is open, **Then** a Back control returns to the node's details.

### User Story 3 - Remove a node with Undo (Priority: P1)

From the popover, "Remove from the run" takes the node out. The lane keeps a struck-through row where it was, with an Undo button, for as long as the host offers the undo.

**Why this priority**: removal is destructive; seeing the hole and the way back in the same place makes it safe.

**Independent Test**: remove a node, feed the host's status with its undo token, and check the struck row appears in the right lane with Undo, and Undo sends the token.

**Acceptance Scenarios**:

1. **Given** a removable node, **When** the person presses Remove from the run, **Then** the removal is sent and the popover closes.
2. **Given** the host answers with an undo for that removal, **When** the lane redraws, **Then** a struck row with the node's name and an Undo button sits in the phase it left.
3. **Given** the struck row, **When** the person presses Undo, **Then** the undo is sent and the row goes away.
4. **Given** the last node of a step, **When** the popover opens, **Then** Remove from the run is inert and says a step needs at least one node.

### User Story 4 - Add a step, with the auto warning (Priority: P2)

From the lane modal's Step choice or the "+ step" control at the end of the lanes, a person names a new step, picks what it runs after and what it writes, and is told plainly that the hands-off auto command will not run it.

**Why this priority**: steps are rarer than nodes, and the warning prevents a wrong expectation.

**Independent Test**: choose Step, type a valid name, and check the warning names the steps auto runs, and Add step sends the new step.

**Acceptance Scenarios**:

1. **Given** the Step choice opened from a lane, **When** it shows, **Then** "Runs after" starts on that lane's step.
2. **Given** an invalid or taken name, **When** it is typed, **Then** the problem is said under the field and Add step is disabled.
3. **Given** the project has an auto command, **When** the Step choice shows, **Then** a warning says auto runs <first> through <last> and a step you add runs only when you start it.
4. **Given** the "+ step" control at the end of the lanes, **When** it is pressed, **Then** the same modal opens on Step, placed after the last step.

### User Story 5 - Phase label menu (Priority: P2)

A phase label is a button. It opens a small menu headed with the phase and its node count, offering Rename…, Split and Merge into the phase above or below.

**Why this priority**: these actions existed behind a "+" with five unrelated rows; the label is where people look.

**Independent Test**: open the menu on a middle phase and check both merge directions are offered and send the right grouping.

**Acceptance Scenarios**:

1. **Given** a middle phase, **When** its label menu opens, **Then** it offers Merge into <above>, above and Merge into <below>, below.
2. **Given** Rename…, **When** picked, **Then** the label turns into a field holding the name; Enter saves, Escape cancels, and hooks follow the new name.
3. **Given** a phase with one node, **When** the menu opens, **Then** Split is inert and says why.

### Edge Cases

- A step with no phases: the lane still offers "Add the first phase".
- A rebuild that removes the open popover's node closes the popover.
- A second remove replaces the first struck row; any other status clears it.
- A step name that matches no lane (stale) yields no struck row.
- Dragging a card by its grip and dragging hooks keep working as today.
- The Hook choice keeps every hook feature: kinds, search, where and when, keep open.
- Reduced motion: no animated transitions on the new parts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each lane header MUST show a "+ Add to <step>" button that opens the add modal for that step.
- **FR-002**: The add modal MUST open with a first row of choices Hook · Node · Step when it adds; editing a hook MUST show no choice row.
- **FR-003**: The Node choice MUST list exactly the nodes the step has on offer, searchable, naming each and saying whether it is shipped optional or removed from this run.
- **FR-004**: The Node choice MUST let the person choose the phase the node joins at its end, and MUST send the same add-node write the phase menu sends today.
- **FR-005**: The Step choice MUST offer name, display name, runs after and writes, validate the name as today, and send the same new-step write.
- **FR-006**: The Step choice MUST warn that the hands-off auto command will not run a step you add, naming the steps it does run, when the project has an auto step.
- **FR-007**: A "+ step" control MUST sit at the end of the lanes and open the modal on Step.
- **FR-008**: The node popover MUST offer Move…, Edit node and Remove from the run in its footer, and keep every other node action reachable.
- **FR-009**: Move… MUST list up, down and each other phase; a place the writer would refuse MUST be inert with the reason; held neighbours MUST be marked.
- **FR-010**: Remove from the run MUST send the removal and, while the host offers its undo, show a struck row with Undo in the lane.
- **FR-011**: A phase label MUST open a menu with Rename…, Split and Merge in both directions where they exist.
- **FR-012**: Every existing webview to host message MUST remain reachable from the builder.
- **FR-013**: The modal and the narrow sheet MUST trap focus and restore it; every icon-only control MUST have a name; motion MUST respect reduced motion.

### Key Entities

- **Node on offer** *(existing)*: a node the step can run and does not.
- **Move place**: a target for a node (up, down, or another phase), legal or refused with a reason.
- **Removed row**: a node just removed whose removal can still be undone.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adding a node from any lane takes at most three actions (open, pick, add).
- **SC-002**: 100% of places the writer refuses for reading order or held nodes show their reason before being picked.
- **SC-003**: Every builder action available before the change is reachable after it (checked against the message list).
- **SC-004**: Keyboard alone can add a node, move a node, remove and undo it, and rename or merge a phase.

## Non-goals

- No change to the host, the protocol or the writer.
- No new way to write a node file of your own.
- No change to the Inspector side pane.
- No pixel baselines or clips regenerated in this change.

## Change-level rules

- Host tokens only, light and dark; accent fill only for the forward action; no side stripes.
- Update the sibling stories with each component change.

## Verification plan

1. Unit tests: lane button opens the modal; Node tab sends addNode; Step tab sends newStep and shows the warning; move list refuses with reasons; remove shows the struck row and Undo; phase menu merges both ways.
2. `npx tsc --noEmit -p ./` and the related jest tests pass.
3. Storybook stories show the three modal choices, the move list and the phase menu.

## Assumptions

- The host does not say per place whether a move is legal, so the builder mirrors the writer's own rules (reads order, held nodes) and wording; the writer still decides.
- The host does not say which steps auto runs; the builder takes the shipped in-sequence steps, which matches the auto command's own list.
- "Your node file" cannot be told apart from "removed" in the data, so the list says only shipped optional or removed from this run.
- A node added from the lane defaults to the last phase that does not end on a held node.
- Add hook moves from the popover footer into its More menu, which keeps Open the file, variants and Use the shipped node.

## Verbatim Constraints

- `+ Add to <step>`, `Hook`, `Node`, `Step`, `Move…`, `Edit node`, `Remove from the run`, `Undo`, `Keep open to add another`, `Add node`, `Add step`, `Rename…`
