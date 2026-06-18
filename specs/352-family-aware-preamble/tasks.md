# Tasks: Command-family-aware capture preamble

All edits are in one module (`src/ai-providers/promptPreamble.ts`) plus one new test file, so the implementation is a single sequential pass. The test depends on the renderer changes, so it runs last.

## Phase 1: Foundational — renderer changes

These tasks touch the same file (`promptPreamble.ts`) and build on each other, so they form one ordered wave (no parallelism within the file).

- [x] **T001** [US2] Wire `renderClosingInstruction` (stock self-close branch) to use `write-context.py --step <step> --advance --by ai` for advancing steps (specify/plan/tasks) and `--finish` for clarify/analyze. Drive the advance-vs-finish choice off a `STEP_COMPLETED_STATUS`-equivalent set so it stays in sync with the script's map. · src/ai-providers/promptPreamble.ts
- [x] **T002** [US1] Add a slim companion branch to `renderPreamble`: when `companionInstalled` is true, emit only the seed-start instruction, the next-step-start guard, and a one-line "the command body carries the full protocol" pointer — dropping the schema block, status lifecycle, shared rules, and closing-instruction prose. · src/ai-providers/promptPreamble.ts
- [x] **T003** [US3] Add the same slim/full split to `renderLifecycleBody` (which `renderSpecifyCreationLifecyclePreamble` calls), keyed off its `companionInstalled` arg, so the create-spec flow inherits the split. · src/ai-providers/promptPreamble.ts

**⟶ After the renderer changes land, then:**

## Phase 2: Tests

- [x] **T004** [US1][US2][US3] Add `tests/unit/ai-providers/promptPreamble.spec.ts`: assert a companion `renderPreamble` is slim (keeps dispatch timestamp + feature dir + next-step guard, drops schema/lifecycle/shared-rules), a stock `renderPreamble` is full and references `--advance` for plan, a stock clarify references `--finish` not `--advance`, and the create-spec body splits slim/full by `companionInstalled`. · tests/unit/ai-providers/promptPreamble.spec.ts

## Phase 3: Polish — docs

- [x] **T005** Extend the "Specify settle in stock mode (#332)" / mode-aware self-close section of `docs/capture-and-timing.md` to document the slim companion preamble vs full stock preamble split and the `--advance` modernization. · docs/capture-and-timing.md
- [x] **T006** Add a user-facing `CHANGELOG.md` entry (Unreleased) for the leaner companion-command capture text and the stock-path `--advance` status flip. · CHANGELOG.md

## Dependencies & Execution Order

Phase 1 (T001→T002→T003, sequential — same file) blocks Phase 2 (T004, the test asserts the new output) which blocks nothing; Phase 3 (T005, T006 — independent docs files, can run together) blocks nothing. Verify with `npm run compile && npm test`.
