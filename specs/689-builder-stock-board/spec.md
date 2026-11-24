# Workflow Builder on stock Spec Kit

A project that runs stock Spec Kit, without the Companion extension, opens the Workflow Builder and sees the same board a Companion project sees: one lane per step, a card per command, its hooks inside the card, review gates on the arrows between lanes. It can add, change and remove its own hooks through the same add modal, see which layer of each template is in force, and reach the one way to add Companion.

## User Scenarios & Testing

### User Story 1 - The same board on a stock project (Priority: P1)

A developer whose project runs stock Spec Kit opens the builder. Each command step is a lane with its number, name and a quiet count line. Inside the lane one card names the command, shows its command and the file it writes, with the hooks that run before it at the top of the card and the ones after it at the bottom. A review gate sits as a small chip on the arrow between two lanes and says it waits for you. Under each card a dashed, muted block says in plain words what Companion would add there. One quiet banner under the header says what this project runs and offers one button to add Companion.

**Why this priority**: it is the board itself; nothing else on stock is reachable without it.

**Independent Test**: open the builder on a stock project with a workflow that has two commands and a gate between them; the lanes, the card, the gate chip, the "With Companion" blocks and the banner are drawn.

**Acceptance Scenarios**:

1. **Given** a stock workflow of specify, a review gate, then plan, **When** the builder opens, **Then** it draws two lanes and the gate as a chip on the arrow between them, reading "waits for you".
2. **Given** any stock project, **When** the builder opens, **Then** the header says changes apply at once and offers no Build.
3. **Given** the product has a command that adds the Companion extension, **When** the developer presses Add Companion, **Then** that command runs.
4. **Given** a narrow panel, **When** the builder opens, **Then** the lanes stack, with a down arrow and the gate chip between them.

---

### User Story 2 - Hooks: an extension's and your own (Priority: P1)

An extension's hook shows neutral, with who registered it and an on/off switch. The developer's own hook shows in the "yours" style. "+ before" and "+ after" on a card open the add modal, limited to what stock supports: the skill or command name, a description, required or optional, and what an optional hook asks. Pressing a hook opens a popover with its real fields; for the developer's own hook it offers Edit and Remove.

**Why this priority**: hooks are the one thing a stock project customises step by step.

**Independent Test**: add a hook after plan through the modal; the host is asked to add it with exactly the typed fields. Open your own hook; Edit and Remove send the change and the removal by its address.

**Acceptance Scenarios**:

1. **Given** an installed extension's hook, **When** the developer flips its switch, **Then** the hook is switched by its address and nothing else changes.
2. **Given** the add modal for "after plan", **When** the developer types a name, picks optional, writes a prompt and adds, **Then** the host is asked to add that hook after plan with those fields.
3. **Given** the developer's own hook, **When** they open it and choose Edit, **Then** the same modal opens filled in, and saving sends the change for that hook's address.
4. **Given** the developer's own hook, **When** they choose Remove, **Then** the host is asked to remove it by its address.
5. **Given** an extension's hook, **When** its popover opens, **Then** it shows its fields and offers no Edit or Remove.

---

### User Story 3 - Which template layer is in force (Priority: P2)

A quiet documents row under the lanes lists each template and the constitution. Opening it shows a modal: each template with its layers, top first, the one in force marked, and Open. The constitution offers Open and Revise.

**Why this priority**: "which one wins" is the question a stock project with presets cannot answer today.

**Independent Test**: a template with an override over a preset over core opens with three layers, the override marked in use and the others marked hidden.

**Acceptance Scenarios**:

1. **Given** a template with layers, **When** the documents modal opens on it, **Then** the layers are listed top first and the one in force is marked.
2. **Given** a template without layer data, **When** the modal opens on it, **Then** it shows the template and Open, and no layers.
3. **Given** the constitution, **When** the developer presses Revise, **Then** the stock command that owns it runs.

---

### User Story 4 - Workflows and presets (Priority: P3)

The header shows which workflow is drawn and switches among the installed ones. A quiet "Extensions and workflows" control opens a modal with the installed workflows (draw, open) and the Spec Kit presets the host already lists.

**Why this priority**: it keeps what the board already offers, in the new layout.

**Independent Test**: pick another workflow in the switcher; the host is asked to draw it.

**Acceptance Scenarios**:

