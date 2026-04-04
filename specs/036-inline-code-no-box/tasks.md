# Tasks: Inline Code Without Boxes

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-04

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Remove box styling from spec-viewer inline code — `webview/styles/spec-viewer/_typography.css` | R001, R002, R003
  - **Do**: In `#markdown-content code:not(pre code)` rule (line ~104), remove `background`, `border`, `border-radius`. Keep `font-family`, `font-size`, `padding`, `color`.
  - **Verify**: Open a spec with inline code in the spec viewer — code should show as colored text without a box.

- [x] **T002** Remove box styling from spec-markdown inline code — `webview/styles/spec-markdown.css` | R001, R002
  - **Do**: In `p code, li code` rule (line ~95), remove `background-color`, `border-radius`. Keep `font-size`, `padding`.
  - **Verify**: Markdown preview renders inline code without box.

- [x] **T003** Remove box styling from spec-editor inline code — `webview/styles/spec-editor.css` | R001, R002
  - **Do**: In `.preview-container code` rule (line ~387), remove `background-color`, `border-radius`. Keep `font-family`, `padding`.
  - **Verify**: Spec editor preview renders inline code without box.

- [x] **T004** Remove box styling from workflow inline code — `webview/styles/workflow.css` | R001, R002
  - **Do**: In `.line-content code` rule (line ~508), remove `background`, `border`, `border-radius`. Keep `font-family`, `font-size`, `padding`, `color`.
  - **Verify**: Workflow task descriptions render inline code without box.

---

## Progress

- Phase 1: T001–T004 [x]
