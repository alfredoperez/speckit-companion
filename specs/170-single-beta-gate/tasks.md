---
description: "Task list for One Beta Gate for the SpecKit Companion Workflow"
---

# Tasks: One Beta Gate for the SpecKit Companion Workflow

**Input**: Design documents from `/specs/170-single-beta-gate/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/settings-and-gates.md, quickstart.md

**Tests**: Automated tests ARE requested for this feature (migration matrix + telemetry field — see quickstart.md "Automated test coverage"). Picker-gating and resume context-key wiring are config/disk-dependent and validated manually (known coverage gap in CLAUDE.md → Testing).

**Organization**: Tasks are grouped by user story. All three stories are P1. US3 (migration) is the only story that must never regress activation, so it is sequenced last as the safety capstone but is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 — maps to the user stories in spec.md

## Path Conventions

Single-project VS Code extension. Source under `src/`, config in root `package.json`, docs in root `README.md` / `CHANGELOG.md` / `docs/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm baseline builds before touching the configuration surface.

- [x] **T001** Confirm a clean baseline: run `npm install && npm run compile && npm test` from repo root and note the current passing state (per quickstart.md → Build).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The configuration schema and the shared config-key constant define the single source of truth that every user story reads. These MUST land before any story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] **T002** In `package.json` → `contributes.configuration`, add `speckit.companion.workflowBeta` under the **Beta Features** group: `type: boolean`, `default: false`, `scope: window`, `order: 5`, with the `markdownDescription` from contracts/settings-and-gates.md (mentions the Create-Spec picker when the companion piece is installed and the Continue/Resume button). (FR-001, FR-002)
- [x] **T003** In `package.json` → `contributes.configuration`, remove the `speckit.companion.resumeBeta` entry (currently near line 1042). (FR-003, SC-001)
- [x] **T004** In `src/core/constants.ts`, repoint `ConfigKeys.resumeBeta` (line 68) from `'speckit.companion.resumeBeta'` to `'speckit.companion.workflowBeta'` (keep the constant name `resumeBeta` — only the value changes). (FR-008)

**Checkpoint**: Schema exposes exactly one Companion-workflow setting; the shared constant points at it. User-story work can begin.

---

## Phase 3: User Story 1 - Single switch turns on the whole Companion experience (Priority: P1) 🎯 MVP

**Goal**: One beta setting (on, companion installed) makes both the Create-Spec picker appear and the Continue/Resume button available — no second switch.

**Independent Test**: With `.specify/extensions/companion/` present, turn `speckit.companion.workflowBeta` on → Create Spec shows the SpecKit / SpecKit Companion picker (preselected to `defaultWorkflow`) and the sidebar resume `▶` is available; turn it off → both disappear, stock SpecKit only. (Scenario A in quickstart.md)

### Implementation for User Story 1

- [x] **T005** [US1] In `src/features/workflows/workflowManager.ts`, change `buildWorkflows(filterByProvider, outputChannel)` (around line 232) so the built-in `COMPANION_WORKFLOW` is seeded into the selection list ONLY when `filterByProvider === true` AND `speckit.companion.workflowBeta` is on AND `isCompanionInstalled(workspaceRoot)` is true; the unfiltered path (`getAllWorkflows()`) MUST still always include it. Read the beta value via `coerceLegacyBoolean(value, false)` and import `isCompanionInstalled` from `../settings/companionPresetReconciler`. (FR-006, FR-007)
- [x] **T006** [US1] In `src/extension.ts`, update the activation read site (around lines 286–289) that sets the `speckit.resumeBeta` context key so it reads `companion.workflowBeta` (via `ConfigKeys.resumeBeta` / `coerceLegacyBoolean`) instead of `companion.resumeBeta`. (FR-008)
- [x] **T007** [US1] In `src/extension.ts`, update the `onDidChangeConfiguration` handler (around lines 264–270) so the `affectsConfiguration` check and the value read both target `companion.workflowBeta`, keeping the `CONTEXT_KEYS.resumeBeta` context-key name unchanged. (FR-008)
- [x] **T008** [P] [US1] In `src/core/telemetry.ts`, rename the `BetaSnapshot.resumeBeta` field to `workflowBeta` (line 71) and source it from `companion.workflowBeta` in `buildBetaSnapshot()` (line 88). (Decision 5)
- [x] **T009** [P] [US1] In `src/core/__tests__/telemetry.test.ts`, update the snapshot assertions to the new `workflowBeta` field and its `companion.workflowBeta` source.

