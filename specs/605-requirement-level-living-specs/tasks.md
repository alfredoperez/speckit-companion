# Tasks: A living spec is read one requirement at a time

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Issue**: [#672](https://github.com/alfredoperez/speckit-companion/issues/672) (Wave 1 of 3) · **Size**: normal

Three stories, and they layer: the marker has to exist before a load can narrow on it, and both parsers have to agree before either the load or the outline can trust a heading. The Foundational phase is where that agreement is built, and it blocks everything.

---

## Phase 1: Setup

**Wave 1 — independent (different files):**

- [x] **T001** [P] Create the shared fixture directory with one spec fragment per parsing case: no markers, all marked, mixed, a marker inside a fenced block, a marker one line too far down, two requirements sharing a heading, a marker matching nothing, a marker matching everything the capability claims · `speckit-extension/tests/fixtures/requirement-slices/`
- [x] **T002** [P] Record the baseline for SC-001: the line count each capability's spec contributes to a load today, for the largest capability and for a typical change · `specs/605-requirement-level-living-specs/research.md`

---

## Phase 2: Foundational — the two parsers must agree before anything reads them

**Goal**: one definition of what a requirement is and what a marker says, provably identical in both runtimes.

**⟶ Wait for Wave 1 (T001) to finish, then:**

**Wave 2 — independent (different files, same fixtures):**

- [x] **T003** [P] [US2] Add `requirementSlices(specText)` beside `requirementIds()`: strip fences with the existing rule, walk `###` headings under `## Requirements`, read a `touches` marker only on the line immediately following a heading, return `{heading, touches?, body}` · `src/features/specs/livingSpecsModel.ts`
- [x] **T004** [P] [US2] Add the Python twin in the resolver: same fence rule, same heading rule, same marker position rule · `speckit-extension/scripts/resolve-spec-paths.py`

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — independent (different files):**

- [x] **T005** [P] [US2] TypeScript suite reads every fixture in the shared directory and asserts the slice for each · `src/features/specs/__tests__/livingSpecsModel.test.ts`
- [x] **T006** [P] [US2] Python suite reads the same fixtures and asserts the same slices · `speckit-extension/tests/test_resolve_spec_paths.py`

**⟶ Wait for Wave 3 to finish, then:**

- [x] **T007** [US2] The drift guard: a test asserting every fixture in the directory is exercised by both suites, so a fixture only one side reads fails the build (FR-008) · `speckit-extension/tests/test_resolve_spec_paths.py`

**Checkpoint**: both runtimes agree on what a requirement is and what a marker says, and cannot silently diverge.

---

## Phase 3: User Story 2 — a requirement says which files it describes (P1)

**Goal**: markers get written by the two commands that already produce requirements, so the information is a by-product rather than a chore.

**Independent Test**: adopt a code area, confirm each produced requirement carries a marker naming files actually read for it; change one of those files, sync, confirm the marker still covers it.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T008** [P] [US2] Adoption writes a `touches` marker on each requirement it produces, naming the files that requirement was derived from (FR-006) · `speckit-extension/commands/speckit.companion.living-adopt.md`
- [x] **T009** [P] [US2] Sync writes or widens the marker of each requirement it updates, as the union of what it named and what changed — never narrowing (FR-007) · `speckit-extension/commands/speckit.companion.living-sync.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T010** [US2] Assert the additive contract: fold-back, drift, coverage and the viewer's cards produce identical results on a spec with markers and the same spec without them (FR-001, FR-014, FR-015) · `speckit-extension/tests/test_living_specs.py`

**Checkpoint**: markers are written by normal work, and no existing behaviour changed.

---

## Phase 4: User Story 1 — a run reads only the requirements about the code it is changing (P1)

**Goal**: the load narrows, and the run records what it read.

**Independent Test**: mark one large capability's requirements, start a feature touching a single file only one requirement claims, confirm the load is the purpose plus that requirement plus every unmarked one, and that the record names it.

### Implementation

- [x] **T011** [US1] Add `--requirements-for` to the resolver: given the changed files, return per capability its `purpose`, the requirements to contribute, and `whole: true|false` — `whole` when the spec carries no marker anywhere (FR-003, FR-004) · `speckit-extension/scripts/resolve-spec-paths.py`

**⟶ Wait for T011 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T012** [P] [US1] The specify load step asks for the slice and reads it, instead of reading the whole spec (FR-003) · `speckit-extension/nodes/specify/load-living-specs.md`
- [x] **T013** [P] [US1] The plan load step does the same on its side (FR-003) · `speckit-extension/nodes/plan/gather-context.md`
- [x] **T014** [P] [US1] The recorder writes `livingSpecs.loadedRequirements` as a sibling of `livingSpecs.loaded`, leaving the existing field's shape untouched, and writes nothing for a capability loaded whole (FR-005) · `speckit-extension/scripts/record-living-specs.py`

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — independent (different files):**

- [x] **T015** [P] [US1] Resolver tests: a marked spec narrows, an unmarked spec returns `whole`, a spec whose markers all miss returns its purpose and no requirements but is still matched, unmarked requirements are always contributed (FR-002, FR-003, FR-004) · `speckit-extension/tests/test_resolve_spec_paths.py`
- [x] **T016** [P] [US1] Recorder tests: the sibling field is written, `loaded` keeps its shape, a whole-load writes no entry (FR-005) · `speckit-extension/tests/test_living_specs.py`

**⟶ Wait for Wave 3 to finish, then:**

- [x] **T017** [US1] Regenerate the frozen command bodies after the two node edits, and confirm `check-shape-parity.py` is green · `speckit-extension/tests/golden/commands/`

**Checkpoint**: a run on a marked capability reads a slice and names what it read; an unmarked capability is byte-identical to today.

---

## Phase 5: User Story 3 — a reader can find one requirement without scrolling (P2)

**Goal**: the outline, derived from the pass that already builds cards.

**Independent Test**: open a living spec with several requirements; the outline lists all of them, a known-coverage row differs from an unknown one, and clicking a row moves to it.

### Implementation

- [x] **T018** [US3] Derive the outline inside `preprocessLivingRequirements` from the headings that pass already walks, reading coverage from the same heading-keyed store the badges use, and the file count from each slice's marker (FR-009, FR-010, FR-011) · `webview/src/spec-viewer/markdown/livingComponents.ts`

**⟶ Wait for T018 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T019** [P] [US3] Style the outline: sticky beside the cards, readable at a narrow width, the ellipsis trio complete on a long heading, and coverage shown as unknown rather than zero where it is unknown · `webview/styles/spec-viewer/_living.css`
- [x] **T020** [P] [US3] Activation moves the view to the requirement, by pointer and by keyboard, and the outline is rendered in living mode only — never on a feature spec (FR-012, FR-013) · `webview/src/spec-viewer/markdown/livingComponents.ts`

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — independent (different files):**

- [x] **T021** [P] [US3] Tests: every requirement appears once in document order; a known-coverage row is distinguishable from unknown; the file count matches the marker; a feature spec renders no outline · `webview/src/spec-viewer/markdown/__tests__/livingComponents.test.ts`
- [x] **T022** [P] [US3] A story covering a living spec with markers, one without, and a long heading at a narrow width · `webview/src/spec-viewer/__stories__/`

**Checkpoint**: a reader reaches any requirement in a 400-line spec in one action.

---

## Phase 6: Polish

**Wave 1 — independent (different files):**

- [x] **T023** [P] Measure SC-001 against T002's baseline and record the real number; if it lands materially under 60%, say so on the issue rather than restating the target · `specs/605-requirement-level-living-specs/research.md`
- [x] **T024** [P] Document the marker in the living-specs reference: what it is, who writes it, that it can only narrow a load, and that an unmarked requirement is always read · `docs/` and `speckit-extension/README.md`
- [x] **T025** [P] Changelog entries in release-notes voice, on both halves: the VS Code side gains the outline, the spec-kit side gains the marker and the selective load · `CHANGELOG.md`, `speckit-extension/CHANGELOG.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T026** Validate against the Success Criteria: `npm test`, `python3 -m pytest speckit-extension/tests -q`, `check-shape-parity.py`, and a drift check reading zero · repository root

---

## Dependencies & Execution Order

**Phase order**: Setup → Foundational → US2 (markers written) → US1 (load narrows) → US3 (outline) → Polish. US2 precedes US1 because a load cannot narrow on markers nothing writes; US3 is last because it is the only story whose value does not depend on the other two.

- **Setup**: T001 and T002 are independent.
- **Foundational**: T003/T004 (the two parsers, parallel) ⟶ T005/T006 (their suites, parallel) ⟶ T007 (the drift guard, which needs both suites to exist).
- **US2**: T008/T009 (two command bodies, parallel) ⟶ T010 (the additive-contract assertion).
- **US1**: T011 (the resolver mode) ⟶ T012/T013/T014 (two node bodies and the recorder, parallel) ⟶ T015/T016 (their tests, parallel) ⟶ T017 (golden regeneration, which must see the final assembled text).
- **US3**: T018 (the derivation) ⟶ T019/T020 (styling and activation, parallel) ⟶ T021/T022 (tests and stories, parallel).
- **Polish**: T023/T024/T025 (parallel) ⟶ T026 (the single validation run, last).

T004 and T011 both edit `resolve-spec-paths.py` and are therefore never in the same wave. T018 and T020 both edit `livingComponents.ts`, likewise.
