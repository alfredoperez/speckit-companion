# Tasks: Spec Sorting & Lifecycle — Button Overhaul

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-02

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Sort active specs by creation date — `src/features/specs/specExplorerProvider.ts` | R001
  - **Do**: Sort `activeSpecs` by `fs.statSync(specFullPath).birthtime` descending (newest first)
  - **Verify**: Active specs in sidebar appear newest-first

- [x] **T002** Remove completion badge from navigation bar — `src/features/spec-viewer/html/navigation.ts` | R007
  - **Do**: Remove the `🌱 SPEC COMPLETED` badge rendering. The Tasks tab already shows completion percentage — the badge is redundant. Remove the `completion-badge` CSS class and the conditional that checks `taskCompletionPercent === 100` to show it.
  - **Verify**: No badge appears in top bar at any status. Tasks tab still shows percentage.
  - **Leverage**: `src/features/spec-viewer/html/navigation.ts` (lines 20-74, badge rendering)

- [x] **T003** Remove Edit Source button from footer — `src/features/spec-viewer/html/generator.ts` | R006
  - **Do**: Remove the `<button id="editSource">Edit Source</button>` from the footer `.actions-right`. Remove the `editDisabled` logic. Remove the `editSource` click handler from `webview/src/spec-viewer/actions.ts` and the element ref from `elements.ts`. Keep the `editSource` / `editDocument` message handler in `messageHandlers.ts` (still used by inline editor).
  - **Verify**: No "Edit Source" button in footer. Build passes.

- [x] **T004** Implement new button visibility logic — `src/features/spec-viewer/html/generator.ts` | R002, R003, R006, R007
  - **Do**: Rewrite the footer button rendering in `generator.ts` lines 148-167 to match:
    - **Active, tasks < 100%**: Show `Regenerate` (secondary) + `Archive` (secondary) + CTA if next step missing (primary)
    - **Active, tasks = 100%**: Show `Archive` (secondary) + `Complete` (primary). Hide Regenerate.
    - **Completed**: Show `Archive` (secondary) + `Reactivate` (secondary). No Regenerate.
    - **Archived**: Show `Reactivate` (secondary) only.
    - Max 3 buttons at any time.
  - **Verify**: HTML output matches visibility matrix for all statuses.
  - **Leverage**: Existing `specStatus` and `showApproveButton` logic as starting point

- [x] **T005** Add `reactivateSpec` message type and handler — `src/features/spec-viewer/types.ts`, `src/features/spec-viewer/messageHandlers.ts` | R004
  - **Do**: Add `| { type: 'reactivateSpec' }` to `ViewerToExtensionMessage`. In `messageHandlers.ts`, add handler that calls `setSpecStatus(specDirectory, 'active')`, fires `speckit.refresh`, and calls `updateContent()`. Show info notification "Spec '{name}' reactivated".
  - **Verify**: Clicking Reactivate moves spec from Completed/Archived back to Active in sidebar.

- [x] **T006** Wire webview click handlers for Reactivate — `webview/src/spec-viewer/actions.ts`, `webview/src/spec-viewer/elements.ts` | R004
  - **Do**: Add `reactivateSpecButton` element ref in `elements.ts`. Add click handler in `actions.ts` `setupFooterActions()` that posts `{ type: 'reactivateSpec' }`. Remove `editSourceButton` ref from `elements.ts`.
  - **Verify**: Clicking Reactivate sends correct message.

- [x] **T007** Simplify status determination — `src/features/spec-viewer/specViewerProvider.ts` | R007
  - **Do**: In `updateContent()` (lines 462-475), simplify the specStatus chain:
    1. `.spec-context.json` `status === 'archived'` OR `currentStep === 'archived'|'done'` → `'archived'`
    2. `.spec-context.json` `status === 'completed'` → `'completed'`
    3. `taskCompletionPercent === 100` → `'tasks-done'` (new value — active but all tasks done, shows Complete button)
    4. Otherwise → `'active'`
    Remove `extractSpecStatus(content)` call — no longer needed as a source.
  - **Verify**: Status correctly resolves for all scenarios. Build passes.

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [x] **T008** [P][A] Unit tests for button visibility — `test-expert` | R001-R007
  - **Files**: `src/features/spec-viewer/__tests__/generator.test.ts`
  - **Pattern**: Jest with `describe`/`it` BDD style, VS Code mock from `tests/__mocks__/vscode.ts`
  - **Tests**:
    - Active spec with no plan: shows Regenerate, Archive, Plan (primary)
    - Active spec with plan+tasks: shows Regenerate, Archive, Implement (primary)
    - Active spec with tasks 100%: shows Archive, Complete (primary). No Regenerate.
    - Completed spec: shows Archive, Reactivate. No Regenerate, no CTA.
    - Archived spec: shows Reactivate only.
    - No completion badge in any state.
  - **Reference**: `src/features/spec-viewer/__tests__/messageHandlers.test.ts`

- [x] **T009** [P][A] Unit tests for message handlers — `test-expert` | R004, R005
  - **Files**: `src/features/spec-viewer/__tests__/messageHandlers.test.ts`
  - **Tests**:
    - `reactivateSpec` calls `setSpecStatus(dir, 'active')` and refreshes
    - `completeSpec` calls `setSpecStatus(dir, 'completed')` and refreshes
    - `archiveSpec` calls `setSpecStatus(dir, 'archived')` and refreshes
    - Each shows correct notification message
  - **Reference**: Existing tests in same file

- [x] **T010** [P][A] Update README — `docs-expert`
  - **Files**: `README.md`
  - **Do**: Update spec viewer section to document new button behavior: Complete appears when tasks are 100%, Reactivate available from Completed/Archived, Edit Source removed from footer, no completion badge. Document the lifecycle flow.
  - **Verify**: README accurately reflects new behavior

---

## Progress

- Phase 1: T001–T007 [x]
- Phase 2: T008–T010 [ ]
