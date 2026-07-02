# Tasks: Spec Explorer actions — drift, coverage, adopt

**Feature**: 384-explorer-actions · **Plan**: [plan.md](./plan.md) · **Contract**: [contracts/explorer-actions.md](./contracts/explorer-actions.md)

## Phase 1: Setup

No setup tasks — no new tooling or dependencies; the change lands in existing modules plus one new commands module and one new test module.

## Phase 2: Foundational (blocks all stories)

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add `CapabilityHealth` + `readCapabilityHealth(workspaceRoot, cap, opts?)` — coverage count from the `.spec.md`/`.coverage.md` pair (CLI rule), drift boolean from one time-bounded async git call filtered by `match`/`exclude`/exempt globs; never rejects, absent fields on any failure · `src/features/specs/livingSpecsModel.ts`
- [x] **T002** [P] Declare the four commands (`speckit.livingSpecs.{drift,coverage,adopt,refresh}`) and their menus — `view/title` (refresh + adopt) and `view/item/context` on `viewItem == living-specs-capability` (drift + coverage) — per the contract · `package.json`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** Create the commands module registering all four (drift/coverage dispatch `/speckit.companion.<cmd> <capability>` via `executeSlashCommand`, adopt dispatches bare, refresh fires the provider's change event); wire registration at activation · `src/features/specs/livingSpecsCommands.ts`, `src/extension.ts`

**Checkpoint**: commands exist, menus render, dispatch path compiles.

## Phase 3: User Story 1 — Check drift from the tree (P1)

### Implementation

**Wave 1:**

- [x] **T004** [US1] Ensure capability tree items carry what the command needs (capability name reachable from the invoked node) and add dispatch tests: invoking drift on a capability sends exactly `/speckit.companion.drift <name>`; hidden/no-op when the node is not a capability · `src/features/specs/livingSpecsExplorerProvider.ts`, `src/features/specs/__tests__/livingSpecsCommands.test.ts`

**Checkpoint**: drift runs from a right-click, scoped correctly.

## Phase 4: User Story 2 — Check coverage from the tree (P1)

### Implementation

**Wave 1:**

- [x] **T005** [US2] Coverage dispatch tests mirroring T004 (`/speckit.companion.coverage <name>`; same gating) · `src/features/specs/__tests__/livingSpecsCommands.test.ts`

**Checkpoint**: coverage runs from a right-click.

## Phase 5: User Story 3 — Adopt from the view (P2)

### Implementation

**Wave 1:**

- [x] **T006** [US3] Adopt reachable from the view title menu (and meaningful when the tree shows the off/empty info nodes); dispatch test asserts bare `/speckit.companion.adopt` · `src/features/specs/__tests__/livingSpecsCommands.test.ts`

**Checkpoint**: adoption starts from the view, including the empty state.

## Phase 6: User Story 4 — Capability health on the row (P2)

### Implementation

**Wave 1:**

- [x] **T007** [US4] Render health on capability rows — description suffix (`3/5 covered`, `● drift` with warning color), tooltip lines, async via `getChildren`, recomputed by the refresh command · `src/features/specs/livingSpecsExplorerProvider.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T008** [US4] Health tests: covered/total counting, drifted boolean from a seeded git repo (or mocked git runner), and the fallback case — health absent ⇒ row renders exactly as today · `src/features/specs/__tests__/livingSpecsModel.test.ts`

**Checkpoint**: the tree reads as a dashboard; failures render as today.

## Phase 7: Polish

**Wave 1 — independent (different files):**

- [x] **T009** [P] Document the actions + health in the sidebar reference and the README's sidebar summary · `docs/sidebar.md`, `README.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T010** Full verification: `npm test` + `npm run compile`; validate against the spec's Success Criteria (SC-001…SC-005) · repo root

## Dependencies & Execution Order

- **Setup → Foundational → US1 → US2 → US3 → US4 → Polish.** Foundational: T001/T002 parallel (different files), then T003 (needs both the model API and the declared ids).
- US1/US2/US3 (T004–T006) share the test module — sequential in that order; each depends on T003's registrations.
- US4: T007 (provider rendering) then T008 (tests over model + provider).
- Polish: T009 parallel-safe, then T010 as the final gate.
