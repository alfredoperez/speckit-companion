# Tasks: Stock-mode capture — bundled writer + enriched prompts

**Feature**: 391-stock-capture · [spec.md](./spec.md) · [plan.md](./plan.md)

## Phase 1: Setup

- [x] **T001** Un-ignore the writer so the package ships it: add `!speckit-extension/scripts/write-context.py` after the `speckit-extension/**` exclusion · .vscodeignore

## Phase 2: Foundational

- [x] **T002** Thread `writerPath` through the pure preamble functions (`renderPreamble`, `renderLifecyclePreamble`, `renderSpecifyCreationLifecyclePreamble`, `perTaskFinishCmd`, `selfCloseCmd`, `renderLifecycleBody`) — quoted in every rendered command; slim companion branches ignore it · src/ai-providers/promptPreamble.ts

**⟶ Wait for T002 to finish, then:**

- [x] **T003** `bundledWriterPath()` in the builder: `vscode.extensions.getExtension('alfredoperez.speckit-companion')` install path joined to the script's relative path, workspace-path fallback; thread into all three render calls · src/ai-providers/promptBuilder.ts

## Phase 3: User Story 1 — Stock specs stop sticking (P1)

**Goal**: every stock-mode writer reference resolves to a shipped file; the self-contradictory prose is gone.

**Independent Test**: unit-assert stock preamble output references the bundled path (quoted) and never the bare workspace path; prose no longer claims "there is no companion extension here" while pointing at its path.

### Implementation

- [x] **T004** [US1] Correct the stock-mode prose in `selfCloseLine` and the closing-instruction blocks to the bundled-writer mechanism (drop the self-contradiction) · src/ai-providers/promptPreamble.ts *(after T002 — same file)*

**Checkpoint**: stock preambles reference only the bundled writer, coherently.

## Phase 4: User Story 2 — Stock runs fill the Activity panel (P1)

**Goal**: stock preambles instruct the compact per-step capture block (contract table).

### Implementation

- [x] **T005** [US2] Add the capture block to the stock branch: specify → intent/expectation/context/`--coverage-req --title`; plan → approach/decision/step-summary; tasks → `--coverage-req --tasks`/step-summary; implement → verified/`--coverage-req --tests`/step-summary alongside per-task journaling; all best-effort (skip silently without python3) · src/ai-providers/promptPreamble.ts *(after T004 — same file)*

**⟶ Wait for Wave above, then:**

- [x] **T006** [US1+US2] Unit tests: bundled-path reference + quoting; zero bare workspace-path occurrences in stock output; ICE capture lines present per step; companion slim output byte-identical to before · src/ai-providers/__tests__/promptBuilder.test.ts

**Checkpoint**: stock preamble contract fully unit-asserted.

## Phase 5: User Story 3 — Forced-preamble sandbox eval (P2)

### Implementation

**Wave 1 — independent (different files):**

- [x] **T007** [P] [US3] `run.mjs`: temp sandbox (git init, `specs/`, marker `.specify/`, NO companion ext), compose the real stock preamble from compiled output pointing at this repo's writer, prepend a small 2-FR feature instruction, drive the headless AI CLI, then invoke the asserter · tests/eval/stock-capture/run.mjs
- [x] **T008** [P] [US3] `assert_capture.py`: non-zero exit unless status advanced, intent non-empty, ≥1 expectation, ≥1 context, all coverage titled, all tasks journaled, ≥1 verified · tests/eval/stock-capture/assert_capture.py
- [x] **T009** [P] [US3] README: what the eval proves, prerequisites, how to run · tests/eval/stock-capture/README.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T010** [US3] Run the eval for real against the built output; fix preamble text until the asserter passes; record the transcript location · (eval run)

**Checkpoint**: a real model following the real forced preamble produces a passing context file.

## Phase 6: Polish

**Wave 1 — independent (different files):**

- [x] **T011** [P] Docs: stock-mode section of the capture model doc (bundled writer, enriched capture, eval pointer) · docs/capture-and-timing.md
- [x] **T012** [P] Root changelog entry (#408, user-facing voice) · CHANGELOG.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T013** Verify: full jest + both tsc; `npm run package` and confirm the `.vsix` contains the writer byte-identical to source; validate SC-001…SC-004 · (no new files)

## Dependencies & Execution Order

- Setup (T001) is independent; Foundational T002 → T003 blocks all stories.
- `promptPreamble.ts` serializes T002 → T004 → T005; T006 waits on T003+T005.
- US3: T007/T008/T009 parallel → T010 (needs T006-green preamble + compiled output).
- Polish: T011/T012 parallel → T013 last gate.
