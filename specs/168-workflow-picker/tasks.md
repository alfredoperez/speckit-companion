# Tasks — Workflow Picker: One Choice, SpecKit or SpecKit Companion

Dependency-ordered checklist organized by execution layer. Traceability is to files and requirements (`FR-…`). `[P]` marks tasks that touch different files with no incomplete dependency and may run in parallel.

## Setup

- [x] **T001** [P] Inventory every live reference to the three retired keys (`templateProfile`, `turboWorkflowPicker`, `complexityFastPath`) and the profile/turbo axis (`buildTurboWorkflowEntry`, `TURBO_WORKFLOW_NAME`, `TURBO_COMMAND_BY_STOCK`, `seedProfileForNewSpec`) across `src/` to scope the deletion surface (read-only grep pass; no edits) — establishes the FR-004/FR-009 removal checklist.

## Foundational (blocking — everything below depends on these)

- [x] **T002** Change `speckit.defaultWorkflow` in `package.json` `contributes.configuration` from a free-form string to `"enum": ["speckit", "companion"]` with `enumDescriptions` + human labels, keeping `default: "speckit"`; delete the three property blocks `speckit.companion.templateProfile`, `speckit.companion.turboWorkflowPicker`, `speckit.companion.complexityFastPath` (FR-001, FR-004).
- [x] **T003** In `src/core/constants.ts` remove `templateProfile`, `turboWorkflowPicker`, `complexityFastPath` from `ConfigKeys`, and add `COMPANION_WORKFLOW_NAME = 'companion'` (or reuse the existing companion constant) (FR-001, FR-004, FR-009).
- [x] **T004** In `src/features/workflows/workflowManager.ts` add `COMPANION_WORKFLOW: WorkflowConfig` mirroring `DEFAULT_WORKFLOW` with each step/`step-*` mapped to `speckit.companion.specify|plan|tasks|implement` plus a terminal `mark-complete` step; include it in `getWorkflows()` so the built-in list is exactly `[speckit, companion]` (+ user custom workflows) and `getWorkflow('companion')` resolves it (FR-002, FR-003).

## Core work (one task per file/module, dependencies first)

- [x] **T005** In `src/features/specs/profileDispatch.ts` delete the profile/turbo-twin machinery (`TURBO_COMMAND_BY_STOCK`, `resolveProfileCommand`, `resolveNewSpecProfileCommand`, `seedProfileForNewSpec`) and replace it with a single workflow-aware dispatch resolver that, given a spec's `workflow`, returns its step command and applies the missing-extension fallback (`isCompanionInstalled` → downgrade `speckit.companion.*` to its stock twin, `fellBack: true`) (FR-003, FR-006, FR-007; depends on T004).
- [x] **T006** In `src/features/spec-editor/specEditorProvider.ts` delete `buildTurboWorkflowEntry`, `TURBO_WORKFLOW_NAME`, the reserved-name guard, and the `pickedTurbo`/`seedProfile` branch in `handleSubmit`; have the picker list the two built-in workflows from `getWorkflows()`, seed the chosen `workflowName` verbatim into `.spec-context.json` (`companion` seeds `companion`), and apply the missing-extension fallback when `companion` is chosen (FR-002, FR-003; depends on T004, T005).
- [x] **T007** In `src/core/telemetry.ts` remove the `templateProfile`/`complexityFastPath`/`turboWorkflowPicker` settings dimensions and `templateProfileTelemetryId`; add a single `defaultWorkflow` dimension (`'speckit' | 'companion'`) (FR-009; depends on T003).
- [x] **T008** [P] In `src/core/settingsMigration.ts` remove `companion.turboWorkflowPicker` from `BETA_BOOLEAN_SETTINGS` and add a one-time idempotent cleanup that removes the three retired keys from `settings.json` at every scope (FR-004, FR-005; depends on T003).
- [x] **T009** [P] In `src/ai-providers/promptBuilder.ts` strip the stale `templateProfile` comment/logic (~line 264) so the specify preamble no longer seeds a `profile` (FR-006, FR-009; depends on T003).
- [x] **T010** [P] In `src/features/settings/companionPresetReconciler.ts` drop `readTemplateProfile`, `writeTemplateProfile`, `writeComplexityFastPath`, `resolveComplexityFastPath`, and `shouldEnsureStandard`'s `templateProfile` dependence; narrow the reconciler to ensuring the companion command family is present when needed (FR-009; depends on T003).

## Integration (wiring the units together)

- [x] **T011** In `src/extension.ts` remove the `onDidChangeConfiguration` watchers for `templateProfile`/`complexityFastPath` and the activation-time `writeTemplateProfile`/`resolveComplexityFastPath` mirrors; keep the companion-family *ensure* keyed off "companion workflow selectable / extension installed" rather than `templateProfile`, and verify activation tolerates stale persisted keys (FR-005, FR-009; depends on T003, T010).
- [x] **T012** Route all dispatch callers — viewer footer, sidebar resume, command palette, spec-editor specify — through the single workflow-aware resolver from T005, removing any remaining `profile`-axis branches so each step dispatches its workflow's command family with no cross-workflow leakage (FR-003, FR-005-cross-leak; depends on T005, T006).

## Polish (docs, validation, cleanup)

- [x] **T013** Confirm `deriveViewerState` renders the Companion `mark-complete` → `completed` terminal step; add coverage only if a gap surfaces (FR-008; depends on T004).
- [x] **T014** Update tests: `src/core/telemetry.test.ts` (single `defaultWorkflow` dimension), `settingsMigration.test.ts` (retired-key cleanup + no-crash on stale keys), and `companionPresetReconciler.test.ts` (narrowed reconciler) (FR-005, FR-009; depends on T007, T008, T010).
- [x] **T015** [P] Update docs: README "Configuration" + Spec Context "Status vocabulary" (single two-value picker, drop the three settings), `docs/template-profiles.md` (retire the profiles model → workflow choice), `docs/capture-and-timing.md` (drop the `templateProfile` capture mirror), `docs/sidebar.md` if it referenced the picker, and `CHANGELOG.md` (user-facing: one workflow choice, three beta toggles removed) (FR-010; depends on T002).
- [x] **T016** Final validation against Success Criteria: grep shipped `src/` and docs for any remaining reference to the three removed keys (SC-004), verify settings UI + Create-Spec picker present exactly two choices (SC-001), and confirm `npm run compile` + `npm test` pass clean (depends on T011–T015).

## Dependencies

- **T002, T003, T004** are foundational and block the core work. T003 (`ConfigKeys` + companion constant) is the single most widely-depended-upon task.
- **T005** (dispatch resolver) depends on T004 and unblocks T006 and T012.
- **T007–T010** each depend on T003 and edit independent files.
- **T011** depends on T003 + T010; **T012** depends on T005 + T006.
- **T013** depends on T004; **T014** depends on T007/T008/T010; **T015** depends on T002.
- **T016** is the final gate — runs after T011–T015.

## Parallel

- After T003 lands: **T007, T008, T009, T010** can run together (distinct files: `telemetry.ts`, `settingsMigration.ts`, `promptBuilder.ts`, `companionPresetReconciler.ts`).
- **T015** (docs) is independent of the test/integration tasks once T002 lands and can proceed in parallel with T011–T014.
- T001 (inventory) can run immediately, in parallel with nothing blocking it.
