# Tasks: Spec Create CTA Button Cleanup

## Phase 1 — Core

- [x] **T001** · Rename submit button label
  - **Do**: In `src/features/spec-editor/specEditorProvider.ts` ~line 494, change `Submit to AI` → `Submit`
  - **Verify**: Create Spec window footer shows "Submit" (not "Submit to AI")

- [x] **T002** · Remove Preview button HTML
  - **Do**: In `src/features/spec-editor/specEditorProvider.ts` ~line 493, delete the `<button class="btn-secondary" id="previewBtn">Preview</button>` line
  - **Verify**: No Preview button appears in the Create Spec footer

- [x] **T003** · Remove preview event listener
  - **Do**: In `webview/src/spec-editor/index.ts` ~lines 241-244, remove the `// Preview button` block and its `addEventListener` call
  - **Verify**: No console errors about missing elements; bundle compiles cleanly
