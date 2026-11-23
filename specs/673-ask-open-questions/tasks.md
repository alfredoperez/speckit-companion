# Tasks: Ask a spec's open questions before plan

## Phase 1: Setup

None: the change edits existing node files and adds tests beside the existing ones.

## Phase 2: Foundational

None: no shared code. Each story owns its own node files.

## Phase 3: User Stories 1 and 2 - Ask when attended, assume and record when unattended (Priority: P1)

Both stories change the same two checklist nodes, so they ship as one phase.

Files: apps/speckit-extension/nodes/specify/quality-checklist.md, apps/speckit-extension/nodes/specify/quality-checklist-blocking.md, apps/speckit-extension/tests/test_open_questions.py

**Goal**: remaining open questions are asked once in an attended run, and assumed with one concern each in an unattended run.

**Independent Test**: the built specify command carries the ask, the decision call keyed by question, the no-marker pass-through and the unattended rule, and a clean spec's path is unchanged.

### Tests

**Wave 1 — independent:**
- [x] **T001** [US1] [US2] Test that the built specify command asks remaining markers as one numbered table with options only when markers remain (FR-001, FR-003), records each answer as a `spec-question-<n>` decision by `you` (FR-002), and in an unattended run assumes a default under Assumptions and records one concern per question instead of pausing, in both the default and blocking nodes (FR-004) · apps/speckit-extension/tests/test_open_questions.py

### Implementation

**Wave 1 — independent (different files):**
- [x] **T002** [P] [US1] [US2] Replace "no option tables / leave for clarify" with: ask remaining markers as one table, record each answer as a decision, fold it into the spec; when unattended (from the prompt or `.spec-context.json`), assume a default under Assumptions and record one concern per question · apps/speckit-extension/nodes/specify/quality-checklist.md
- [x] **T003** [P] [US2] Add the unattended branch and drop the stale "advisory checklist defers to clarify" line · apps/speckit-extension/nodes/specify/quality-checklist-blocking.md

**Checkpoint**: the checklist nodes ask or assume; T001 passes after the rebuild in Polish.

## Phase 4: User Story 3 - Non-goals, change-level rules and a verification plan (Priority: P2)

Files: apps/speckit-extension/nodes/specify/draft-spec.md, apps/speckit-extension/nodes/specify/draft-spec-bugfix.md, apps/speckit-extension/nodes/specify/finalize.md, apps/speckit-extension/tests/test_spec_sections.py

**Goal**: every new spec says what it leaves out, any change-only rules, and how it will be proven.

**Independent Test**: the built specify command lists the three sections, allows "None", and records the Non-goals section as non-goals.

### Tests

**Wave 1 — independent:**
- [x] **T004** [US3] Test that the built specify command lists Non-goals, Change-level rules and Verification plan and allows "None" (FR-005), that the bugfix variant lists Non-goals and Verification plan, and that finalize records the Non-goals section as `expectations` and nothing for "None" (FR-006) · apps/speckit-extension/tests/test_spec_sections.py

### Implementation

**Wave 1 — independent (different files):**
- [x] **T005** [P] [US3] Add the three sections to step 2 and reword step 3 so a section that applies but has nothing says "None" · apps/speckit-extension/nodes/specify/draft-spec.md
- [x] **T006** [P] [US3] Add Non-goals and Verification plan to the bug spec sections · apps/speckit-extension/nodes/specify/draft-spec-bugfix.md
- [x] **T007** [P] [US3] Point `expectations` at the Non-goals section, record nothing for "None", and drop "the four sections only" · apps/speckit-extension/nodes/specify/finalize.md

**Checkpoint**: new specs carry the sections; T004 passes after the rebuild in Polish.

## Phase 5: Polish

**Wave 1 — independent (different files):**
- [x] **T008** [P] Rebuild the assembled commands and commit the output; `build.py --check` passes (FR-007) · apps/speckit-extension/commands/speckit.companion.specify.md
- [x] **T009** [P] Rewrite the Specify section's open-question paragraph and add the new sections; add the unattended rule to the Auto section and keep its bullet count true (FR-008) · apps/website/src/content/docs/docs/steps/index.mdx
- [x] **T010** [P] Add one `[Unreleased]` line under Changed (FR-008) · apps/speckit-extension/CHANGELOG.md

**⟶ Wait for Wave 1 to finish, then:**
- [x] **T011** Validate against SC-001 to SC-004: the speckit-extension test suite, `build.py --check`, `check_shape_parity.py`, the instruction budget, and the changelog consistency test · apps/speckit-extension/tests

## Dependencies & Execution Order

- Setup and Foundational are empty. Phases 3 and 4 own disjoint files and can run in either order or together.
- Phase 3: T001 is written first and fails until T002, T003 and the rebuild (T008) land.
- Phase 4: T004 first; T005, T006, T007 in one wave.
- Polish: T008, T009, T010 in one wave, then T011.
