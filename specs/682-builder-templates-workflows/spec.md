# Feature Specification: Templates and saved workflows in the Workflow Builder

**Feature**: `682-builder-templates-workflows`
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Change a document's sections from the node that writes it (Priority: P1)

A person looks at the node that writes a document, for example "Write the plan". Its popover shows one row, "Document: plan.md · 5 sections · 1 yours". Opening it shows the document's sections in order, each saying whether it is shipped or replaced and by what. Opening a section offers the fragments written for it and a way back to the shipped section. Beside the list, an outline of the resulting document shows what each section will hold. Done saves the picks; Cancel drops them.

**Why this priority**: the template feature had one door, a small chip on the step header, far from the node that actually writes the file.

**Independent Test**: open a node that writes a templated file, pick a fragment for one section, press Done, and see the section marked as yours with the fragment's name.

**Acceptance Scenarios**:

1. **Given** a step whose template has sections, **When** a person opens the popover of the node that writes that file, **Then** it shows a row naming the file, the section count and how many are the project's own.
2. **Given** the document modal is open, **When** a person opens a section with fragments on offer, **Then** each fragment is listed with its summary, the chosen one is marked, and "Restore shipped" is offered when the section is replaced.
3. **Given** a person picked a fragment, **When** they press Done, **Then** the panel asks the host to point that section at the fragment, and only the sections whose pick changed are written.
4. **Given** a person picked a fragment, **When** they press Cancel or Escape, **Then** nothing is written.
5. **Given** the modal is open, **Then** the outline beside the list shows every section with what it will hold after the picks, and says the full text lives in the template file.

### User Story 2 - Switch workflows from the header (Priority: P1)

The workflow name in the header is a dropdown: Shipped, This project, then a Saved group with each saved workflow, ending in "New workflow…". The one in force is checked. After a switch, the header says the workflow is selected and not built, until a build makes it current.

**Why this priority**: switching is the main workflow action and must say plainly that nothing runs differently until Build.

**Independent Test**: pick a saved workflow and see the header read "Selected, not built" next to its name.

**Acceptance Scenarios**:

1. **Given** the project has saved workflows, **When** the dropdown opens, **Then** it lists Shipped, This project (when the project has its own file), a Saved group, and "New workflow…".
2. **Given** a person picks another workflow, **When** the board redraws with it in force and the build is not current, **Then** the header says "Selected, not built".
3. **Given** the person then builds, **When** the build is current, **Then** the line goes away.

### User Story 3 - Create a workflow from a small modal (Priority: P2)

"New workflow…" opens a small modal with a name field and a "Start from" choice: Shipped, This project, or any shipped preset the host offers. Create writes the workflow; Cancel or Escape closes it.

**Why this priority**: creating is rarer than switching, but the side pane it lived in is being retired.

**Independent Test**: open New workflow, type a name, pick a preset, press Create, and see the host asked to create it from that preset.

**Acceptance Scenarios**:

1. **Given** the modal is open, **When** the name is empty, malformed or already taken, **Then** Create is disabled and a malformed or taken name says why.
2. **Given** a valid name and a start, **When** Create is pressed, **Then** the host is asked to create the workflow from that start.

### Edge Cases

- A step has a template but no node declares the file: the row goes on the step's first authoring node, so the feature stays reachable.
- No fragment is written for any section: the modal says so once and still lists the sections.
- A rebuild removes the step while the modal is open: the modal closes.
- The host sends no saved workflows: the Saved group is omitted.
- The project has no `companion.yml`: "This project" is not offered.
- Narrow width: both modals become bottom sheets; the document sheet splits Sections and Preview into two tabs.

## Requirements

### Functional Requirements

- **FR-001**: The popover of the node that writes a step's templated file MUST show a "Document" row with the file name, section count and the count of sections the project replaced.
- **FR-002**: The Document row MUST open a modal listing every section of the template in order, each marked shipped or yours with the chosen fragment.
- **FR-003**: Opening a section MUST list the fragments written for it, mark the chosen one, and offer "Restore shipped" when the section is replaced.
- **FR-004**: Picks MUST be held until Done, which sends one section write per changed section; Cancel and Escape MUST write nothing.
- **FR-005**: The modal MUST show an outline of the resulting document beside the list, built only from section headings and fragment names and summaries.
- **FR-006**: The modal MUST keep the advice to write a section as a placeholder.
- **FR-007**: The step header MUST no longer carry the "Document shape" chip, and the side-pane template form MUST be removed.
- **FR-008**: The header's workflow dropdown MUST list Shipped, This project (when offered), each saved workflow under a Saved heading, and "New workflow…", with the one in force marked.
- **FR-009**: After a switch or a create, the header MUST say the workflow is selected and not built while the build is not current.
- **FR-010**: "New workflow…" MUST open a modal with a name field and a start choice of Shipped, This project (when offered) and each preset the host offers.
- **FR-011**: Both modals MUST trap focus, close on Escape, return focus to their opener, and become bottom sheets at narrow width.
- **FR-012**: Every builder action available before the change MUST remain reachable.

### Key Entities

- **Template** *(existing)*: the file a step writes, its available sections, the replaced ones and the fragment chosen for each.
- **Fragment** *(existing)*: a shipped alternative for one section, with a name and summary.
- **Workflow** *(existing)*: a named configuration; `shipped`, the project's own, or a saved one.
- **Preset** *(existing)*: a shipped configuration a new workflow can start from.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A section can be pointed at a fragment in at most four actions from the board: open node, open Document, open section, pick and Done.
- **SC-002**: Zero writes happen when the document modal is cancelled.
- **SC-003**: Every webview-to-host message the builder sent before the change is still sent by some control after it.
- **SC-004**: The modals pass keyboard-only use: open, move, choose, close, and focus returns to the opener.

## Non-goals

- A rendered preview of the document's real text: the host does not produce one.
- A one-line summary per saved workflow: the host does not send one.
- A "What differs from shipped" row in the workflow menu.
- Any host or protocol change.

## Change-level rules

- No new dependency and no protocol change.
- Host tokens only; follow the user's VS Code theme.
- No pixel baselines or clips regenerated in this change.

## Verification plan

1. Unit tests: the Document row, the modal's pick, Done, Cancel and Restore flows, the outline, the workflow menu's groups, the selected-not-built line, and the new-workflow modal.
2. Stories for the document modal, the workflow menu and the new-workflow modal, wide and narrow.
3. `npx tsc --noEmit -p ./` and the related jest tests pass.

## Assumptions

- The node that writes the document is the one whose writes include the template's file name without `-template`; otherwise the step's first authoring node.
- "Selected, not built" shows after a switch or create made in this panel session while the build is not current; the panel cannot know a switch made elsewhere.
- Picks being staged until Done is the intended meaning of the design's Cancel and Done buttons.

## Verbatim Constraints

- `Document: <file>`
- `Restore shipped`
- `Replace with`
- `New workflow…`
- `Selected, not built`
- `Write a section as a placeholder, like [List the house rules or write None]. Text written as an order tends to be ignored by the assistant.`
