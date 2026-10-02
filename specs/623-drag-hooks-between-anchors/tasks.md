# Tasks: Drag a hook between anchors

**Input**: [drag-hooks-between-anchors.spec.md](./drag-hooks-between-anchors.spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/move-hook.md](./contracts/move-hook.md)

User Stories 1, 2 and 4 all live in the board's drag code in one file, so they share one phase. Their acceptance scenarios are tested separately inside it.

## Phase 1: Setup

No setup: the worktree already has dependencies installed and the companion extension added in dev mode.

## Phase 2: Foundational

Files: `apps/speckit-extension/scripts/config_write.py`, `apps/speckit-extension/tests/test_hook_moves.py`, `apps/vscode/src/protocol/pipeline.ts`, `apps/vscode/src/features/specs/pipelineGraph.ts`, `apps/vscode/tests/unit/pipeline-builder/pipelineGraph.spec.ts`, `apps/vscode/src/features/pipeline-builder/builderPanel.ts`, `apps/vscode/tests/unit/pipeline-builder/builderPanel.spec.ts`, `apps/vscode/webview/src/pipeline-builder/hookMoves.ts`, `apps/vscode/webview/src/pipeline-builder/__tests__/HookMoves.test.tsx`

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add `move_hook` and the `--move-from` / `--to-index` / `--boundary` flags: lift the entry verbatim, insert at the target index, tidy an emptied anchor without eating trailing comments, validate the target through the built plan and `resolve_anchor`, one `save_config` · apps/speckit-extension/scripts/config_write.py
- [x] **T002** [P] Add the `moveHook` message and remove `addHook.movedFrom` · apps/vscode/src/protocol/pipeline.ts
- [x] **T003** [P] Write the pure hook-move helpers: payload encode/decode under `application/x-pb-hook`, final index after removal, same-address test · apps/vscode/webview/src/pipeline-builder/hookMoves.ts

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T004** [P] Test the writer move: across anchors, reorder up and down, verbatim text, emptied anchor keeps trailing comments, content edit in the same write, and byte-identical refusals (missing index, unknown anchor, boundary mismatch) · apps/speckit-extension/tests/test_hook_moves.py
- [x] **T005** [P] Add the `moveHook` writer helper and its flag test · apps/vscode/src/features/specs/pipelineGraph.ts, apps/vscode/tests/unit/pipeline-builder/pipelineGraph.spec.ts
- [x] **T006** [P] Test the hook-move helpers · apps/vscode/webview/src/pipeline-builder/__tests__/HookMoves.test.tsx

**⟶ Wait for Wave 2 to finish, then:**

- [x] **T007** Handle `moveHook` in one write with an outcome status, drop the two-write `movedFrom` path, and update the panel tests · apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/tests/unit/pipeline-builder/builderPanel.spec.ts

**Checkpoint**: a move written from the CLI or the panel message is atomic and refused byte-identically.

## Phase 3: User Stories 1, 2 and 4 — drag on the board (P1, P1, P2)

Files: `apps/vscode/webview/src/pipeline-builder/Canvas.tsx`, `apps/vscode/webview/styles/pipeline-builder.css`, `apps/vscode/webview/src/pipeline-builder/__tests__/HookDrag.test.tsx`

**Goal**: a project hook row drags to any anchor or place on its step, and read-only rows and other lanes refuse with a reason.

**Independent Test**: render the canvas, drag a hook row onto a card half, a row half and a seam, and assert the `onMoveHook` address; start a drag on an extension row and assert the refusal.

### Tests

- [x] **T008** [P] [US1] Write the drag tests: card halves, row halves (reorder both ways), seam and block append, self-drop sends nothing, node drop handlers ignore hook payloads, extension and parked rows refuse with a reason, another lane refuses · apps/vscode/webview/src/pipeline-builder/__tests__/HookDrag.test.tsx

### Implementation

**Wave 1 — independent (different files):**

