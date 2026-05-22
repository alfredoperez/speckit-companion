# Tasks: Persist inline review comments + Activity view

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** Add `ReviewComment` data model — `src/core/types/specContext.ts` | R001, R008
  - **Do**: Add a `ReviewComment` interface (`id`, `doc: 'spec'|'plan'|'tasks'`, `anchor: { heading: string|null; blockText: string; line: number }`, `comment`, `status: 'pending'|'applied'`, `createdAt`); add optional `reviewComments?: ReviewComment[]` to both `SpecContext` and `ViewerState`.
  - **Verify**: `npm run compile` type-checks.

- [x] **T002** [P] Extend the context JSON schema *(depends on T001)* — `src/core/types/spec-context.schema.json` | R001
  - **Do**: Add an optional `reviewComments` array definition mirroring the interface; keep it non-required so older files still validate.
  - **Verify**: schema parses; an existing `.spec-context.json` without the field still validates.

- [x] **T003** [P] Extension-side comment helpers *(depends on T001)* — `src/features/spec-viewer/reviewComments.ts` (create) | R001, R003, R006
  - **Do**: Export a `buildReviewComment(doc, lineNum, sourceLines, comment)` that anchors via `extractBlock` (heading + block text + line), plus pure mutators `addComment` / `editComment` / `removeComment` / `markApplied(ids)` that take and return a `SpecContext`.
  - **Verify**: unit-callable; type-checks.
  - **Leverage**: `src/features/spec-viewer/extractBlock.ts` (anchor primitive), `src/features/specs/specContextWriter.ts` (mutate-and-write pattern).

- [x] **T004** [P] Pass `reviewComments` through to viewer state *(depends on T001)* — `src/features/spec-viewer/stateDerivation.ts` | R002, R005
  - **Do**: Add a `pickReviewComments(ctx)` reader (like the existing `pickStringArray`/`pickRecord`) and include `reviewComments` in the returned `ViewerState`.
  - **Verify**: type-checks; derived state includes the array when present.

- [x] **T005** [P] Webview comment + message types *(depends on T001)* — `webview/src/spec-viewer/types.ts`, `webview/src/spec-viewer/signals.ts` | R002, R007
  - **Do**: Add the `ReviewComment` shape and `addComment`/`editComment`/`removeComment`/`runDocRefinement` message types; expose persisted comments off `viewerState` (no new long-lived signal needed beyond reading `viewerState.reviewComments`).
  - **Verify**: type-checks.

- [x] **T006** Persist + mark-applied in the message handler *(depends on T003)* — `src/features/spec-viewer/messageHandlers.ts` | R001, R005, R006, R008
  - **Do**: Add `addComment`/`editComment`/`removeComment` cases that route through `updateSpecContext` using the T003 mutators; add `runDocRefinement` (dispatch one doc's pending comments to the AI); rewrite `handleSubmitRefinements` to stop writing `<doc>-extra.md` and instead `markApplied` the submitted comment ids. Echo updated content back so the viewer re-renders.
  - **Verify**: adding a comment writes `reviewComments` to `.spec-context.json` and preserves all other fields + transitions; refine writes no `-extra.md`.
  - **Leverage**: existing block/heading prompt enrichment in `handleSubmitRefinements`.

- [x] **T007** Post persist messages from inline edits *(depends on T005, T006)* — `webview/src/spec-viewer/editor/refinements.ts` | R001, R007, R010
  - **Do**: `addRefinement`/`addRefinementForRow`/`removeRefinement` post `addComment`/`removeComment`; `submitAllRefinements` posts `runDocRefinement` and no longer clears comments locally (they flip to `applied` on echo-back). Keep the inline `✨ Refine (N)` count.
  - **Verify**: adding/removing inline triggers a persist message; the line-hover "+", card, and dialog UX are unchanged.

- [x] **T008** Restore comments on open (re-anchor) *(depends on T005, T007)* — `webview/src/spec-viewer/editor/restoreComments.ts` (create) | R002, R003
  - **Do**: For each `viewerState.reviewComments` of the current doc, match stored `blockText` against rendered lines (anchor on stored `line` first, then exact block text, then nearest matching heading); mount via the existing `renderComment` path; never drop a comment (flag re-anchored ones).
  - **Verify**: exact-match restores at original line; drifted source re-anchors to nearest heading; nothing is lost.

- [x] **T009** [P] Activity consolidated comments list *(depends on T004, T005)* — `webview/src/spec-viewer/components/cards/CommentsCard.tsx` (create) | R005, R009
  - **Do**: Render all `reviewComments` grouped by document with a status badge (pending/applied), a jump-to-line control, and a per-document **Run refinement** button that posts `runDocRefinement`.
  - **Verify**: card lists comments across spec/plan/tasks with working jump + run actions.
  - **Leverage**: existing cards under `webview/src/spec-viewer/components/cards/`.

- [x] **T010** [P] Remove the scratchpad / Notes path — `src/features/spec-viewer/documentScanner.ts`, `src/core/constants.ts`, `src/features/spec-viewer/types.ts` | R004
  - **Do**: Stop synthesizing per-source scratchpad ("Notes") docs in `documentScanner`; remove `ScratchpadFiles`/`SCRATCHPAD_SUFFIX` and the `isScratchpad`/`scratchpadFor` doc fields and their consumers. Land all three files together so the build stays green.
  - **Verify**: `npm run compile` passes; the viewer surfaces no Notes sub-tab.

- [x] **T011** Wire restore + CommentsCard into the viewer *(depends on T008, T009)* — `webview/src/spec-viewer/components/ActivityPanel.tsx`, `webview/src/spec-viewer/editor/index.ts` | R002, R005
  - **Do**: Render `CommentsCard` in `ActivityPanel` (and include comments in `hasAnyData`); call `restoreComments` after markdown render completes and on document switch.
  - **Verify**: reopening a spec shows persisted comments inline and in the Activity list.

- [x] **T012** [P] Tests *(depends on T006, T008, T010)* — `src/features/spec-viewer/__tests__/messageHandlers.test.ts`, `documentScanner` + webview re-anchor tests | R001, R003, R004, R006
  - **Do**: Cover persist add/edit/remove + field preservation, refine marks `applied` and writes no `-extra.md`, `documentScanner` emits no Notes doc, and re-anchor exact/drift/never-drop.
  - **Verify**: `npm test` passes.

- [x] **T013** [P] Docs — `README.md`, `docs/viewer-states.md` | R004, R005
  - **Do**: Document persisted review comments, the Activity review surface (status/jump/Run refinement), and removal of the Notes sub-tab; update the viewer state reference accordingly.
  - **Verify**: README + viewer-states reflect the new behavior.