**Checkpoint**: With beta on + companion installed, the picker is offered and resume is enabled from the single setting; telemetry reports `workflowBeta`. Validate via quickstart Scenario A.

---

## Phase 4: User Story 2 - No hollow options when the companion piece is missing (Priority: P1)

**Goal**: With beta on but the companion piece NOT installed, no workflow picker appears (no silent-fallback "Companion" choice), and the install offer stays reachable.

**Independent Test**: Remove `.specify/extensions/companion/`, turn the beta on, open Create Spec → no picker, new specs run stock SpecKit, and the install prompt/banner is still reachable. (Scenario B in quickstart.md)

### Implementation for User Story 2

- [x] **T010** [US2] Verify the `isCompanionInstalled(root)` term added in T005 makes `getWorkflows()` return a single-entry list (no Companion) when beta is on but the companion piece is absent — so the webview's `length > 1` rule collapses the picker with no webview change. Add an inline guard/early-return only if T005 left an edge where Companion could still leak into the selection list. (FR-006, FR-009, SC-004)
- [x] **T011** [US2] Confirm (no code change expected) the install-prompt surface is independent of the picker gate: the `speckit.companion.installPrompt` banner and sidebar install affordance remain reachable when beta is on and the companion piece is missing. Note the finding in the PR description; only adjust wiring if the gate change in T005/T006 suppressed it. (FR-009, SC-004)

**Checkpoint**: Beta on + companion missing yields zero hollow picker surfaces while the install path stays open. Validate via quickstart Scenario B.

---

## Phase 5: User Story 3 - Existing opt-in carries over without breaking (Priority: P1)

**Goal**: On upgrade, a prior `companion.resumeBeta` opt-in (including legacy "on"/"beta" strings) migrates to `companion.workflowBeta = true`, the old key is removed, and NO stored value can fail activation.

**Independent Test**: Seed each historical value of `companion.resumeBeta` (`true`, `"on"`, `"beta"`, `false`, `"off"`, unset, garbage), reload → old key gone; new key on for on-style values, off/absent otherwise; activation never errors. (Scenario C in quickstart.md)

### Tests for User Story 3 (write first, expect them to fail before T013)

- [x] **T012** [P] [US3] In `src/core/settingsMigration.test.ts`, add a `describe('migrateResumeBetaToWorkflowBeta')` suite covering the contracts/settings-and-gates.md value table: `true`/`"on"`/`"beta"` → `workflowBeta=true` at the same scope + old key deleted; `false`/`"off"`/unset/garbage → `workflowBeta` unchanged + old key deleted (or nothing to delete); scope preservation (Global vs Workspace); idempotent re-run writes nothing; does not overwrite an explicitly-set `workflowBeta`; never throws on any value. (FR-004, FR-005, SC-002, SC-006)

### Implementation for User Story 3

- [x] **T013** [US3] In `src/core/settingsMigration.ts`, add `export async function migrateResumeBetaToWorkflowBeta(): Promise<void>` that, per scope (`Global`/`Workspace`/`WorkspaceFolder`) via `inspect()`, reads `companion.resumeBeta`; when `coerceLegacyBoolean(value, false)` is true AND `workflowBeta` isn't already explicitly set at that scope, writes `companion.workflowBeta = true` at that scope; then deletes `companion.resumeBeta` (`update(key, undefined, scope)`) at every scope where it was set. Reuse the existing `coerceLegacyBoolean` + per-scope pattern. (FR-004, data-model.md migration rules)
- [x] **T014** [US3] In `src/extension.ts`, call `migrateResumeBetaToWorkflowBeta()` during `activate()` alongside the existing `migrateBetaTriStateSettings()`/`removeRetiredSettings()` calls (around line 119), wrapped in (or inside) the same try/catch so any error is logged and swallowed — activation MUST complete for every stored value. Add the import next to the existing migration imports (line 29). (FR-005, SC-002)

