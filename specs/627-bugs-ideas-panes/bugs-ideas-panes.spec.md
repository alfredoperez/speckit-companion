# Feature Specification: Bugs and Ideas panes

**Feature Branch**: `627-bugs-ideas-panes`
**Created**: 2026-10-03
**Status**: Draft
**Input**: Issues #824 and #829, and the decisions D13, D14 and D4 of 2026-10-03: bugs and ideas each get their own pane beside Specs; before their Spec Kit extension is installed each pane shows one install row; ideas are built on the same reader as bugs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bugs have their own pane (Priority: P1)

A developer who uses Spec Kit's bug flow opens the SpecKit sidebar and finds a Bugs pane beside Specs. It groups bugs by where they stand, so the ones waiting for a fix or a test are at the top and never hidden behind a long list of specs.

**Why this priority**: Bugs exist in the product today but sit after Archived inside the Specs tree, where a project with many specs pushes them off screen. Moving them is the smallest step that makes the layout decision real.

**Independent Test**: In a project with bug reports in three different states, open the sidebar. The Bugs pane shows them under To fix, To test and Verified, and the Specs pane no longer has a Bugs group.

**Acceptance Scenarios**:

1. **Given** a bug with only an assessment, **When** the developer opens the sidebar, **Then** it is listed under To fix in the Bugs pane, named by its title, with its severity and verdict on the row.
2. **Given** a bug with an assessment and a fix, **When** the developer opens the sidebar, **Then** it is listed under To test.
3. **Given** a bug whose test report says verified, **When** the developer opens the sidebar, **Then** it is listed under Verified.
4. **Given** a bug whose test report says failed or partial, **When** the developer opens the sidebar, **Then** it is listed under To fix, and the row says the test failed.
5. **Given** a bug whose assessment says it is not a valid bug, **When** the developer opens the sidebar, **Then** it is listed under Verified's sibling group Closed, not under To fix.
6. **Given** any bug row, **When** the developer expands it, **Then** it lists Assessment, Fix and Test, and a report not written yet reads "not created".
7. **Given** a bug row or a report row, **When** the developer clicks it, **Then** it opens in the viewer exactly as it does today.
8. **Given** a project that had a Bugs group in the Specs pane, **When** this ships, **Then** the Specs pane shows only specs.

---

### User Story 2 - Ideas have their own pane (Priority: P2)

A developer who uses Spec Kit's idea assessment sees their ideas in an Ideas pane: the ones still being assessed with the stage they reached, and the decided ones with the verdict. They can open any stage's document to read it.

**Why this priority**: Companion does not show ideas at all today. Reading them is the first slice; creating and continuing them comes after.

**Independent Test**: In a project with one idea part-way through assessment and one decided, open the sidebar. The Ideas pane lists the first under Assessing with its latest stage, the second under Decided with its verdict, and each stage document opens read-only.

**Acceptance Scenarios**:

1. **Given** an idea with an intake and a research document, **When** the developer opens the sidebar, **Then** it is listed under Assessing and the row says "research".
2. **Given** an idea with a decision whose verdict is go, **When** the developer opens the sidebar, **Then** it is listed under Decided and the row says "go".
3. **Given** decided ideas with the verdicts go, needs-clarification and kill, **When** the developer looks at their rows, **Then** each shows its own verdict and the three are visually distinct.
4. **Given** an idea row, **When** the developer expands it, **Then** it lists Intake, Research, Problem, Concept and Decision in that order, and a stage not written yet reads "not created".
5. **Given** a stage row that exists, **When** the developer clicks it, **Then** the document opens read-only in the viewer, the same way a bug report does.
6. **Given** an idea whose decision file exists but names no verdict Companion recognises, **When** the developer opens the sidebar, **Then** it is listed under Decided with no verdict text, never with arbitrary text from the file.

---

### User Story 3 - A pane says how to get its process (Priority: P3)

A developer whose project does not have Spec Kit's bug or idea extension still sees the Bugs and Ideas panes. Each holds a single row saying which extension to install, and choosing it starts the install.

**Why this priority**: Without it nobody discovers the two processes from Companion. It is small and depends on the panes existing.

**Independent Test**: In a project with neither extension, open the sidebar. Each pane shows one install row; choosing the Bugs one opens a terminal that installs the bug extension, and the pane fills in once reports exist.

**Acceptance Scenarios**:

1. **Given** a project without the bug extension and with no bug reports, **When** the developer opens the Bugs pane, **Then** it shows one row, "Install Spec Kit's bug extension".
2. **Given** that row, **When** the developer chooses it, **Then** a terminal opens in the project folder and runs the install command for the bug extension.
3. **Given** a project without the bug extension that does have bug reports on disk, **When** the developer opens the Bugs pane, **Then** it lists the reports and shows no install row.
4. **Given** the bug extension is installed and there are no reports, **When** the developer opens the Bugs pane, **Then** it says there are no bugs yet and names the command that starts one.
5. **Given** the same four situations for ideas, **When** the developer opens the Ideas pane, **Then** it behaves the same way with the idea extension and its command.
6. **Given** no workspace is open, **When** the developer opens the sidebar, **Then** neither pane is shown.

### Edge Cases

- A bug or idea folder with no recognised file in it: not listed.
- A report or stage file that cannot be read: the item is still listed, named by its folder, with no detail on the row.
- Reports created, changed or deleted while the sidebar is open: the pane updates without a manual refresh.
- The project folder changes in a multi-root workspace: both panes follow it.
- A very long title: the row truncates with an ellipsis and the full title is in the tooltip.
- The Specs filter and sort: they apply to specs only and no longer touch bugs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The SpecKit sidebar MUST have a Bugs pane and an Ideas pane, placed after Specs and before Living Specs, each shown only when a workspace is open.
- **FR-002**: The Bugs pane MUST group bugs as To fix, To test, Verified and Closed, decided only from the report files present and the verdicts they state, and MUST hide a group that is empty.
- **FR-003**: A bug row MUST show the bug's title, and its severity and latest outcome as secondary text, and MUST expand to its three reports.
- **FR-004**: The Specs pane MUST no longer list bugs, and its filter and sort MUST apply to specs only.
- **FR-005**: The Ideas pane MUST group ideas as Assessing and Decided, MUST show the latest stage on an assessing idea and the verdict on a decided one, and MUST hide a group that is empty.
- **FR-006**: An idea row MUST expand to its five stage documents in order, and opening one MUST show it read-only in the viewer through the same path a bug report uses.
- **FR-007**: A verdict, severity or stage shown on a row MUST come from a fixed list of known values; an unrecognised value MUST be shown as nothing.
- **FR-008**: When a process's Spec Kit extension is not installed and the project has no items of that kind, its pane MUST show a single install row that runs the extension's install command in a terminal started in the project folder.
- **FR-009**: When the extension is installed and there are no items, the pane MUST say so and name the command that starts one.
- **FR-010**: Both panes MUST update when their files are created, changed or deleted, and when the project folder changes.
- **FR-011**: Each pane MUST have a Refresh action in its title bar.
- **FR-012**: The docs MUST describe the two panes, the groups, and the install rows.

### Key Entities

- **Bug**: a folder of up to three reports under the project's bug directory. Its state (to fix, to test, verified, closed) is derived from which reports exist and what they conclude.
- **Idea**: a folder of up to five stage documents under the project's assessment directory. It is assessing until a decision exists; its verdict is go, needs-clarification or kill.
- **Process extension**: the Spec Kit extension that provides a process's commands. Installed or not, per project.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a project with 40 specs, a bug waiting for a fix is visible in the sidebar without scrolling or collapsing anything.
- **SC-002**: Every bug that was listed before this change is listed after it, in exactly one group.
- **SC-003**: A developer can read any stage of any idea in two clicks from the sidebar.
- **SC-004**: A project with neither extension shows exactly one row in each of the two panes.
- **SC-005**: Creating a report on disk shows up in its pane within two seconds, with no manual refresh.

## Assumptions

- Starting a bug or an idea from Companion, and the Fix, Test and Continue buttons, are the next change. This one adds no "+" action.
- The look of the bug, idea and report pages is being decided separately. Opening an item uses today's read-only viewer.
- Relationship notes between ideas, specs and bugs wait for the change that lets an idea create a spec, since nothing records the link today.
- An assessment that calls a bug invalid, a duplicate or not reproducible closes it. A failed or partial test sends it back to To fix.
- The two panes have no visibility setting; a developer who does not want one collapses or hides it from the view's own menu.
- "Installed" means the extension's folder exists under the project's Spec Kit extensions directory.

## Verbatim Constraints

- Pane titles: `Bugs`, `Ideas`
- Bug groups: `To fix`, `To test`, `Verified`, `Closed`
- Idea groups: `Assessing`, `Decided`
- Idea verdicts: `go`, `needs-clarification`, `kill`
- Install rows: `Install Spec Kit's bug extension`, `Install Spec Kit's assess extension`
- Install commands: `specify extension add bug`, `specify extension add assess`
- Directories: `.specify/bugs/`, `.specify/assessments/`
