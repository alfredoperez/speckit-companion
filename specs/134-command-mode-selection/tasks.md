# Tasks: Command Mode Selection

**Input**: Design documents from `/specs/134-command-mode-selection/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/dispatch-and-reconcile.md, quickstart.md

**Tests**: Included. The contracts file (`contracts/dispatch-and-reconcile.md`) enumerates explicit invariants each contract's tests must assert, and the existing `companionPresetReconciler.test.ts` must be updated as the reconciler is repurposed — so test tasks are in scope for this regression fix.

**Organization**: Tasks are grouped by user story (P1 → P3) so each story is an independently testable increment. This is a behavior reframe of existing code (no new schema), so file paths point at the real modules the plan identifies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in every task

## Path Conventions

Single VS Code extension. Extension code under `src/`, tests co-located as `*.test.ts`, docs under `docs/` and the two READMEs, manifest in `package.json` at repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a known-good baseline before touching the dispatch/reconcile seam

- [x] T001 Confirm the baseline builds and tests pass before any change: run `npm run compile && npm test` from the repo root and note the current green state of `src/features/settings/companionPresetReconciler.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Repurpose the reconciler's pure decision from a destructive swap to an add-only "ensure standard" — the single change US1, US2, and US4 all depend on

**⚠️ CRITICAL**: No user story work can begin until the decision function is add-only

- [x] T002 In `src/features/settings/companionPresetReconciler.ts`, replace the tri-state swap decision `decidePresetOps(profile, installed)` with an add-only `decideEnsureStandardOps(installed)` that returns `add` (or `enable` when already installed) for `companion-standard` and a `remove` ONLY for a leftover `companion-lean` and the legacy `sdd-lean` — and NEVER emits a `remove` for `companion-standard`, regardless of installed state (Contract C / FR-002).
- [x] T003 In the same file `src/features/settings/companionPresetReconciler.ts`, extract an add-only runner `ensureStandardFamily(workspaceRoot, deps)` from `reconcileCompanionPreset`: it runs the ops from `decideEnsureStandardOps(installedMap(workspaceRoot))` in order, keeps the "CLI failures are logged, not thrown" guarantee, and drops the remove-before-add ordering and the `removeFailed` skip logic (no destructive op remains to guard). Leave `readTemplateProfile` / `writeTemplateProfile` untouched — they stay the setting's persistence path for routing and seeding.

**Checkpoint**: The decision is provably add-only for the standard family — stories can now wire it in and remove the swap.

---

## Phase 3: User Story 1 - Creating a spec never fails with "Unknown command" (Priority: P1) 🎯 MVP

**Goal**: With any mode active and after any number of switches, creating a spec always dispatches a command that exists — no "Unknown command: /speckit-specify".

**Independent Test**: With lean mode active, create a spec on each supported provider and confirm it succeeds with no "Unknown command" error (quickstart §1).

### Implementation for User Story 1

- [x] T004 [US1] In `src/extension.ts`, remove the two destructive swap call sites — the `reconcileCompanionPreset(root, profile, …)` call in the `affectsConfiguration(ConfigKeys.templateProfile)` handler (~L225–235) and the one in the activation block (~L246–256) — and replace the activation block with a call to the add-only `ensureStandardFamily(root, { log })`. The config-change handler no longer touches presets (mode change is non-destructive); update the import on L13 accordingly.
- [x] T005 [P] [US1] Add a test in `src/features/settings/companionPresetReconciler.test.ts` asserting `decideEnsureStandardOps` returns no `remove` for `companion-standard` for every installed-state permutation (present/absent × lean present/absent), satisfying FR-002 / Contract C.
- [x] T006 [P] [US1] Create `src/features/specs/profileDispatch.test.ts` asserting `resolveProfileCommand`: a `lean` spec resolves all four pipeline commands (`speckit.specify|plan|tasks|implement`) to their `/speckit.companion.*` twins; a `standard`, absent, or invalid `profile` resolves each to the stock name unchanged; an unreadable/corrupt context returns the command unchanged without throwing — so no resolution yields a command with no backing file (FR-004, FR-005, SC-001, Contract A).

**Checkpoint**: Lean mode dispatches `/speckit.companion.*` (always present) and the swap can no longer blank stock files — the headline regression is fixed and demoable.

---

## Phase 4: User Story 2 - Switching modes never deletes either command set (Priority: P2)

**Goal**: Toggling the mode is non-destructive — neither command set is ever removed, and re-applying the current state is a no-op.

**Independent Test**: Toggle standard → lean → standard a few times; after each switch confirm both command sets are present and no `specify preset remove` of the standard family ran (quickstart §2).

