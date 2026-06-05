# Tasks: Fix Footer Button Visibility

**Input**: Design documents from `/specs/124-fix-footer-button-visibility/`
**Prerequisites**: plan.md (required), spec.md (user stories), research.md, data-model.md, contracts/

**Tests**: INCLUDED. The spec's success criteria (SC-001…SC-005), the quickstart, and the plan's Testing section all establish unit tests as the **determinism oracle** for this fix — the live-derived footer is asserted against `contracts/footer-button-matrix.md`. Test tasks are therefore part of the feature, not optional.

**Organization**: Tasks are grouped by user story (P1 → P3) so each can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (US1, US2, US3)
- Exact file paths are included in every task

## Path Conventions

VS Code extension layout: extension side `src/`, webview side `webview/src/`, tests in colocated `__tests__/` dirs, docs in `docs/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared test scaffolding used by every story's determinism assertions.

- [x] T001 [P] Encode the footer button matrix oracle (`specs/124-fix-footer-button-visibility/contracts/footer-button-matrix.md`) as a typed, reusable fixture in `src/features/spec-viewer/__tests__/footerMatrix.fixtures.ts` — each row maps a `(status, step/condition)` to the expected Left + Right button ids.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Give the footer a single, complete state source. Every user story rides on `ViewerState` carrying the run-step/generating fields and on both refresh paths emitting a complete payload.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete — the webview cannot read footer state from `viewerState` until those fields exist and are derived.

- [x] T002 Add the run-step/generating fields (`runningStepArtifactReady: boolean`, `runningStepStartedAt: string | null`, `runningStepLabel: string | null`) to the `ViewerState` interface in `src/core/types/specContext.ts` (`activeStep` already present).
- [x] T003 [P] Mirror the new `ViewerState` fields and any `contentUpdated` / `viewerStateUpdated` message-shape changes in the extension message types at `src/features/spec-viewer/types.ts`.
- [x] T004 [P] Mirror the new `ViewerState` fields and message-shape changes in the webview types at `webview/src/spec-viewer/types.ts`.
- [x] T005 Populate the new fields in `deriveViewerState()` in `src/features/spec-viewer/stateDerivation.ts` — derive the running step from `stepHistory`, `runningStepArtifactReady` via `hasNonTrivialArtifact()` (100% tasks for implement), `runningStepStartedAt` from the running step, `runningStepLabel` via `getDocTypeLabel()`, and resolve the `approve` label to the next step before serialization (depends on T002).
- [x] T006 Extract one shared payload builder in `src/features/spec-viewer/specViewerProvider.ts` and make BOTH `sendContentUpdateMessage()` and `refreshContextIfDisplaying()` emit a COMPLETE `viewerState` (plus complete navState for nav-only fields such as `enhancementButtons`) so no footer-affecting message is ever partial (INV-3) (depends on T005).

**Checkpoint**: `ViewerState` now carries every footer-relevant field and both refresh paths ship it complete — user stories can begin.

---

## Phase 3: User Story 1 - Footer actions stay consistent with the spec's true state (Priority: P1) 🎯 MVP

**Goal**: The footer is a pure function of one `ViewerState` snapshot — a still-valid action never disappears because another control was clicked, and the same true state always yields the same button set.

**Independent Test**: Open a spec at a known stage, record the visible footer buttons, click each non-destructive/non-advancing control, and confirm the still-valid buttons remain after every click and after a refresh; re-open the spec and confirm the identical set.

### Implementation for User Story 1

- [x] T007 [US1] In `webview/src/spec-viewer/components/FooterActions.tsx`, replace the 4-source status fallback chain (`vs?.status || ns.footerState?.specStatus || ns.specStatus || initialSpecStatus`) with `status = viewerState.status` only.
- [x] T008 [US1] In `webview/src/spec-viewer/components/FooterActions.tsx`, delete the legacy `navState.footerState`-driven fallback render branch so exactly two render shapes remain — `CatalogFooter` and `GeneratingFooter` (INV-4 / FR-009) (depends on T007).
- [x] T009 [US1] In `webview/src/spec-viewer/components/FooterActions.tsx`, compute the `isGenerating` / run-step gate from `viewerState` (`activeStep`, `runningStepArtifactReady`, `runningStepStartedAt`, `stepHistory`) and remove all `navState` reads from the footer path (depends on T008).
- [x] T010 [P] [US1] In `webview/src/spec-viewer/components/footer/GeneratingFooter.tsx`, source the running-step label and recovery-timeout anchor from `viewerState` instead of `navState`.
- [x] T011 [P] [US1] In `webview/src/spec-viewer/signals.ts`, make the `viewerState` signal the footer's sole input and confirm the footer no longer depends on the `navState` signal.
- [x] T012 [P] [US1] In `webview/src/spec-viewer/index.tsx`, ensure `viewerStateUpdated` refreshes the footer from the complete `viewerState` and never leaves it reading a stale/partial snapshot (close the early-`viewerStateUpdated`-before-first-`navState` race).
- [x] T013 [P] [US1] Add determinism tests in `src/features/spec-viewer/__tests__/footerActions.test.ts` (new) — idempotence (same `ViewerState` ⇒ identical set, SC-001), a state-preserving action leaves the set unchanged (SC-002 / FR-002), and an external `.spec-context.json` change re-derives the matrix-correct footer (FR-007 / SC-004), using the `footerMatrix.fixtures` from T001.
- [x] T014 [P] [US1] Extend `webview/src/spec-viewer/components/__tests__/FooterActions.test.tsx` — assert the footer derives only from `viewerState` (a stale/partial `navState` cannot hide a still-valid button) and that the generating overlay reverts to `CatalogFooter` on artifact-ready and on timeout (FR-005).

**Checkpoint**: The reported #193 symptom is gone — buttons are deterministic and no still-valid action disappears after clicks/refreshes. This is the MVP.

---

## Phase 4: User Story 2 - The expected next action is always reachable at a pause point (Priority: P2)

**Goal**: At every pause stage (`specified`, `planned`, `ready-to-implement`, `implemented`, `completed`, `archived`) the documented forward or closure control is present and enabled.

**Independent Test**: Drive a spec to each pause stage and confirm the documented forward/closure control is present and enabled, with no reopen required.

### Implementation for User Story 2

- [x] T015 [US2] In `src/features/spec-viewer/stateDerivation.ts`, verify the serialized `approve` label resolves to the next step at each pause stage (`specified`→**Plan**, `planned`→**Tasks**, `ready-to-implement`→**Implement**) and is hidden on `implement`; adjust if the relocated run-step fields changed `shouldShowApprove` gating.
- [x] T016 [US2] In `src/features/spec-viewer/footerActions.ts` / `src/features/spec-viewer/stateDerivation.ts`, verify the closure controls surface per matrix — `Mark Completed` + `Archive` at `implemented`, `Reactivate` + `Archive` at `completed`, `Reactivate` at `archived` — and no forward action shows at the closure gate.
- [x] T017 [P] [US2] Add pause-stage oracle tests in `src/features/spec-viewer/__tests__/footerMatrix.test.ts` (new) — assert the derived footer equals the `footerMatrix.fixtures` Left + Right set for each of `specified` / `planned` / `ready-to-implement` / `implemented` / `completed` / `archived` (SC-003 / FR-004).

**Checkpoint**: Every pause stage exposes its forward/closure control; the user is never stranded.

---

## Phase 5: User Story 3 - Step tabs reflect true per-step state through actions (Priority: P3)

**Goal**: Step tabs (Specification, Plan, Tasks) show enabled/disabled, completion ✓, active, and reviewing indicators that match the spec's true per-step state, and stay in sync after footer actions.

**Independent Test**: At each stage, compare every tab's enabled/✓/active state against the spec's true per-step completion + on-disk document presence; perform footer actions and re-check the tabs stay in sync.

### Implementation for User Story 3

- [x] T018 [US3] In `webview/src/spec-viewer/navigation.ts`, confirm step-tab class derivation (enabled/disabled, completion ✓, active/working, reviewing, green-✓ on-disk check) reads from the same refreshed `viewerState` snapshot (`steps`, `highlights`, `pulse`, `stepHistory`); replace any stale `navState` read.
- [x] T019 [US3] Verify a workflow-advancing footer action updates the affected step tab's indicator without a reopen — riding the complete-payload refresh from T006, with no separate tab-only state path — in `webview/src/spec-viewer/navigation.ts` / `webview/src/spec-viewer/components/StepTab.tsx`.
- [x] T020 [P] [US3] Add step-tab sync tests in `webview/src/spec-viewer/__tests__/navigation.test.ts` (new) — tab enabled/✓/active match the true per-step state at each stage, and a tab indicator updates after a workflow-advancing footer action (FR-006).

**Checkpoint**: Tabs and footer share one snapshot; no tab desyncs after footer actions.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, visual baseline, and dead-code cleanup once the single-source model is in place.

- [x] T021 [P] Update `docs/viewer-states.md` — document the single-source (viewerState-only) footer model and confirm its footer button matrix matches `specs/124-fix-footer-button-visibility/contracts/footer-button-matrix.md`.
- [x] T022 [P] Update `webview/src/spec-viewer/components/FooterActions.stories.tsx` to exercise the consolidated states (catalog per pause stage, generating overlay, terminal completed/archived) and remove any legacy-fallback story variant.
- [x] T023 Remove the now-dead footer duplicates (`footerState`, `specStatus`, `runningStep*`, footer-only `activeStep`) from `NavState` in `webview/src/spec-viewer/types.ts` and `src/features/spec-viewer/types.ts` after confirming no remaining readers; keep nav-only fields (`coreDocs`, `relatedDocs`, `enhancementButtons`, …) (depends on T009, T010, T011).
- [x] T024 Run `npm run compile && npm run compile-web && npm test`, then execute `specs/124-fix-footer-button-visibility/quickstart.md` against `specs/_00_demo-specified` / `_01_demo-planned` / `_02_demo-tasked` and `git restore` those demo dirs afterward (do NOT commit fixture edits).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: T002 → (T003 ∥ T004) → T005 → T006. BLOCKS all user stories.
- **User Stories (Phase 3-5)**: All depend on Foundational completion. Once it is done, US1/US2/US3 can proceed in parallel (they touch largely different files); recommended order is P1 → P2 → P3.
- **Polish (Phase 6)**: T021/T022 after their respective stories; T023 after US1 webview edits (T009-T011); T024 last (full build + manual repro).

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. Delivers FR-001, FR-002, FR-005, FR-007, FR-008, FR-009 — the core determinism fix (MVP).
- **US2 (P2)**: Depends on Foundational (uses the derived `approve` label + closure gates from T005). Independently testable via the pause-stage oracle.
- **US3 (P3)**: Depends on Foundational (rides the same complete-payload refresh). Independently testable via tab-sync tests.

### Within Each User Story

- The three `FooterActions.tsx` edits (T007 → T008 → T009) are sequential (same file).
- Tests can be written alongside or just after the implementation tasks they assert.

### Parallel Opportunities

- T003 ∥ T004 (different type files) after T002.
- T010 ∥ T011 ∥ T012 ∥ T013 ∥ T014 (different files) after the `FooterActions.tsx` edits land.
- T017 (US2 test) ∥ T020 (US3 test) ∥ US1 tests — different files.
- After Foundational, US1 / US2 / US3 can be staffed in parallel.
- T021 ∥ T022 in Polish.

---

## Parallel Example: User Story 1

```bash
# After T007-T009 (FooterActions.tsx) land, run these together:
Task: "Source generating fields from viewerState in webview/src/spec-viewer/components/footer/GeneratingFooter.tsx"
Task: "Make viewerState the footer's sole input in webview/src/spec-viewer/signals.ts"
Task: "Guard viewerStateUpdated against stale/partial snapshots in webview/src/spec-viewer/index.tsx"
Task: "Determinism tests in src/features/spec-viewer/__tests__/footerActions.test.ts"
Task: "Single-source render tests in webview/src/spec-viewer/components/__tests__/FooterActions.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (matrix fixture).
2. Complete Phase 2: Foundational (single complete state source) — CRITICAL, blocks all stories.
3. Complete Phase 3: User Story 1 (footer reads only `viewerState`; legacy path + 4-source chain removed).
4. **STOP and VALIDATE**: run the #193 repro from `quickstart.md` against the demo fixtures — no still-valid button disappears, identical set on re-open.

### Incremental Delivery

1. Setup + Foundational → footer has one complete source.
2. Add US1 → determinism restored → demo (MVP, closes #193).
3. Add US2 → every pause stage exposes its forward/closure control.
4. Add US3 → step tabs stay in sync with the footer.
5. Polish → docs, stories, dead-code removal, full build + manual repro.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- This is a fix within a known subsystem: `footerActions.ts` visibility **rules are unchanged** — the work is in *how state reaches the footer* (single complete `ViewerState`), not in what the rules decide.
- The target behavior is the existing `docs/viewer-states.md` matrix; do not change the documented matrix.
- Preserve the generating-state UX and the client-side recovery timeout — only its inputs move to `viewerState`.
- Never commit edits to the `specs/_00_demo-specified` / `_01_demo-planned` / `_02_demo-tasked` fixtures.
