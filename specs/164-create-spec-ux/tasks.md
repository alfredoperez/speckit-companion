# Tasks: Create Spec Page — UX & Accessibility Overhaul

Dependency-ordered, grouped by execution layer. Traceability is to files and `FR-…`.

## Foundational

- [x] **T001** Create pure helper module `webview/src/spec-editor/submitGate.ts` with `canSubmit`, `isOverLimit`, `shouldShowCharCount`, `isMacPlatform`, and exported `HELPER_TEXT` / `SUBTITLE_TEXT` constants (FR-002, FR-004, FR-008, FR-009, FR-010, FR-019)

## Core work

- [x] **T002** Rework the HTML template in `src/features/spec-editor/specEditorProvider.ts`: `<main>` landmark, h1→h2 heading fix, rewritten subtitle, persistent helper text, `role=alert`/`aria-live` on `#error-container`, `aria-describedby` textarea→counter+helper, hidden counter, composer-style attachments (no dashed dropzone), `aria-busy`+status text on loading overlay, **Create Spec** button disabled-by-default, regrouped footer, visually-hidden `#sr-status` region (FR-001, FR-004, FR-005, FR-007, FR-008, FR-011, FR-012, FR-013, FR-016, FR-018)
- [x] **T003** Update webview behavior in `webview/src/spec-editor/index.ts`: import gate helpers; `updateSubmitState()` on input/init/restore; counter visibility + over-limit gate in `updateCharCount()`; submit click & Ctrl/Cmd+Enter early-return on `!canSubmit`; accessible error close + delegated listener + focus; `setLoading()` toggles `aria-busy`/overlay text; attach/remove writes `#sr-status` and remove buttons get `aria-label`; platform-correct keyboard hint via `isMacPlatform`; Esc confirms when content present (FR-002, FR-008, FR-010, FR-012, FR-013, FR-014, FR-015, FR-016, FR-019, FR-020, FR-021)
- [x] **T004** Restyle `webview/styles/spec-editor.css`: centered ~800px column, proportional textarea font, helper-text `--text-body`, visible `:focus-visible` on textarea/select/all buttons, remove dashed/drag affordance + composer row, drop divider rules, `.sr-only` + counter-hidden utilities, single-row footer (FR-001, FR-002, FR-003, FR-005, FR-006, FR-009, FR-011, FR-017)

## Integration

- [x] **T005** [P] Update the Storybook mock `webview/src/spec-editor/CreateSpecMock.tsx` and `__stories__/CreateSpec.stories.tsx` to the new layout (centered column, helper text, Create Spec button, disabled-on-empty, composer attachments, platform hint, footer grouping) and add Empty-disabled / OverLimit story variants (FR-001, FR-002, FR-005, FR-007, FR-008, FR-011)

## Polish

- [x] **T006** [P] Add unit tests `webview/src/spec-editor/__tests__/submitGate.test.ts` covering empty/whitespace/over-limit `canSubmit`, `shouldShowCharCount` threshold, and `isMacPlatform` (FR-008, FR-009, FR-010, FR-019)
- [x] **T007** [P] Docs: README Create-Spec / "Reading Specs" area + root `CHANGELOG.md` `[Unreleased]` user-facing entry; note screenshots to re-shoot (FR-001..FR-020)
- [x] **T008** Verify: `npm run compile && npm test` green and `npm run package` builds the webview with no tsc/webpack errors (SC-001..SC-011)

## Dependencies

- T001 blocks T002, T003, T006 (they import/exercise the helpers).
- T002 (markup ids/aria hooks) blocks T003 (wires to those ids) and T004 (styles those classes).
- T005, T006, T007 depend on the behavior/markup being final (T002–T004).
- T008 is last (full verify).

## Parallel

- T005, T006, T007 are `[P]` — different files, runnable together once T002–T004 land.