**Checkpoint**: All historical `resumeBeta` values upgrade cleanly; activation is crash-proof. Validate via quickstart Scenario C and the new migration tests.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation (part of the change, not a follow-up) and end-to-end validation.

- [x] **T015** [P] In `README.md` (Configuration → Beta Features), document the single `speckit.companion.workflowBeta` setting and the removal of `companion.resumeBeta`, including that it gates both the Create-Spec picker (when the companion piece is installed) and Continue/Resume. (FR-010)
- [x] **T016** [P] In `docs/sidebar.md`, update the resume `▶` button reference to read its enablement from the new beta setting. (FR-010)
- [x] **T017** [P] In `docs/how-it-works.md`, `docs/template-profiles.md`, and `docs/capture-and-timing.md`, replace references to the old `resumeBeta` toggle / always-on picker gating with the single-gate model (picker shown only when beta on AND companion installed). (FR-010)
- [x] **T018** [P] In `CHANGELOG.md`, add a user-facing entry: one setting now turns on the whole Companion workflow (picker + resume), the old resume toggle is removed, and your prior opt-in carries over automatically. Use changelog voice (no internal file/symbol names). (FR-010)
- [x] **T019** Run `npm run compile && npm test` and confirm the migration + telemetry suites pass; then run quickstart.md Scenarios A, B, and C in the Extension Development Host (F5) and confirm each behaves as listed. (SC-001 through SC-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS all user stories** — the schema + `ConfigKeys` value must exist first.
- **User Stories (Phase 3–5)**: All depend on Foundational. US1, US2, US3 are independently testable; US2 builds on the gate term added in US1 (T005), so run US1 before US2.
- **Polish (Phase 6)**: Depends on the user-story code landing.

### User Story Dependencies

- **US1 (P1)**: After Foundational. Delivers the picker gate (T005) and resume/telemetry wiring — the MVP.
- **US2 (P1)**: Reuses the `isCompanionInstalled` term from T005; verification-heavy, minimal new code.
- **US3 (P1)**: After Foundational. Fully independent of US1/US2 (migration only); sequenced last as the activation-safety capstone.

### Within Each User Story

- US3: write the migration test (T012) before the implementation (T013).
- Telemetry change (T008) before its test update (T009) — or together.
- Code before its docs in Phase 6.

### Parallel Opportunities

- T008 + T009 (telemetry, separate from workflow/extension files) can run alongside T005–T007.
- T012 (test file) is independent of other story files.
- All Phase 6 doc tasks (T015–T018) are different files → fully parallel.

---

## Parallel Example: Phase 6 Documentation

```bash
# All four doc updates touch different files — run together:
Task: "Update README.md Beta Features section (T015)"
Task: "Update docs/sidebar.md resume button reference (T016)"
Task: "Update docs/how-it-works.md + template-profiles.md + capture-and-timing.md (T017)"
Task: "Add CHANGELOG.md entry (T018)"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup (T001).
2. Phase 2: Foundational (T002–T004) — schema + constant.
3. Phase 3: User Story 1 (T005–T009) — picker gate + resume wiring + telemetry.
4. **STOP and VALIDATE**: quickstart Scenario A (beta on + installed → picker + resume).

### Incremental Delivery

1. Foundation → single setting exists.
2. US1 → picker + resume from one switch (MVP). Validate Scenario A.
3. US2 → honest surface when companion missing. Validate Scenario B.
4. US3 → migration + crash-proof activation. Validate Scenario C.
5. Polish → docs + full quickstart pass.

---

## Notes

- This is the **VS Code extension** half (root `README.md`/`CHANGELOG.md`, `package.json`, `v*` release lane). Do NOT touch `speckit-extension/` docs or version.
- [P] tasks = different files, no dependencies.
- Migration must never throw out of `activate()` — the provider-rename lesson is the hard requirement behind T013/T014.
- Picker-gating and resume context-key paths have no config-mock harness (CLAUDE.md → Testing); rely on quickstart Scenarios A/B for those.
- Commit after each logical group; restore demo fixtures if exercised.
