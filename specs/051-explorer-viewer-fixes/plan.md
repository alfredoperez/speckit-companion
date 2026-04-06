# Plan: Explorer & Viewer Fixes

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-05

## Approach

Split `getOrSelectWorkflow()` into two functions: a read-only `resolveWorkflow()` that returns the default workflow in-memory without writing, and keep the existing `getOrSelectWorkflow()` for explicit user actions. Fix explorer sorting, directory resolution, and 5 webview UI issues (refinement border, line action spacing, mermaid zoom, step tab disabling, stepper badge/pulse states).

## Technical Context

**Stack**: TypeScript 5.3+, VS Code Extension API, Webpack 5
**Key Dependencies**: mermaid.js (CDN), highlight.js (CDN)
**Constraints**: Webview CSS must use VS Code theme variables; no new dependencies

## Files

### Modify

- `src/features/workflows/workflowSelector.ts` — Add `resolveWorkflow()` that resolves default workflow in-memory without calling `saveFeatureWorkflow()`. Keep `getOrSelectWorkflow()` unchanged for use in `specCommands.ts`.

  **Detail**: New function `resolveWorkflow(featureDir, outputChannel?)` follows the same logic as `getOrSelectWorkflow()` (lines 139-169) but removes line 167 (`await saveFeatureWorkflow(...)`). Returns the workflow config without side effects. Export it alongside existing functions.

- `src/features/specs/specExplorerProvider.ts` — Replace `getOrSelectWorkflow()` call (line 351) with `resolveWorkflow()`. Add sort for `completedSpecs` and `archivedSpecs` arrays using same birthtime comparator as `activeSpecs` (lines 116-124).

  **Detail for Problem 1**: Change import to include `resolveWorkflow`, replace line 351 call.
  **Detail for Problem 2**: After partitioning specs (lines 99-113), add `.sort()` calls to `completedSpecs` and `archivedSpecs` using the same `fs.statSync(...).birthtime` comparator already used for `activeSpecs`. Extract the sort comparator to a local function to avoid duplication.

- `src/features/spec-viewer/specViewerProvider.ts` — Replace `getOrSelectWorkflow()` call (line 105) with `resolveWorkflow()`.

  **Detail**: Change import, replace line 105 call. This eliminates the write-on-viewer-open cascade.

- `src/core/specDirectoryResolver.ts` — Add `directoryHasSpecContext()` check alongside `directoryHasMarkdown()` in `resolveSpecDirectories()`.

  **Detail**: Add new function `directoryHasSpecContext(dirPath)` that checks for `.spec-context.json` file existence. In `resolveSpecDirectories()` line 85, change `const hasContent = await directoryHasMarkdown(...)` to `const hasContent = await directoryHasMarkdown(...) || await directoryHasSpecContext(...)`. Same change needed for `expandGlobPattern()` if it also filters by `.md` presence.

- `webview/src/spec-viewer/editor/inlineEditor.ts` — Wrap the `editor-comment-section` div with a bordered container class.

  **Detail**: Add a CSS class `editor-comment-area` to the `editor-comment-section` div (line 43). The CSS will provide the border. No structural HTML change needed — just add the class or add a wrapper div.

- `webview/styles/spec-viewer/_line-actions.css` — Reduce line action button size and adjust positioning to not affect bullet spacing.

  **Detail**: Change `.line-add-btn` (line 74-92): reduce from 22x22px to 18x18px, change `top: 4px` to `top: 2px`, reduce SVG from 14x14 to 12x12. Add `li.line` rule to ensure `min-height` is not inflated — set `min-height: unset` or match natural line height. The button is already `opacity: 0` at rest and `position: absolute`, so reducing size should eliminate the spacing issue.

- `webview/styles/spec-viewer/_code.css` — Add mermaid zoom controls and remove `max-width: 100%` constraint on SVG.

  **Detail**: Remove `max-width: 100%` from `.mermaid svg` (line 180). Add `.mermaid-controls` bar above the diagram with zoom in/out/reset buttons. Add CSS for zoom controls toolbar. The SVG will render at natural size with horizontal scroll from `overflow-x: auto` on `.mermaid-container`.

- `webview/src/spec-viewer/highlighting.ts` — After `mermaid.run()`, inject zoom control buttons into each `.mermaid-container` and wire up click handlers for zoom.

  **Detail**: After line 136 (`mermaid.run()`), iterate `.mermaid-container` elements. Insert a toolbar div with +/−/reset buttons. On click, apply CSS `transform: scale(N)` to the `.mermaid svg` element, tracking zoom level in a data attribute. Use `transform-origin: top left` so scrolling works naturally.

- `webview/src/spec-viewer/navigation.ts` — Set `disabled` attribute on step tabs when `docExists` is false in `updateNavState()`. Fix badge to always use context state.

  **Detail for Problem 7**: In `updateNavState()` around line 29-32, after computing `docExists`, add `tabEl.disabled = !docExists` (for button elements) or set the `disabled` attribute. The click handler (line 265) already checks `btn.disabled`.
  **Detail for Problem 9**: The badge text is set server-side by `computeBadgeText()` which reads from context — this is correct. The issue is that the webview-side `updateNavState()` might be re-computing badge text based on the viewed tab. Need to verify the badge element is not being overwritten on tab switch. If it is, remove that override so badge stays as set from extension.

- `src/features/spec-viewer/html/navigation.ts` — Fix `.working` class to check `completedAt` before applying. Use `completed` class for steps with `completedAt` set.

  **Detail for Problem 8b/10**: Line 40 sets `isWorking = activeStep === phase`. Change to: `isWorking = activeStep === phase && !stepHistory?.[phase]?.completedAt`. Pass `stepHistory` to this function from the caller.

- `webview/styles/spec-viewer/_animations.css` — Change `working-pulse` keyframes to use `var(--success)` instead of `var(--accent)`.

  **Detail**: Lines 77-84: replace all `var(--accent)` references with `var(--success)` in the `working-pulse` keyframes.

- `webview/styles/spec-viewer/_navigation.css` — Style `.working .step-label` with bold accent/primary color instead of default text color.

  **Detail**: Lines 134-136 currently set `.step-tab.working .step-label { color: var(--text-primary) }`. Change to `color: var(--accent); font-weight: 700;` so the actively working step stands out from merely viewed tabs.

## Risks

- Mermaid zoom via CSS transform may cause blurry text at non-integer scale factors: mitigate by snapping to 0.25 increments (1.0, 1.25, 1.5, etc.)
- `resolveWorkflow()` diverging from `getOrSelectWorkflow()` over time: mitigate by extracting shared logic into a private helper
