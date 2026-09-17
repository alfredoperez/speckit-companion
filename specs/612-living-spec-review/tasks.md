# Tasks: Reviewing a living spec

**Input**: `plan.md`, `living-spec-review.spec.md`, `data-model.md`, `research.md`, `contracts/living-review.md`

**Scale note**: about 22 files across both extensions. Most of them are touched by two or more stories, so the shared extension side (protocol, model, undo, handlers, resolver) and the shared rendering (cards, header) sit in Foundational, and each story phase owns only its own wiring, surfaces and tests. Watch the two seams the plan names: Undo state lives on the panel in the extension, and the TypeScript and Python aligns parsers must agree on the shared `requirement-slices` fixtures.

**Format**: `- [ ] **T###** [P?] [US#] Description · file`

---

## Phase 1: Setup

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add fixtures for links: a cross-capability aligns link, a same-capability link, a self-link, a broken capability, a broken heading, and two requirements sharing a heading. Both parsers read this set · speckit-extension/tests/fixtures/requirement-slices/

---

## Phase 2: Foundational

Blocks every story. Owns every file two stories would both edit.

Files: `src/protocol/viewer.ts`, `src/features/specs/livingSpecsModel.ts`, `src/features/spec-viewer/livingDocs.ts`, `src/features/spec-viewer/specViewerProvider.ts`, `src/features/spec-viewer/messageHandlers.ts`, `speckit-extension/scripts/resolve-spec-paths.py`, `webview/src/spec-viewer/markdown/livingComponents.ts`, `webview/styles/spec-viewer/_living.css`, `webview/src/spec-viewer/components/SpecHeader.tsx`

### Tests

Write these first. They fail until the matching implementation lands.

**Wave 1 — independent (different files):**

- [x] **T002** [P] [US3] `requirementLinks`: Leans on keeps marker order and marks broken capability or heading, Leaned on by excludes the own capability, a self-link appears once, shared headings get the same lists, and the fixtures from T001 match · src/features/specs/__tests__/requirementSlices.test.ts
- [x] **T003** [P] [US2] `readMainCopy` returns the file text from `git show main:<path>`, and `undefined` on a non-zero exit, a missing file on `main` or a timeout · src/features/specs/__tests__/livingSpecsModel.test.ts
- [x] **T004** [P] [US4] `appendLivingRemoval` creates `.spec-context.json` when absent, appends one `requirement-removed` entry with `capability`, keeps unknown fields and existing entries, and adds no feature-spec defaults · src/features/spec-viewer/__tests__/livingDocs.test.ts
- [x] **T005** [P] [US1] [US4] Approve and Remove store a pending undo; Undo with matching disk text restores byte for byte and records nothing; Undo with changed disk text writes nothing and warns; a stale token is ignored; Remove refuses only when another capability leans on the heading · src/features/spec-viewer/__tests__/messageHandlers.test.ts
- [x] **T006** [P] [US3] [US4] `--leaned-on-by <capability>#<heading>` returns every match including the own capability, `[]` on no match or a disabled registry, and text output lists `capability#heading`; `removed_requirements` reads only the named capability's records · speckit-extension/tests/test_resolve_spec_paths.py
- [x] **T007** [P] [US2] [US3] Cards: `data-req-new` and a `New` pill, a drifted new card keeps the drifted edge and both pills, `Leans on` / `Leaned on by` render only when non-empty, resolved entries are `button[data-open-living-requirement]`, broken entries are spans showing `raw` · webview/src/spec-viewer/markdown/livingComponents.test.ts
- [x] **T008** [P] [US1] [US2] Header: no approve button, `N new` shown only when `newRequirements.length ≥ 1` · webview/src/spec-viewer/components/__tests__/SpecHeader.test.tsx

### Implementation

**Wave 1 — independent (different files):**

