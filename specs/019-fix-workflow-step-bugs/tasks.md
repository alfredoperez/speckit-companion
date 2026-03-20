# Tasks: Fix Workflow Step Bugs

**Input**: Design documents from `/specs/019-fix-workflow-step-bugs/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Not requested — manual testing via Extension Development Host.

**Organization**: Tasks grouped by scenario (Icon Mapping, Command Dispatch, Subfile Indentation) from spec.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which scenario this task belongs to (US1=Icon Mapping, US2=Command Dispatch, US3=Subfile Indentation)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Type Foundation)

**Purpose**: Add the `icon` property to `WorkflowStepConfig` and update the settings schema — prerequisite for all bug fixes.

- [ ] T001 Add `icon?: string` property to `WorkflowStepConfig` interface in `src/features/workflows/types.ts`
  - **Do**: Add `icon?: string` to the `WorkflowStepConfig` interface (added by 018). This is an optional VS Code ThemeIcon id (e.g., `"telescope"`).
  - **Verify**: `npm run compile` passes.

- [ ] T002 [P] Add `icon` property to workflow step schema in `package.json`
  - **Do**: In the `speckit.customWorkflows` schema under the `steps` array item properties, add `"icon": { "type": "string", "description": "VS Code ThemeIcon id for this step (e.g., 'telescope', 'rocket'). Falls back to built-in icon map when not specified." }`.
  - **Verify**: VS Code validates the schema without errors; existing configs still pass.

**Checkpoint**: Type foundation ready — all bug fix tasks can now proceed.

---

## Phase 2: Icon Mapping Fix (Priority: P1) — US1

**Goal**: Fix icon rendering for custom step names and support per-step icon overrides (R001, R002, R006).

**Independent Test**: Configure a workflow with steps named `specify`, `design`, `implement` (no file), and a step with `icon: "telescope"`. Verify each shows the correct icon in the sidebar. Verify `implement` shows `play` icon with no status dot.

- [ ] T003 [US1] Add `STEP_ICON_MAP` constant and icon resolution helper to `src/features/specs/specExplorerProvider.ts`
  - **Do**: Add `STEP_ICON_MAP: Record<string, string>` with mappings from data-model.md (legacy: `spec→chip`, `plan→layers`, `tasks→tasklist`; new: `specify→chip`, `design→circuit-board`, `implement→play`, `explore→telescope`, `verify→check-all`, `archive→archive`, `review→eye`, `test→beaker`, `deploy→rocket`). Add `DEFAULT_FILE_ICON = 'file'` and `DEFAULT_ACTION_ICON = 'terminal'` constants. Add `resolveStepIcon(step: WorkflowStepConfig, isActionOnly: boolean): string` function implementing the 4-tier resolution: (1) `step.icon`, (2) `STEP_ICON_MAP[step.name]`, (3) file → `DEFAULT_FILE_ICON`, (4) action-only → `DEFAULT_ACTION_ICON`.
  - **Verify**: `npm run compile` passes.

- [ ] T004 [US1] Update `SpecItem` icon logic to use `STEP_ICON_MAP` and support action-only steps in `src/features/specs/specExplorerProvider.ts`
  - **Do**: In the `SpecItem` constructor, replace the hard-coded `if/else` chain for `spec-document` contextValue (lines ~319-328) with a lookup: use `resolveStepIcon()` when a `WorkflowStepConfig` is available, otherwise fall back to `STEP_ICON_MAP[documentType] ?? DEFAULT_FILE_ICON`. Add a new contextValue `'spec-action-step'` for action-only steps — these render with the resolved icon, no status indicator (`description` is empty), and a command that dispatches the step command in the terminal instead of opening a file.
  - **Verify**: `npm run compile` passes. Default workflow still shows chip/layers/tasklist icons.

- [ ] T005 [US1] Update `getSpecDocuments()` to detect and render action-only steps in `src/features/specs/specExplorerProvider.ts`
  - **Do**: In `getSpecDocuments()`, when iterating workflow steps (from 018's dynamic loop), for each step: check if `step.file` is defined OR if `{step.name}.md` exists on disk. If neither → create a `SpecItem` with contextValue `'spec-action-step'`, the resolved icon from `resolveStepIcon(step, true)`, no status indicator, and a click command that dispatches the step's command in terminal. If file exists → render as normal `spec-document` with `resolveStepIcon(step, false)`.
  - **Verify**: `npm run compile` passes. A step with no file shows `play` icon and no status dot. A step with a file shows its mapped icon and status indicator.

**Checkpoint**: Icon mapping and action-only rendering verified in Extension Development Host.

---

## Phase 3: Command Dispatch Fix (Priority: P1) — US2

**Goal**: Fix step command resolution to use the `command` field from `WorkflowStepConfig` (R003).

**Independent Test**: Configure `speckit.defaultWorkflow: "sdd-test"` with a step `{ name: "specify", command: "sdd-spec" }`. Create a new spec, click the specify step in sidebar. Verify terminal dispatches `/sdd-spec <specDir>` (not `/speckit.specify`).

- [ ] T006 [US2] Update `resolveStepCommand()` to use `steps` array in `src/features/workflows/workflowManager.ts`
  - **Do**: Replace the current implementation that builds `step-${step}` key with one that: (1) if `workflow.steps` exists, find the step by `name` and return its `command` field; (2) otherwise fall back to legacy `step-${step}` key lookup (compat with un-normalized configs). The function signature may need to accept either a `WorkflowStep` string or a `WorkflowStepConfig` object — if the caller already has the step config, use `step.command` directly.
  - **Verify**: `npm run compile` passes. Custom workflow dispatches the correct command.

- [ ] T007 [US2] Verify `getOrSelectWorkflow()` respects `speckit.defaultWorkflow` in `src/features/workflows/workflowSelector.ts`
  - **Do**: Review and confirm that `getOrSelectWorkflow()` (lines 139-169) already reads `speckit.defaultWorkflow` and auto-selects that workflow when no `.speckit.json` exists. Per research (R3), this already works correctly. If any edge case is found (e.g., workflow name mismatch after normalization), fix it. Otherwise, mark this task as verified — no code change needed.
  - **Verify**: Set `speckit.defaultWorkflow` to a custom workflow name, remove `.speckit.json`, trigger a step command. Confirm the custom workflow is auto-selected.

**Checkpoint**: Command dispatch verified — custom steps execute the correct command.

---

## Phase 4: Subfile Indentation Fix (Priority: P2) — US3

**Goal**: Fix visual hierarchy of subfile/related-doc items under parent steps (R004).

**Independent Test**: Configure a step with `subDir: "plan"` and create `plan/architecture.md`. Verify child items appear indented deeper than the parent step in the sidebar.

- [ ] T008 [US3] Fix related doc tree nesting in `getChildren()` in `src/features/specs/specExplorerProvider.ts`
  - **Do**: Review the `getChildren()` method to ensure related docs are ONLY returned when the parent element is a collapsible step item (not at the spec level). After 018's changes, each step with subfiles/subDir should be collapsible, and `getChildren(stepItem)` should return only that step's related docs. If related docs are currently attached only to the `plan` step, generalize this so any step with `subFiles` or `subDir` gets collapsible children. Ensure the tree item hierarchy is: spec → step (collapsible if has children) → related docs.
  - **Verify**: `npm run compile` passes. Related docs appear visually indented under their parent step.

**Checkpoint**: Subfile indentation verified in Extension Development Host.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Update workflow selector display and final validation.

- [ ] T009 [P] Update `buildWorkflowDetail()` to use `steps` array in `src/features/workflows/workflowSelector.ts`
  - **Do**: Replace the 4 hard-coded `step-*` key checks (lines 106-123) with: if `workflow.steps` exists and has entries, display `Steps: ${workflow.steps.map(s => s.label || s.name).join(' → ')}`. Show custom commands only for steps whose command differs from `speckit.{name}`. Keep checkpoint display logic unchanged. Fall back to legacy key display if `steps` is absent.
  - **Verify**: `npm run compile` passes. Quick pick shows `Steps: specify → design → implement` for custom workflows.

- [ ] T010 [P] Add context menu support for action-only steps in `package.json`
  - **Do**: In the `contributes.menus` section, ensure `spec-action-step` contextValue items have an appropriate context menu (e.g., "Run Step" command). If 018 already handles this, verify and skip. Otherwise, add a menu contribution for `viewItem == spec-action-step` that triggers the step's command.
  - **Verify**: Right-clicking an action-only step in the sidebar shows a "Run Step" option.

- [ ] T011 Run quickstart.md validation
  - **Do**: Configure the test workflow from quickstart.md in VS Code settings. Launch Extension Development Host. Verify all 4 expected behaviors: (1) `specify` → chip icon + status, (2) `design` → telescope icon + status, (3) `implement` → play icon + no status, (4) `verify` → check-all icon + status. Test command dispatch for each step. Test subfile indentation with a step that has `subDir`.
  - **Verify**: All scenarios from spec.md pass. No error popups. Default workflow unchanged.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Icon Mapping (Phase 2)**: Depends on T001 (type change)
- **Command Dispatch (Phase 3)**: Depends on T001; independent of Phase 2
- **Subfile Indentation (Phase 4)**: Independent of Phases 2-3, but logically follows
- **Polish (Phase 5)**: Depends on Phases 2-4 complete

### Parallel Opportunities

- **T001 + T002**: Can run in parallel (different files)
- **Phase 2 + Phase 3**: Can run in parallel after Phase 1 (different files: specExplorerProvider.ts vs workflowManager.ts/workflowSelector.ts)
- **T009 + T010**: Can run in parallel (different files)

### Within Phases

- T003 → T004 → T005 (sequential — each builds on the previous in same file)
- T006 → T007 (sequential — verify after fix)

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Icon Mapping Fix (T003–T005) — most visible bug
3. Complete Phase 3: Command Dispatch Fix (T006–T007) — most impactful bug
4. **STOP and VALIDATE**: Test with custom SDD workflow
5. Ship if stable

### Full Delivery

1. Setup → Icon Fix → Command Fix → Subfile Fix → Polish
2. Each phase independently testable
3. Total: 11 tasks across 5 phases

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Setup | T001–T002 | [ ] |
| Phase 2: Icon Mapping | T003–T005 | [ ] |
| Phase 3: Command Dispatch | T006–T007 | [ ] |
| Phase 4: Subfile Indentation | T008 | [ ] |
| Phase 5: Polish | T009–T011 | [ ] |