- [x] **T009** [P] [US1] Make project hook rows drag sources and rows, cards, seams, blocks and phase headings drop targets; refuse drags from extension and parked rows and drops from another step through `onRefuse` · apps/vscode/webview/src/pipeline-builder/Canvas.tsx
- [x] **T010** [P] [US2] Style the grip, the over halves and the refused row with no transition-dependent feedback · apps/vscode/webview/styles/pipeline-builder.css

**Checkpoint**: dragging works on the board and every refusal has a reason.

## Phase 4: User Story 3 — move from the keyboard (P1)

Files: `apps/vscode/webview/src/pipeline-builder/AttachForm.tsx`, `apps/vscode/webview/src/pipeline-builder/index.tsx`, `apps/vscode/webview/src/pipeline-builder/__tests__/AttachForm.test.tsx`, `apps/vscode/webview/src/pipeline-builder/__tests__/SidePanes.test.tsx`, `apps/vscode/webview/src/pipeline-builder/__tests__/wiring.test.tsx`, `apps/vscode/webview/src/pipeline-builder/__tests__/MoveAnnouncement.test.tsx`

**Goal**: the hook form moves a hook with Move up, Move down and its Runs fields, stays open, and announces only the outcome.

**Independent Test**: open a hook in the form, press Move up, and assert one `moveHook` was posted and the live region stays quiet until the status arrives.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T011** [P] [US3] Add the Order row (Move up / Move down, disabled with a reason at the edges) and a polite live region, and send a placement change as a move · apps/vscode/webview/src/pipeline-builder/AttachForm.tsx
- [x] **T012** [P] [US3] Wire board drags and form moves to `moveHook` through `sendMove`, keep the form on the hook with an optimistic index and put it back on refusal, and show panel-side refusals in the status line · apps/vscode/webview/src/pipeline-builder/index.tsx

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T013** [US3] Update and add the form, wiring and announcement tests for the Order row, the atomic placement move and outcome-only announcement · apps/vscode/webview/src/pipeline-builder/__tests__/AttachForm.test.tsx, apps/vscode/webview/src/pipeline-builder/__tests__/SidePanes.test.tsx, apps/vscode/webview/src/pipeline-builder/__tests__/wiring.test.tsx, apps/vscode/webview/src/pipeline-builder/__tests__/MoveAnnouncement.test.tsx

**Checkpoint**: every pointer move has a keyboard path.

## Phase 5: Polish

**Wave 1 — independent (different files):**

- [x] **T014** [P] Add stories for a hook being dragged, a refused drag and the form's Order row · apps/vscode/webview/src/pipeline-builder/__stories__/Components.stories.tsx, apps/vscode/webview/src/pipeline-builder/__stories__/Guide.stories.tsx, apps/vscode/webview/src/pipeline-builder/__stories__/Interactions.stories.tsx
- [x] **T015** [P] Update the living spec's move requirement and scenarios · capabilities/pipeline-builder/attach-a-hook.spec.md
- [x] **T016** [P] Add a short guide section and the changelog lines · apps/website/src/content/docs/docs/guides/pipeline-builder.mdx, CHANGELOG.md, apps/speckit-extension/CHANGELOG.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T017** Validate against the Success Criteria: both pipeline-builder test dirs, full jest, compile, webview typecheck, the Python suite, `npm run test:visual`, living spec validation and drift, and a headless-Chrome check of drag, keyboard move, a refused drop and a narrow width

## Dependencies & Execution Order

- Setup → Foundational → Phase 3 → Phase 4 → Polish. Phase 4 consumes Phase 3's `onMoveHook` / `onRefuse` props in `index.tsx`.
- Foundational: Wave 1 (T001–T003) blocks Wave 2 (T004–T006), which blocks T007.
- Phase 3: T008 is written first and fails; Wave 1 (T009, T010) makes it pass.
- Phase 4: Wave 1 (T011, T012) blocks T013.
- Polish: Wave 1 (T014–T016) blocks T017.
