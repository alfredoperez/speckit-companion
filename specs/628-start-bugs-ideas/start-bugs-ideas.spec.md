# Feature Specification: Start and continue a bug or an idea from Companion

**Feature Branch**: `628-start-bugs-ideas`
**Created**: 2026-10-03
**Status**: Draft
**Input**: Issue #785 and the decisions D5, D15 and D18 of 2026-10-03: New bug, then Fix and Test buttons, with the state read from the files; New bug and New idea as shown in the prototypes; a decided idea offers Create spec from this idea on a go.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a bug from Companion (Priority: P1)

A developer who hits a bug chooses the + in the Bugs pane, describes the symptom, and sends it. Their assistant runs Spec Kit's bug assessment for it, and the bug appears in the pane when the assessment is written.

**Why this priority**: Bugs can only be started by typing a command today. This is the first half of "start and continue a bug fix from Companion".

**Independent Test**: Choose New bug, type a symptom, send. The assistant receives the assess command with the symptom and the slug shown on the screen.

**Acceptance Scenarios**:

1. **Given** the Bugs pane, **When** the developer chooses its + action, **Then** a New Bug screen opens with a symptom field, an optional link or pasted error field, a slug field and an Assess bug button.
2. **Given** a typed symptom, **When** the developer has not touched the slug, **Then** the slug field holds a short kebab-case name derived from the symptom, and the developer can edit it.
3. **Given** a symptom and a slug, **When** the developer chooses Assess bug, **Then** the configured assistant receives the bug assess command with the symptom, the link or error when given, and the slug, and the screen closes.
4. **Given** an empty symptom, **When** the developer looks at the button, **Then** it is disabled.
5. **Given** a slug that already names a bug folder, **When** the developer looks at the screen, **Then** it says a bug with that name exists, and sending is blocked until the slug changes.
6. **Given** a project without the bug extension, **When** the developer chooses the + action, **Then** Companion says the bug extension is needed and offers to install it, and nothing is sent.

---

### User Story 2 - Fix and test a bug from its page (Priority: P1)

A developer reading a bug sees the next step as the main button at the bottom: Fix bug after an assessment, Test fix after a fix. Choosing it sends that step to the assistant. A quieter button repeats the step already done.

**Why this priority**: It is the second half of the same request, and the buttons are what make the Bugs pane more than a reading list.

**Independent Test**: Open a bug that has only an assessment and choose Fix bug. The assistant receives the fix command for that bug. When the fix report appears the button becomes Test fix.

**Acceptance Scenarios**:

1. **Given** a bug under To fix with only an assessment, **When** the developer opens it, **Then** the footer's main button is Fix bug.
2. **Given** a bug under To test, **When** the developer opens it, **Then** the main button is Test fix and a secondary button is Fix again.
3. **Given** a bug whose test failed or was partial, **When** the developer opens it, **Then** the main button is Fix bug and a secondary button is Test again.
4. **Given** a verified bug, **When** the developer opens it, **Then** there is no main button, and a secondary button is Test again.
5. **Given** a closed bug, **When** the developer opens it, **Then** the only button is Assess again.
6. **Given** any of these buttons, **When** the developer chooses one, **Then** the assistant receives that step's command with the bug's slug.
7. **Given** an open bug page, **When** the report that step writes appears, **Then** the buttons change to the next step without reopening the page.
8. **Given** a bug page, **When** the developer tries to edit the report or comment on it, **Then** it is still read-only.

---

### User Story 3 - Start and continue an idea (Priority: P2)

A developer chooses the + in the Ideas pane, writes the idea in a sentence or two, and sends it for intake. From the idea's page they move it through the stages with one button, and when the decision is a go they turn it into a spec.

**Why this priority**: Same shape as bugs, built on the same parts, and ideas are newer and less used.

**Independent Test**: Choose New idea, type an idea, send. The assistant receives the intake command. On an idea with only an intake, the main button sends the research command.

**Acceptance Scenarios**:

1. **Given** the Ideas pane, **When** the developer chooses its + action, **Then** a New Idea screen opens with an idea field, an optional "who it is for" field, a slug field and an Assess idea button.
2. **Given** an idea and a slug, **When** the developer chooses Assess idea, **Then** the assistant receives the intake command with the idea, who it is for when given, and the slug.
3. **Given** an idea still being assessed, **When** the developer opens it, **Then** the main button names the next stage and sends that stage's command with the idea's slug.
4. **Given** an idea decided as go, **When** the developer opens it, **Then** the main button is Create spec from this idea, and choosing it opens Create Spec with the idea's title and summary filled in.
5. **Given** an idea decided as needs-clarification, **When** the developer opens it, **Then** the main button is Continue assessment, which sends the research command for it.
6. **Given** an idea decided as kill, **When** the developer opens it, **Then** there is no main button and a secondary button is Reopen from intake.
7. **Given** a project without the assess extension, **When** the developer chooses the + action, **Then** Companion says the assess extension is needed and offers to install it.

