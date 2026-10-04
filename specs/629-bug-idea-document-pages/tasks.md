# Tasks: Document pages for bugs and ideas

**Scale note**: 27 tasks over about 30 files in four areas: a pure parse and model layer, the viewer's host side, the viewer's webview, and Storybook with fixtures and docs. The host builds the page model and the webview only lays it out, so the two story phases meet only at the wiring Phase 2 puts in place.

V = `apps/vscode`. The model shapes are in `data-model.md` and every label, class name and heading id is in `contracts/report-pages.md`.

## Phase 1: Setup

- [x] **T001** Add four fixture folders shaped like real reports: a bug whose test failed (`assessment.md`, `fix.md`, `test.md` with `Result: failed` and a `fail` check), a bug assessed invalid (`assessment.md` only), a go idea with all five stages and a decision holding a Scorecard and an `If go` handoff, and a needs-clarification idea whose decision holds a Scorecard and an `If needs-clarification` section · V/tests/fixtures/report-pages/.specify/bugs/{discount-applied-twice,export-drops-header}/, V/tests/fixtures/report-pages/.specify/assessments/{saved-filters,bulk-archive}/ (a root of their own, so the tests that list the existing fixture folders are untouched)

## Phase 2: Foundational

**Wave 1 — independent (different files):**

- [x] **T002** [P] Move `knownValue` and `parseReportHeader` into a module with no `fs` import and re-export them from `reportSet.ts` · V/src/features/reports/reportValues.ts, V/src/features/reports/reportSet.ts
- [x] **T003** [P] Move the four bug lists into `bugValues.ts` and add `BUG_CHECK_RESULTS`; `bugReports.ts` imports them · V/src/features/bugs/bugValues.ts, V/src/features/bugs/bugReports.ts
- [x] **T004** [P] Move the idea verdicts and stages into `ideaValues.ts` and add `IDEA_RATINGS` with a tone each; `ideaReports.ts` imports them · V/src/features/ideas/ideaValues.ts, V/src/features/ideas/ideaReports.ts
- [x] **T005** [P] Port the fence-aware document reader (sections by heading prefix, first table by header row, top-level list items, `- **Term**: text` fields, fenced blocks) with its tests · V/src/features/reports/reportDoc.ts, V/src/features/reports/__tests__/reportDoc.test.ts
- [x] **T006** [P] Declare `BugStory`, `IdeaDecision` and their parts as in `data-model.md`, and add `NavState.report` · V/src/features/reports/reportPageModel.ts, V/src/protocol/viewer.ts
- [x] **T007** [P] Port the Document look as one partial on existing tokens with the `rp-` classes, scoped under `#markdown-content`, with container queries for a narrow window and wrapping for long paths; register it · V/webview/styles/spec-viewer/_report-pages.css, V/webview/styles/spec-viewer/index.css
- [x] **T008** [P] Add `Prose` and `Inline`: markdown fragments rendered without heading ids or comment controls, fenced code as the viewer's `pre.code-block` markup with its text escaped · V/webview/src/spec-viewer/report-pages/fragments.tsx, V/webview/src/spec-viewer/report-pages/__tests__/fragments.test.tsx

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T009** [P] Create `buildBugStory` and `buildIdeaDecision` as typed stubs that return `undefined`, so the wiring compiles before either story is built · V/src/features/reports/bugStory.ts, V/src/features/reports/ideaDecision.ts
- [x] **T010** [P] Create `BugStoryPage` and `IdeaDecisionPage` as stubs, and `ReportPage`, which picks one from `navState.report` and calls `applyHighlighting` and `buildToc` after it renders · V/webview/src/spec-viewer/report-pages/BugStoryPage.tsx, IdeaDecisionPage.tsx, ReportPage.tsx
- [x] **T011** [P] Give a bug's document list a first `story` entry with no file, always present · V/src/features/reports/reportSet.ts (`reportDocuments`), V/src/features/reports/__tests__/reportSet.test.ts

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — independent (different files):**

- [x] **T012** [P] `readReportPanel` reads the report texts, calls the builder for its set with the primary action's label, and returns the page and the default document · V/src/features/spec-viewer/reportPanels.ts
- [x] **T013** [P] Render `ReportPage` inside `#markdown-content` when the nav state carries a page, and the markdown otherwise · V/webview/src/spec-viewer/App.tsx
- [x] **T014** [P] On a report panel, label the rail for its kind and disable every entry whose document does not exist, the first included · V/webview/src/spec-viewer/components/StepTab.tsx, NavigationBar.tsx, V/webview/src/spec-viewer/components/__tests__/NavigationBar.test.tsx

**⟶ Wait for Wave 3 to finish, then:**

- [x] **T015** Pass the report kind and page through `generateHtml` into the initial nav state; `showReport` takes a landing flag so an item row opens the default document and a report row opens that report; a `story` request that cannot be built shows the assessment; the pane's item rows pass the flag · V/src/features/spec-viewer/html/generator.ts, V/src/features/spec-viewer/specViewerProvider.ts, V/src/features/processes/processPaneProvider.ts, V/src/features/spec-viewer/specViewerCommands.ts

## Phase 3: User Story 1 - A bug reads as one story (P1)

Files: V/src/features/reports/bugStory.ts, V/webview/src/spec-viewer/report-pages/BugStoryPage.tsx