### Implementation for User Story 2

- [x] T007 [US2] In `src/features/settings/companionPresetReconciler.ts`, delete the now-dead swap machinery left unreachable by the add-only ensure: the `PRESET_BY_PROFILE`-driven target selection, the remove-before-add ordering, and any `off`-removes-both branch. Keep `companion-lean` referenced only inside the one-time migration remove list; keep `ALL_PRESET_IDS` / `isPresetInstalled` / `installedMap` as the installed-state probe.
- [x] T008 [P] [US2] Update `src/features/settings/companionPresetReconciler.test.ts`: remove the swap-era assertions (remove-before-add ordering, both-active prevention, `removeFailed` skip) and add idempotency assertions — re-running the ensure when `companion-standard` is already installed yields zero ops (FR-006), and a standard↔lean mode change emits no `specify preset remove companion-standard` (SC-002, Contract B).

**Checkpoint**: Mode switching provably issues no standard-family remove; both US1 and US2 hold together.

---

## Phase 5: User Story 3 - Mode is chosen through one Companion option (Priority: P2)

**Goal**: The mode is set only through the `speckit.companion.templateProfile` setting, which seeds each spec's pinned shape; the old right-click "Template Profile → Standard / Lean" submenu is gone.

**Independent Test**: Set the option to lean → spec runs the lean shape; set it to standard → standard shape; right-click a spec → the old submenu is absent (quickstart §3).

### Implementation for User Story 3

- [x] T009 [US3] In `package.json`, retire the right-click submenu: delete the `speckit.specs.setProfileStandard` and `speckit.specs.setProfileLean` entries in `contributes.commands` (~L455–461), the `speckit.specs.profile` submenu declaration (~L467–468) and its two `contributes.menus["speckit.specs.profile"]` items (~L472–479), and the `submenu: "speckit.specs.profile"` reference in the spec context menu (~L531) — FR-007.
- [x] T010 [US3] In `src/features/specs/specCommands.ts`, remove the menu handler wiring: delete `setSpecProfile` and the `speckit.specs.setProfileStandard` / `speckit.specs.setProfileLean` `registerCommand` calls (~L274–292). Keep the `setProfile` import from `stepLifecycle` only if T011's seeding uses it here; otherwise drop the unused import.
- [x] T011 [US3] Seed the per-spec `profile` at the specify step in `src/features/specs/specContextManager.ts`: at each `currentStep: 'specify'` skeleton creation (~L160 and ~L226), read the project default via `readTemplateProfile(workspaceRoot)` (treat `off`/absent as `standard`; only `standard`|`lean` are pinned) and write it into the new spec's `profile`, pinning the shape so a later default change never reshapes an in-flight spec (Edge Case: in-flight safety; data-model Seeding rule).
- [x] T012 [US3] Rewrite the `speckit.companion.templateProfile` `description` in `package.json` (~L1056): remove every reference to the preset reconcile/swap and the retired right-click menu; describe it as the single option that routes a spec to the standard or lean command shape (Contract B — description MUST NOT reference the retired menu or the mutually-exclusive reconcile).

**Checkpoint**: The setting is the only mode surface, new specs inherit it as a pin, and the submenu is gone.

---

## Phase 6: User Story 4 - Both command sets survive reload and a fresh checkout (Priority: P3)

**Goal**: After an editor reload or a fresh checkout, both sets are present without any manual repair; a project stranded by a prior swap recovers automatically.

**Independent Test**: Reload the editor and check out the repo fresh; in each case both sets are present and a spec can be created (quickstart §4, §6).

### Implementation for User Story 4

- [x] T013 [US4] Confirm the activation path re-materializes the standard family: `ensureStandardFamily` (run from `src/extension.ts` activation, wired in T004) issues the bundled-path add `specify preset add --dev .specify/extensions/companion/presets/companion-standard` when `companion-standard` is absent and a no-op `enable`/nothing when present — recovering a stranded project (FR-009) and surviving reload/fresh-checkout (FR-006). Verify `presetCommandFor` still emits the `--dev` bundled-path form for `add`.
- [x] T014 [P] [US4] Add a recovery test in `src/features/settings/companionPresetReconciler.test.ts`: given a stranded installed-state (`companion-standard` absent, no companion presets), `decideEnsureStandardOps` emits the bundled-path `add` for `companion-standard`; given it already present, it emits no ops (idempotent — FR-006, FR-009, Contract C).

**Checkpoint**: All four stories hold; durability and recovery are covered by tests.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Bring the required docs in line with the reframe (per CLAUDE.md: docs are part of the change) and validate end-to-end

