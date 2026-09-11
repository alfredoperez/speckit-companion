# Tasks: Living spec surface

**Input**: [plan.md](./plan.md), [living-spec-surface.spec.md](./living-spec-surface.spec.md), [data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md)

## Phase 2: Foundational

Files: `src/protocol/viewer.ts`, `src/features/specs/livingSpecsModel.ts`, `src/features/specs/__tests__/livingSpecsModel.test.ts`, `src/features/spec-viewer/specViewerProvider.ts`, `src/extension.ts`

**Wave 1 — independent (different files):**
- [x] **T001** [P] Add `driftedRequirements?: string[]` to `LivingHeaderMeta` and a `livingValidate` webview message type · src/protocol/viewer.ts
- [x] **T002** [P] Add `driftedRequirements(specText, driftedFiles)`: headings whose touches globs match a drifted file, with a test · src/features/specs/livingSpecsModel.ts, src/features/specs/__tests__/livingSpecsModel.test.ts
- [x] **T003** [P] Capability-file watcher also refreshes an open living viewer · src/extension.ts

**⟶ Wait for Wave 1 to finish, then:**
- [x] **T004** `pushLivingHealth` sends `driftedRequirements` (absent when drift is unknown) · src/features/spec-viewer/specViewerProvider.ts

## Phase 3: User Story 1 - Requirement cards (P1)

Files: `webview/src/spec-viewer/markdown/livingComponents.ts`, `webview/src/spec-viewer/markdown/livingComponents.test.ts`, `webview/styles/spec-viewer/_living.css`

### Tests
- [x] **T005** Tests: card carries `data-req-state`, state word only on adopted, adopted tooltip escapes quotes, `touches N files` link, no coverage/confidence badge row · webview/src/spec-viewer/markdown/livingComponents.test.ts

### Implementation
**⟶ Wait for T005, then Wave 1 — independent:**
- [x] **T006** [P] [US1] Card markup: `data-req-state`, `.living-req-state` word with attribute-safe tooltip, `.living-req-touches` link, drop the adopted badge text from the face · webview/src/spec-viewer/markdown/livingComponents.ts
- [x] **T007** [P] [US1] Card CSS: heading block with 3px state edge, state word inks, touches link, 760px column · webview/styles/spec-viewer/_living.css

**Checkpoint**: every requirement renders as a state-edged card.

## Phase 4: User Story 2 - State at a glance (P1)

Files: `webview/src/spec-viewer/index.tsx`, `webview/src/spec-viewer/toc.ts`, `webview/styles/spec-viewer/_toc.css`, `webview/src/spec-viewer/components/SpecHeader.tsx`, `webview/src/spec-viewer/__tests__/tocRequirements.test.ts`

**Wave 1 — independent (different files):**
- [x] **T008** [P] [US2] On `livingHealthResolved`, mark cards named in `driftedRequirements` as drifted and rebuild the rail · webview/src/spec-viewer/index.tsx
- [x] **T009** [P] [US2] Rail pip takes the card state as a `--state-<state>` modifier, with a test · webview/src/spec-viewer/toc.ts, webview/styles/spec-viewer/_toc.css, webview/src/spec-viewer/__tests__/tocRequirements.test.ts
- [x] **T010** [P] [US2] Header count line: `N requirements · X adopted, unconfirmed · Y drifted` · webview/src/spec-viewer/components/SpecHeader.tsx

**Checkpoint**: edges, words, counts and pips agree.

## Phase 5: User Story 3 - Capability bar (P2)

Files: `webview/src/spec-viewer/components/footer/LivingFooter.tsx`, `src/features/spec-viewer/messageHandlers.ts`, `src/features/specs/livingSpecsCommands.ts`, `package.json`

**Wave 1 — independent (different files):**
- [x] **T011** [P] [US3] `speckit.livingSpecs.validate` dispatches `/speckit.companion.living-validate <capability>`; register it · src/features/specs/livingSpecsCommands.ts, package.json
- [x] **T012** [P] [US3] Footer: condition text left; Adopt an area, Validate, Sync (drifted only) right · webview/src/spec-viewer/components/footer/LivingFooter.tsx

**⟶ Wait for Wave 1 to finish, then:**
- [x] **T013** [US3] `livingValidate` handler runs the validate command for the open capability · src/features/spec-viewer/messageHandlers.ts

**Checkpoint**: every bar button reaches its tree counterpart.

## Phase 6: User Story 4 - Empty and single (P2)

Files: `webview/src/spec-viewer/App.tsx`

- [x] **T014** [US4] Hide the rail for one or zero cards; show `Adopt this area` when the capability has no spec file · webview/src/spec-viewer/App.tsx

**Checkpoint**: first-time states render.

## Phase 7: Polish

- [x] **T015** Docs and changelog: living view reference, README living-specs section, `## [Unreleased]` entry · docs/sidebar.md, README.md, CHANGELOG.md
- [x] **T016** Run `npm test` and `npm run lint`, validate against SC-001..SC-004 · (repo)

## Dependencies & Execution Order

- Foundational → US1 → US2 → US3 → US4 → Polish. US2 reads the card state US1 writes; US3 needs T001's message type.
- Phase 2: Wave 1 (T001–T003) blocks T004.
- US1: T005 blocks Wave 1 (T006, T007).
- US2: one wave (T008–T010).
- US3: Wave 1 (T011, T012) blocks T013.
