# Tasks — Create Spec Polish

- [x] **T001** Right-align the workflow selector: fix `.workflow-row` so the lone `.workflow-selector` sits top-right + `webview/styles/spec-editor.css`
- [x] **T002** [P] Bump base body type to a readable size (helper text, label, selector) keeping `--text-body`/`--text-primary` tokens + `webview/styles/spec-editor.css`
- [x] **T003** [P] Update the `#specContent` placeholder with concrete examples incl. a sample Jira link and a sample GitHub link + `src/features/spec-editor/specEditorProvider.ts`
- [x] **T004** Mirror the new placement, larger type, and example placeholder in the Storybook mock + `webview/src/spec-editor/CreateSpecMock.tsx`
- [x] **T005** Update the story to cover the polished layout + `webview/src/spec-editor/__stories__/CreateSpec.stories.tsx`
- [x] **T006** Refresh README Create-Spec copy only if the described UX changed; otherwise skip + `README.md` (skipped — README does not document the placeholder text or selector corner position; no documented UX changed)
- [x] **T007** Verify no behavioral regressions (submit, char count, attach, keyboard, workflow change) via `npm test` + `webview/src/spec-editor/__tests__/`