- [x] T015 [P] Rewrite the "Template Profiles" section in `README.md`: drop the mutually-exclusive reconcile and the right-click override; describe the single `speckit.companion.templateProfile` setting and non-destructive routing to two always-present command families.
- [x] T016 [P] Rewrite the "Template profiles" section in `speckit-extension/README.md` from the spec-kit-extension side: routing model, both families always present, no swap. (Spec-kit extension docs only — do NOT touch the root README here.)
- [x] T017 [P] Rewrite `docs/template-profiles.md`: replace "Selecting a profile" with the single-setting model, replace the reconciler description with the add-only "ensure standard" + routing model, and update the Files list to match the repurposed modules.
- [x] T018 [P] Remove the right-click "Template Profile → Standard / Lean" menu item reference from `docs/sidebar.md` (the setting is now the only mode surface).
- [x] T019 [P] Add a user-facing release note to `CHANGELOG.md` and `speckit-extension/CHANGELOG.md`: "Switching modes no longer deletes your commands; lean mode no longer fails with 'Unknown command'." Keep it effect-first, no internal file/symbol names.
- [x] T020 Run `npm run compile && npm test` and walk `quickstart.md` steps 1–6 to confirm SC-001..SC-005 and the in-flight / recovery edge cases.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (the add-only decision is the shared linchpin).
- **User Stories (Phase 3–6)**: All depend on Foundational. US1 is the MVP; US2/US3/US4 build on it. US3 (UI surface + seeding) is the most independent and can proceed in parallel with US2/US4 once Foundational is done.
- **Polish (Phase 7)**: Depends on the behavior being final across US1–US4.

### User Story Dependencies

- **US1 (P1)**: After Foundational. Removes the swap call sites + verifies routing never yields a missing command. No dependency on other stories.
- **US2 (P2)**: After Foundational; naturally follows US1 (both assert the no-remove guarantee on the same reconciler file — coordinate edits to avoid conflicts).
- **US3 (P2)**: After Foundational. Touches `package.json`, `specCommands.ts`, `specContextManager.ts` — disjoint from the reconciler file, so it parallelizes cleanly with US2/US4.
- **US4 (P3)**: After Foundational; shares the reconciler file and the activation wiring from US1 (T004).

### Within Each User Story

- Implementation before its tests' final assertions where the test imports new symbols (e.g. T002/T003 before T005, T008, T014).
- Tests marked [P] touch a different file from the story's impl task and can be written alongside it.
- Story complete before moving to the next priority.

### Parallel Opportunities

- T005, T006 (US1 tests — different files) can run together.
- US3's manifest/handler/seeding/description tasks are mostly sequential within their two files, but US3 as a whole parallelizes with US2 and US4 (disjoint files).
- All Polish doc tasks T015–T019 are [P] (different files).

---

## Parallel Example: User Story 1

```bash
# After T002–T004, write both US1 tests together (different files):
Task: "resolveProfileCommand contract test in src/features/specs/profileDispatch.test.ts"
Task: "add-only decision test in src/features/settings/companionPresetReconciler.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup (T001).
2. Phase 2: Foundational (T002–T003) — the add-only decision.
3. Phase 3: US1 (T004–T006) — remove the swap, verify routing.
4. **STOP and VALIDATE**: lean mode creates a spec with no "Unknown command" (quickstart §1). This alone restores the core promise.

### Incremental Delivery

1. Foundational ready → US1 (MVP, fixes the regression) → demo.
2. Add US2 → switching is provably non-destructive → demo.
3. Add US3 → single setting surface, submenu retired, specs pin their shape → demo.
4. Add US4 → reload/fresh-checkout durability + stranded-project recovery → demo.
5. Polish → docs + changelogs + quickstart validation.

### Coordination note

US1, US2, and US4 all edit `src/features/settings/companionPresetReconciler.ts` and its test. Sequence those three on the reconciler file (or land them in one focused pass) to avoid same-file conflicts; US3's files are disjoint and can proceed in parallel.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- This is a removal-and-reframe change: success is measured by behavior that no longer happens (no remove, no Unknown command) as much as new behavior — keep the no-remove assertions central.
- Commit after each task or logical group; restore demo fixtures (`git restore specs/_00_demo-specified specs/_01_demo-planned specs/_02_demo-tasked`) if exercising the viewer dirties them.
- The `off` value stays an explicit upstream escape hatch (routes to stock, no ensure) — outside the standard↔lean non-destructive guarantee (research Decision 4); do not fold it into the no-remove promise.
