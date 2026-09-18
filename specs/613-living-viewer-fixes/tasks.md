# Tasks: Living Viewer Fixes

**Input**: [plan.md](./plan.md), [living-viewer-fixes.spec.md](./living-viewer-fixes.spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md)

> **Scale note**: 25 tasks over about 22 files in four areas: approve, the markdown pipeline and rail, the sidebar tree, the Overview card. Every story owns its own files, so the six story phases can run side by side once Phase 2 lands. Watch the screenshots: any CSS task here makes them stale, and they regenerate once, in Polish.

## Phase 1: Setup

Nothing to set up. The branch and tooling exist.

## Phase 2: Foundational

The naming rule both the tree (US3) and the Overview card (US6) import.

Files: `src/core/utils/capabilityNames.ts`, `src/core/utils/__tests__/capabilityNames.test.ts`

- [x] **T001** Write failing tests for `readableName` and `stripSharedLeadingWords`: the eight `commands-*` names, a single label, siblings sharing every word · src/core/utils/__tests__/capabilityNames.test.ts

**⟶ Wait for T001, then:**

- [x] **T002** Create `readableName` (moved from the provider) and `stripSharedLeadingWords`, keeping at least one word per label (FR-012, FR-013) · src/core/utils/capabilityNames.ts

**Checkpoint**: the naming util passes its tests. Stories can start.

## Phase 3: User Story 1 - Approve clears a draft that has nothing left to approve (P1)

**Goal**: approve removes the banner on a zero-marker draft, and the bar offers it.
**Independent Test**: approve a draft with no adopted markers and see the banner leave the file.

Files: `src/features/spec-viewer/livingDocs.ts`, `webview/src/spec-viewer/components/footer/LivingFooter.tsx`, `webview/src/spec-viewer/components/FooterActions.stories.tsx`

### Tests

Owns `src/features/spec-viewer/__tests__/livingDocs.test.ts`, `webview/src/spec-viewer/components/__tests__/FooterActions.test.tsx`.

**Wave 1 — independent (different files):**

- [x] **T003** [P] [US1] Failing tests: whole-spec approve with a banner and no markers drops the banner, neither present returns `null`, per-heading approve keeps the banner while a marker remains · src/features/spec-viewer/__tests__/livingDocs.test.ts
- [x] **T004** [P] [US1] Failing tests: a draft with zero adopted shows `Approve spec` and posts `approveSpec`, a draft with 3 shows `Approve all 3`, a non-draft with zero shows no approve · webview/src/spec-viewer/components/__tests__/FooterActions.test.tsx

### Implementation

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T005** [P] [US1] In `approveLivingText`, run the banner drop on every whole-spec approve and return `null` only when neither a marker nor the banner changed (FR-001, FR-002) · src/features/spec-viewer/livingDocs.ts
- [x] **T006** [P] [US1] Show approve when the spec is a draft or adopted is above zero, labelled `Approve all N` or `Approve spec` (FR-003) · webview/src/spec-viewer/components/footer/LivingFooter.tsx

**⟶ Wait for Wave 2 to finish, then:**

- [x] **T007** [US1] Turn the nothing-adopted story into a draft showing `Approve spec`, and add a non-draft story with no approve · webview/src/spec-viewer/components/FooterActions.stories.tsx

**Checkpoint**: a zero-marker draft can be approved from the bar.

## Phase 4: User Story 2 - A draft spec shows DRAFT once (P1)

**Goal**: reviewed, aligns and capability markers render nothing.
**Independent Test**: render a spec whose line 3 is a reviewed marker.

Files: `webview/src/spec-viewer/markdown/preprocessors.ts`, `webview/src/spec-viewer/markdown/renderer.ts`

### Tests

Owns `webview/src/spec-viewer/markdown/livingComponents.test.ts`.