- [x] **T009** [P] Add `RequirementLink`, `leansOn` / `leanedOnBy` on overview requirements, `newRequirements?` on `LivingHeaderMeta`, `livingUndo` on `NavState`, and the `undoLivingAction { token }` message · src/protocol/viewer.ts
- [x] **T010** [P] [US3] Add `requirementLinks(root, capability)` over `requirementSlices`, exact heading match, per data-model rules · src/features/specs/livingSpecsModel.ts
- [x] **T011** [P] [US4] Add `appendLivingRemoval(specPath, capability, heading)` with a direct read-merge-write of `history[]`, not `updateSpecContext` · src/features/spec-viewer/livingDocs.ts
- [x] **T012** [P] [US3] [US4] Add `--leaned-on-by` with the contract's JSON and text shapes, and `removed_requirements(spec_path, capability)` · speckit-extension/scripts/resolve-spec-paths.py

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T013** [P] [US2] Add `readMainCopy(root, relPath, { git })` beside `makeDefaultGitRunner`, 1500 ms timeout, `undefined` on any failure · src/features/specs/livingSpecsModel.ts
- [x] **T014** [P] [US1] [US4] Hold one pending undo per panel: token, 5000 ms timer, replace on a newer action, settle on timer, dispose and re-anchor, call `appendLivingRemoval` when a `remove` settles, send `livingUndo` only while `expiresAt` is ahead, and put `requirementLinks` on overview requirements · src/features/spec-viewer/specViewerProvider.ts
- [x] **T015** [P] [US2] [US3] Render `data-req-new` and the `New` pill, and the `Leans on` / `Leaned on by` lists with `escapeAttr` attributes and broken spans · webview/src/spec-viewer/markdown/livingComponents.ts
- [x] **T016** [P] [US1] [US2] Remove `ApproveSpecButton` and add the `N new` fact · webview/src/spec-viewer/components/SpecHeader.tsx

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — independent (different files):**

- [x] **T017** [P] [US1] [US3] [US4] Snapshot before approve and remove, register the pending undo, add the `undoLivingAction` handler with the disk-text compare and warning, and refuse Remove through `leanedOnBy` · src/features/spec-viewer/messageHandlers.ts
- [x] **T018** [P] [US2] [US3] Move the `data-req-state="new"` rule to `[data-req-new]`, style link lists and the broken state with `--review` rules and `--text-body` words · webview/styles/spec-viewer/_living.css
- [x] **T019** [P] [US1] [US2] Update header stories: adopted spec without the approve button, spec with `3 new` · webview/src/spec-viewer/components/SpecHeader.stories.tsx
- [x] **T020** [P] [US2] [US3] Add card stories: new, new and drifted, with links, with a broken link · webview/src/spec-viewer/markdown/LivingComponents.stories.tsx

**⟶ Wait for Wave 3 to finish, then:**

- [x] **T021** [US3] Delete the loose `alignsIn`, now unused · src/features/spec-viewer/livingDocs.ts

**Checkpoint**: extension side stores and settles undo, computes links and reads `main`; cards and header render every new fact from fixtures.

---

## Phase 3: User Story 1 - Approve all with undo (P1) 🎯 MVP

**Goal**: one press approves every adopted requirement, and Undo restores the file for 5 seconds.

**Independent Test**: open a spec with 4 adopted requirements, press `Approve all 4`, confirm only markers and the banner are gone, press `Undo`, confirm the file is byte-identical.

Files: `webview/src/spec-viewer/components/footer/LivingFooter.tsx`, `webview/src/spec-viewer/components/__tests__/FooterActions.test.tsx`, `webview/src/spec-viewer/components/FooterActions.stories.tsx`

### Tests

**Wave 1 — independent (different files):**

- [x] **T022** [P] [US1] Bar shows `Approve all N` for N ≥ 1 and nothing for 0, posts `approveSpec`, renders `UndoToast` labelled `Undo` for `expiresAt - Date.now()`, posts `undoLivingAction` with the token, and hides after expiry · webview/src/spec-viewer/components/__tests__/FooterActions.test.tsx

### Implementation

