# Tasks: Check the requirements by default above small size

## Phase 1: Setup

None.

## Phase 2: Foundational

None: each story owns its own files.

## Phase 3: User Story 1 - The default implement checks the requirements (Priority: P1)

Files: apps/speckit-extension/nodes/implement/_order.yml, apps/speckit-extension/nodes/implement/check-requirements.md, apps/speckit-extension/tests/test_requirements_check.py

**Goal**: every implement above simple size runs the requirements check between the build and the verified record.

**Independent Test**: the built implement command carries the check after implement-exec and before record-verified, opening with the size gate.

### Tests

**Wave 1 — independent:**
- [x] **T001** [US1] Test the built implement command: the check sits after implement-exec and before record-verified (FR-001), opens with the skip-at-simple, missing-counts-as-normal gate (FR-002), carries no stop-and-ask wording and has the no-subagent fallback (FR-003); and implement's add-ons are only verify-manually (FR-005) · apps/speckit-extension/tests/test_requirements_check.py

### Implementation

**Wave 1 — independent (different files):**
- [x] **T002** [P] [US1] Put check-requirements in `order:` and the execute phase between implement-exec and record-verified; remove it from `optional:` · apps/speckit-extension/nodes/implement/_order.yml
- [x] **T003** [P] [US1] Number the node 6a, open it with the size gate, and add the inline fallback for hosts without subagents · apps/speckit-extension/nodes/implement/check-requirements.md

**Checkpoint**: the default implement checks requirements above simple size.

## Phase 4: User Story 2 - Brownfield gets the check (Priority: P2)

Files: apps/speckit-extension/workflows/presets/brownfield.yml, apps/speckit-extension/tests/test_presets.py (one new case beside the other brownfield cases)

### Tests

**Wave 1 — independent:**
- [x] **T004** [US2] Test that a project seeded from brownfield builds implement with the check after implement-exec and before record-verified (FR-004) · apps/speckit-extension/tests/test_presets.py

### Implementation

**Wave 1 — independent:**
- [x] **T005** [US2] Add check-requirements after implement-exec in brownfield's implement nodes and execute phase · apps/speckit-extension/workflows/presets/brownfield.yml

**Checkpoint**: brownfield checks the requirements too.

## Phase 5: Polish

**Wave 1 — independent (different files):**
- [x] **T006** [P] Rebuild the commands; `build.py --check` passes (FR-006) · apps/speckit-extension/commands/speckit.companion.implement.md
- [x] **T007** [P] Describe the check in the Implement section (FR-006) · apps/website/src/content/docs/docs/steps/index.mdx
- [x] **T008** [P] Add the check to the implement row of the node table · apps/speckit-extension/docs/node-model.md
- [x] **T009** [P] Add one `[Unreleased]` Changed line (FR-006) · apps/speckit-extension/CHANGELOG.md

**⟶ Wait for Wave 1 to finish, then:**
- [x] **T010** Validate SC-001 to SC-003: the extension suite, `build.py --check`, `check_shape_parity.py` and the changelog consistency test · apps/speckit-extension/tests

## Dependencies & Execution Order

- Phases 3 and 4 own disjoint files. Each writes its test first.
- The tests read the built command, so they pass only after T006.
- Polish: T006 to T009 in one wave, then T010.