- [x] **T008** [US2] Failing tests through `renderMarkdown`: a draft whose line 3 is `reviewed:` renders no banner text and no disclosure, `aligns:` and `capability:` render nothing, an ordinary comment in a feature spec still becomes a disclosure · webview/src/spec-viewer/markdown/livingComponents.test.ts

### Implementation

**⟶ Wait for T008, then:**

**Wave 1 — independent (different files):**

- [x] **T009** [P] [US2] Widen the pass-through regex in `preprocessHtmlComments` to `touches|adopted|reviewed|aligns|capability` (FR-004) · webview/src/spec-viewer/markdown/preprocessors.ts
- [x] **T010** [P] [US2] Widen `TOUCHES_MARKER_LINE` the same way so the renderer drops those lines (FR-004, FR-005) · webview/src/spec-viewer/markdown/renderer.ts

**Checkpoint**: a drift-accepted draft shows one badge and no grey bar.

## Phase 5: User Story 3 - The tree groups capabilities and reads as words (P2)

**Goal**: a group per multi-spec folder, short leaf labels, icons only where something is wrong.
**Independent Test**: build the tree for eight `commands-*` specs in one folder plus a single-spec folder.

Files: `src/features/specs/livingSpecsModel.ts`, `src/features/specs/livingSpecsExplorerProvider.ts`

### Tests

Owns `src/features/specs/__tests__/livingSpecsTree.test.ts`, `src/features/specs/__tests__/livingSpecsExplorerProvider.test.ts`.

**Wave 1 — independent (different files):**

- [x] **T011** [P] [US3] Failing tests: eight specs in `capabilities/companion-commands/` give a `Companion Commands` group with the eight stripped leaf labels, a single-spec folder still collapses · src/features/specs/__tests__/livingSpecsTree.test.ts
- [x] **T012** [P] [US3] Failing tests: a healthy row has no icon, drifted keeps `warning`, missing keeps `circle-outline`, the tooltip's first line starts with the exact capability name · src/features/specs/__tests__/livingSpecsExplorerProvider.test.ts

### Implementation

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T013** [US3] In `buildCapabilityTree`, keep a spec's folder as a group segment when it holds two or more capability specs, and put a `label` on each group and leaf using the naming util (FR-011, FR-012, FR-013) · src/features/specs/livingSpecsModel.ts

**⟶ Wait for T013, then:**

- [x] **T014** [US3] Read labels from the model, delete the private `readableName`, and give a healthy capability no icon (FR-013, FR-014) · src/features/specs/livingSpecsExplorerProvider.ts

**Checkpoint**: the tree is grouped and scannable.

## Phase 6: User Story 4 - The rail marks only what needs attention (P2)

**Goal**: dots for adopted, drifted and new only, no guide border on requirement rows.
**Independent Test**: build the rail for one confirmed, one adopted, one drifted and one new requirement.

Files: `webview/src/spec-viewer/toc.ts`, `webview/styles/spec-viewer/_toc.css`

### Tests

Owns `webview/src/spec-viewer/__tests__/tocRequirements.test.ts`.

- [x] **T015** [US4] Failing tests: a confirmed row has no `.spec-toc-cov`, adopted, drifted and new rows have one with the matching state class, no row carries `spec-toc-cov--unknown`, the accessible name still names the state · webview/src/spec-viewer/__tests__/tocRequirements.test.ts

### Implementation

**⟶ Wait for T015, then:**

**Wave 1 — independent (different files):**

- [x] **T016** [P] [US4] Emit the dot only for drifted, adopted or new (reading `data-req-new`), in that order of precedence, and drop the coverage dot (FR-009, FR-010) · webview/src/spec-viewer/toc.ts
- [x] **T017** [P] [US4] Cancel the `--h3` border, margin and padding for `.spec-toc-link--requirement`, delete `.spec-toc-cov--unknown` and the confirmed state rule, leave `.spec-toc-link--h3` alone (FR-008, FR-010) · webview/styles/spec-viewer/_toc.css

**Checkpoint**: a rail of confirmed requirements is plain text.

