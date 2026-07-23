# Tasks: Label fast-path folded steps instead of showing "<1s"

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md)

## Phase 1: Setup

No setup — the change rides entirely on existing modules and tooling.

## Phase 2: Foundational

**Wave 1 — single task (shared derivation blocks everything):**

- [x] **T001** [US3] Derive the `folded` flag in `deriveStepHistory` (fold window constant, own extension-stamped pair within the window, adjacency to the previous group's extension-stamped close) and add `folded?: boolean` to `StepHistoryEntry` · src/features/specs/stepHistoryDerivation.ts + src/core/types/specContext.ts

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T002** [P] [US3] Mirror `folded?: boolean` on the webview `StepHistoryEntry` · webview/src/spec-viewer/types.ts
- [x] **T003** [P] [US3] Derivation tests: fast-path fold sets `folded` on plan/tasks (not specify); same-instant fold still folded; sub-second span without adjacency not folded; normal run has no `folded` · src/features/specs/__tests__/stepHistoryDerivation.test.ts

## Phase 3: User Story 1 — folded phases read as folded (P1)

**Goal**: The Run overview strip labels folded phases "folded into Specify" instead of `<1s`.

**Independent Test**: Open `specs/528-footer-done-guard` in the viewer — Plan and Tasks show the folded note, Specify keeps its measured duration.

### Implementation

**Wave 3 — independent (different files):**

- [x] **T004** [P] [US1] Render the folded note in `OverviewTiming`: suppress the duration for `folded` entries, render `folded into <anchor>` (nearest earlier non-folded phase), add `is-folded` to the phase item · webview/src/spec-viewer/components/OverviewDossier.tsx
- [x] **T005** [P] [US1] Style the folded phase: muted/hollow dot under `is-folded`, italic muted-metadata folded note · webview/styles/spec-viewer/_overview-dossier.css

**Checkpoint**: A fast-path spec renders folded phases distinctly with no `<1s`.

## Phase 4: User Story 2 — real durations stay real (P2)

**Goal**: Non-folded rendering is byte-identical; both directions pinned by tests.

**Independent Test**: Existing OverviewTiming tests pass unchanged; new cases assert no folded note on measured phases and no `<1s` on folded ones.

### Implementation

**Wave 4 — single task:**

- [x] **T006** [US2] Component tests: folded plan/tasks render the folded note and never `<1s`; the anchor names Specify; a trusted measured phase keeps its duration and no folded note · webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx

## Phase 5: Polish

**Wave 5 — independent (different files):**

- [x] **T007** [P] [US1] Add a fast-path folded story variant covering the Run overview strip · webview/src/spec-viewer/components/ActivityPanel.stories.tsx
- [x] **T008** [P] [US1] Update the timing-display semantics (folded phases) in the state-machine doc · docs/viewer-states.md
- [x] **T009** [P] [US1] Root CHANGELOG entry under Unreleased (user-facing voice) · CHANGELOG.md

**⟶ Wait for Wave 5 to finish, then:**

**Wave 6 — single task:**

- [x] **T010** Full verification: `npm run compile && npm test` green; eyeball SC-001 against `specs/528-footer-done-guard` data · (no file)

## Dependencies & Execution Order

- Phase 2 → Phase 3/4 → Phase 5: the derivation (T001) blocks everything; types/tests (T002, T003) and rendering (T004, T005) follow; component tests (T006) need T002+T004; docs/stories/changelog (T007–T009) need the rendered shape; T010 last.
- Waves: W1 (T001) → W2 (T002∥T003) → W3 (T004∥T005) → W4 (T006) → W5 (T007∥T008∥T009) → W6 (T010).
