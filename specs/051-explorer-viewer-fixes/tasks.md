# Tasks: Explorer & Viewer Fixes

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-05

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add read-only resolveWorkflow() — `src/features/workflows/workflowSelector.ts` | R001, R002
  - **Do**: Add `resolveWorkflow(featureDir, outputChannel?)` function that duplicates `getOrSelectWorkflow()` logic (lines 139-169) but omits the `saveFeatureWorkflow()` call on line 167. Export it. Also export from the workflows barrel file.
  - **Verify**: `npm run compile` passes; new function is importable
  - **Leverage**: `getOrSelectWorkflow()` in same file (copy and remove the save call)

- [x] **T002** Use resolveWorkflow() in explorer provider *(depends on T001)* — `src/features/specs/specExplorerProvider.ts` | R001, R002
  - **Do**: Change import to include `resolveWorkflow` from workflows. Replace `getOrSelectWorkflow()` call at line 351 with `resolveWorkflow()`. Remove `getOrSelectWorkflow` from import if no longer used here.
  - **Verify**: `npm run compile` passes; opening explorer tree does not modify any `.spec-context.json` files

- [x] **T003** Use resolveWorkflow() in viewer provider *(depends on T001)* — `src/features/spec-viewer/specViewerProvider.ts` | R001, R002
  - **Do**: Change import to include `resolveWorkflow`. Replace `getOrSelectWorkflow()` call at line 105 with `resolveWorkflow()`.
  - **Verify**: `npm run compile` passes; opening spec viewer does not modify `.spec-context.json`

- [x] **T004** Sort completed and archived specs by date — `src/features/specs/specExplorerProvider.ts` | R003
  - **Do**: Extract the birthtime sort comparator (lines 116-124) into a local function `sortByCreationDateDesc(basePath, a, b)`. Apply it to `activeSpecs`, `completedSpecs`, and `archivedSpecs` arrays after the partitioning loop (line 113).
  - **Verify**: `npm run compile` passes; completed/archived groups show newest first

- [x] **T005** Show spec dirs with only .spec-context.json — `src/core/specDirectoryResolver.ts` | R004
  - **Do**: Add `directoryHasSpecContext(dirPath)` function that checks if `.spec-context.json` exists in the directory. In `resolveSpecDirectories()` line 85, change `const hasContent = await directoryHasMarkdown(...)` to `const hasContent = await directoryHasMarkdown(...) || await directoryHasSpecContext(...)`. Check if `expandGlobPattern()` needs the same fix.
  - **Verify**: `npm run compile` passes; a directory with only `.spec-context.json` appears in explorer

- [x] **T006** Add refinement comment area border — `webview/src/spec-viewer/editor/inlineEditor.ts`, `webview/styles/spec-viewer/_line-actions.css` | R005
  - **Do**: In `inlineEditor.ts`, add class `editor-comment-area` to the `editor-comment-section` div (line 43). In CSS, add `.editor-comment-area` rule with `border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-3); margin-top: var(--space-2);`.
  - **Verify**: Refinement textarea + buttons have a visible border container in the spec viewer

- [x] **T007** Fix line action button spacing — `webview/styles/spec-viewer/_line-actions.css` | R006
  - **Do**: Change `.line-add-btn`: `width: 18px; height: 18px; top: 2px;`. Change `.line-add-btn svg`: `width: 12px; height: 12px;`. Add `li.line { min-height: unset; }` to prevent the button from inflating list item height.
  - **Verify**: Bullet point lines have natural spacing; add-comment button still visible on hover

- [x] **T008** Add mermaid diagram zoom — `webview/styles/spec-viewer/_code.css`, `webview/src/spec-viewer/highlighting.ts` | R007
  - **Do**: In `_code.css`, remove `max-width: 100%` from `.mermaid svg`. Add `.mermaid-controls` styles (flex bar with small buttons, positioned above diagram). In `highlighting.ts`, after `mermaid.run()` (line 136), iterate `.mermaid-container` elements, prepend a toolbar div with +/−/reset buttons. Wire click handlers: +/− adjust `transform: scale(N)` on `.mermaid svg` in 0.25 increments (min 0.5, max 3.0), reset sets scale to 1. Set `transform-origin: top left` on `.mermaid svg`.
  - **Verify**: Mermaid diagrams render at natural size; zoom buttons increase/decrease/reset scale

- [x] **T009** Disable non-existent step tabs — `webview/src/spec-viewer/navigation.ts` | R008
  - **Do**: In `updateNavState()`, after computing `docExists` (around line 30), add: `(tabEl as HTMLButtonElement).disabled = !docExists;`. The click handler at line 265 already checks `btn.disabled`.
  - **Verify**: Step tabs without files appear dimmed (opacity 0.35) and don't respond to clicks

- [x] **T010** Fix badge to reflect real context state — `webview/src/spec-viewer/navigation.ts` | R009
  - **Do**: Verify the badge element (`.status-badge`) is not being overwritten by `updateNavState()` on tab switch. If badge text is being recomputed webview-side based on viewed tab, remove that logic. Badge should only be set from extension-side `computeBadgeText()` via postMessage.
  - **Verify**: Switching tabs does not change badge text; badge always matches `.spec-context.json` state

- [x] **T011** Fix working pulse: stop on completed, use green — `src/features/spec-viewer/html/navigation.ts`, `webview/styles/spec-viewer/_animations.css`, `webview/styles/spec-viewer/_navigation.css` | R010, R011, R012
  - **Do**: In `html/navigation.ts` line 40, change `isWorking = activeStep === phase` to `isWorking = activeStep === phase && !stepHistory?.[phase]?.completedAt` (pass `stepHistory` from caller if not already available). In `_animations.css` lines 77-84, replace `var(--accent)` with `var(--success)` in `working-pulse` keyframes. In `_navigation.css` lines 134-136, change `.step-tab.working .step-label` to `color: var(--accent); font-weight: 700;`.
  - **Verify**: Pulse stops for completed steps; pulse glow is green; working step label is bold accent color

---

## Progress

- Phase 1: T001–T011 [ ]
