# Tasks: Spec Explorer Sidebar View

**Feature**: `specs/381-spec-explorer` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Task line format: `- [ ] **T###** [P?] [US#] Description · exact/file/path`

## Phase 1: Setup

No setup tasks — the change reuses the existing build, test, and provider infrastructure.

## Phase 2: Foundational (BLOCKS all stories)

The node-side reader is the shared engine every story renders from. Nothing user-facing works until it exists and is tested.

**Wave 1 — single task (new file):**

- [x] **T001** [US1] Create the node-side living-specs reader `livingSpecsModel.ts`: parse the `livingSpecs` block of `.specify/companion.yml` with `js-yaml`; normalize each capability's `match`/`exclude` to string lists; resolve each capability's spec path (default `capabilities/<name>/spec.md`, explicit `spec` for colocated); compute `location` (centralized vs colocated); check spec + `.arch.md`/`.coverage.md` tier existence on disk; glob `**/*.spec.md` for orphans excluding `specs/`, reserved tiers, claimed paths, and capability-owned dirs; de-dupe capabilities by resolved spec path; return a `LivingSpecsListing`. Mirror the resolver's glob semantics (`*` never crosses `/`). · `src/features/specs/livingSpecsModel.ts`

**⟶ Wait for Wave 1, then:**

- [x] **T002** [US1] Unit-test `livingSpecsModel.ts` against a temp fixture tree: disabled config → empty+`enabled:false`; centralized + colocated capabilities resolve correct paths and `location`; tiers reported only when files exist; orphan glob excludes `specs/`, reserved tiers, claimed/owned files and surfaces a genuine orphan; missing/malformed config → empty (no throw); same-spec-path capabilities de-duped; `*` does not cross `/`. · `src/features/specs/__tests__/livingSpecsModel.test.ts`

## Phase 3: User Story 1 — Browse and open living specs (P1)

**Goal**: A clickable Capabilities index with name + storage location that opens each capability's spec.

**Independent Test**: With living specs enabled and ≥1 capability, the view lists each capability (name + centralized/colocated) and clicking opens its spec.

### Implementation

**Wave 2 — single task (new file, depends on T001):**

- [x] **T003** [US1] Create `LivingSpecsExplorerProvider extends BaseTreeDataProvider<LivingSpecItem>`: root → a Capabilities group (and Orphans group when present); a capability node labelled `name` with `description` = `centralized`/`colocated`, marked not-created when its spec is absent (no open command, distinct icon); capability node opens its spec via `vscode.open` when it exists. Add `LivingSpecItem extends vscode.TreeItem`. · `src/features/specs/livingSpecsExplorerProvider.ts`

**⟶ Wait for Wave 2, then:**

- [x] **T004** [US1] Add the `Views.livingSpecs` id constant and re-export the provider. · `src/core/constants.ts`, `src/features/specs/index.ts`
- [x] **T005** [US1] Register the provider and its tree view in `activate()`; add a `FileSystemWatcher` on `.specify/companion.yml` and the `capabilities/**` tree wired to `refresh()`; refresh when the companion-installed context flips (reuse the existing `.specify/extensions/companion/**` watcher's refresh callback). · `src/extension.ts`
- [x] **T006** [US1] Contribute the `speckit.views.livingSpecs` view in `package.json` under `contributes.views.speckit`, with `when: "!(workbenchState == empty || workspaceFolderCount == 0) && speckit.companion.installed"`. · `package.json`

**Checkpoint**: Capabilities list and open — US1 independently functional.

## Phase 4: User Story 2 — See a capability's tiers (P2)

**Goal**: Expanding a capability reveals only the tiers (spec/architecture/coverage) that exist on disk.

**Independent Test**: A capability with arch+coverage siblings shows three tier children; one without shows only the spec tier; clicking a tier opens it.

### Implementation

**Wave 3 — single task (depends on T003):**

- [x] **T007** [US2] In the provider, render a capability's children as tier nodes — spec (always, when it exists), plus architecture and coverage when `tiers[].exists` — each opening its file via `vscode.open`; collapse a capability that has no expandable children. · `src/features/specs/livingSpecsExplorerProvider.ts`

**Checkpoint**: Tiers visible and openable — US2 independently functional.

## Phase 5: User Story 3 — Find orphan specs (P2)

**Goal**: An Orphans group lists unclaimed `*.spec.md` files.

**Independent Test**: An unclaimed spec outside `specs/` appears under Orphans and opens; claimed/tier/owned files do not.

### Implementation

**Wave 4 — single task (depends on T003; model orphan logic from T001):**

- [x] **T008** [US3] In the provider, render the Orphans group and its orphan leaf nodes (from `listing.orphans`), each opening its file via `vscode.open`; omit the group when there are no orphans. · `src/features/specs/livingSpecsExplorerProvider.ts`

**Checkpoint**: Orphans listed and openable — US3 independently functional.

## Phase 6: User Story 4 — Friendly empty and hidden states (P1)

**Goal**: Calm empty state when off/none; view hidden entirely when companion absent.

**Independent Test**: Disabled → friendly message, no error. Companion dir removed → view gone; restored → view back.

### Implementation

**Wave 5 — independent (different surfaces):**

- [x] **T009** [P] [US4] In the provider, return a single non-clickable info node for the empty states — distinct copy for "living specs are off" vs "no living specs yet" — never an error. · `src/features/specs/livingSpecsExplorerProvider.ts`
- [x] **T010** [P] [US4] Add a `viewsWelcome` entry for `speckit.views.livingSpecs` as the friendly fallback copy. · `package.json`

**Checkpoint**: Empty/hidden states correct — US4 independently functional.

## Phase 7: Polish

**Wave 6 — independent (docs, different files):**

- [x] **T011** [P] Document the Spec Explorer view in `docs/sidebar.md` (full reference: groups, tier children, orphans, empty/hidden states, gating). · `docs/sidebar.md`
- [x] **T012** [P] Add the Spec Explorer to the "Sidebar at a Glance" summary in `README.md`. · `README.md`

**⟶ Wait for Wave 6, then:**

- [x] **T013** Run `npm run compile && npm test`; verify SC-001…SC-005 against the model tests and a manual eyeball of the view. · (validation)

## Dependencies & Execution Order

- **Phase 2 (Foundational)** blocks everything: T001 (model) → T002 (tests).
- **Phase 3 (US1)**: T003 (provider) → then T004/T005/T006 (wiring) in one wave.
- **Phase 4 (US2)** T007 and **Phase 5 (US3)** T008 both extend the provider built in T003 (same file — sequential after T003, not parallel with each other).
- **Phase 6 (US4)**: T009 (provider) and T010 (package.json) are independent.
- **Phase 7 (Polish)**: T011/T012 docs are independent; T013 validation runs last.