### Edge Cases

- The symptom or idea contains quotes, backticks, dollar signs or newlines: it reaches the assistant as written and never as part of a shell command.
- The slug field is cleared: sending is blocked.
- The slug is typed with spaces or capitals: it is normalised to lowercase kebab-case as the developer types.
- A slug that would escape the folder (`../x`, `/`): it normalises to something safe or to nothing, and nothing blocks sending.
- No assistant is configured, or the dispatch fails: the screen stays open with what was typed and says what went wrong.
- A step is sent twice quickly: each click sends once; the page does not guard against the assistant running both.
- The bug or idea folder is deleted while its page is open: the page says so, as it does today, and shows no buttons.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Bugs pane and the Ideas pane MUST each have a + action in their title bar that opens that process's create screen.
- **FR-002**: The New Bug screen MUST collect a symptom (required), an optional link or pasted error, and a slug, and MUST send Spec Kit's bug assess command with them to the configured assistant.
- **FR-003**: The New Idea screen MUST collect an idea (required), an optional audience, and a slug, and MUST send Spec Kit's assess intake command with them.
- **FR-004**: The slug MUST be derived from the first field until the developer edits it, MUST be normalised to lowercase kebab-case, MUST NOT be empty, and MUST NOT name an existing item of the same kind.
- **FR-005**: A create screen MUST NOT send anything while its required field is empty, and MUST keep the typed text when a dispatch fails.
- **FR-006**: The + action MUST offer to install the process's Spec Kit extension, and send nothing, when that extension is not installed.
- **FR-007**: A bug page MUST show footer buttons chosen from the bug's state: Fix bug, Test fix, and the secondary Fix again, Test again and Assess again, each sending that step's command with the bug's slug.
- **FR-008**: An idea page MUST show a main button for the next assessment stage while assessing, Create spec from this idea on a go, Continue assessment on needs-clarification, and Reopen from intake as a secondary button on a kill.
- **FR-009**: Create spec from this idea MUST open the Create Spec screen with a description built from the idea's title and decision, and MUST NOT create anything by itself.
- **FR-010**: The buttons on an open page MUST follow the files: when a report is written or removed the buttons update without reopening the page.
- **FR-011**: Bug and idea pages MUST stay read-only apart from these buttons.
- **FR-012**: Text the developer typed MUST reach the assistant as prompt text, never interpolated into a shell command line.
- **FR-013**: The docs MUST describe starting a bug and an idea from Companion and the buttons on their pages.

### Key Entities

- **Create request**: what a create screen sends: the kind (bug or idea), the main text, the optional second field, and the slug.
- **Next step**: the one command a bug or idea page offers as its main button, derived from the item's state, plus zero or more secondary steps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can start a bug assessment from the sidebar in three actions: +, type, send.
- **SC-002**: From an assessed bug to a verified one takes two button presses in Companion and no typed command.
- **SC-003**: The main button on a bug or idea page is correct for every state the panes can show.
- **SC-004**: A slug that already exists can never be sent.
- **SC-005**: No text typed in a create screen appears in a terminal's command line except as the assistant's prompt.

## Assumptions

- The pages keep today's read-only viewer; the new look is a separate change. The buttons sit in the existing footer.
- The assistant is the configured one, shown by name on the create screen. Choosing a different assistant per bug is out of scope.
- Nothing extra is recorded: the state stays derived from Spec Kit's files, so a step run by hand shows up the same.
- The link between an idea and the spec made from it is not recorded yet; row notes and viewer links for related items are a later change.
- Continue assessment on needs-clarification sends the research stage, which is the stage Spec Kit's decision usually names.
- The create screens reuse the Create Spec screen's look and behaviour.

## Verbatim Constraints

- Commands: `speckit.bug.assess`, `speckit.bug.fix`, `speckit.bug.test`, `speckit.assess.intake`, `speckit.assess.research`, `speckit.assess.define`, `speckit.assess.shape`, `speckit.assess.decide`
- Slug argument form: `slug=<slug>`
- Button labels: `Assess bug`, `Assess idea`, `Fix bug`, `Test fix`, `Fix again`, `Test again`, `Assess again`, `Continue assessment`, `Create spec from this idea`, `Reopen from intake`
- Screen titles: `New Bug`, `New Idea`
