# Feature Specification: Document pages for bugs and ideas

**Feature Branch**: `629-bug-idea-document-pages`
**Created**: 2026-10-04
**Status**: Draft
**Input**: Decisions D16, D18 and D20 of 2026-10-04. A bug opens on a story page with its reports as tabs, a decided idea opens on a decision page with a five-step rail, and both use the "Document" look: one reading column, prose first.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A bug reads as one story (Priority: P1)

A developer opens a bug from the Bugs pane. Instead of one raw report, they get a page that says where the bug stands in its first sentence, then tells it in order: what was wrong, what changed, how it was verified. The raw reports are one click away as tabs.

**Why this priority**: A bug is three files today and the reader has to open each to learn its state. The story page is the reason the bug flow lives in Companion at all.

**Independent Test**: Open a bug that has an assessment and a fix but no test. The page leads with "Fixed, not tested yet.", shows the first two steps as done and the third as next, and the footer still offers Test fix.

**Acceptance Scenarios**:

1. **Given** a bug with only an assessment, **When** the developer opens it, **Then** the page leads with "Assessed, not fixed yet.", shows What was wrong as done, and shows What changed and How it was verified as next.
2. **Given** a bug with an assessment and a fix, **When** the developer opens it, **Then** the page leads with "Fixed, not tested yet." and the third step says it has not been verified and names Test fix.
3. **Given** a bug whose test report says verified, **When** the developer opens it, **Then** the page leads with "Fixed and verified." and all three steps are done.
4. **Given** a bug whose test report says failed or partial, **When** the developer opens it, **Then** the page leads with "The fix did not hold." and the third step shows the checks and their results.
5. **Given** a bug whose assessment verdict is invalid, **When** the developer opens it, **Then** the page leads with "Closed without a fix." and shows only the first step.
6. **Given** any bug page, **When** the developer looks under the lead, **Then** one line gives when and where it was reported, the verdict, the severity and the fix status, each only if the reports state it.
7. **Given** a bug page, **When** the developer chooses the Assessment, Fix or Test tab, **Then** that report opens as it does today, and Story returns to the page. A tab whose report does not exist is disabled.
8. **Given** a bug page, **When** the developer looks at the footer, **Then** it offers the same next-step buttons as before this change.
9. **Given** a fix report that lists changed files, **When** the developer reads What changed, **Then** each file is a row with its change and note, followed by the diff if the report has one.
10. **Given** a bug with a fix report whose status is not applied, **When** the developer opens it, **Then** the page leads with "Assessed, not fixed yet." and What changed is marked next while still showing what the fix report says.
11. **Given** a bug with a test report whose result Companion does not recognise, **When** the developer opens it, **Then** the page leads with "Tested, result unclear." and never says the fix stands or failed.
12. **Given** reports that list risks or open questions, **When** the developer reads the end of the page, **Then** they are listed under Risks and open questions. With none, the heading is not shown.

---

### User Story 2 - A decided idea reads as a decision (Priority: P2)

A developer opens a decided idea from the Ideas pane. The page leads with the verdict and why, then the scorecard and the handoff. A rail of the five stages lets them read any stage document.

**Why this priority**: The decision is what an idea assessment exists to produce, and today it is the fifth of five raw files.

**Independent Test**: Open an idea with a go decision. The page leads with "Go." and the first sentence of the rationale, lists the scorecard as rows, lists the handoff fields, and the footer still offers Create spec from this idea.

**Acceptance Scenarios**:

1. **Given** an idea with a go decision, **When** the developer opens it, **Then** the page leads with "Go." followed by the first sentence of the rationale, and the rest of the rationale follows as prose. A rationale that opens by restating the verdict has that opening dropped, so the verdict is said once.
2. **Given** an idea decided needs-clarification or kill, **When** the developer opens it, **Then** the lead reads "Needs clarification." or "Kill." in the same position.
3. **Given** a decision with a scorecard, **When** the developer reads it, **Then** each criterion is one row: its name, its rating, and why. The rating's colour reflects whether it is favourable, mixed or unfavourable.
4. **Given** a go decision with a handoff, **When** the developer reads it, **Then** each handoff field is a term with its text beneath or beside it, under Handoff. A needs-clarification decision shows its blocking questions and the stage to revisit under What is blocking, and a kill decision shows its Revisit trigger.
5. **Given** any idea, **When** the developer looks at the rail, **Then** it lists Intake, Research, Problem, Concept and Decision in order, a stage with no document is disabled, and choosing a stage opens its document as it does today.
6. **Given** an idea still being assessed, **When** the developer opens it, **Then** it opens on its latest stage document, with the same rail.
7. **Given** a decision whose verdict Companion does not recognise, **When** the developer opens it, **Then** the decision document is shown as it is today, with the rail.

---

### User Story 3 - The pages can be reviewed without a project (Priority: P3)

The owner reviews the look in Storybook before it ships: every state of both pages, in light and dark, from report files shaped like real ones.

**Why this priority**: The first version of these pages was rejected on looks. Review has to be possible without setting up nine project states by hand.

**Independent Test**: Open Storybook and find one story per state listed below, each rendering the real page components.

**Acceptance Scenarios**:

1. **Given** Storybook, **When** the owner opens the bug page stories, **Then** there is one each for assessed only, fixed not tested, verified, test failed, and closed as invalid.
2. **Given** Storybook, **When** the owner opens the idea page stories, **Then** there is one each for assessing, go, needs-clarification, and kill.
3. **Given** any of those stories, **When** the owner switches the theme, **Then** the page is readable in light and in dark.

### Edge Cases

