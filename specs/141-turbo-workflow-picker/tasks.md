# Tasks: Turbo Workflow Picker

Organized by execution layer and file/dependency order. `[P]` = parallelizable (different files, no incomplete dependency).

## Setup

- [x] **T001** Add `speckit.companion.turboWorkflowPicker` (enum `off|beta|on`, default `beta`, enumDescriptions, beta-aware description) to the "Beta Features" group in `package.json` (FR-001, FR-006).
- [x] **T002** Add `turboWorkflowPicker: 'speckit.companion.turboWorkflowPicker'` to `ConfigKeys` in `src/core/constants.ts` (FR-001).

## Foundational

- [x] **T003** Export `isCompanionInstalled(workspaceRoot: string): boolean` from `src/features/settings/companionPresetReconciler.ts`, reusing `isPresetInstalled`/`ALL_PRESET_IDS` plus the bundled `.specify/extensions/companion/` directory check (FR-005).
- [x] **T004** [P] Add reserved `TURBO_WORKFLOW_NAME = 'speckit-turbo'` constant and optional `beta?: boolean` field on `WorkflowDefinition` in `src/features/spec-editor/types.ts` (FR-004, FR-013).
- [x] **T005** [P] Add optional `beta?: boolean` to the webview `WorkflowDefinition` in `webview/src/spec-editor/types.ts` (FR-006).

## Core work

- [x] **T006** In `src/ai-providers/promptBuilder.ts`, thread an optional `profile?: 'turbo' | 'standard'` through `buildSpecifyCreationPreamble` and `renderSpecifyCreationLifecyclePreamble`, emitting a `"profile": "turbo"` line in the seed-write JSON only when `profile === 'turbo'`; default unchanged (FR-007, FR-009).
- [x] **T007** In `src/features/spec-editor/specEditorProvider.ts` `getWorkflows()`, after the normal list, append the synthetic turbo `WorkflowDefinition` when `turboWorkflowPicker` ∈ {`beta`,`on`} AND `isCompanionInstalled(workspaceRoot)`: `name = TURBO_WORKFLOW_NAME`, `displayName = 'SpecKit Companion (Turbo)'` (+ `' (beta)'` when mode is `beta`), `stepSpecify` = turbo specify twin, `beta: true`. Cache in `this.workflows` (FR-002, FR-003, FR-004, FR-006, FR-011).
- [x] **T008** In `specEditorProvider.ts` `handleSubmit()`, when `workflowName === TURBO_WORKFLOW_NAME` and no custom command: set `command` to the turbo specify twin (bypassing `resolveNewSpecProfileCommand`) and pass `profile: 'turbo'` to `buildSpecifyCreationPreamble`; all other paths unchanged (FR-007, FR-008, FR-009, FR-010, FR-013).

## Integration

- [x] **T009** In `webview/src/spec-editor/index.ts`, accept the `beta` field on incoming workflows (no label change needed — `displayName` already carries the suffix); confirm the existing `workflows.length <= 1` guard reveals the selector when the turbo entry is the second option (FR-004, FR-011).

## Polish

- [x] **T010** [P] Add/extend unit tests: `isCompanionInstalled` true/false in `companionPresetReconciler.test.ts`; seed JSON carries `profile: turbo` only when passed in `promptBuilder` tests (SC-003, SC-004, SC-005).
- [x] **T011** [P] Update `docs/template-profiles.md` (and README mention) to document the per-spec turbo choice at creation: Create New Spec → Workflow dropdown, beta-gated (`turboWorkflowPicker`), install-gated (Companion preset present), and its relation to the `templateProfile` default (FR-012).
- [x] **T012** Run `npm run compile`, `npm test`, and confirm no `src/` runtime import of `.claude/**` or `.specify/**` (SC-005, SC-006).

## Dependencies

- T002 depends on T001 (key must exist before constant references it).
- T007 depends on T003 (install predicate) and T004 (name + type field).
- T008 depends on T006 (preamble profile arg) and T004 (reserved name).
- T009 depends on T005 + T007 (field + emitted entry).
- T010–T012 depend on the core/integration work landing.

## Parallel

- T004 and T005 can run together (different type files).
- T010 and T011 can run together (tests vs docs, different files).