**Goal**: A bug opens on a page that states where it stands and tells it in three steps.
**Independent Test**: Build the story from the `cart-total-skips-first` fixture without its `test.md`. The lead is "Fixed, not tested yet.", two steps are done and the third is next.

### Tests

- [x] **T016** [P] [US1] Builder tests: one case per lead in the contract's table, a fix marked not applied, the meta line dropping unknown and placeholder values and the badge's value, a missing section left out, risks merged from three sections with "None." items dropped, and `undefined` for text with none of the sections · V/src/features/reports/__tests__/bugStory.test.ts
- [x] **T017** [P] [US1] Page tests: three steps with the right done and next marks, one step when closed, no Risks heading without risks, the next-step sentence naming the button only when one is given, and no sentence appearing twice · V/webview/src/spec-viewer/report-pages/__tests__/BugStoryPage.test.tsx

### Implementation

- [x] **T018** [US1] Implement `buildBugStory` over `reportDoc`, the bug lists and `bugState` · V/src/features/reports/bugStory.ts
- [x] **T019** [US1] Implement `BugStoryPage`: lead, meta line, timeline of steps with changed-file rows, diff blocks and check rows, then Risks and open questions · V/webview/src/spec-viewer/report-pages/BugStoryPage.tsx

**Checkpoint**: A bug's Story tab renders from real report files and its footer buttons are unchanged.

## Phase 4: User Story 2 - A decided idea reads as a decision (P2)

Files: V/src/features/reports/ideaDecision.ts, V/webview/src/spec-viewer/report-pages/IdeaDecisionPage.tsx

**Goal**: A decided idea's Decision stage opens as a page that leads with the verdict.
**Independent Test**: Build the decision from the `saved-filters` fixture. The lead opens with "Go.", the scorecard has one row per criterion, and the handoff lists its fields.

### Tests

- [x] **T020** [P] [US2] Builder tests: each verdict's lead and closing section, a rationale that opens with a bold verdict sentence said once, ratings outside the list shown without a rating, a decision with no scorecard, and `undefined` for an unrecognised verdict · V/src/features/reports/__tests__/ideaDecision.test.ts
- [x] **T021** [P] [US2] Page tests: lead, rationale, scorecard rows with the rating word and its tone class, each closing section, and nothing rendered for a missing part · V/webview/src/spec-viewer/report-pages/__tests__/IdeaDecisionPage.test.tsx

### Implementation

- [x] **T022** [US2] Implement `buildIdeaDecision` over `reportDoc` and the idea lists · V/src/features/reports/ideaDecision.ts
- [x] **T023** [US2] Implement `IdeaDecisionPage`: lead, rationale, Scorecard rows, and the closing section for the verdict · V/webview/src/spec-viewer/report-pages/IdeaDecisionPage.tsx

**Checkpoint**: A decided idea opens on its decision page with the five-stage rail.

## Phase 5: User Story 3 - The pages can be reviewed without a project (P3)

Files: V/webview/src/spec-viewer/__stories__/ReportPages.stories.tsx, V/webview/src/spec-viewer/__stories__/BugReport.stories.tsx

**Goal**: Every state of both pages is one story, built by the production builders from fixture files.

### Implementation

- [x] **T024** [US3] Add nine stories that mount the real `App` with a nav state built by the production builders: bug assessed only, fixed not tested, verified, test failed, closed as invalid; idea assessing, go, needs-clarification, kill. Remove the stories in `BugReport.stories.tsx` that these replace · V/webview/src/spec-viewer/__stories__/ReportPages.stories.tsx, V/webview/src/spec-viewer/__stories__/BugReport.stories.tsx

**Checkpoint**: All nine states open in Storybook in light and dark.

## Phase 6: Polish

**Wave 1 — independent (different files):**

- [x] **T025** [P] Update the host panel tests for the Story entry, the landing rule, the page in the nav state and the fallback to the raw document · V/src/features/spec-viewer/__tests__/bugPanel.test.ts, ideaPanel.test.ts, V/src/features/bugs/__tests__/bugsPane.test.ts, V/src/features/ideas/__tests__/ideasPane.test.ts
- [x] **T026** [P] Docs and changelog: the story page, the decision page, the tabs and the rail · apps/website/src/content/docs/docs/processes/fix-a-bug.mdx, assess-an-idea.mdx, navigate/inside-the-viewer.mdx, CHANGELOG.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T027** Rebuild the Copilot canvas bundle and run every suite: `npm run compile`, `npx tsc -p tsconfig.webview.json --noEmit`, `npm test`, `npm run test:canvas`, `npm run build-storybook` · apps/copilot-canvas/vendor/viewer.css

## Dependencies & Execution Order

Setup → Foundational → User Stories 1 and 2 (independent of each other) → User Story 3 (needs both) → Polish.

- **Foundational**: Wave 1 (value lists, reader, types, styles, fragments) blocks Wave 2 (stubs and the Story entry), which blocks Wave 3 (panel reader, mount, rail), which blocks T015 (the provider and generator wiring).
- **User Story 1 and 2**: tests first, then the builder, then the page. The builder and page files are created as stubs by T009 and T010 and filled in here; no other phase edits them.
- **User Story 3**: one task, after both pages exist.
- **Polish**: tests and docs together, then the bundle and the suites.
