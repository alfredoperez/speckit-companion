# Tasks: Ship every runtime script the commands call

**Feature**: `395-package-runtime-scripts` | **Issue**: #432 | **Size**: `normal`
**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/package-manifest-cli.md](./contracts/package-manifest-cli.md)

Line format: `- [ ] **T###** [P?] [US#] Description · exact/file/path`. `[P]` = independent of the other tasks in its wave.

## Phase 1: Setup

No setup phase. The scripts, the test harness, and the CI job all already exist — this change adds one script and edits existing files. There is no scaffolding, dependency, or tooling prerequisite to stand up first.

## Phase 2: Foundational (blocks every story)

The packing list is the single thing all three stories read. Nothing else can start until it exists.

**Wave 1 — single task:**

- [x] **T001** Create the packing list and its gate · `speckit-extension/scripts/package-manifest.py`
  Declare `RUNTIME_SCRIPTS` (the 8 from the spec's Verbatim Constraints) and `BUILD_ONLY` (the 5, plus this script itself). Implement `derive_closure()` — scan every command file declared under `provides.commands` in `extension.yml` plus shipped `workflows/` for the `.specify/extensions/companion/scripts/<name>.py` anchor to get the roots, then walk each script's sibling references to a fixed point, handling all three forms (plain import, `import_module("hyphen-name")`, `spec_from_file_location(…, "…/name.py")`), discarding candidates that don't match a file in `scripts/`, with a `visited` set so a cycle terminates. Implement `check()` returning a list of human-readable problems (needed-but-not-packaged / packaged-but-unreachable / unclassified / declared-but-absent), and the `--check`, `--copy-to <dir>`, `--list` CLI per the contract. `--copy-to` must run the check first and refuse to copy on failure. Stdlib only. (FR-001, FR-002, FR-003, FR-004, FR-005, FR-006)

**⟶ Wait for Wave 1 to finish, then the story phases can proceed.**

---

## Phase 3: User Story 1 — A released extension's commands actually run (P1)

**Goal**: The release archive carries every helper a shipped command invokes, so `adopt` / `drift` / `coverage` run end to end from a clean install and `specify` / `plan` regain their living-spec context.

**Independent Test**: Build an archive from the new step, install it in a scratch project, run each previously-broken script against a real spec dir. None aborts for a missing sibling.

### Implementation

**Wave 2 — single task (proves the derivation is right before anything is built from it):**

- [x] **T002** Run `--check` against the real repo and confirm it passes, reporting the closure as exactly the 8 declared scripts · `speckit-extension/scripts/package-manifest.py`
  A pass here means the scanner independently rediscovered the closure the spec pinned. If it names fewer than 8, the scanner is missing a reference form — fix the scanner, never the assertion. (FR-001, FR-006)

**⟶ Wait for T002, then:**

**Wave 3 — single task:**

- [x] **T003** Build a real archive with `--copy-to` into a scratch dir and assert its contents · `speckit-extension/scripts/package-manifest.py`
  All 8 runtime scripts present; all 5 build-only scripts absent; no docs, examples, or test files. This is the concrete artifact the bug is about. (FR-001, FR-002)

**⟶ Wait for T003, then:**

**Wave 4 — single task:**

- [x] **T004** Install the built archive into a scratch project and execute the previously-broken scripts against a real spec dir · scratch install of `companion-<ver>/scripts/`
  Run `register-capability.py`, `drift.py`, `check-coverage.py`, and `resolve-spec-paths.py`. Each must execute and produce output — not `ImportError`/`FileNotFoundError` on a missing sibling. This is the end-to-end reproduction of #432, now passing. (FR-001, SC-001)

**Checkpoint**: The reported defect is fixed and demonstrated. A user installing from an archive built this way can run every shipped command.

---

## Phase 4: User Story 2 — The packing list can never quietly fall behind again (P1)

**Goal**: A disagreement between the commands and the packing list fails the build, loudly and by name, before it can reach a release.

**Independent Test**: Introduce each kind of drift in turn and watch the gate catch it and name the offender.

### Implementation

**Wave 5 — independent (different files):**

- [x] **T005** [P] [US2] Add the packaging gate as a unit test · `speckit-extension/tests/test_packaging.py`
  Stdlib `unittest`, importing `package-manifest.py` by file path (the established idiom for hyphenated scripts here). Assert `check()` is empty on the real repo; assert `derive_closure()` equals `RUNTIME_SCRIPTS`; assert `RUNTIME_SCRIPTS` and `BUILD_ONLY` are disjoint and together account for every `scripts/*.py`; assert every declared script exists on disk. Picked up automatically by the existing `unittest discover`. (FR-004, FR-005, FR-007)
- [x] **T006** [P] [US2] Add an explicit packaging-gate step to the CI `capture-suite` job · `.github/workflows/ci.yml`
  Place it beside the existing `check-shape-parity.py` and `assemble-nodes.py --check` steps so a packaging break reads as a packaging break in the CI log. (FR-007)

**⟶ Wait for Wave 5 to finish, then:**

**Wave 6 — single task (the gate must be proven to bite, not just to pass):**

- [x] **T007** [US2] Prove the gate fails on real drift, in both directions, then revert every probe · `speckit-extension/scripts/package-manifest.py`
  (a) Temporarily point a shipped command body at a script that isn't on the packing list → `--check` must exit 1 and **name** it as needed-but-not-packaged. (b) Temporarily add an entry to `RUNTIME_SCRIPTS` that nothing reaches → `--check` must exit 1 and **name** it as packaged-but-unreachable. Revert both probes and confirm the check returns to green. A gate that has only ever been observed passing is not known to work. (FR-004, FR-005, SC-005)

**Checkpoint**: The defect class is closed. A future command that grows a new dependency cannot be released un-packaged.

---

## Phase 5: User Story 3 — The publish flow reads the packing list instead of restating it (P2)

**Goal**: The archive and the gate agree by construction — there is no second copy of the file list left to drift.

**Independent Test**: Read the publish instructions; find no hand-written list of scripts. Run the archive step; get exactly the packing list.

### Implementation

**Wave 7 — independent (different files):**

- [x] **T008** [P] [US3] Repoint the publish doc's archive step at `--copy-to`, deleting the hand-typed `cp scripts/…` line and the prose that enumerates which scripts ship · `speckit-extension/docs/publishing.md`
  Keep the allow-list *principle* (and the standing warning against reverting to a `tar --exclude` deny-list); remove only the hand-maintained enumeration, which is now the script's job. (FR-003, FR-008)
- [x] **T009** [P] [US3] Repoint the publish command's step 5 at `--copy-to`, deleting its duplicate `cp scripts/…` line · `.claude/commands/publish-speckit-ext.md` (FR-003, FR-008)

**Checkpoint**: The list is stated in exactly one place. Both consumers read it.

---

## Phase 6: Polish

**Wave 8 — independent (different files):**

- [x] **T010** [P] Bump the extension version `0.18.0` → `0.18.1` · `speckit-extension/extension.yml` (FR-009)
- [x] **T011** [P] Add the release-notes entry · `speckit-extension/CHANGELOG.md`
  User-facing voice: the adopt / drift / coverage commands now run from a released install, and specify / plan regain their living-spec context. Name the commands, not the scripts or the scanner. (FR-009)
- [x] **T012** [P] Document what the release archive carries · `speckit-extension/README.md` (FR-009)

**⟶ Wait for Wave 8 to finish, then:**

**Wave 9 — single task:**

- [x] **T013** Run the full verification suite green · repo root
  `npm run compile && npm test`; `python3 speckit-extension/scripts/check-shape-parity.py`; `python3 speckit-extension/scripts/assemble-nodes.py --check`; `python3 -m unittest discover -s speckit-extension/tests -p "test_*.py"`. The two parity gates must still pass untouched — no command body text changed. (FR-010, SC-005)

**⟶ Wait for T013, then:**

**Wave 10 — single task:**

- [x] **T014** Confirm the scope fence held · repo root
  `git status` shows no change to the root `README.md`, `CHANGELOG.md`, or `package.json`, and no regenerated `.specify/` artifacts are staged (`git checkout origin/main -- .specify/` if any appear). Verify the spec's `.spec-context.json` carries the real spec name and every task is checked. (FR-009)

---

## Dependencies & Execution Order

**Phases**: Foundational (T001) → US1 (T002 → T003 → T004) → US2 (T005/T006 → T007) → US3 (T008/T009) → Polish (T010–T012 → T013 → T014).

- **T001 blocks everything.** It is the packing list; no story can read a list that does not exist.
- **US1 is strictly serial** (T002 → T003 → T004): each step consumes the previous one's artifact — you cannot build an archive from an unverified list, or install an archive you have not built.
- **US2's Wave 5 is parallel** (T005 and T006 touch different files), then **T007 joins** — the negative probes need the gate wired before they can prove it bites.
- **US3's two tasks are parallel** (two different documents), and depend only on T001, so US3 may run alongside US2.
- **Polish's Wave 8 is parallel** (three different files), then T013 validates everything and T014 checks the fence. T013 must run last among the substantive tasks, since it validates their combined result.

**Parallel opportunities**: T005+T006; T008+T009; T010+T011+T012. US2 and US3 are independent of each other once T001 lands.