**Wave 1 — independent (different files):**

- [x] **T023** [P] [US1] Add `Approve all N` from the overview's adopted count and the `UndoToast` for any `livingUndo` kind · webview/src/spec-viewer/components/footer/LivingFooter.tsx

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T024** [US1] Add bar stories: adopted spec with `Approve all 4`, no adopted requirements, Undo pending · webview/src/spec-viewer/components/FooterActions.stories.tsx

**Checkpoint**: Approve all and its Undo work end to end in the viewer.

---

## Phase 4: User Story 2 - New requirements are marked (P1)

**Goal**: cards added on this branch carry a green edge and a `New` pill, and the header counts them.

**Independent Test**: on a branch, add one requirement to a spec that exists on `main`; only that card shows `New` and the header reads `1 new`.

Files: `src/features/spec-viewer/livingHeaderMeta.ts`, `src/features/spec-viewer/__tests__/livingHeaderMeta.test.ts`, `webview/src/spec-viewer/messageHandlers.ts`, `webview/src/spec-viewer/__tests__/messageHandlers.test.ts`

### Tests

**Wave 1 — independent (different files):**

- [x] **T025** [P] [US2] `resolveLivingHealth` sets `newRequirements` to headings absent from `main`'s slices, keeps a body-only change unmarked, and leaves it absent when the read fails · src/features/spec-viewer/__tests__/livingHeaderMeta.test.ts
- [x] **T026** [P] [US2] `livingHealthResolved` calls `setLivingNew` and re-renders only when the set changed · webview/src/spec-viewer/__tests__/messageHandlers.test.ts

### Implementation

**Wave 1 — independent (different files):**

- [x] **T027** [P] [US2] Compute `newRequirements` with `readMainCopy` inside the existing slow push, never writing the spec file · src/features/spec-viewer/livingHeaderMeta.ts
- [x] **T028** [P] [US2] Keep the module-level new set through `setLivingNew`, like `setLivingDrifted` · webview/src/spec-viewer/messageHandlers.ts

**Checkpoint**: on a branch, new cards and the header count appear after the health push; without `main` nothing is marked.

---

## Phase 5: User Story 3 - Leans on and Leaned on by (P2)

**Goal**: each card lists its links in both directions, broken links stay visible, and a resolved link opens its target.

**Independent Test**: link A to B in another capability; A lists B under `Leans on`, B lists A under `Leaned on by`, clicking opens the target scrolled to it, and a bad heading reads as broken.

Files: `webview/src/spec-viewer/actions.ts`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T029** [P] [US3] Route a `data-open-living-requirement` click to `openLivingSpec` with `capabilityName`, `specPath` and `requirement` · webview/src/spec-viewer/actions.ts

**Checkpoint**: links render from Foundational and now navigate; the resolver answers `--leaned-on-by` for commands.

---

## Phase 6: User Story 4 - Undoable, remembered removal (P2)

**Goal**: Remove offers Undo, and a removal that stands is recorded so the validator does not flag it.

**Independent Test**: remove a requirement and undo it, confirm no record; remove again and wait 5 seconds, confirm one record and no `delta-heading-not-found` for it.

Files: `speckit-extension/scripts/living_validate.py`, `speckit-extension/tests/test_living_validate.py`

### Tests

**Wave 1 — independent (different files):**

- [x] **T030** [P] [US4] A delta heading with a removal record raises no `delta-heading-not-found`; the same heading without a record still does; a record for another capability in the shared file does not suppress it · speckit-extension/tests/test_living_validate.py

### Implementation

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T031** [US4] Skip `delta-heading-not-found` for headings in `removed_requirements` · speckit-extension/scripts/living_validate.py

**Checkpoint**: Remove, Undo and the removal record work in the viewer, and the validator honors the record.

---

## Phase 7: User Story 5 - Open a living spec from anywhere (P3)

**Goal**: `SpecKit: Open Living Spec` reaches any requirement in 2 picks, and every entry point scrolls the same way.

