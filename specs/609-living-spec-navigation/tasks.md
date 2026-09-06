# Tasks: Reach one requirement, from anywhere

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Size**: oversized

## Scale note

24 tasks across four areas that barely touch: Python under `speckit-extension/scripts/`, a command body plus its registration, TypeScript in `src/features/` and `webview/`, and docs. Two things to watch. First, `.specify/extensions/companion/` is generated and gitignored — every Python edit goes in `speckit-extension/scripts/` and reaches the local copy through `/install-local`, never the other way round. Second, requirement headings are parsed twice, in `resolve-spec-paths.py` and in `livingSpecsModel.ts`, pinned against `speckit-extension/tests/fixtures/requirement-slices/`; every reader added here goes through one of those two, never a third regex.

---

## Phase 1: Foundational

Two independent seams that the stories build on. Nothing else may start until both land.

**Wave 1 — independent (different files):**

- [x] **T001** [P] Normalize an optional `rules` block to `{"spec": [str], "plan": [str]}` in `load_living_specs_block`, always present after normalization, unknown step keys dropped with a warning, non-list values coerced to empty · speckit-extension/scripts/companion_config.py
- [x] **T002** [P] Add a shared capability lookup that resolves a capability by name to its spec path and text, returning a distinct "registered but no spec on disk" outcome rather than an empty slice list · speckit-extension/scripts/resolve-spec-paths.py

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** Cover the rules normalizer: absent, empty, non-mapping, unknown step key, non-list step value · speckit-extension/tests/test_config.py

---

## Phase 2: User Story 1 — Read one requirement without opening the file (P1)

**Goal**: A person or a command body can print one capability's headings, one named requirement, or the requirements describing one file.

**Independent Test**: With living specs configured, ask for a capability's headings, then one of those headings, then a source file, and get exactly those slices.

### Tests

- [x] **T004** Write the failing tests for the three modes and every degraded case in the contract — disabled, unknown capability, capability with no spec file, no-match name (headings listed back), ambiguous name (candidates listed), file matching nothing — all exiting 0 · speckit-extension/tests/test_living_show.py

### Implementation

**Wave 2 — independent (different files):**

- [x] **T005** [P] Add `--headings`, `--requirement <name>` and `--file <path>` modes to the resolver's CLI, each honouring `--json`, built on `requirement_slices` and `requirements_for_change` so the count matches `requirementIds()` · speckit-extension/scripts/resolve-spec-paths.py
- [x] **T006** [P] Write the `living-show` command body — read-only, opt-in, never halts, prints what the script returns and nothing more · speckit-extension/commands/speckit.companion.living-show.md

**⟶ Wait for Wave 2 to finish, then:**

- [x] **T007** Register the command with its one-line description · speckit-extension/extension.yml
- [x] **T008** Verify the printed requirement count equals `requirementIds()`'s count for every capability in this repo, as a test over the real registry · speckit-extension/tests/test_living_show.py

**Checkpoint**: `living-show` works end to end from the terminal, independently of the other two stories.

---

## Phase 3: User Story 2 — Write the house rule once (P1)

**Goal**: Guidance written once in `living-specs.yml` reaches the spec step and the plan step, each seeing only its own.

**Independent Test**: Add one spec rule and one plan rule, run specify and confirm only the spec rule arrived, then run plan and confirm the reverse.

### Tests

- [x] **T009** Write the failing tests for the resolver's rules output: present, absent, malformed registry, and step isolation · speckit-extension/tests/test_resolve_spec_paths.py

### Implementation

**Wave 3 — independent (different files):**

- [x] **T010** [P] Emit the normalized rules on a `--rules` flag and inside the `--requirements-for --json` envelope · speckit-extension/scripts/resolve-spec-paths.py
- [x] **T011** [P] Teach the specify load node to read `rules.spec` from the resolver call it already makes and treat the lines as instructions, silently skipping when there are none · speckit-extension/nodes/specify/load-living-specs.md
- [x] **T012** [P] Teach the plan context node to read `rules.plan` the same way · speckit-extension/nodes/plan/gather-context.md

**⟶ Wait for Wave 3 to finish, then:**

