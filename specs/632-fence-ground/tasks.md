# Tasks: The ground all four stand on

Paths are under `apps/vscode/` unless stated. Tests are written first in each story.

## Phase 1: Setup

No setup work.

## Phase 2: Foundational

Files: `webview/src/spec-viewer/markdown/fenceInfo.ts`, `webview/src/spec-viewer/markdown/__tests__/fenceInfo.test.ts`

**Wave 1 — one owner:**

- [x] **T001** [US3] Write failing tests for `parseFenceInfo` and the fence-region helper (title, bare and `key=value` options, hostile strings, backtick-only fences, unclosed fence, indented fence, tilde is not a fence) · webview/src/spec-viewer/markdown/__tests__/fenceInfo.test.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T002** [US3] Implement `parseFenceInfo`, the strict language check moved here, and `mapOutsideFences` using the renderer's fence rule · webview/src/spec-viewer/markdown/fenceInfo.ts

## Phase 3: User Story 1 - A file link opens the file it names (P1)

Files: `webview/src/spec-viewer/markdown/inline.ts`, `webview/src/spec-viewer/actions.ts`, `src/protocol/viewer.ts`, `src/features/spec-viewer/messageHandlers.ts`, `webview/src/spec-viewer/markdown/__tests__/inline.test.ts`, `src/features/spec-viewer/__tests__/messageHandlers.test.ts`

### Tests

**Wave 1 — independent (different files):**

- [x] **T003** [P] [US1] Failing inline tests: `path:line`, `path:from-to`, bad lines carry no `data-line`, unknown extension stays code · webview/src/spec-viewer/markdown/__tests__/inline.test.ts
- [x] **T004** [P] [US1] Failing host tests: inside root opens, `..` and absolute-out rejected, `..config.yml` allowed, folder path does not match a same-named file elsewhere, bare name keeps lookup, line reveals and sets the cursor · src/features/spec-viewer/__tests__/messageHandlers.test.ts

### Implementation

**⟶ Wait for the tests, then Wave 1 — independent (different files):**

- [x] **T005** [P] [US1] Chip accepts `path:line` / `path:from-to` and sets a validated `data-line` · webview/src/spec-viewer/markdown/inline.ts
- [x] **T006** [P] [US1] Add optional `line` to the `openFile` message · src/protocol/viewer.ts
- [x] **T007** [P] [US1] Rewrite `handleOpenFile`: confine with the exact `path.relative` rule, resolve folder paths against project root then spec folder, keep bare-name lookup, reveal the line · src/features/spec-viewer/messageHandlers.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T008** [US1] Click handler posts `line` from `data-line` · webview/src/spec-viewer/actions.ts

**Checkpoint**: a chip with a folder path and a line opens the named file at that line, inside the project.

## Phase 4: User Story 2 - Fence bodies are left alone (P2)

Files: `webview/src/spec-viewer/markdown/preprocessors.ts`, `webview/src/spec-viewer/markdown/__tests__/preprocessors.test.ts`

**Wave 1 — one owner:**

- [x] **T009** [US2] Failing tests: `**Note:**`, `## Phase 1`, `### User Story 1` and an HTML comment inside a fence untouched, same text outside unchanged, fence-free output identical, line mapping stable · webview/src/spec-viewer/markdown/__tests__/preprocessors.test.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T010** [US2] Run `preprocessCallouts`, `preprocessHtmlComments`, `preprocessUserStories`, `preprocessTaskPhases` through `mapOutsideFences` · webview/src/spec-viewer/markdown/preprocessors.ts

**Checkpoint**: fenced text renders as written; unfenced output is unchanged.

## Phase 5: User Story 3 - The fence line is kept and block names registered (P3)

Files: `webview/src/spec-viewer/markdown/blockFences.ts`, `webview/src/spec-viewer/markdown/renderer.ts`, `webview/src/spec-viewer/markdown/__tests__/renderer.test.ts`

**Wave 1 — one owner:**

- [x] **T011** [US3] Failing renderer tests in the exact-attribute style: plain code block for `calls`/`states`/`screen`, title and options never reach attributes, injection through the info string, registered renderer used, throwing or empty renderer falls back, registry runs before the tree check · webview/src/spec-viewer/markdown/__tests__/renderer.test.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T012** [US3] Add the registry with the three names, an empty renderer map and a safe dispatch · webview/src/spec-viewer/markdown/blockFences.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T013** [US3] Use `parseFenceInfo` in the fence loop and dispatch the registry before the tree check · webview/src/spec-viewer/markdown/renderer.ts

**Checkpoint**: nothing changes on screen; the seam is in place.

## Phase 6: Polish

**Wave 1 — one owner:**

- [x] **T014** Run `npm run canvas:build` and keep the rebuilt files under `apps/copilot-canvas/vendor` · apps/copilot-canvas/vendor
- [x] **T015** Add one Fixed line under Unreleased in the house voice with the `spec-viewer` area tag; no version bump · CHANGELOG.md
- [x] **T016** Validate against the Success Criteria with `npx tsc -p ./ --noEmit` and `npm test` · apps/vscode

## Dependencies & Execution Order

Foundational blocks all stories. US1 does not use the helper but shares the phase order. US2 needs T002. US3 needs T002. T008 waits for T005 to T007. T013 waits for T012. Polish runs last.