**Independent Test**: run the command, pick a capability and a requirement, confirm the viewer scrolls to it; pick "Open at the top", confirm it opens at the top.

Files: `src/features/specs/livingSpecsCommands.ts`, `package.json`, `src/features/specs/__tests__/livingSpecsCommands.test.ts`, `src/features/specs/__tests__/manifest.test.ts`, `src/features/specs/__tests__/livingSpecsStatusBar.test.ts`, `src/features/specs/__tests__/livingSpecsExplorerProvider.test.ts`

### Tests

**Wave 1 — independent (different files):**

- [x] **T032** [P] [US5] Command lists registered capabilities, then headings plus "Open at the top"; dismissing either picker opens nothing; unconfigured shows a message and opens nothing; it calls `speckit.viewSpecDocument` with `{ living: true, requirement? }` · src/features/specs/__tests__/livingSpecsCommands.test.ts
- [x] **T033** [P] [US5] `speckit.livingSpecs.open` is contributed with title `Open Living Spec` in category `SpecKit` · src/features/specs/__tests__/manifest.test.ts
- [x] **T034** [P] [US5] Status bar item passes its requirement to `speckit.viewSpecDocument` · src/features/specs/__tests__/livingSpecsStatusBar.test.ts
- [x] **T035** [P] [US5] Tree row opens with `{ living: true }` and no requirement · src/features/specs/__tests__/livingSpecsExplorerProvider.test.ts

### Implementation

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T036** [P] [US5] Register `speckit.livingSpecs.open` with both pickers over `readLivingSpecs(root, { withOrphans: false })` and `requirementSlices` · src/features/specs/livingSpecsCommands.ts
- [x] **T037** [P] [US5] Contribute the command in the SpecKit category · package.json

**Checkpoint**: the palette command opens any capability at any requirement; entry points are pinned by tests.

---

## Phase 8: Polish

Files: `docs/viewer-states.md`, `docs/sidebar.md`, `CHANGELOG.md`, `speckit-extension/CHANGELOG.md`, `docs/screenshots/generated/`

**Wave 1 — independent (different files):**

- [x] **T038** [P] [US1] [US2] [US3] [US4] Document the bar's Approve all and Undo, New marks, link lists and removal records · docs/viewer-states.md
- [x] **T039** [P] [US5] Document `SpecKit: Open Living Spec` and the entry points that scroll to a requirement · docs/sidebar.md
- [x] **T040** [P] Add user-facing entries under `## [Unreleased]` for the viewer features · CHANGELOG.md
- [x] **T041** [P] Add an `## [Unreleased]` entry for `--leaned-on-by` and removal records honored by validation, with no version bump · speckit-extension/CHANGELOG.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T042** Regenerate docs images with `scripts/capture-docs-images.mjs`, overwriting in place · docs/screenshots/generated/

**⟶ Wait for T042 to finish, then:**

- [x] **T043** Run `npm run compile`, `npm test`, the webview tests and `python3 -m pytest speckit-extension/tests`, then check SC-001 to SC-006 against the results · (no file)

---

## Dependencies & Execution Order

- **Setup → Foundational → stories → Polish.** Stories 3 to 7 depend only on Foundational, own disjoint files, and can run in parallel.
- **Phase 1**: one wave (T001).
- **Phase 2**: tests wave (T002–T008) → Wave 1 (T009–T012) → Wave 2 (T013–T016) → Wave 3 (T017–T020) → T021.
- **Phase 3 (US1)**: tests (T022) and Wave 1 (T023) → T024.
- **Phase 4 (US2)**: tests (T025–T026) and Wave 1 (T027–T028).
- **Phase 5 (US3)**: Wave 1 (T029).
- **Phase 6 (US4)**: tests (T030) → T031.
- **Phase 7 (US5)**: tests (T032–T035) → Wave 2 (T036–T037).
- **Phase 8**: Wave 1 (T038–T041) → T042 → T043.