- A report is missing a section the page uses: that part of the page is left out, with no empty heading or placeholder.
- A report has none of the sections the page uses: the raw report is shown as it is today.
- A report is deleted, added or rewritten while its page is open: the page updates.
- A field holds an unfilled template option list or a value Companion does not recognise: it is not shown.
- Very long file paths in the changed-files rows: they wrap or truncate with an ellipsis and never widen the page.
- The same sentence appears in two reports, or as both a summary and a lead: the page shows it once.
- A window narrower than the reading column: the timeline stays to the left of the text and nothing overflows sideways.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Opening a bug MUST show a story page built from that bug's report files, with a first sentence that states where the bug stands.
- **FR-002**: The lead sentence MUST be one of six, chosen from the bug's state: assessed, fixed and untested, verified, test failed, tested with an unclear result, closed without a fix.
- **FR-003**: The story page MUST show one meta line under the lead with the report date, source, verdict, severity and fix status, each omitted when its report does not state a recognised value.
- **FR-004**: The story page MUST present three steps in order, What was wrong, What changed and How it was verified, each marked done when its report exists and next when it does not.
- **FR-005**: A step whose report does not exist MUST say so in one sentence and name the footer button that produces it, when the footer offers one.
- **FR-006**: What changed MUST list the changed files as rows and show the diff when the fix report has one.
- **FR-007**: The story page MUST list risks and open questions at the end when any report states them, and omit the section otherwise.
- **FR-008**: A bug MUST offer Story, Assessment, Fix and Test as tabs. A report tab opens the raw report, and a tab with no report MUST be disabled. Opening a bug from its row lands on Story, and opening one of its reports lands on that report.
- **FR-009**: Opening a decided idea MUST show a decision page that leads with the verdict and the first sentence of the rationale, followed by the rest of the rationale, the scorecard, and the closing section that fits the verdict: Handoff, What is blocking, or Revisit trigger.
- **FR-010**: The scorecard MUST be one row per criterion with its rating and reason, and the rating MUST carry a favourable, mixed or unfavourable tone that does not rely on colour alone.
- **FR-011**: An idea MUST offer its five stages as a rail in order. A stage with no document MUST be disabled, and an idea still being assessed MUST open on its latest stage document.
- **FR-012**: Every value the pages show as a state, verdict, severity or rating MUST come from Companion's list of recognised values. Anything else is not shown.
- **FR-013**: A part of a page whose source section is missing MUST be omitted. A report with none of the expected sections MUST fall back to the raw document.
- **FR-014**: The footer's next-step buttons MUST behave on these pages exactly as they do today.
- **FR-015**: The pages MUST update when a report file is created, changed or deleted while they are open.
- **FR-016**: The pages MUST use one reading column and the viewer's existing colours and type sizes, and MUST keep the viewer's "On this page" outline.
- **FR-017**: The pages MUST NOT repeat the same text in two places.
- **FR-018**: Storybook MUST have one story per page state named in User Story 3, rendered from report files shaped like real ones, readable in light and dark.
- **FR-019**: The docs for the Bugs and Ideas panes MUST describe the story page, the decision page, the tabs and the rail.

### Key Entities

- **Bug story**: what the page shows for one bug. Read from up to three reports. Holds the bug's state, the facts for the meta line, the content of each step, and the risks and open questions.
- **Idea decision**: what the page shows for one decided idea. Read from the decision document. Holds the verdict, the rationale, the scorecard rows and the handoff fields.
- **Stage rail**: the five idea stages in order, each with whether its document exists.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reader can tell a bug's state from the first sentence of its page, without opening a report.
- **SC-002**: Any raw report of a bug, and any stage of an idea, is one click from its page.
- **SC-003**: No page shows an empty heading, an empty row, or a placeholder for missing content, across all nine story states.
- **SC-004**: None of the nine story states shows the same sentence twice.
- **SC-005**: Every footer button that worked on a bug or idea before this change works after it.
- **SC-006**: All nine states are reviewable in Storybook in both themes.

## Assumptions

- The Analysis and Converge report pages and their Reports group are a separate change. They need the reports saved first.
- Links between an idea and the spec created from it are a separate change.
- The Bugs and Ideas sidebar panes do not change.
- The look follows the "Document" direction prototyped on the `design/processes-style` branch. The prototype is a reference, and nothing ships from it.
- The lead sentences are Companion's own wording, derived from the state. They are not read from the reports.
- A bug is closed only by an invalid verdict, which is the only closing verdict Companion recognises today.
- The header badge above the page already names the outcome. The meta line leaves out the one value the badge shows.
- Risks and open questions come from the assessment's risks and open questions and the test report's residual risks. The fix report's follow-ups restate them and are not listed.
- On an idea, the Decision stage is the decision page. The raw decision document is shown only when the page cannot be built.
- An idea with no decision yet has no decision page. Its stage documents keep today's look.
- Comments stay off on these pages, as they are on reports today.
- This is visual work. It is pushed for review in Storybook and no pull request is opened until the owner has seen it.

## Verbatim Constraints

- Bug tabs: `Story`, `Assessment`, `Fix`, `Test`
- Bug steps: `What was wrong`, `What changed`, `How it was verified`
- Closing section: `Risks and open questions`
- Bug leads: `Assessed, not fixed yet.`, `Fixed, not tested yet.`, `Fixed and verified.`, `The fix did not hold.`, `Tested, result unclear.`, `Closed without a fix.`
- Idea leads: `Go.`, `Needs clarification.`, `Kill.`
- Idea rail: `Intake`, `Research`, `Problem`, `Concept`, `Decision`
- Idea sections: `Scorecard`, `Handoff`, `What is blocking`, `Revisit trigger`
- Scorecard ratings: `strong`, `adequate`, `weak`, `unknown`
- Directories: `.specify/bugs/`, `.specify/assessments/`
