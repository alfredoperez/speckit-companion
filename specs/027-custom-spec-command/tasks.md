# Tasks: Custom Spec Command Button

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-29

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add submitCommand schema to package.json — `package.json`
  - **Do**: Add `submitCommand` object property to `speckit.customWorkflows` items schema with `label` (string, required) and `command` (string, required) sub-properties
  - **Verify**: `npm run compile` passes, no JSON schema errors

- [x] **T002** Add submitCommand to workflow types — `src/features/workflows/types.ts`
  - **Do**: Add optional `submitCommand?: { label: string; command: string }` to `WorkflowConfig` interface
  - **Verify**: `npm run compile` passes

- [x] **T003** Thread submitCommand through extension-side types and provider *(depends on T002)* — `src/features/spec-editor/`
  - **Do**: Add optional `submitCommand` to `WorkflowDefinition` in `src/features/spec-editor/types.ts`. Add `submitCustom` to `SpecEditorToExtensionMessage` union. In `specEditorProvider.ts`: read `submitCommand` from workflow config in `getWorkflows()`, pass it in `WorkflowDefinition`, handle `submitCustom` message in `handleMessage()` using the custom command instead of `stepSpecify`
  - **Verify**: `npm run compile` passes

- [x] **T004** Thread submitCommand through webview-side types *(depends on T003)* — `webview/src/spec-editor/types.ts`
  - **Do**: Add optional `submitCommand` to webview `WorkflowDefinition`. Add `submitCustom` message type to `SpecEditorToExtensionMessage` union
  - **Verify**: `npm run compile` passes

- [x] **T005** Render custom command button in webview *(depends on T004)* — `webview/src/spec-editor/index.ts`
  - **Do**: Add `customCommandBtn` element to `getElements()`. In `initWorkflows()`, store workflows list for later lookup. Add `updateCustomCommandButton(workflowName)` that shows/hides the button based on selected workflow's `submitCommand`. Wire click handler to post `submitCustom` message. Call `updateCustomCommandButton` on workflow dropdown `change` event. Add button HTML in the footer next to Submit
  - **Verify**: Button appears when workflow with submitCommand is selected, hidden otherwise

- [x] **T006** Add secondary button CSS and update HTML template *(depends on T005)* — `webview/styles/spec-editor.css`, `src/features/spec-editor/specEditorProvider.ts`
  - **Do**: Add `.btn-secondary` style (distinct from `.btn-primary`). Add the `customCommandBtn` button element in the HTML footer template. Update keyboard hints to show custom command shortcut when available
  - **Verify**: Visual inspection — secondary button styled distinctly, keyboard hints update

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [ ] **T007** [P][A] Unit tests — `test-expert`
  - **Files**: `src/features/spec-editor/__tests__/specEditorProvider.test.ts`
  - **Pattern**: Jest with VS Code mock, BDD describe/it blocks
  - **Reference**: `src/features/spec-viewer/__tests__/documentScanner.test.ts`

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T006 | [x] |
| Phase 2 | T007 | [ ] |
