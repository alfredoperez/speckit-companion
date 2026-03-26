# Tasks: Stale Warning Banner

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-26

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add staleness types — `src/features/spec-viewer/types.ts`, `webview/src/spec-viewer/types.ts`
  - **Do**: Add `StalenessInfo` interface (`isStale: boolean`, `staleReason: string`, `newerUpstream: string`) and `StalenessMap` type (`Record<DocumentType, StalenessInfo>`) to both extension and webview type files. Extend `NavState` in both files with optional `stalenessMap?: StalenessMap`.
  - **Verify**: `npm run compile` passes with no type errors

- [x] **T002** Create staleness computation module *(depends on T001)* — `src/features/spec-viewer/staleness.ts`
  - **Do**: Create `computeStaleness(documents: SpecDocument[]): Promise<StalenessMap>`. For each core document (in workflow order), use `vscode.workspace.fs.stat()` to read mtime. A document is stale if any preceding document in the workflow has a strictly newer mtime. Skip non-existent files (not stale). Return a map keyed by document type with `StalenessInfo` for each core doc. The `staleReason` should be a human-readable message like `"Plan was generated before the current spec"` and `newerUpstream` should be the label of the newest upstream doc that caused staleness.
  - **Verify**: `npm run compile` passes

- [x] **T003** Thread staleness through updateContent *(depends on T002)* — `src/features/spec-viewer/specViewerProvider.ts`
  - **Do**: In `updateContent()`, after `scanDocuments()` returns, call `computeStaleness(documents)` and store the result. Pass `stalenessMap` to `generateHtml()` as a new parameter. In `sendContentUpdateMessage()`, also call `computeStaleness()` and include `stalenessMap` in the `NavState` object sent via `postMessage`.
  - **Verify**: `npm run compile` passes

- [x] **T004** Render stale badges in navigation tabs *(depends on T003)* — `src/features/spec-viewer/html/navigation.ts`
  - **Do**: Add `stalenessMap` parameter to `generateCompactNav()`. Inside the step-tabs loop, if `stalenessMap[doc.type]?.isStale`, append a `<span class="stale-badge">!</span>` after the step-label span. This badge renders regardless of which tab is active.
  - **Verify**: `npm run compile` passes

- [x] **T005** Render stale warning banner in HTML generator *(depends on T004)* — `src/features/spec-viewer/html/generator.ts`
  - **Do**: Add `stalenessMap` parameter to `generateHtml()`. Pass it to `generateCompactNav()`. After the `${navHtml}` insertion, conditionally render a `<div class="stale-banner">` between nav and `<main>`. The banner shows when `stalenessMap[currentDocType]?.isStale` is true, displaying the `staleReason` text and a `<button id="stale-regen" class="stale-regen-btn">Regenerate</button>`.
  - **Verify**: `npm run compile` passes

- [x] **T006** Handle staleness in webview navigation *(depends on T005)* — `webview/src/spec-viewer/navigation.ts`
  - **Do**: In `updateNavState()`, read `navState.stalenessMap`. For each `.step-tab`, toggle a `.stale` class and show/hide a `.stale-badge` element based on staleness. Find or create the `.stale-banner` element: if the current doc is stale, set its text to the `staleReason` and show it; otherwise hide it. Wire the banner's Regenerate button to send `vscode.postMessage({ type: 'regenerate' })` (same as existing footer Regenerate).
  - **Verify**: `npm run compile` passes

- [x] **T007** Add staleness CSS styles *(depends on T006)* — `webview/styles/spec-viewer/_staleness.css`, `webview/styles/spec-viewer/index.css`
  - **Do**: Create `_staleness.css` with: (1) `.stale-banner` — yellow/orange background using `var(--vscode-editorWarning-foreground)` and `var(--vscode-inputValidation-warningBackground)`, padding, flex layout with message text and regen button, positioned between nav and content. (2) `.stale-badge` — small orange/yellow `!` indicator on tabs, positioned as a superscript. (3) `.stale-regen-btn` — compact button matching existing secondary button style. Add `@import '_staleness.css'` to `index.css`.
  - **Verify**: `npm run package` succeeds, open extension and visually confirm banner appears on stale docs

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [x] **T008** [P][A] Unit tests — `test-expert`
  - **Files**: `src/features/spec-viewer/__tests__/staleness.test.ts`
  - **Pattern**: Jest with `ts-jest`, BDD `describe`/`it` blocks, mock `vscode.workspace.fs.stat()` via the `tests/__mocks__/vscode.ts` mock
  - **Reference**: `src/features/spec-viewer/__tests__/documentScanner.test.ts`
  - **Cases**: (1) No upstream → not stale. (2) Upstream newer → stale with correct reason. (3) Upstream older → not stale. (4) File doesn't exist → not stale. (5) Cascading: spec newer than both plan and tasks → both stale. (6) Only immediate predecessor newer → stale. (7) Same mtime → not stale.

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T007 | [x] |
| Phase 2 | T008 | [x] |
