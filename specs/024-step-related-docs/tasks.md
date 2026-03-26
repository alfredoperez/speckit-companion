# Tasks: Step-Scoped Related Documents

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-26

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Assign parentStep to orphan related docs in scanner — `src/features/spec-viewer/documentScanner.ts`
  - **Do**: After the `scanRelatedDocs` loop (~line 258-261), add a parentStep assignment pass over all related docs that have no `parentStep`. For each orphan doc: (1) check if any step's `subFiles` array contains the doc's `fileName` — if so, set `parentStep` to that step's `name`; (2) if still unassigned, find the first step with `includeRelatedDocs: true` and assign to it; (3) if still unassigned, fall back to the last non-`actionOnly` step's `name`. This requires passing `steps` into the assignment logic (already available as a parameter).
  - **Verify**: `npm run compile` passes. No runtime behavior change yet (navigation still uses `!d.parentStep` fallthrough).

- [x] **T002** Tighten navigation filter to require parentStep *(depends on T001)* — `src/features/spec-viewer/html/navigation.ts`
  - **Do**: On line 73-75, change the `relevantRelatedDocs` filter from `!d.parentStep || d.parentStep === currentDocType` to just `d.parentStep === currentDocType`. This ensures only docs explicitly assigned to the current step appear as tabs.
  - **Verify**: `npm run compile` passes. Manually test: Specify step should show no related tabs (unless a doc is explicitly assigned to it). Plan step should show Research tab if research.md exists.

- [x] **T003** Add includeRelatedDocs to default workflow plan step — `src/features/workflows/workflowManager.ts`
  - **Do**: In the `DEFAULT_WORKFLOW` constant, add `includeRelatedDocs: true` to the plan step object (line ~31). Result: `{ name: 'plan', label: 'Plan', command: 'speckit.plan', file: 'plan.md', includeRelatedDocs: true }`.
  - **Verify**: `npm run compile` passes. Default workflow now routes orphan related docs to Plan step.

- [x] **T004** Add includeRelatedDocs to package.json workflow schema — `package.json`
  - **Do**: In the `speckit.customWorkflows` JSON schema, inside the step item properties (near the `subDir` property), add `"includeRelatedDocs": { "type": "boolean", "description": "When true, unassigned related .md files in the spec folder are grouped under this step" }`.
  - **Verify**: VS Code validates custom workflow configs without errors. The new property appears in IntelliSense when editing settings.

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [x] **T005** [P][A] Unit tests — `test-expert`
  - **Files**: `src/features/spec-viewer/__tests__/documentScanner.test.ts`
  - **Pattern**: Jest with `describe`/`it`, VS Code mock from `tests/__mocks__/vscode.ts`
  - **Reference**: existing test files in `src/features/`
  - **Cases**: (1) orphan doc assigned via `subFiles` match, (2) orphan doc assigned via `includeRelatedDocs` step, (3) orphan doc falls back to last non-actionOnly step when no step claims it, (4) docs with existing `parentStep` from `subDir` scan are not reassigned

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T004 | [x] |
| Phase 2 | T005 | [x] |
