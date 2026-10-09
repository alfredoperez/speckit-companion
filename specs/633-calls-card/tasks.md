# Tasks: Calls card

## Phase 1: Foundational

Files: `markdown/blockFences.ts`, `markdown/inline.ts`, `markdown/renderer.ts`

**Wave 1 — independent (different files):**

- [x] **T001** [P] Share the file chip markup as one exported helper and call it from the inline code span · apps/vscode/webview/src/spec-viewer/markdown/inline.ts
- [x] **T002** [P] Give `BlockRenderer` a context argument (first body source line, following note text) · apps/vscode/webview/src/spec-viewer/markdown/blockFences.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** Pass row source lines and the note from the render loop, skip the consumed note line, export the component-line wrapper · apps/vscode/webview/src/spec-viewer/markdown/renderer.ts

## Phase 2: User Story 1 - the card (P1)

Files: `markdown/callsCard.ts`, `styles/spec-viewer/_calls.css`, `styles/spec-viewer/index.css`, `markdown/__tests__/callsCard.test.ts`

### Tests

- [x] **T004** [US1] Failing tests: parser grammar rows and every error case, renderer attributes via parseFragment, injection through name, title and path, fallback, note consumed, two blocks, fence inside comment or fence untouched, row `data-line` · apps/vscode/webview/src/spec-viewer/markdown/__tests__/callsCard.test.ts

### Implementation

- [x] **T005** [US1] `parseCalls` and `renderCallsCard`, registered for `calls` · apps/vscode/webview/src/spec-viewer/markdown/callsCard.ts
- [x] **T006** [P] [US1] Card styles from existing tokens, imported after `_code.css` · apps/vscode/webview/styles/spec-viewer/_calls.css

**Checkpoint**: a valid fence renders a card, a malformed one the plain block.

## Phase 3: User Story 3 - comment and strike (P2)

Files: `editor/callsStrike.ts`, `editor/__tests__/callsStrike.test.ts`, `src/features/spec-viewer/extractBlock.ts` and its test

### Tests

- [x] **T007** [P] [US3] Failing tests: strike posts once with the exact text, struck state, repeat press does nothing · apps/vscode/webview/src/spec-viewer/editor/__tests__/callsStrike.test.ts
- [x] **T008** [P] [US3] Failing tests: `extractBlock` inside a `calls` fence returns the row, outside unchanged; `buildReviewComment` anchors a row · apps/vscode/src/features/spec-viewer/__tests__/reviewComments.test.ts

### Implementation

- [x] **T009** [P] [US3] Strike click handler and struck state, wired where the other line actions are · apps/vscode/webview/src/spec-viewer/editor/callsStrike.ts
- [x] **T010** [P] [US3] Fence-aware single-line anchor · apps/vscode/src/features/spec-viewer/extractBlock.ts

**⟶ Wait for the wave to finish, then:**

- [x] **T011** [US3] Check the Refine prompt reads sensibly for a row, change nothing else · apps/vscode/src/features/spec-viewer/messageHandlers.ts

## Phase 4: Polish

- [x] **T012** Storybook stories: two cards and one malformed fence · apps/vscode/webview/src/spec-viewer/markdown/PlanComponents.stories.tsx
- [x] **T013** Run `npx tsc -p ./ --noEmit`, `npm test`, `npm run canvas:build`; commit the rebuilt vendor files · apps/copilot-canvas/vendor

## Dependencies & Execution Order

Foundational (T001, T002 in parallel, then T003) blocks the card. The card (T004 first, then T005 and T006) blocks strike (T009 needs the markup). T007, T008 come before T009, T010. Polish runs last.
