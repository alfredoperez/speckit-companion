# Tasks: Live per-task progress and trustable step durations

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [contracts/capture-boundaries.md](./contracts/capture-boundaries.md)

- `[P]` = independent of the others in its wave (different file, no incomplete dependency)
- `[US#]` = user story from the spec

## Phase 1: Setup

*(none — no structure, config, or tooling prerequisites; the repo's build/assembly scripts already exist)*

## Phase 2: Foundational

*(none — no shared infrastructure blocks the stories; the two stories edit disjoint surfaces and Polish regenerates/validates the union)*

## Phase 3: User Story 2 — Every phase shows a real, trusted duration (P1)

**Goal**: extension-stamped plan/tasks boundaries in start→complete order; derivation reads 4-of-4 trusted.

**Independent Test**: derivation tests over a new-order history fixture read all four phases trusted; a legacy inverted fixture stays untrusted.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US2] Add script-stamped plan start (`--step plan --status planning --kind start --by extension`) as the opening action of step 1 · speckit-extension/nodes/plan/gather-context.md
- [x] **T002** [P] [US2] Add script-stamped tasks start (`--step tasks --status tasking --kind start --by extension`) as the opening action of step 1 · speckit-extension/nodes/tasks/tasks-doc.md
- [x] **T003** [P] [US2] Switch the writer call to `--kind complete` (both the bare and `--feature-dir` forms) and reword the body to say it records the completion boundary · speckit-extension/commands/speckit.companion.after-plan.md
- [x] **T004** [P] [US2] Same `--kind complete` switch and rewording · speckit-extension/commands/speckit.companion.after-tasks.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T005** [US2] Narrow the timing part's self-close set to clarify/analyze, naming why plan/tasks are now extension-closed (body start + after-hook complete; an earlier `by:ai` complete would win the idempotency race and block the hook's) · speckit-extension/presets/_parts/timing.md
- [x] **T006** [US2] Derivation tests: a new-order Companion history derives all four steps `durationTrusted` with a 4-of-4 timing summary; a legacy inverted-order history (plan complete before its extension start) stays untrusted · src/features/specs/__tests__/stepHistoryDerivation.test.ts

**Checkpoint**: boundaries land in order on every dispatch path; trust proven by tests.

## Phase 4: User Story 1 — The panel advances as each task lands (P1)

**Goal**: the main agent folds each task's finish the moment it lands; workers stay append-only.

**Independent Test**: implement-exec and the timing part instruct per-task materialize by the named MAIN agent; no per-wave fold language remains.

### Implementation

**Wave 2 — single task (same file as T005's part is already settled):**

- [x] **T007** [US1] Rewrite the per-task fold paragraph: materialize immediately after each task's finish lands, MAIN agent only, foreground, one at a time; wave-end fold becomes a backstop; keep workers append-only · speckit-extension/presets/_parts/timing.md
- [x] **T008** [US1] Rewrite steps 3–4: recording a task = append + immediate materialize by the MAIN agent (own tasks right after the append; a worker's as its result returns); the wave join keeps reconcile + backstop materialize · speckit-extension/nodes/implement/implement-exec.md

## Phase 5: User Story 3 — The instructions agree everywhere (P2)

### Implementation

**Wave 3 — single task:**

- [x] **T009** [US3] Mirror the cadence in the GUI preamble: per-task fold language in the stock implement instruction and the lifecycle body; update the slim-body parenthetical to the new closure model (hooks close plan/tasks on Companion runs) · src/ai-providers/promptPreamble.ts

## Phase 6: Polish

**Wave 4 — regenerate and validate (sequential, shared outputs):**

- [x] **T010** [Polish] Regenerate assembled bodies (`build-commands.py`, `assemble-nodes.py`), refresh the committed stock skill emissions if they carry the timing part, re-bless goldens (`capture-golden.py`), and pass `assemble-nodes.py --check` + `check-shape-parity.py` · speckit-extension/commands/, presets/companion-standard/commands/, tests/golden/commands/, .claude/skills/
- [x] **T011** [Polish] Update the capture doc: per-task fold cadence, boundary-ownership table (body start + hook complete for plan/tasks), self-close narrowed to clarify/analyze; check `speckit-extension/README.md` for cadence mentions; add the `[Unreleased]` entry · docs/capture-and-timing.md, speckit-extension/README.md, speckit-extension/CHANGELOG.md
- [x] **T012** [Polish] Full validation: `npm run compile`, `npm test`, python test suite, capture-eval static checks; fix anything red · repo-wide

## Dependencies & Execution Order

- Phase 3 → Phase 4 → Phase 5 → Phase 6 (T005/T007 edit the same part file, so US2's wave 1 lands before the timing-part rewrites; T009 mirrors the final part text; Polish regenerates from everything).
- Wave 1 (T001–T004) is the only parallel-eligible group; T005–T012 are sequential (shared files or shared regenerated outputs).
