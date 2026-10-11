# Tasks: Plan cards that respond on the Copilot app board

**Feature**: [board-states-card.spec.md](./board-states-card.spec.md) · **Plan**: [plan.md](./plan.md)

## Phase 1: Foundational

The picking code has to reach the page before either story can use it.

Files: `apps/copilot-canvas/build.mjs`, `apps/copilot-canvas/server.mjs`, `apps/copilot-canvas/vendor/states-select.mjs`, `apps/copilot-canvas/README.md`

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add a fifth bundle from `apps/vscode/webview/src/spec-viewer/editor/statesSelect.ts`, with the same options and banner as the others, and name it in the closing log line · `apps/copilot-canvas/build.mjs`
- [x] **T002** [P] Serve it at `/states-select.mjs` · `apps/copilot-canvas/server.mjs`
- [x] **T003** [P] Add the new file to the `vendor/` table · `apps/copilot-canvas/README.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T004** Run `npm run canvas:build` so the generated file exists · `apps/copilot-canvas/vendor/states-select.mjs`

## Phase 2: User Story 1 - Picking a state on the board shows that state (P1)

**Goal**: a click on a state changes the card, as in VS Code.

**Independent Test**: on a plan with a states fence, click the second state; the caption names it and it is the only one marked.

Files: `apps/copilot-canvas/public/app.js`, `apps/copilot-canvas/public/styles.css`, `apps/copilot-canvas/tests/page.test.mjs`

### Tests

- [x] **T005** [US1] A page test with its own temp project whose `plan.md` holds a states fence and a file name: clicking the second state changes the caption and moves the mark, and still does after a redraw · `apps/copilot-canvas/tests/page.test.mjs`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T006** [P] [US1] Import `setupStatesSelect` and call it once at load · `apps/copilot-canvas/public/app.js`
- [x] **T007** [P] [US1] Remove the rules that switch the states card off and un-hide its list; keep the two that hide comment and strike · `apps/copilot-canvas/public/styles.css`

**Checkpoint**: the states card works on the board.

## Phase 3: User Story 2 - A file name on the board does not look like a link (P2)

**Goal**: a file name reads as a name.

**Independent Test**: every `.file-ref` on a drawn plan is disabled and its cursor is the default one.

Files: none of its own. It edits the three files Phase 2 owns, so it runs after Phase 2, never beside it.

### Implementation

- [x] **T008** [US2] Disable every `.file-ref` after a document or overview is drawn · `apps/copilot-canvas/public/app.js`

**⟶ Wait for T008, then:**

- [x] **T009** [US2] Give `.file-ref` a default cursor and no pointer events on the board · `apps/copilot-canvas/public/styles.css`

**⟶ Wait for T009, then:**

- [x] **T010** [US2] Extend the page test: the file name is disabled, and the comment and strike buttons are not visible · `apps/copilot-canvas/tests/page.test.mjs`

**Checkpoint**: nothing on a board plan looks live and is not.

## Phase 4: Polish

- [x] **T011** Add one entry under Unreleased, in the root changelog where board entries live · `CHANGELOG.md`
- [x] **T012** Validate against the Success Criteria: `npm run test:canvas`, `npm run compile && npm test`, and `git diff --exit-code -- apps/copilot-canvas/vendor` after a rebuild

## Dependencies & Execution Order

Foundational, then Story 1, then Story 2, then Polish.

- **Phase 1**: T001, T002 and T003 in any order, then T004.
- **Phase 2**: T005 first, written to fail; then T006 and T007.
- **Phase 3**: T008, T009, T010 in order. It shares Phase 2's files, which is why it follows it.
