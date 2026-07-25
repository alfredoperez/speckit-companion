# Tasks: Default workflow to Companion when the companion extension is installed

**Feature branch**: `563-companion-default-workflow` | **Issue**: #567 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup

No setup tasks — the change extends existing modules with the toolchain already in place.

## Phase 2: Foundational

The resolver blocks every consumer, so it lands first.

**Wave 1 — the resolver (single task):**

- [x] **T001** [US1][US2] Add `pickEffectiveDefaultWorkflow(inspected, companionInstalled)` (pure) and `resolveEffectiveDefaultWorkflow(root?)` (vscode wrapper reading `config.inspect('defaultWorkflow')` + `isCompanionInstalled(root)`) to `src/features/workflows/workflowManager.ts`.

**⟶ Wait for Wave 1, then:**

- [x] **T002** [US1][US2] Re-export `resolveEffectiveDefaultWorkflow` (and the pure core) from `src/features/workflows/index.ts`.

## Phase 3: User Story 1 + 2 — install-aware default & explicit-honored (P1)

**Wave 2 — independent consumers (different files):**

- [x] **T003** [P] [US1][US2] In `src/features/workflows/workflowSelector.ts` `resolveDefaultWorkflow`, replace `config.get('defaultWorkflow', 'speckit')` with `resolveEffectiveDefaultWorkflow(root)`, threading the workspace root.
- [x] **T004** [P] [US1][US2] In `src/features/spec-editor/specEditorProvider.ts` `handleReady`, compute the pre-selected `defaultWorkflow` via `resolveEffectiveDefaultWorkflow(workspaceRoot)` instead of the raw `config.get`.

**Checkpoint**: With the extension installed and the setting unset, both the Create-Spec pre-selection and per-feature resolution pick `companion`; an explicit value is returned verbatim.

## Phase 4: User Story 3 — telemetry stays honest (P2)

**Wave 3 — telemetry comment (single task):**

- [x] **T005** [US3] In `src/core/telemetry.ts` `buildBetaSnapshot`, keep the raw `config.get('defaultWorkflow', 'speckit')` read and add a one-line comment stating telemetry reports the raw configured value, not the install-derived effective value, so the companion-adoption metric stays honest.

## Phase 5: Polish

**Wave 4 — tests & docs (different files):**

- [x] **T006** [P] Add `src/features/workflows/__tests__/resolveEffectiveDefaultWorkflow.test.ts` unit-testing the pure `pickEffectiveDefaultWorkflow`: unset+installed → companion; unset+not-installed → speckit; explicit companion → companion; explicit speckit (installed) → speckit; and a prototype-key/empty-value guard.
- [x] **T007** [P] Update `docs/template-profiles.md` selection-model section: when the companion extension is installed, an unset `speckit.defaultWorkflow` resolves to companion; an explicit value is always honored.
- [x] **T008** Run `npm run compile && npm test` to validate against the Success Criteria.

## Dependencies & Execution Order

- Phase 2 (T001) blocks everything; T002 depends on T001.
- Phase 3 Wave 2 (T003, T004) depends on T002 and is internally parallel (different files).
- Phase 4 (T005) is independent of the resolver but sequenced after for a coherent diff.
- Phase 5 Wave 4 (T006, T007) parallel; T008 (suite run) last.
