# Tasks: Track install rate and prompt→install conversion

**Feature dir**: `specs/523-install-prompt-telemetry` · **Plan**: [plan.md](./plan.md) · **Size**: normal

## Phase 1: Setup

No setup tasks — this extends an existing telemetry module in place.

## Phase 2: Foundational (blocks all stories)

The emit helpers and enums are shared by every story, so they land first.

**Wave 1 — single task (shared module):**

- [x] **T001** [US1][US2] Add to `src/core/telemetry.ts`: `InstallPromptSurface` (`'createSpec'|'activity'`) and `InstallPromptAction` (`'shown'|'clicked'`) types, the `companion.installPrompt` event-name constant, a module-level `Set<InstallPromptSurface>` session-dedupe guard, `reportInstallPromptShown(surface)` (emits `action:'shown'` once per surface per session), `reportInstallPromptClicked(surface)` (emits `action:'clicked'`), and a test-only dedupe reset helper · `src/core/telemetry.ts`

## Phase 3: User Story 1 — install rate (P1)

**Wave 2 — single task (depends on nothing in Wave 1):**

- [x] **T002** [US1] In `fireActivatedEvent`, compute `isCompanionInstalled(root)` and add `companionInstalled: String(...)` to the `extension.activated` payload (report `false` when no workspace root) · `src/extension.ts`

**Checkpoint**: `extension.activated` now reports install state on every activation.

## Phase 4: User Story 2 — prompt→install conversion (P1)

**⟶ Wait for Wave 1 (T001) to finish, then:**

**Wave 3 — independent (different files):**

- [x] **T003** [P] [US2] Emit `reportInstallPromptShown('createSpec')` when the Create-Spec banner renders visible, and `reportInstallPromptClicked('createSpec')` in the `installSpecKitExtension` message handler before delegating to the command · `src/features/spec-editor/specEditorProvider.ts`
- [x] **T004** [P] [US2] Emit `reportInstallPromptShown('activity')` inside `computeShowInstallPrompt()` when it returns `true`, and `reportInstallPromptClicked('activity')` in the `installSpecKitExtension` handler before delegating · `src/features/spec-viewer/specViewerProvider.ts`, `src/features/spec-viewer/messageHandlers.ts`

**Checkpoint**: both banner surfaces emit shown + clicked; conversion is computable.

## Phase 5: User Story 3 — used-vs-installed (P2)

**Wave 4 — single task (verification only):**

- [x] **T005** [US3] Confirm `spec.created`, `spec.completed`, `phase.dispatched`, `workflow.selected` still emit (grep + existing tests) — no code change unless a regression is found · `src/` (verification)

## Phase 6: Polish

**⟶ Wait for T001–T004, then:**

**Wave 5 — independent (different files):**

- [x] **T006** [P] Tests in `src/core/__tests__/telemetry.test.ts`: `extension.activated` carries boolean `companionInstalled`; `reportInstallPromptShown` emits `companion.installPrompt` with `action:'shown'`+surface and dedupes on the second call; `reportInstallPromptClicked` emits `action:'clicked'`+surface; assert only boolean/enum fields (no identifier/path); assert the disabled-telemetry gate suppresses them · `src/core/__tests__/telemetry.test.ts`
- [x] **T007** [P] README Telemetry section: add `companionInstalled` and the `companion.installPrompt` (shown/clicked × surface) signals to the "What is collected" table, plus a "Reading these in App Insights" note with a sample `AppEvents` query · `README.md`
- [x] **T008** [P] CHANGELOG `[Unreleased]` user-facing entry for the new install-rate + conversion telemetry · `CHANGELOG.md`

**⟶ Wait for T006, then:**

- [x] **T009** Run `npm run compile && npm test`; confirm green (telemetry suite included) · repo

## Dependencies & Execution Order

- Phase 2 (T001) blocks Phase 4 (T003, T004) and the tests (T006) — the emit helpers must exist first.
- T002 (US1) is independent of T001 (it edits `extension.activated` directly), can run any time.
- Wave 3 (T003, T004) are different files → parallelizable once T001 lands.
- Wave 5 docs/tests (T006–T008) are different files → parallelizable once code lands; T009 (build+test) runs last.
