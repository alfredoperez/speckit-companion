# Tasks: Open a spec from its name in the Specs tree

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [contracts/open-spec-command.md](./contracts/open-spec-command.md)

## Phase 1: Foundational (blocks every story)

**Wave 1 — single task:**

- [x] **T001** Add `showSpec(specDirectory)` to the spec viewer provider: create the panel for the spec when none exists (requesting no particular document, so the existing display-document cascade resolves the first available one), otherwise re-render the existing panel on its current document and reveal it · `src/features/spec-viewer/specViewerProvider.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T002** Register the `speckit.openSpec` command and route it to `showSpec` · `src/features/spec-viewer/specViewerCommands.ts`

## Phase 2: User Story 1 — click a spec's name and land on its Overview (P1)

**Goal**: The spec-name row opens the spec in the viewer, on the Overview when the spec has one.

**Independent Test**: Click the name of a spec with a recorded run; the viewer opens showing the Overview.

### Implementation

**Wave 2 — single task:**

- [x] **T003** [US1] Give the spec-name row the `speckit.openSpec` command with the spec's absolute directory as its argument, keeping the row collapsible so the chevron still toggles · `src/features/specs/specExplorerProvider.ts`

**Checkpoint**: Clicking a spec name opens its viewer panel; the row still expands.

## Phase 3: User Story 2 — a spec with no recorded run still opens (P1)

**Goal**: Opening a spec that never ran lands on its first available document, and a spec with no documents opens without error.

**Independent Test**: Click the name of a spec whose only file is its specification; the viewer opens on it.

### Tests

**Wave 3 — independent (different files):**

- [x] **T004** [P] [US2] Test `showSpec`: a spec with no open panel creates one; an existing panel is revealed and re-rendered rather than duplicated; a spec whose documents are all absent opens without throwing · `src/features/spec-viewer/__tests__/showSpec.test.ts`
- [x] **T005** [P] [US1] Test the tree row: the spec item carries `speckit.openSpec` with its absolute spec directory and stays collapsible; document rows still carry `speckit.viewSpecDocument` · `src/features/specs/__tests__/specExplorerProvider.test.ts`
- [x] **T006** [P] [US2] Test the landing rule is not duplicated: `showingOverview` lands on the Overview when the spec has durable context and on the document when it does not · `tests/unit/spec-viewer/showingOverview.spec.ts`

**Checkpoint**: Both landing paths are covered by tests that exercise the real code, not a re-derived predicate.

## Phase 4: Polish

**Wave 4 — independent (different files):**

- [x] **T007** [P] Document the click behavior (name opens the spec on its Overview; chevron browses without opening) in the sidebar reference · `docs/sidebar.md`
- [x] **T008** [P] Note the spec-level open's landing view in the viewer state reference · `docs/viewer-states.md`
- [x] **T009** [P] Update the "Sidebar at a Glance" summary · `README.md`
- [x] **T010** [P] Add the user-facing changelog entry under Unreleased · `CHANGELOG.md`

**⟶ Wait for Wave 4 to finish, then:**

- [x] **T011** Verify against the Success Criteria: `npm run compile && npm test && npm run package` all green

## Dependencies & Execution Order

Foundational (T001 → T002) blocks everything. T003 depends on T002 (the command must exist). Tests (T004–T006) run in parallel once T003 lands. Polish (T007–T010) is parallel, then T011 verifies.
