# Tasks: Guard the command inventory against drift, and complete the command reference

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/check-command-emissions.md](./contracts/check-command-emissions.md)

Format: `- [ ] **T###** [P?] [US#] Description · exact/file/path`

---

## Phase 1: Setup

Nothing to install or scaffold — the check joins existing tooling and an existing test sweep. No baseline task.

---

## Phase 2: Foundational (blocks every story)

The single manifest reader every downstream check depends on. Nothing else starts until this is in place.

**Wave 1 — single task (both files change together):**

- [x] **T001** Add `declared_commands()` to the shared helper, returning the ordered `(name, file)` pairs from `provides.commands`, and repoint `package-manifest.py`'s `declared_command_files()` at it so its private manifest regex is removed rather than left as a second parser · `speckit-extension/scripts/_command_parts.py`, `speckit-extension/scripts/package-manifest.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T002** Confirm the packaging gate still passes against the repointed reader, so the refactor is proven non-breaking before anything builds on it · `speckit-extension/scripts/package-manifest.py`

**Checkpoint** — one manifest reader exists and the existing gate is green on it.

---

## Phase 3: User Story 1 — Catch a renamed or removed command before it ships (P1)

**Goal** — one check that holds the installed command files, the install records, and the two documents against the manifest, and fails on any disagreement.

**Independent Test** — plant a command file under a name the manifest does not declare, run the check, confirm it fails naming that path; remove a declared command's file, confirm it fails naming that command; run on a healthy tree, confirm it passes.

### Implementation

**Wave 2 — independent (different concerns, one new file each, all built against the contract):**

- [x] **T003** [P] [US1] Create the check's skeleton — the `KNOWN_AREAS` table from the data model, the dashed/dotted name translations in both directions, and `main()` printing the success line with derived counts or the `DRIFT` block · `speckit-extension/scripts/check-command-emissions.py`
- [x] **T004** [P] [US1] Write the test module's scaffolding — load the script by filename the way `test_packaging.py` does, plus a helper that builds a synthetic install area in a temporary directory · `speckit-extension/tests/test_command_emissions.py`

**⟶ Wait for Wave 2 to finish, then build the four comparisons onto the skeleton:**

**Wave 3 — independent (four separate functions in the same new file; build in any order, they share no state):**

- [x] **T005** [P] [US1] `discover_areas()` — scan the repository root for directories holding a Companion-shaped entry, excluding `examples/`, and emit `unknown install area` for anything found that is not in `KNOWN_AREAS` · `speckit-extension/scripts/check-command-emissions.py`
- [x] **T006** [P] [US1] `check_area()` — per-area disk comparison emitting `orphan emission` with the exact path, `missing emission` for a declared command with no file, and `unresolvable entry` for a name matching no known shape · `speckit-extension/scripts/check-command-emissions.py`
- [x] **T007** [P] [US1] `check_records()` — compare the manifest against `registered_commands` per agent and against the hook registrations, emitting `stale record`, `unrecorded command`, and `stale hook` · `speckit-extension/scripts/check-command-emissions.py`
- [x] **T008** [P] [US1] `check_docs()` — assert every manifest command name appears literally in both documents, emitting `undocumented command` naming which document · `speckit-extension/scripts/check-command-emissions.py`

**⟶ Wait for Wave 3 to finish, then:**

- [x] **T009** [US1] `check()` — compose the four comparisons over the discovered areas, sort the findings for stable output, and wire the exit codes · `speckit-extension/scripts/check-command-emissions.py`

**Checkpoint** — the check runs end to end and reports this repository's stale records. US1 is functional and testable on its own.

---

## Phase 4: User Story 2 — Repair the stale install records (P1)

**Goal** — bring this repository's install records back in line with the manifest, so the check passes and the uninstall path is no longer pointed at names that do not exist.

**Independent Test** — run the check before the repair and confirm it reports the stale records; run it after and confirm it reports none.

### Implementation

**Wave 4 — independent (two different record files):**

- [x] **T010** [P] [US2] Repoint the four lifecycle hook registrations from the retired capture names to the current `after-specify` / `after-plan` / `after-tasks` / `after-implement` · `.specify/extensions.yml`
- [x] **T011** [P] [US2] Replace the eight retired command names with the current ones in `registered_commands` for every agent, preserving each list's order and the surrounding record structure · `.specify/extensions/.registry`

**Checkpoint** — the record half of the check is green; the capture hooks resolve to commands that exist.

---

## Phase 5: User Story 3 — Find every command in one place (P2)

**Goal** — both documents describe all seventeen commands, grouped by family, with the automatic ones marked and attributed to their triggering event.

**Independent Test** — compare the manifest's command list against both documents and confirm every command appears in each.

### Implementation

**Wave 5 — independent (two different documents):**

- [x] **T012** [P] [US3] Rebuild the Commands table grouped into Pipeline, Run state, Living specs, and Hooks (never invoke) — adding the missing `living-move` row, one row per command, each hook row naming its triggering event and marked as never invoked by hand · `speckit-extension/README.md`
- [x] **T013** [P] [US3] Extend the reference to cover all seventeen commands, keeping the existing hook and read-command sections and adding the pipeline, workflow, and living-specs commands · `speckit-extension/docs/commands.md`

**Checkpoint** — the documentation half of the check is green; a reader can find every command in one place.

---

## Phase 6: User Story 4 — Keep the reference honest as commands change (P3)

**Goal** — the documentation requirement is enforced by the same check, not by convention.

**Independent Test** — declare a command without documenting it and confirm the check reports which document is missing it.

### Implementation

- [x] **T014** [US4] Add the check to CI beside the existing shape-parity and packaging gates so a documentation gap fails the build · `.github/workflows/ci.yml`

**Checkpoint** — adding a command without documenting it now fails CI.

---

## Phase 7: Polish

**Wave 6 — independent (tests for separate directions, then docs):**

- [x] **T015** [P] Add a failing case per drift direction — orphan on disk, gap on disk, stale record, unrecorded command, stale hook, undocumented command, unknown install area — each asserting its specific problem string, plus a clean-tree case and an assertion that every area `discover_areas()` finds is in `KNOWN_AREAS` · `speckit-extension/tests/test_command_emissions.py`
- [x] **T016** [P] Add the `[Unreleased]` entry in user-facing voice, naming no internal files or symbols · `speckit-extension/CHANGELOG.md`

**⟶ Wait for Wave 6 to finish, then:**

- [x] **T017** Verify against the Success Criteria — run the full test sweep, the shape-parity gate, the packaging gate, the new check, and the TypeScript build and tests; confirm each drift direction fails when its production branch is reverted · repository-wide

---

## Dependencies & Execution Order

**Phase order** — Setup (empty) → Foundational → US1 → US2 → US3 → US4 → Polish.

- **Phase 2** blocks everything: T001 creates the single manifest reader, T002 proves it non-breaking.
- **Phase 3** — Wave 2 (T003, T004) is independent; both must land before Wave 3 (T005–T008), which is four independent functions built onto the skeleton; T009 composes them and waits for all four.
- **Phase 4** — Wave 4 (T010, T011) touches two different record files and is independent. It depends on Phase 3 only for the ability to verify, not to edit.
- **Phase 5** — Wave 5 (T012, T013) touches two different documents and is independent.
- **Phase 6** — T014 waits for T009, since CI must have something green to run.
- **Phase 7** — Wave 6 (T015, T016) is independent; T017 is the final gate and waits for everything.

**Parallel opportunities** — the widest wave is Wave 3 (four independent functions). Waves 4, 5, and 6 are each two independent files. Everything else is a join.
