# Tasks: Spec Viewer Header Redesign

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-05

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add `specName` and `branch` to FeatureWorkflowContext — `src/features/workflows/types.ts` | R005, R006
  - **Do**: Add `specName?: string` and `branch?: string` fields to the `FeatureWorkflowContext` interface (in the SDD-enriched section)
  - **Verify**: `npm run compile` passes with no type errors

- [x] **T002** Populate `specName` and `branch` on context creation *(depends on T001)* — `src/features/specs/specContextManager.ts` | R005, R006, R007
  - **Do**: In `updateStepProgress` (or a new helper called during context creation), derive `specName` from the spec directory slug (e.g., `046-spec-viewer-header-redesign` → `Spec Viewer Header Redesign`) and populate `branch` from `git rev-parse --abbrev-ref HEAD`. Investigate `selectedAt` — if it duplicates `stepHistory.specify.startedAt`, remove it; otherwise document its purpose
  - **Verify**: After running a workflow step, `.spec-context.json` contains `specName` and `branch` fields
  - **Leverage**: Existing `updateSpecContext` merge pattern for writing fields

- [x] **T003** Update `computeBadgeText` for in-progress animation *(depends on T001)* — `src/features/spec-viewer/phaseCalculation.ts` | R001, R002
  - **Do**: When `substep` is non-null (indicating in-progress work), append `...` suffix to the badge text (e.g., `PLANNING...`, `IMPLEMENTING...`). Add a helper `getDocTypeLabel(step)` that maps step names to display labels (`specify→Spec`, `plan→Plan`, `tasks→Tasks`, `implement→Implementation`)
  - **Verify**: Unit test `computeBadgeText({ step: 'plan', substep: 'writing' })` returns `'PLANNING...'`

- [x] **T004** Replace badge-bar + dates-bar with structured header *(depends on T003)* — `src/features/spec-viewer/html/generator.ts` | R001, R002, R003
  - **Do**: Replace the existing `.spec-badge-bar` and `.spec-dates-bar` divs with a single `.spec-header` block containing: badge (primary color), created date, title line (`{DocType}: {specName}`), file link (clickable `vscode.open` URI), optional branch badge, and a `<hr>` separator. The header renders from spec-context.json data passed as params, before any markdown content
  - **Verify**: Opening a spec in the viewer shows the structured header above markdown content
  - **Leverage**: Existing `generateHtml` parameter pattern for passing data

- [x] **T005** Pass new fields through specViewerProvider *(depends on T004)* — `src/features/spec-viewer/specViewerProvider.ts` | R001, R003, R006
  - **Do**: Read `specName`, `branch`, and current file path from spec-context.json and pass them to `generateHtml()` and `sendContentUpdateMessage()`. Ensure the header data is available on initial load (not just on tab switch)
  - **Verify**: Header shows specName, branch badge, and file link on first open

- [x] **T006** Persist step change on tab click *(depends on T002)* — `src/features/spec-viewer/messageHandlers.ts` | R004
  - **Do**: In `handleStepperClick`, after calling `sendContentUpdateMessage`, fire-and-forget call `updateStepProgress(specDirectory, phase, workflowStepNames)` to persist the step change to `.spec-context.json`. Get `workflowStepNames` from `resolveWorkflowSteps` (already available in `MessageHandlerDependencies`)
  - **Verify**: Click a step tab → `.spec-context.json` shows updated `currentStep` and `stepHistory` entry
  - **Leverage**: `updateStepProgress` already exists in `specContextManager.ts`

- [x] **T007** Update webview navigation for structured header *(depends on T004)* — `webview/src/spec-viewer/navigation.ts` | R001, R003
  - **Do**: Update `updateNavState` to refresh the structured header on tab switch: update title text (`{DocType}: {specName}`), file link path, and badge text. Add `specName`, `filePath`, and `docTypeLabel` to the `NavState` type. Remove old `.spec-dates-bar` and `.spec-badge-bar` patching logic, replace with `.spec-header` updates
  - **Verify**: Switching tabs updates the header title and file link without full page reload

- [x] **T008** Strip raw metadata from rendered markdown *(depends on T004)* — `webview/src/spec-viewer/markdown/preprocessors.ts` | R008
  - **Do**: When spec-context.json data is available (passed as a flag/parameter), modify `preprocessSpecMetadata` to strip the entire metadata block (Status, Feature Branch, etc.) instead of rendering it as compact HTML. When no context is available, keep current behavior as fallback
  - **Verify**: Spec with context shows no duplicate metadata; spec without context still renders metadata inline

- [x] **T009** Restyle badge and add header CSS *(depends on T004)* — `webview/styles/spec-viewer/_content.css` | R001, R002, R006
  - **Do**: Change `.spec-badge` background/color to use the primary/h1 heading color (`var(--heading-color)` or equivalent). Add styles for `.spec-header` layout (badge + date on first line, title on second, file link + branch badge on third, separator). Style branch badge as muted monospace pill. Remove old `.spec-badge-bar` and `.spec-dates-bar` rules
  - **Verify**: Badge uses accent/primary color matching h1; header layout matches spec wireframe

---

## Progress

- Phase 1: T001–T009 [x]