## Phase 7: User Story 5 - Requirement buttons look like buttons (P3)

**Goal**: roomy buttons, Remove red only on hover.
**Independent Test**: render a requirement card and inspect both buttons.

Files: `webview/styles/spec-viewer/_living.css`

### Tests

Owns `webview/src/spec-viewer/__tests__/livingCss.test.ts`.

- [x] **T018** [US5] Failing test that reads the stylesheet: both button rules carry `min-height: 24px`, `padding: 2px 10px` and `var(--font-family)`, and `var(--error)` appears only in the Remove hover rule · webview/src/spec-viewer/__tests__/livingCss.test.ts

### Implementation

**⟶ Wait for T018, then:**

- [x] **T019** [US5] Apply the button metrics and sans font to `.living-req-approve` and `.living-req-remove`, keep Remove neutral at rest (FR-006, FR-007) · webview/styles/spec-viewer/_living.css

**Checkpoint**: the card buttons have room.

## Phase 8: User Story 6 - The Overview says what the run did to each living spec (P3)

**Goal**: two labelled groups with readable names.
**Independent Test**: render the card for one synced and two loaded capabilities.

Files: `webview/src/spec-viewer/components/cards/LivingSpecsCard.tsx`, `webview/src/spec-viewer/components/cards/LivingSpecsCard.stories.tsx`, `webview/styles/spec-viewer/_activity.css`

### Tests

Owns `webview/src/spec-viewer/components/cards/__tests__/LivingSpecsCard.test.tsx`.

- [x] **T020** [US6] Failing tests: synced and loaded chips sit under `Updated by this run` and `Read for context`, an empty group is absent, chip text is the readable name while the click payload keeps the exact name, no `folded back` text · webview/src/spec-viewer/components/cards/__tests__/LivingSpecsCard.test.tsx

### Implementation

**⟶ Wait for T020, then:**

**Wave 1 — independent (different files):**

- [x] **T021** [P] [US6] Split chips by `synced` into two labelled lists, name them with `readableName`, delete the `folded back` span (FR-015, FR-016) · webview/src/spec-viewer/components/cards/LivingSpecsCard.tsx
- [x] **T022** [P] [US6] Style the group label and delete `.living-specs-chip__synced` · webview/styles/spec-viewer/_activity.css

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T023** [US6] Update the stories so loaded-and-synced, loaded-only and synced-only show the groups · webview/src/spec-viewer/components/cards/LivingSpecsCard.stories.tsx

**Checkpoint**: the card reads as two plain lists.

## Phase 9: Polish

Files: `docs/viewer-states.md`, `docs/sidebar.md`, `CHANGELOG.md`, `docs/screenshots/generated/`

**Wave 1 — independent (different files):**

- [x] **T024** [P] Update the docs: the Living specs paragraph in `docs/viewer-states.md` (inline in the intent, two groups, not an Activity card; Approve spec; single DRAFT), and `docs/sidebar.md` (folder groups, stripped labels, no healthy icon, `law` and **Rules** in place of `type-hierarchy`). Add one `## [Unreleased]` changelog entry in release-note voice (FR-017) · docs/viewer-states.md, docs/sidebar.md, CHANGELOG.md

**⟶ Wait for every story phase and Wave 1, then:**

- [x] **T025** Run `npm test`, lint and the type check, then regenerate the screenshots with `scripts/capture-docs-images.mjs` and confirm each Success Criterion (FR-017) · docs/screenshots/generated/

## Dependencies & Execution Order

Foundational (T001 → T002) blocks US3 and US6 only. US1, US2, US4 and US5 depend on nothing and can start at once. No file appears under two phases, so all six story phases can run in parallel. Polish T024 can run alongside them. T025 runs last.

- US1: T003, T004 → T005, T006 → T007
- US2: T008 → T009, T010
- US3: T011, T012 → T013 → T014
- US4: T015 → T016, T017
- US5: T018 → T019
- US6: T020 → T021, T022 → T023
