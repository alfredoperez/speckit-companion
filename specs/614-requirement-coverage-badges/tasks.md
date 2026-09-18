# Tasks: Requirement Coverage Badges

**Input**: [plan.md](./plan.md), [requirement-coverage-badges.spec.md](./requirement-coverage-badges.spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/living-health-message.md](./contracts/living-health-message.md)

No setup phase: the change adds no dependency, config or tooling.

## Phase 2: Foundational

The message shape, the reader and the setter's change flag. Both stories need all three.

Files: `src/protocol/viewer.ts`, `src/features/specs/livingSpecsModel.ts`, `src/features/specs/__tests__/livingSpecsModel.test.ts`, `webview/src/spec-viewer/markdown/livingComponents.ts`

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add the optional `requirementCoverage` field to `LivingHeaderMeta`, with the one-line doc from the contract (FR-002) · src/protocol/viewer.ts
- [x] **T002** [P] Make `setLivingCoverage` return whether the map changed, the way `setLivingDrifted` does (FR-007) · webview/src/spec-viewer/markdown/livingComponents.ts
- [x] **T003** [P] Write failing tests for `readRequirementCoverage`: a heading-keyed line with one test, several tests with one missing giving `F/N tests`, an `[inferred]` heading joined through `requirementKey`, an `FR-nnn` join, a line that names no test giving no entry, a test path that escapes the workspace counting as not found, no coverage file and an unreadable file both giving an absent map (FR-001, FR-004, FR-005, FR-006) · src/features/specs/__tests__/livingSpecsModel.test.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T004** Add `readRequirementCoverage` beside `readCoverageCount`, sharing its test-reference rule and built on the requirement slicer, add `requirementCoverage` to `CapabilityHealth`, and set it in `readCapabilityHealth`. Build each label from two integers only (FR-001, FR-004, FR-005, FR-006) · src/features/specs/livingSpecsModel.ts

**Checkpoint**: T003 passes. The model reports a label per covered requirement and nothing else changed.

## Phase 3: User Story 1 - See test coverage on each requirement card (P1)

**Goal**: A requirement with mapped tests shows its label on its card in the running extension.

**Independent Test**: Open `examples/todo-living-central` in the Extension Development Host and open the todos capability. Three cards show a label and two show none.

Files: `src/features/spec-viewer/livingHeaderMeta.ts`, `src/features/spec-viewer/specViewerProvider.ts`, `webview/src/spec-viewer/messageHandlers.ts`

### Tests

Files: `src/features/spec-viewer/__tests__/livingHeaderMeta.test.ts`, `webview/src/spec-viewer/__tests__/messageHandlers.test.ts`

**Wave 1 — independent (different files):**

- [x] **T005** [P] [US1] Write a failing test that `resolveLivingHealth` returns `requirementCoverage` for a fixture capability with a coverage file (FR-002, FR-009) · src/features/spec-viewer/__tests__/livingHeaderMeta.test.ts
- [x] **T006** [P] [US1] Write failing tests that a `livingHealthResolved` message carrying `requirementCoverage` puts the label on the rendered card as `.living-req-coverage` and `data-req-coverage`, redraws once for the same map sent twice, and redraws again when the map changes (FR-003, FR-007, FR-009) · webview/src/spec-viewer/__tests__/messageHandlers.test.ts

### Implementation

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T007** [P] [US1] Confirm `resolveLivingHealth` passes the new field through its spread and widen its return type to include it (FR-002) · src/features/spec-viewer/livingHeaderMeta.ts
- [x] **T008** [P] [US1] Include `requirementCoverage` in the guard that skips the health message when nothing resolved (FR-002) · src/features/spec-viewer/specViewerProvider.ts
- [x] **T009** [P] [US1] Apply `message.livingMeta.requirementCoverage` with `setLivingCoverage` in the `livingHealthResolved` handler and fold its change flag into the redraw condition. In `applyNavState`, clear the map when the incoming `livingMeta.specPath` differs from the one on screen (FR-003, FR-007, FR-008) · webview/src/spec-viewer/messageHandlers.ts

**Checkpoint**: T005 and T006 pass. Cards show labels in the running extension.

## Phase 4: User Story 2 - Capabilities without coverage look the same as today (P2)

**Goal**: Prove that absence and switching leave no label behind.

**Independent Test**: Open a capability with no coverage file after one that has labels. No card shows a label.

Files: `webview/src/spec-viewer/__tests__/livingCoverageAbsent.test.ts`

### Tests

- [x] **T010** [US2] Write tests that a health message with no `requirementCoverage` removes labels shown before it, that a nav state for a different spec path clears them with no health message at all, and that a nav state for the same spec path keeps them (FR-004, FR-006, FR-008) · webview/src/spec-viewer/__tests__/livingCoverageAbsent.test.ts

**Checkpoint**: T010 passes with no change to production code. If it fails, the fix belongs to T009.

## Phase 5: Polish

Files: `CHANGELOG.md`, `webview/src/spec-viewer/viewer-ui-document.spec.md`

**Wave 1 — independent (different files):**

- [x] **T011** [P] Add one user-facing line under Unreleased: requirement cards in a living spec now show how many tests cover them · CHANGELOG.md
- [x] **T012** [P] Check the living spec's outline requirement still reads true now that coverage is supplied, and leave the fold to the sync step rather than editing it by hand · webview/src/spec-viewer/viewer-ui-document.spec.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T013** Run `npm test` and the lint script, then check SC-001 to SC-005 against `examples/todo-living-central`. Regenerate docs images only if a card's markup changed, which this plan does not expect

## Dependencies & Execution Order

- Foundational blocks both stories. Inside it, T001 to T003 are independent and T004 waits for them.
- User Story 1: the two tests are independent, then T007 to T009 are independent of each other and wait for the tests.
- User Story 2 waits for User Story 1, because T010 exercises the handler T009 changes.
- Polish runs last. T011 and T012 are independent and T013 waits for both.
