# Tasks: One command to sync living specs from your current changes

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/living-sync.md](./contracts/living-sync.md)

## Phase 1: Setup

*(none — no structure, config, or tooling prerequisites; the change slots into existing modules)*

## Phase 2: Foundational

The `--working` derivation blocks both the sync command (US1 consumes its JSON) and the read-only mode (US2 documents it), so it lands first.

**Wave 1 — single task:**

- [x] **T001** [US2] Add the opt-in `--working` mode to the drift detector: thread `working: bool` through `compute_drift`, extend the changed-set to baseline→working-tree diff ∪ untracked (`git ls-files --others --exclude-standard`), scope the tracked-set context scan the same way, add the top-level `"working"` field to the JSON result, note working-tree inclusion in the human header, and keep the default path byte-identical (exit 0 always) · speckit-extension/scripts/drift.py

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — single task:**

- [x] **T002** [US2] Add working-mode drift tests, one per drift direction: uncommitted edit invisible by default but drifted with `--working`; untracked file drifted with `--working`; working-tree deletion drifted; exempt globs still filter in working mode; uncommitted-spec capability still skipped (counts line intact); `"working"` flag present in JSON; default-mode result object unchanged on a dirty tree · speckit-extension/tests/test_living_specs.py

## Phase 3: User Story 1 — Sync every affected living spec in one pass (P1)

**Goal**: `/speckit.companion.living-sync` groups working-tree changes by capability via the T001 derivation and applies the update-not-regenerate flow to each, then reports and leaves edits uncommitted.

**Independent Test**: in a living-specs repo with uncommitted edits in two capability areas (plus one untracked file), run the command: both specs update, clarifications survive, edits stay uncommitted, report names synced+skipped.

### Implementation

**Wave 1 — single task (needs T001's JSON contract):**

- [x] **T003** [US1] Author the sync command body: frontmatter description; python3 prerequisite check; run `drift.py --working --json`; gate on `enabled`/`checked` (opt-in, nothing-to-do exits clean); per drifted capability apply the update-not-regenerate instruction (edit `spec` path in place, keep every requirement/clarification/scenario the change doesn't invalidate, scope to that capability's `drifted[].file` list, treat deletions as removed behavior); surface skips verbatim (uncommitted-spec skips point at `/speckit.companion.living-adopt`); end with the synced/skipped report and the do-not-commit instruction; never halt the host · speckit-extension/commands/speckit.companion.living-sync.md

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T004** [P] [US1] Register `speckit.companion.living-sync` in `provides.commands` (name, file, description) — no `version` change · speckit-extension/extension.yml
- [x] **T005** [P] [US1] Re-emit dev-install agent commands so the inventory gate sees the new command (`specify extension add ./speckit-extension --dev --force`), then confirm `check-command-emissions.py` fails only on the two not-yet-written doc tables (closed by T008/T009) · (no repo file; gitignored emissions)

**Checkpoint**: the command exists, is registered, and is installable; running it in a dirty living-specs repo syncs every drifted capability.

## Phase 4: User Story 2 — Read-only drift check that sees the working tree (P2)

**Goal**: `--working` is a documented, supported mode of the drift command.

**Independent Test**: run `/speckit.companion.living-drift` docs/flow with `--working`; uncommitted changes appear; default run unchanged.

### Implementation

**Wave 1 — single task:**

- [x] **T006** [US2] Document `--working` in the drift command body: the flag's meaning (uncommitted + untracked included), the unchanged never-fails/counts contract, and the JSON `working` field; point readers at living-sync for the write path · speckit-extension/commands/speckit.companion.living-drift.md

**Checkpoint**: both drift modes documented and tested (tests from T002).

## Phase 5: User Story 3 — One-click sync from the sidebar (P3)

**Goal**: a "Sync living specs from my changes" title action on the Living Specs view dispatches the command.

**Independent Test**: click the action with the companion extension installed → the slash command reaches the AI provider; the view (and thus the action) is absent when not installed.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T007** [P] [US3] Contribute the `speckit.livingSpecs.sync` command (title `Sync living specs from my changes`, sync icon) and its `view/title` menu item on the Living Specs view at `navigation@3` · package.json
- [x] **T010** [P] [US3] Register the `speckit.livingSpecs.sync` handler dispatching `/speckit.companion.living-sync` via `executeSlashCommand` (adopt pattern, with the output-channel log line) · src/features/specs/livingSpecsCommands.ts

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T011** [P] [US3] Add the sync dispatch test (command registered, slash command + title dispatched) · src/features/specs/__tests__/livingSpecsCommands.test.ts
- [x] **T012** [P] [US3] Lock the new command title in the manifest test's title table · src/features/specs/__tests__/manifest.test.ts

**Checkpoint**: sidebar action dispatches; manifest + handler covered by tests.

## Phase 6: Polish — docs & validation

**Wave 1 — independent (different files):**

- [x] **T008** [P] Document the spec-kit half: command-table row + a "sync from your changes" subsection under Living specs (the direct-dev loop, uncommitted-by-design), and `--working` in the drift section · speckit-extension/README.md
- [x] **T009** [P] Add the `speckit.companion.living-sync` entry and families-table mention (and `--working` on the drift entry) · speckit-extension/docs/commands.md
- [x] **T013** [P] Add the `[Unreleased]` changelog entry (user voice, no internal symbols) · speckit-extension/CHANGELOG.md
- [x] **T014** [P] Update the VS Code half's docs: Living Specs paragraph in the root README mentions the sync title action; `docs/sidebar.md` title-actions line + Living Specs section gain the action · README.md + docs/sidebar.md

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — single task:**

- [x] **T015** Validate against Success Criteria: `npm run compile && npm test`; speckit-extension python suite; `check-shape-parity.py`; `check-command-emissions.py` green (T005 emissions + T008/T009 docs); a live `drift.py --working` smoke run in this repo · (verification, no new file)

## Dependencies & Execution Order

- Phase 2 → everything: T001 (the shared derivation) blocks T002, T003; T002 is its regression proof.
- US1: T003 → {T004, T005} (registration + emissions follow the body).
- US2: T006 independent of US1 after T001.
- US3: {T007, T010} → {T011, T012}; independent of US1/US2 code, ships after the command name exists (T003 defines it).
- Polish: {T008, T009, T013, T014} independent of each other; T015 last, after all.