1. **Given** two installed workflows, **When** the developer picks the other, **Then** the host is asked to draw it.
2. **Given** installed presets, **When** the modal opens, **Then** the presets panel lists them.

### Edge Cases

- No steps found: the board says so and still offers the documents and the banner.
- No registry file: hooks still draw; adding writes the registry through the host.
- A hook with no description or command: it is named by what it has, never blank.
- A hook added while the modal is open elsewhere, or the board redrawn after a write: the modal closes on add unless "keep open" is ticked.
- A template with one layer: it is in force alone; nothing is marked hidden.
- A stock step with no file it writes: the card shows only the command.

## Requirements

### Functional Requirements

- **FR-001**: The stock board MUST draw one lane per command step, in run order, each with its number, name and a count line of its command and hooks.
- **FR-002**: Each lane MUST hold one card naming the command's label, its command in this project's spelling and the files it writes.
- **FR-003**: A review gate MUST be drawn as a chip on the join between two lanes that says it waits for you, not as a lane.
- **FR-004**: Under each card the board MUST draw a dashed, muted "With Companion" block saying in plain words what Companion adds there, with no number the host did not send.
- **FR-005**: The board MUST show one quiet banner under the header with the stock message and one outline button that runs the product's existing command to add the Companion extension.
- **FR-006**: The header MUST say changes apply at once and MUST NOT offer Build.
- **FR-007**: An installed extension's hook MUST be neutral, name its extension, and carry an on/off switch that sends the switch by the hook's address.
- **FR-008**: The developer's own hook MUST be drawn in the "yours" style.
- **FR-009**: Each card MUST offer "+ before" and "+ after", which open the add modal for that side of that step.
- **FR-010**: The stock add modal MUST take a skill or command name, a description, required or optional, and an optional prompt, and MUST send the add for that step and side.
- **FR-011**: A hook MUST open a popover showing its real fields; for the developer's own hook the popover MUST offer Edit and Remove, which send the change or the removal by the hook's address.
- **FR-012**: A documents row MUST open a modal listing each template with its layers top first and the one in force marked, with Open; the constitution MUST offer Open and Revise.
- **FR-013**: The header MUST show the drawn workflow and switch among installed workflows; a modal MUST list the installed workflows and the Spec Kit presets.
- **FR-014**: At narrow widths the lanes MUST stack, the popover MUST become a sheet, and every modal MUST hold the keyboard and give focus back on close.
- **FR-015**: Every action the stock board had before MUST still be reachable.

### Key Entities

- **Stock step** *(existing)*: a command or a gate, with what it writes and its hooks.
- **Stock hook** *(existing)*: an entry in the extension registry, addressed by step, side and index; it is the developer's own or an extension's.
- **Template** *(existing)*: a document shape with the layers it resolves through and the layer in force.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A stock project's board reads as the same lanes and cards as a Companion project's: lanes, cards, hooks inside cards and gates between lanes, at wide and narrow widths.
- **SC-002**: A developer adds a hook of their own to a stock step in one modal, in under 30 seconds.
- **SC-003**: For every template with layers, the layer in force is named in one click from the board.
- **SC-004**: 100% of the actions the stock board offered before remain reachable.

## Non-goals

- Extension lists with priorities and on/off, preset on/off and priorities, workflow overlays, and creating or removing an override from the panel: the host does not provide them.
- A "last run" line on stock hooks: the run record is Companion's.
- Skill search in the stock modal: the stock view carries no skill catalog.
- Changes to the host's stock writers.

## Change-level rules

- Draw a status, source or warning only from fields the host sends.
- Host theme tokens only; no hard-coded colours.
- No new dependency.

## Verification plan

1. Unit tests on the board: lanes, gate chips, banner button, switch, add modal fields, popover Edit and Remove, documents modal layers, workflow switcher.
2. Storybook stories for the stock board, its add modal, a hook popover and the documents modal, wide and narrow.
3. Type check and the related tests.

## Assumptions

- The "With Companion" copy is fixed per step kind, since the host sends no node counts for a stock project.
- Add Companion runs the existing install command for the Companion Spec Kit extension through a new board message the stock guard allows.
- The hook popover is a dialog beside the card when wide and a sheet when narrow, like the node popover.
- Hook run status is not shown on stock: the stock view sends no run record.
