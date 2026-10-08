# Feature Specification: Scripted desktop QA

**Feature Branch**: `630-scripted-desktop-qa`
**Created**: 2026-10-08
**Status**: Draft
**Input**: Issue #822, Make Claude Desktop QA reliable: permissions, stalls and lapsing grants

Every release QA pass this cycle stalled in its desktop half. Claude Desktop can only click in VS Code, its computer-use grant lapses after thirty idle minutes, and it has no shell on the Mac, so the twelve checks that only the desktop handoff covered ended the last two QA reports as BLOCKED. The scripted real-window check already drives a real VS Code window with a stand-in assistant, can type and read the terminal, and passed every step it has. This feature moves every check that one window on one project can decide into that script, and cuts the Claude Desktop handoff to the four short parts that still need eyes.

## User Scenarios & Testing

### User Story 1 - The release gate runs the one-window checks itself (Priority: P1)

The person running release QA starts the scripted real-window check and, without touching Claude Desktop, gets a PASS or FAIL with a screenshot for each of these: the navigation matrix, the narrow viewer, the Workflow Builder, one dispatch from the viewer, the popups those flows raise, and the theme steps again in the dark theme. All of it happens in the one window the check already opens.

**Why this priority**: these are checks that turned BLOCKED on both 2026-10-06 reports and need nothing but a window, a project and a stand-in assistant. Scripting them is what turns a release from "gate overridden" into "ship".

**Independent Test**: run the scripted check on the fixture project in light, then the theme steps in dark. Every new step appears in the results with a PASS and a screenshot, and the summary line counts them.

**Acceptance Scenarios**:

1. **Given** the fixture project, **When** the check walks the navigation matrix rows N1 to N15 from the release-qa recipe, **Then** each row passes or fails on its own line with the recipe's expected state as the assertion.
2. **Given** the side bar dragged out until the viewer is a column of about 430px, **When** a spec shows its Specification and then its Tasks, **Then** the header, the rail and the footer buttons stay inside the column and the page does not scroll sideways. A rail that scrolls sideways by design is reported in the step's note, not failed.
3. **Given** the Workflow Builder open, **When** the check opens a phase menu, opens and cancels the new-step form, narrows the panel and moves a node to another phase, **Then** the menu opens, Cancel leaves the board as it was, the builder holds one column narrow, and the status line names the move.
4. **Given** a spec that has finished specify, **When** the check clicks the footer's Plan button, **Then** a `/speckit-plan` command reaches the stand-in terminal.
5. **Given** the same project, **When** the check runs the steps the themes check names with the dark theme, **Then** each of them passes in dark as it did in light.

---

### User Story 2 - Release QA reads the scripted results instead of waiting on the handoff (Priority: P2)

The release QA flow maps each of the scripted checks to the step ids the script reports, runs the script itself, and fills the checklist from its results. Nothing that the script covers is handed to Claude Desktop any more.

**Why this priority**: without this, the script passes but the QA report still lists the checks as BLOCKED, because the report is built from the surface map.

**Independent Test**: build the checklist for a release that touches the sidebar, the viewer and the builder. The scripted checks appear with their step ids, and after the script runs each one reads PASS or FAIL, never BLOCKED.

**Acceptance Scenarios**:

1. **Given** a changed path that maps to a formerly desktop check, **When** the checklist is built, **Then** that check carries a scripted kind and names the step ids that decide it.
2. **Given** the scripted check has run, **When** the checklist is updated, **Then** a check passes only when every step id it names passed, and otherwise it fails and names the failed step.
3. **Given** the scripted check cannot start, **When** the checklist is updated, **Then** every scripted check reads BLOCKED with the reason, never PASS.

---

### User Story 3 - The desktop handoff fits one sitting (Priority: P2)

The person pastes a handoff into Claude Desktop that asks only for what still needs eyes, in four parts: the first open with workspace trust, the stock workspace and the two-roots window, the timed run through VS Code's buttons with the real assistant, and the real GitHub Copilot app. It is about twenty minutes of clicking, and it tells Claude Desktop that Claude Code answers any terminal question, so the pass never waits on the user.

**Why this priority**: the grant lapses after thirty idle minutes and typing into VS Code needs the user. A short handoff that only clicks in VS Code is what makes the remaining desktop pass finish.

**Independent Test**: stage a run and read the handoff. It holds four parts, each VS Code step is a click or a look, and the staging script prints READY.

**Acceptance Scenarios**:

1. **Given** a staged run, **When** the handoff is written, **Then** it contains only the first open, the stock workspace and two roots, the timed VS Code run and the Copilot app part, with no step the script now covers.
2. **Given** a terminal question appears during the timed run, **When** Claude Desktop reads the handoff, **Then** the handoff tells it to write the question as `C<n> QUESTION:` and move on, because Claude Code answers it.
3. **Given** the release QA flow, **When** Step 2 is read, **Then** it says Claude Code runs the scripted checks and only then stages the handoff.

