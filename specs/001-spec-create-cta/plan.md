# Plan: Spec Create CTA Button Cleanup

**Spec**: specs/001-spec-create-cta/spec.md | **Date**: 2026-02-27

## Approach

Update the HTML template in `specEditorProvider.ts` to rename the button and remove the Preview element, then remove the corresponding event listener in the webview script.

## Files to Change

- `src/features/spec-editor/specEditorProvider.ts` — rename "Submit to AI" → "Submit", remove Preview button HTML
- `webview/src/spec-editor/index.ts` — remove preview button event listener

## Phase 1 Tasks

| ID | Do | Verify |
|----|-----|--------|
| T001 | Change button label from "Submit to AI" to "Submit" in HTML template (line ~494) | Button reads "Submit" in the create spec footer |
| T002 | Remove `<button class="btn-secondary" id="previewBtn">Preview</button>` from HTML template | No Preview button in the footer |
| T003 | Remove the preview event listener block from `webview/src/spec-editor/index.ts` (~lines 241-244) | No JS error when preview button is absent |
