# Tasks: Capability registrations get their own file

**Feature**: `405-capability-registry-file` | **Size**: oversized
**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/registry-location.md](./contracts/registry-location.md)

## Phase 1: Setup

**Wave 1 — single task:**

- [x] **T001** Add the registry-shaped test fixture used by the new Python tests · `speckit-extension/tests/fixtures/living-specs.yml`

---

## Phase 2: Foundational — the shared location rule

Nothing else can start until both runtimes agree on where the registry lives.

**Wave 1 — independent (different files, different runtimes):**

- [x] **T002** [P] Add the location rule to the Python config loader: `LIVING_SPECS_REL`, `LEGACY_CONFIG_REL`, `load_living_specs_block` (accepting the flattened shape and the `livingSpecs:` wrapper), `resolve_living_specs(root)` returning the normalized block plus origin/path/legacy_stale/warnings, and `is_project_root(path)` matching either file · `speckit-extension/scripts/companion_config.py`
- [x] **T003** [P] Add the same location rule to the editor-side reader: registry-first parse with legacy fallback, an inert listing on an unparseable registry, `legacyStale` on the listing, and a boundary probe matching either file · `src/features/specs/livingSpecsModel.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T004** Route the resolver through the shared rule: `load_living` keeps its signature, `load_living_with_meta` exposes origin and warnings, and `_is_project_root` delegates to the shared probe · `speckit-extension/scripts/resolve-spec-paths.py`

**Checkpoint**: both runtimes resolve the registry location identically; every downstream reader inherits it without change.

---

## Phase 3: User Story 1 — Registrations survive routine cleanup (P1)

**Goal**: a capability registered today is still registered after the routine cleanup step runs.

**Independent Test**: register a capability, run `git restore package.json package-lock.json .specify/`, confirm the capability still resolves.

### Tests

**Wave 1 — single task:**

- [x] **T005** Add the survival test: register a capability into a temporary project, run the real cleanup command against it, and assert the registration still resolves · `speckit-extension/tests/test_living_specs.py`

### Implementation

**Wave 1 — single task (T006 must land before the writers can target the new file):**

- [x] **T006** Point the registration writer at the registry: render the flattened block, splice it into an existing registry file preserving surrounding comments, create it when absent, and report `configPath: living-specs.yml` · `speckit-extension/scripts/register-capability.py`

**⟶ Wait, then:**

- [x] **T007** Point the relocation writer at the registry, reusing the registration writer's renderer and splice · `speckit-extension/scripts/relocate-capability.py`

**Checkpoint**: registering and relocating both write the registry file; the cleanup step no longer touches registrations.

---

## Phase 4: User Story 2 — Existing registrations are never stranded (P1)

**Goal**: capabilities already in the old location keep working, and move to the registry on the next write.

**Independent Test**: place capabilities only in the old location, confirm every reader sees them, register one more, confirm all now live in the registry and none remain in the old file.

### Tests

**Wave 1 — independent (different assertions, one file, written together):**

- [x] **T008** Add the migration tests: legacy-only reads resolve; a subsequent registration writes the full set to the registry and removes only the `livingSpecs` block from the old file, leaving siblings and comments intact; both-present reads prefer the registry and warn stale; an unparseable registry does not fall back · `speckit-extension/tests/test_living_specs.py`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T009** [P] Add the migrate-on-write step to the registration writer: when the answer came from the old location, strip the block from it in the same operation, report the move in plain language, and carry `migratedFrom` in the JSON result · `speckit-extension/scripts/register-capability.py`
- [x] **T010** [P] Add the same migrate-on-write step to the relocation writer · `speckit-extension/scripts/relocate-capability.py`

**Checkpoint**: no existing adopter loses a registration, and the old location empties itself the first time they touch their configuration.

---

## Phase 5: User Story 3 — The registry is obvious to find and edit by hand (P2)

**Goal**: someone can find, read, and hand-edit the registry, and everything picks it up.

**Independent Test**: hand-write a capability entry into the registry file and confirm the resolver, the sidebar, drift, and coverage all report it.

### Tests

**Wave 1 — independent (different files):**

- [x] **T011** [P] Add the hand-edit round-trip test: a hand-written flattened registry, and one using the `livingSpecs:` wrapper, both resolve identically · `speckit-extension/tests/test_living_specs.py`
- [x] **T012** [P] Add the editor-side tests: registry-first read, legacy fallback, `legacyStale` when both exist, inert listing on an unparseable registry, and boundary pruning of a nested project that has only a registry file · `src/features/specs/__tests__/livingSpecsModel.test.ts`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T013** [P] Add `living-specs.yml` to the Living Specs refresh watcher pattern · `src/extension.ts`
- [x] **T014** [P] Update the Living Specs empty-state copy to name the registry file · `src/features/specs/livingSpecsExplorerProvider.ts`

**Checkpoint**: the registry is discoverable, hand-editable, and live-refreshing in the sidebar.

---

## Phase 6: User Story 4 — A project that never adopted keeps behaving as before (P2)

**Goal**: a project with neither file notices nothing.

**Independent Test**: run every living-specs reader against a bare project and confirm silence and success.

### Tests

**Wave 1 — single task:**

- [x] **T015** Add the not-adopted test: with neither file present, the resolver, drift, and coverage each report nothing, exit successfully, and emit no warning · `speckit-extension/tests/test_living_specs.py`

**Checkpoint**: opt-in remains genuinely opt-in.

---

## Phase 7: Polish — documentation and validation

**Wave 1 — independent (different files):**

- [x] **T016** [P] Update the adoption, relocation, drift, coverage, and mark-complete command bodies to name the registry file · `speckit-extension/commands/speckit.companion.living-adopt.md`, `speckit-extension/commands/speckit.companion.living-move.md`, `speckit-extension/commands/speckit.companion.living-drift.md`, `speckit-extension/commands/speckit.companion.living-coverage.md`, `speckit-extension/commands/speckit.companion.mark-complete.md`
- [x] **T017** [P] Update the living-specs gate prose in the specify node to name the registry file · `speckit-extension/nodes/specify/load-living-specs.md`
- [x] **T018** [P] Update the spec-kit extension README's living-specs and nested-project sections, and add an `[Unreleased]` changelog entry in user-facing voice · `speckit-extension/README.md`, `speckit-extension/CHANGELOG.md`
- [x] **T019** [P] Update the root README's living-specs configuration references and add a root `[Unreleased]` changelog entry for the editor half · `README.md`, `CHANGELOG.md`
- [x] **T020** [P] Note in the workflow documents carrying the cleanup line that capability registrations now live outside the restored folder · `.claude/commands/install-local.md`, `.claude/commands/fix-tickets.md`, `.claude/commands/ship-ticket.md`, `speckit-extension/examples/ship-ticket/nodes/install-local.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T021** Re-bless the assembled command goldens after the node and command prose edits · `speckit-extension/tests/golden/`
- [x] **T022** Run the full verification set and confirm green: `npm run compile`, `npm test`, `python3 -m unittest discover -s speckit-extension/tests`, `assemble-nodes.py --check`, `check-shape-parity.py`, `check-command-emissions.py`, `package-manifest.py --check`
- [x] **T023** Drift-proof every new test: revert the behavior each one guards, confirm it fails, restore, and record the result per test · `specs/405-capability-registry-file/`

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → **Phases 3–6 (stories, in priority order)** → **Phase 7 (Polish)**.
- Phase 2 blocks everything: T002 and T003 are independent of each other, and T004 waits for T002.
- Phase 3: T005 (test) then T006, then T007 — the relocation writer reuses the registration writer's renderer.
- Phase 4: T008 (tests) then T009 and T010 in parallel — different files, both depending on Phase 3's writers already targeting the registry.
- Phase 5: T011 and T012 in parallel, then T013 and T014 in parallel — four different files, no shared state.
- Phase 6: T015 alone, depends only on Phase 2.
- Phase 7: T016–T020 in parallel (five disjoint document sets), then T021 (goldens follow the prose), then T022 (verification follows every edit), then T023 (drift-proofing follows a green suite).
