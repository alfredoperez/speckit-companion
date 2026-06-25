# Tasks: Brownfield Adoption Wizard (Living Specs LS·5)

Feature dir: `specs/360-living-specs-adopt/`. Builds on LS·1–4 (resolver, config, fold-back). Spec-kit-extension change only — root README/CHANGELOG/`package.json` untouched.

## Phase 1: Setup

No new tooling — the helper is stdlib Python alongside the existing LS scripts, and the bench reuses the existing harness.

## Phase 2: Foundational (blocks all stories)

**Wave 1 — one task:**

- [x] **T001** [US1][US2] Add the registry-append helper `register-capability.py` in the extension scripts — reuse `companion_config.load_config`/`load_living_specs` to read, append one capability keyed on `name` (idempotent no-op if present), refuse on malformed config, create a minimal `livingSpecs` block when absent; CLI per the contract · `speckit-extension/scripts/register-capability.py`

## Phase 3: User Story 1 — Adopt one area into a living spec (P1)

**Goal**: a developer points at one area and gets a registered, drafted living spec.

**Independent Test**: run the wizard against a fixture area; confirm `capabilities/<name>/spec.md` is created with the required structure and the capability is registered.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T002** [P] [US1] Write the wizard command body `speckit.companion.adopt.md` — runtime AI prose: point at one area, propose capabilities for just that area, draft each living spec surface-first ([DRAFT] banner, title + `## Requirements`, observed/inferred tags, `[NEEDS CLARIFICATION]`, `## Uncovered`), then register each confirmed capability via `register-capability.py` · `speckit-extension/commands/speckit.companion.adopt.md`
- [x] **T003** [P] [US1] Register the command in the manifest `provides.commands` and bump `extension.version` · `speckit-extension/extension.yml`

**⟶ Wait for Wave 1, then:**

- [x] **T004** [US1] Verify the post-condition end to end: after `register-capability.py` appends `billing`, `resolve-spec-paths.py --changed src/billing/x.ts` resolves it (covered by the new pytest + the bench demo) · `speckit-extension/tests/test_living_specs.py`

**Checkpoint**: US1 is independently functional — a confirmed capability lands in `companion.yml` and the resolver recognizes it.

## Phase 4: User Story 2 — Incremental, non-destructive registration (P2)

### Implementation

**Wave 1 — one task:**

- [x] **T005** [US2] Add pytest coverage for the helper: append onto an existing one-capability config (both present, rest intact); idempotent re-append (no duplicate); absent config (minimal block created); malformed config (refuse, file untouched) · `speckit-extension/tests/test_living_specs.py`

**Checkpoint**: re-running adoption is safe and preserves existing config.

## Phase 5: User Story 3 — Draft honesty (P3)

### Implementation

**Wave 1 — one task:**

- [x] **T006** [US3] Assert drafted-spec structure against a **seeded** draft in the bench demo (`[DRAFT]` banner, title + `## Requirements`, observed/inferred tags, `## Uncovered`); live AI extraction marked INCONCLUSIVE, never faked · `examples/todo-claude/bench/living-specs/ls-lib.mjs`, `ls-demos.mjs`

**Checkpoint**: a reviewer can tell observed from inferred and see the draft's blind spots.

## Phase 6: Polish

**Wave 1 — independent (different files):**

- [x] **T007** [P] Document the adopt command + registry-append in the spec-kit extension README and add a CHANGELOG entry (user-facing voice; no internal symbol names) · `speckit-extension/README.md`, `speckit-extension/CHANGELOG.md`
- [x] **T008** [P] Build the LS5 bench demo: bake an `src/billing/` fixture, run the real register helper + resolver, seed a drafted spec, assert structure, capture evidence to `evidence/LS5.json` (repo-relative, mode honest, live-draft INCONCLUSIVE) · `examples/todo-claude/bench/living-specs/ls-lib.mjs`, `ls-demos.mjs`, `evidence/LS5.json`

**⟶ Wait for Wave 1, then:**

- [x] **T009** Verify green: `npm run compile && npm test`, pytest, `check-shape-parity.py`, capture eval unchanged, LS5 demo PASS; append the LS·5 section to the vault status page and flip the row · (validation; status.html in vault)

## Dependencies & Execution Order

- Setup (none) → Foundational (T001) → US1 (T002/T003 parallel, then T004) → US2 (T005) → US3 (T006) → Polish (T007/T008 parallel, then T009).
- T001 blocks T004, T005, T008 (they exercise the helper). T002/T003 are independent files. T009 is the final validation gate after everything else.
