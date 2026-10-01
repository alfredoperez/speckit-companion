# Feature Specification: Bug reports in the sidebar and viewer (read-only)

**Feature Branch**: `feat/785-bug-reports-read-only`
**Created**: 2026-10-01
**Status**: Draft
**Input**: Issue #785, first slice. Spec Kit's `bug` extension writes per-bug reports under `.specify/bugs/<slug>/`; SpecKit Companion should show them, read-only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See which bugs have reports, and how far each got (Priority: P1)

A developer who ran Spec Kit's bug commands (assess, fix, test) opens the SpecKit sidebar and sees one entry per bug, named by its title or slug. Each entry says in words which of the three reports exist and the latest outcome (the test result, otherwise the fix status, otherwise the assessment verdict). Bugs sit in their own group, apart from specs, because they have no number and no lifecycle.

**Why this priority**: today these reports are invisible inside the editor. Seeing them is the whole value of the slice.

**Independent Test**: put the real `cart-total-skips-first` report set and the assessment-only `slug-keeps-spaces` report into a workspace's `.specify/bugs/`, open the sidebar, and check the two entries and their stage and outcome text.

**Acceptance Scenarios**:

1. **Given** a bug folder with all three reports whose test result is verified, **When** the sidebar loads, **Then** its entry shows the bug's title, says assess, fix and test are present, and shows "verified".
2. **Given** a bug folder with only an assessment whose verdict is valid, **When** the sidebar loads, **Then** its entry says only assess is present and shows "valid".
3. **Given** a workspace with no `.specify/bugs/` folder, or an empty one, **When** the sidebar loads, **Then** no bug group or bug entry appears and the specs view looks exactly as before.
4. **Given** the sidebar is open, **When** a new report file is written into a bug folder, **Then** the entry updates without a manual refresh.

---

### User Story 2 - Read a bug's reports in the viewer (Priority: P1)

Clicking a bug entry opens it in the spec viewer as one document, with Assessment, Fix and Test as its tabs. A report that does not exist yet shows as not created. The viewer shows the reports, nothing else: no step footer, no run buttons, no run record.

**Why this priority**: listing a bug without letting someone read it is half a feature.

**Independent Test**: click the `cart-total-skips-first` entry and read all three tabs; click `slug-keeps-spaces` and see Assessment readable and Fix and Test marked not created.

**Acceptance Scenarios**:

1. **Given** a bug with all three reports, **When** its entry is clicked, **Then** the viewer opens on the Assessment with Fix and Test as tabs beside it.
2. **Given** a bug with only an assessment, **When** it is opened, **Then** Fix and Test are shown as not created and cannot be opened.
3. **Given** a bug is open in the viewer, **When** its entry or one of its report rows is clicked again, **Then** the same viewer tab is reused and shows the clicked report.
4. **Given** a bug is open, **When** the report on screen changes on disk, **Then** the viewer shows the new text.

---

### User Story 3 - Find it documented and see it in the docs stills (Priority: P2)

A user reading the site's sidebar and viewer pages learns that bug reports appear, and the docs media can be captured from a Storybook story of the new view.

**Why this priority**: docs are part of the change, but the feature works without them.

**Independent Test**: the docs pages carry a short "Bug reports" section; the Storybook story renders a bug report with real report text.

**Acceptance Scenarios**:

1. **Given** the Storybook build, **When** the bug report story is opened, **Then** it shows a bug with its three tabs using the real report text, and a second story shows an assessment-only bug.

### Edge Cases