---

### Edge Cases

- A navigation matrix row changes the fixture on disk (append, copy, delete, rename): later rows see the changed project, so the rows run in the recipe's order and the project is rebuilt per run, never reused.
- The navigation fixtures would change what earlier steps and docs pictures see: they are added only when the navigation steps start, so everything before them sees the project it always did.
- A popup is suppressed by an earlier "don't show again": the throwaway profile starts clean each run, so a popup seen once is seen on every run.
- The rail scrolls sideways by design at a narrow width: the narrow-panel steps report it in their note and still pass.
- The dark run holds only the steps the themes check names: a check graded from light alone never reads the dark results, so the short dark file blocks nothing.
- A run on a user's own sandbox skips the steps that need the built-in fixtures: a skipped step reads BLOCKED, never PASS.
- Steps build on one another, so a recheck of one scripted check reruns the whole real-window check and regrades.
- Each theme's run removes only its own results and pictures, so the light and dark results sit side by side.

## Requirements

### Functional Requirements

- **FR-001**: The first-open check (a window with workspace trust on, Restricted Mode first, then Trust) MUST stay on the Claude Desktop handoff, as part A.
- **FR-002**: The stock-workspace check (a Spec Kit project without Companion, every popup read and its main button used once) MUST stay on the handoff, in part B.
- **FR-003**: The multi-root check (the sandbox and the stock workspace in one window) MUST stay on the handoff, in part B.
- **FR-004**: The scripted check MUST walk the navigation matrix rows N1 to N15 as the release-qa recipe states them, one step per row, asserting the recipe's expected state.
- **FR-005**: The scripted check MUST run narrow-panel steps that drag the side bar out until the viewer is a column of about 430px and assert the header, rail and footer stay inside the column on Specification and on Tasks. A rail that scrolls sideways by design MUST be reported in the note, not failed.
- **FR-006**: The scripted check MUST run builder steps that open a phase menu, open the new-step form and assert Cancel leaves the board as it was, hold the layout in one column at a narrow width, and move a node to another phase.
- **FR-007**: A dispatch step MUST assert that the footer's Plan button on a specified spec puts a `/speckit-plan` command in the stand-in terminal.
- **FR-008**: The scripted check MUST assert each information, warning or error message raised in the flows above appears once and its buttons act as labelled.
- **FR-009**: The steps the themes check names MUST pass in dark as well as in light.
- **FR-010**: The navigation fixtures MUST be added only when the navigation steps start, so earlier steps see the project unchanged.
- **FR-011**: The surface map MUST mark each check the script now covers with a scripted kind that names the step ids deciding it, and the release QA flow MUST run the script and fill those checks from its results.
- **FR-012**: The desktop handoff MUST contain four parts only (the first open, the stock workspace and two roots, the timed VS Code run with the real assistant, the real GitHub Copilot app), MUST say Claude Code answers any terminal question, and MUST be short enough to finish in one sitting of under thirty minutes.
- **FR-013**: The staging script MUST stay unchanged.
- **FR-014**: The visual-assets doc MUST describe the new coverage of the scripted check.

### Key Entities

- **Check**: one row of the release QA checklist, with a kind (auto, scripted, run, desktop), a status and a note.
- **Step**: one unit of the scripted real-window check, with a name, what it asserts, a result and a screenshot.
- **Handoff**: the document Claude Desktop reads, holding only the checks that still need eyes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Of the twelve checks BLOCKED on both 2026-10-06 QA reports, six run scripted (themes, nav-matrix, narrow-panel, popups, provider-dispatch, builder), and process-panes runs scripted with them. Six stay on eyes (vscode-run, first-open, stock-workspace, multi-root, canvas-open in the real app, the board stock run in the real app).
- **SC-002**: The scripted check passes every step in light on the fixture project, and every step the themes check names in dark.
- **SC-003**: A release checklist built after this change lists no scripted check as BLOCKED once the script has run.
- **SC-004**: The handoff has four parts and no step that asks Claude Desktop to type into VS Code or run a command.

## Assumptions

- The scripted check keeps using a throwaway VS Code profile and the stand-in assistant; nothing real runs.
- The owner chose one window per run, so the checks that need a window of their own (first open with trust on, the stock workspace, two roots) stay on the handoff.
- The popups covered are the ones the extension raises in the flows the steps walk; a message raised only by a flow the script does not walk stays on the release's own popup grep.
- The first-start provider picker stays a capture-only step of the screenshot mode; the release looks at its picture when the diff touches the providers.
- Finding what makes Claude Desktop stall in verification needs a live desktop session and stays out of scope; the shorter handoff makes a stall far less likely by making the pass short.
- This is internal tooling, so it gets no entry in the user-facing changelog.