- [x] **T013** Record the rules that applied alongside `livingSpecs.loaded`, so a run's Overview can say what guidance it was given · speckit-extension/scripts/record-living-specs.py
- [x] **T014** Rebuild the command bodies from the edited nodes and re-freeze the shape parity baseline deliberately · speckit-extension/scripts/build-commands.py
- [x] **T015** Add a `rules:` block to this repo's own registry with one real spec rule and one real plan rule, so the feature is exercised by its own project · living-specs.yml

**Checkpoint**: A house rule written once reaches both steps, and a registry without one behaves exactly as before.

---

## Phase 4: User Story 3 — See which rules describe the file you are editing (P2)

**Goal**: The editor shows how many living specs claim the active file, and one click reaches the requirement that describes it.

**Independent Test**: Open a claimed file, see the count, click it, pick a requirement, land on that requirement in the viewer.

### Tests

- [x] **T016** Write the failing tests for claim resolution: two claiming capabilities ordered most-specific first, an exempt file, an excluded file, an unmarked spec (capability claims, no requirements listed), a file outside the workspace · src/features/specs/__tests__/livingSpecsModel.test.ts

### Implementation

**Wave 4 — independent (different files):**

- [x] **T017** [P] Add a claim resolver that maps a workspace-relative path to the capabilities claiming it and, per capability, the requirements whose marker matches, reusing `readLivingSpecs`, `globMatches` and `requirementSlices` · src/features/specs/livingSpecsModel.ts
- [x] **T018** [P] Carry an optional `requirement` heading through `speckit.viewSpecDocument` to the webview, and bring the matching requirement card into view, opening at the top when the heading matches nothing · src/features/spec-viewer/specViewerCommands.ts, webview/src/spec-viewer/toc.ts

**⟶ Wait for Wave 4 to finish, then:**

- [x] **T019** Add the status bar item and its quick-pick — visible only when the count is one or more and living specs are on, refreshed on active-editor change, computed in-process with no dispatch · src/features/specs/livingSpecsStatusBar.ts
- [x] **T020** Register the picker command and the status bar item's lifecycle · src/features/specs/livingSpecsCommands.ts, package.json
- [x] **T021** Cover the picker's shape and the hidden cases · src/features/specs/__tests__/livingSpecsStatusBar.test.ts

**Checkpoint**: A developer reaches a requirement from the file it describes without leaving the editor.

---

## Phase 5: User Story 4 — Know which "living spec" is meant (P3)

- [x] **T022** Open the living specs reference by naming both meanings of the phrase — spec-kit's and ours — before any mechanism, document the `living-show` flags and the `rules:` block, and record whether `/speckit.converge` ships in the pinned spec-kit version along with any overlap with the doctor command · speckit-extension/docs/living-specs.md, speckit-extension/docs/commands.md
- [x] **T023** Note the new command, the rules block and the editor lookup under `## [Unreleased]`, in release-notes voice with no file or symbol names, and update the README living specs section · speckit-extension/CHANGELOG.md, CHANGELOG.md, README.md

---

## Phase 6: Polish

- [x] **T024** Run the Python and TypeScript suites and the lint pass, and check each Success Criterion in `spec.md` against the result · speckit-extension/tests, src, webview

---

## Dependencies & Execution Order

Foundational → the three story phases → docs → Polish.

- **Phase 1** blocks everything. Wave 1 is two independent files (`companion_config.py`, `resolve-spec-paths.py`); T003 waits on T001.
- **Phase 2** (US1) needs T002. Wave 2 is the resolver modes and the command body, independent of each other; T007 and T008 wait on both.
- **Phase 3** (US2) needs T001. Wave 3 is the resolver output and the two node bodies, all independent; T013–T015 wait on the wave, and T014 must follow T011 and T012 because it rebuilds from them.
- **Phase 4** (US3) depends on nothing outside itself. Wave 4 is the model and the viewer plumbing; T019–T021 wait on both.
- **Phases 2, 3 and 4 are independent of each other** and can be built in any order once Phase 1 is done.
- **Phase 5** waits on all three stories, since it documents them.
- **Phase 6** is last.
