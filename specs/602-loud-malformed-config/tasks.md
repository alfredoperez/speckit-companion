# Tasks: A companion config the reader cannot handle fails loudly

**Feature**: `602-loud-malformed-config` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Two files carry the change: the reader at `speckit-extension/scripts/companion_config.py` and its suite at `speckit-extension/tests/test_config.py`, plus a changelog entry. Because both stories land in the same two files, the tests come first in each story so each one is proven to fail against the current reader before the reader changes.

## Phase 1: Setup

No setup. The reader and its suite already exist and already run in CI.

## Phase 2: Foundational

Blocks every story: the reader cannot name a line it does not know the number of, and cannot detect anything before there is a place to put the detection.

**Wave 1 — single task:**

- [x] **T001** Carry each retained line's original 1-based file number alongside its text through the reader, so a rejection can name the line the user sees, and blank/comment lines still do not reach the parser · `speckit-extension/scripts/companion_config.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T002** Add the single line-shape guard the parser consults for every retained line, raising `line <n>: <reason>` and leaving inline flow values and quoted values untouched · `speckit-extension/scripts/companion_config.py`

## Phase 3: User Story 1 — anchors and aliases are reported (Priority: P1)

**Goal**: The exact config from the issue yields one malformed warning and shipped defaults, never a partially-applied config.

**Independent Test**: Load the issue's config through the loader and assert the shipped defaults plus one warning naming the line.

### Tests

**Wave 1 — independent (different concerns, same file, written before the reader changes):**

- [x] **T003** [US1] Add a test whose fixture is the issue's reproduction verbatim, asserting the loader returns shipped defaults and exactly one malformed warning · `speckit-extension/tests/test_config.py`
- [x] **T004** [US1] Add a test that the same fixture applies nothing at all — no command survives from above the anchor · `speckit-extension/tests/test_config.py`
- [x] **T005** [US1] Add a test that an anchor on the file's last line, with nothing after it to look wrong, is still rejected · `speckit-extension/tests/test_config.py`
- [x] **T006** [US1] Add a test that a bare alias in a value position is rejected · `speckit-extension/tests/test_config.py`
- [x] **T007** [US1] Add a test that the reported reason names the line number · `speckit-extension/tests/test_config.py`

**⟶ Wait for the tests to be red, then:**

### Implementation

- [x] **T008** [US1] Teach the guard to reject a key or unquoted value whose first token begins with `&` or `*` · `speckit-extension/scripts/companion_config.py`

**Checkpoint**: The issue's config now fails loudly. Story 1 is independently functional and testable.

## Phase 4: User Story 2 — every other unreadable shape fails the same way (Priority: P1)

**Goal**: Tab indentation, block scalars, document separators, and any file the parser does not finish reading all reach the same single-warning outcome.

**Independent Test**: Load one config per shape and assert each yields shipped defaults plus one warning.

### Tests

**Wave 1 — independent (one shape each):**

- [x] **T009** [US2] Add a test that a config indented with tabs is rejected rather than collapsed to the top level · `speckit-extension/tests/test_config.py`
- [x] **T010** [US2] Add a test that a block scalar value is rejected rather than read as its indicator · `speckit-extension/tests/test_config.py`
- [x] **T011** [US2] Add a test pinning the already-present rejection of a document separator · `speckit-extension/tests/test_config.py`
- [x] **T012** [US2] Add a test that a file the parser stops short of finishing is rejected, naming the first unread line · `speckit-extension/tests/test_config.py`

**⟶ Wait for the tests to be red, then:**

### Implementation

**Wave 2 — independent (different checks):**

- [x] **T013** [P] [US2] Teach the guard to reject a tab character in a line's leading whitespace · `speckit-extension/scripts/companion_config.py`
- [x] **T014** [P] [US2] Teach the guard to reject an unquoted value that is exactly a block-scalar indicator, with its optional chomping marker or indentation digit · `speckit-extension/scripts/companion_config.py`

**⟶ Wait for Wave 2 to finish, then:**

- [x] **T015** [US2] Reject any file the parser did not read to its last line, naming that line — the general guarantee that no partial config is ever returned · `speckit-extension/scripts/companion_config.py`

**Checkpoint**: All four shapes plus the general case fail loudly. Story 2 is independently functional and testable.

## Phase 5: User Story 3 — configs that work today keep working (Priority: P1)

**Goal**: Nothing currently accepted is narrowed, proven against this repository's own config.

**Independent Test**: Load this repository's `.specify/companion.yml` and assert zero warnings and the same resolved hooks.

### Tests

**Wave 1 — independent (different guarantees):**

- [x] **T016** [P] [US3] Add a regression test loading this repository's own `.specify/companion.yml`, asserting no warnings and 6 resolved hooks for implement and 1 each for specify, plan, and tasks · `speckit-extension/tests/test_config.py`
- [x] **T017** [P] [US3] Add a test that values merely containing the marker characters — a shell command joining two parts, a redirect, a quoted glob — still parse as ordinary values · `speckit-extension/tests/test_config.py`
- [x] **T018** [P] [US3] Add a test that a marker inside a comment or inside a quoted value does not cause a rejection · `speckit-extension/tests/test_config.py`

**Checkpoint**: The change is proven to widen reporting without narrowing acceptance. Story 3 is independently verified.

## Phase 6: Polish

**Wave 1 — independent (different files):**

- [x] **T019** [P] Add the user-facing entry under `## [Unreleased]`, in release-notes voice with no internal file or symbol names · `speckit-extension/CHANGELOG.md`
- [x] **T020** [P] Confirm the module's own failure-table docstring still describes the reader's behavior accurately · `speckit-extension/scripts/companion_config.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T021** Validate against the Success Criteria: run the Python suite, the TypeScript suite, and every repository gate, and confirm each new test fails against the pre-fix reader for the defect's own reason

## Dependencies & Execution Order

Phase 2 (Foundational) blocks everything: T001 gives the reader line identity, T002 gives it the single place detection lives. Phase 3, 4, and 5 all edit those same two files, so they run in order rather than concurrently; within each phase the tests are written first and confirmed red, then the reader change makes them green. Phase 6 runs last and validates the whole against the Success Criteria.

Wave summary: Foundational T001 → T002. Story 1: tests T003–T007 → T008. Story 2: tests T009–T012 → T013/T014 in parallel → T015. Story 3: T016–T018 in parallel, no implementation of its own — it is the proof the earlier phases did not narrow anything. Polish: T019/T020 in parallel → T021.