- A bug folder holding no report file, only other files, is not listed.
- A report missing its outcome line, or with an unexpected value, still lists and opens; the outcome is simply not shown.
- A report with no `# Bug …: <title>` line falls back to the slug as its name.
- A folder name that would resolve outside `.specify/bugs/` is ignored.
- Deleting a bug folder removes its entry; an open viewer for it says the folder is gone, like a moved spec.
- The Specs filter narrows bugs by slug or title the same way it narrows specs, so "nothing matches" still means nothing at all. The sort choice never reorders bugs, which stay alphabetical by slug, and bugs never appear inside Active, Completed or Archived.
- A workspace with bug reports and no specs shows the Bugs group on its own.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST discover one bug report per folder under `.specify/bugs/` that holds at least one of `assessment.md`, `fix.md`, `test.md`, recording which of the three exist.
- **FR-002**: The extension MUST read the bug's title from the first report's `# Bug Assessment:` / `# Bug Fix:` / `# Bug Verification:` heading, falling back to the slug, and read the assessment Verdict and Severity, the fix Status and the test Result from their bold-label header lines, treating a missing or unreadable value as absent.
- **FR-003**: The sidebar MUST show discovered bugs in their own group, separate from the spec lifecycle groups, and MUST show nothing for bugs when none are discovered.
- **FR-004**: Each bug entry MUST say in words which of assess, fix and test exist and show the latest outcome (test Result, else fix Status, else assessment Verdict).
- **FR-005**: Expanding a bug entry MUST list Assessment, Fix and Test rows; a missing report reads "not created" and does nothing when clicked.
- **FR-006**: Clicking a bug entry or one of its existing report rows MUST open the bug in the spec viewer with Assessment, Fix and Test as its tabs, one viewer tab per bug.
- **FR-007**: The bug view in the viewer MUST be read-only: no step footer, no dispatch actions, no run record read or written, and no change to any file under `.specify/bugs/`.
- **FR-008**: The sidebar and an open bug viewer MUST refresh when files under `.specify/bugs/` are created, changed or deleted.
- **FR-009**: Bug folder names MUST be validated to stay inside `.specify/bugs/` before any file is read or opened.
- **FR-010**: Storybook MUST carry a story of a bug report in the viewer (all three reports, and assessment-only) built from the real report text.
- **FR-011**: The sidebar and spec-viewer living specs and the site's sidebar and viewer docs pages MUST describe bug reports, and the changelog MUST carry one user-facing line.

### Key Entities

- **Bug report**: one folder under `.specify/bugs/`, keyed by its slug. Holds a title, which of the three reports exist, and the outcome values read from them.
- **Report**: one of Assessment (`assessment.md`, verdict and severity), Fix (`fix.md`, status) and Test (`test.md`, result). Written by Spec Kit's bug commands, only ever read here.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the two real fixture bugs present, the sidebar shows exactly two bug entries with the right stages and outcomes, verified by automated tests against the real files.
- **SC-002**: With no bugs folder, the sidebar output is identical to today's, verified by test.
- **SC-003**: Opening a bug shows its existing reports in one viewer tab in a single click, with zero files written anywhere.
- **SC-004**: The full test suite, compile, webview typecheck, living-spec validation and drift check pass.

## Assumptions

- Report formats are taken from the installed `bug` extension v1.0.0 command files and a real run; there is no front matter, and outcomes live in `- **Label**: value` lines near the top.
- The bugs group lives in the Specs view rather than a new view, so the sidebar's container layout stays as it is; the plan confirms or overturns this with a reason.
- The bugs list follows the Specs filter but not the sort, for this slice.
- No offer to install the `bug` extension is shown; with no reports, nothing appears.

## Verbatim Constraints

- Report folder: `.specify/bugs/<slug>/`
- Report files: `assessment.md`, `fix.md`, `test.md`
- Header labels: `**Verdict**`, `**Severity**`, `**Status**`, `**Result**`

## ADDED Requirements
<!-- capability: work-through-a-document -->

### A checkbox in a bug report never changes the report
<!-- touches: apps/vscode/webview/src/spec-viewer/actions.ts, apps/vscode/webview/src/spec-viewer/editor/readOnly.ts -->

Clicking a checkbox in an open bug report SHALL leave the box as the report file has it and leave the file unchanged. Completed and archived specs are not read-only in this sense: their task boxes still tick through to the file.

#### Scenario: a checkbox inside a bug report
- **WHEN** a checkbox in an open bug report is clicked
- **THEN** it snaps back to its state on disk and the report file is not changed

#### Scenario: a checkbox in a completed spec
- **WHEN** a task box is ticked in the viewer on a completed spec
- **THEN** its line in the tasks file is marked done

## MODIFIED Requirements
<!-- capability: open-the-sidebar -->

### An empty Specs view offers exactly one next step

A Specs view with no specs and no bug reports SHALL show a single welcome block chosen by setup state: Open Folder when no folder is open, Initialize Workspace when the Spec Kit CLI is installed but the project is not initialized, Configure Constitution with Create New Spec when the constitution still needs setting up, and otherwise a welcome with **Create your first spec** and **Open a live sample**. Two blocks SHALL never stack. A workspace with bug reports and no specs shows its Bugs group instead of a welcome block.

#### Scenario: the CLI is installed but the project is bare
- **WHEN** the Spec Kit CLI is detected and the workspace has no Spec Kit scaffolding
- **THEN** the only block shown offers Initialize Workspace

#### Scenario: bug reports but no specs
- **WHEN** the workspace has a report under `.specify/bugs/` and no specs
- **THEN** the Specs view shows the Bugs group and no welcome block
