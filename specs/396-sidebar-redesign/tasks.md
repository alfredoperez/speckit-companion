# Tasks: Sidebar Redesign — One Coherent, VS Code-Native Sidebar

**Feature**: `396-sidebar-redesign` | **Size**: `oversized` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Format: `- [ ] **T###** [P?] [US#] Description · exact/file/path`

---

## Phase 1: Setup

Nothing to scaffold — the extension, its test harness, and every file this feature touches already exist.

---

## Phase 2: Foundational (blocks every story)

The safety net and the two pure modules everything else is written against.

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US10] Add a manifest lock test that parses `package.json` and asserts the contributed view titles, the Specs title-bar action set, the spec-row menu grouping with `speckit.delete` isolated in `5_danger`, the reveal-eligibility context values, and that every lifecycle `when` clause is unchanged · `src/features/specs/__tests__/manifest.test.ts`
- [x] **T002** [P] [US4] Create the pure provider-icon resolver — `detectHostIde()` reusing the same `uriScheme`/`appName` signals as `getProviderDisplayName()`, and `resolveProviderIconKey(providerId, host)` returning an `asset` / `mono` / `codicon` discriminated result per the data model · `src/features/steering/providerIcon.ts`
- [x] **T003** [P] [US10] Create the pure friendly-status formatter mapping every canonical lifecycle status to Title Case, Title-Casing an unknown value on `-` boundaries rather than leaking it raw · `src/features/specs/specStatusLabel.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T004** [P] [US4] Test the provider-icon resolver across every provider id × host-IDE combination, asserting the resolved icon and `getProviderDisplayName()` name the same product, that an unknown IDE Chat host never resolves to Copilot branding, and that both Wibey providers resolve to the documented neutral Codicon · `src/features/steering/__tests__/providerIcon.test.ts`
- [x] **T005** [P] [US10] Test the friendly-status formatter for every canonical status plus an unknown value · `src/features/specs/__tests__/specStatusLabel.test.ts`

**Checkpoint**: the manifest's current shape is locked and the two pure modules exist with tests. Presentation can now be changed safely.

---

## Phase 3: User Story 2 — Names that say what a view is (P1)

### Implementation

**Wave 1 — single task (one file):**

- [x] **T006** [US2] Rename the contributed view titles — `Spec Explorer` → `Living Specs`, `Settings` → `Settings & Feedback` — leaving every view id, `when` clause, and `visibility` untouched · `package.json`

**⟶ Wait for T006, then:**

- [x] **T007** [US2] Update the manifest test's expected view titles to the new values · `src/features/specs/__tests__/manifest.test.ts`

**Checkpoint**: the four views are named for what they hold; nothing else changed.

---

## Phase 4: User Story 3 + 10 — One icon language and friendly copy (P1)

### Implementation

**Wave 1 — independent (different files):**

- [x] **T008** [P] [US3] Replace the Specs group SVGs with themed Codicons (`pulse`, `pass-filled` tinted `testing.iconPassed`, `archive`), drop the `specIcon()` helper, and rewrite the group tooltips to the plan's copy · `src/features/specs/specExplorerProvider.ts`
- [x] **T009** [P] [US3] Replace every generic Steering category SVG with a themed Codicon (`root-folder`, `account`, `hubot`, `tools`, `gear`, `library`, `terminal`, `files`, `law`, `file`, `warning`), keeping the moss product mark and the official provider marks · `src/features/steering/steeringExplorerProvider.ts`
- [x] **T010** [P] [US2] Apply the command-title copy table — `New Spec`, `Filter…`, `Sort…`, `Clear Filter`, `Collapse All`, `Expand All`, `Mark Complete`, `Set Status…`, `Mark All Complete`, `Archive All`, `Reactivate All`, `New Steering Document…`, `Copy Spec Name`, `Copy Spec Path`, `Reveal in VS Code Explorer`, `Reveal in File Manager`, `Check for Drift`, `Adopt Code Area…`, `Refresh Living Specs`, `Install Companion Extension` — changing no command id · `package.json`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T011** [US10] Rewrite the spec-row tooltip as multi-line name / friendly `Status:` / `Last activity:` using the new formatter, drop the leading decorative `·` from the row description, and derive the related-document tooltip from the stored `filePath` instead of reconstructing it from the label · `src/features/specs/specExplorerProvider.ts`
- [x] **T012** [US3] Standardize the agent tools count to `3 tools` (matching skills) and fix the missing-rule tooltips to name the configured provider's steering filename instead of hard-coding `CLAUDE.md` · `src/features/steering/steeringExplorerProvider.ts`
- [x] **T013** [US2] Update the manifest test's expected command titles · `src/features/specs/__tests__/manifest.test.ts`

**Checkpoint**: no generic tree category renders a decorative SVG; no tooltip exposes a raw lifecycle key, a reconstructed path, or the wrong provider filename.

---

## Phase 5: User Story 4 — A provider row that never lies (P1)

### Implementation

**Wave 1 — single task:**

- [x] **T014** [US4] Rewrite `SteeringItem.providerIcon()` as a thin adapter over `resolveProviderIconKey()`, turning the resolver's key into a `Uri`, a `{light,dark}` pair, or a `ThemeIcon` · `src/features/steering/steeringExplorerProvider.ts`

**Checkpoint**: the provider row's label and mark always name the same product; an unknown host gets a neutral chat icon.

---

## Phase 6: User Story 1 + 3 — Density and document status icons (P1)

### Implementation

**Wave 1 — single file, dependent edits:**

- [x] **T015** [US1] Default individual spec rows to collapsed by initializing the provider's expand-all flag to `false`, leaving the group defaults and the id-encoding toggle machinery untouched · `src/features/specs/specExplorerProvider.ts`
- [x] **T016** [US1] Seed the `speckit.specs.allCollapsed` context key to `true` at activation so the collapse/expand affordance reads correctly on a fresh window · `src/features/specs/specCommands.ts`
- [x] **T017** [US3] Render document status icons from the document's own state regardless of the parent spec's lifecycle — green pass for a completed step whose file exists, a blue filled circle for the current step, a muted `circle-outline` for an existing non-current step, and no icon for a missing one · `src/features/specs/specExplorerProvider.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T018** [US1] Extend the spec-explorer tests: spec rows collapse by default, Active expands while Completed/Archived collapse, zero-item groups are omitted, the toggle still flips every row, and document icons render correctly under active, implemented, completed, and archived parents · `src/features/specs/__tests__/specExplorerProvider.test.ts`

**Checkpoint**: a workspace with hundreds of completed specs opens to a short, readable tree.

---

## Phase 7: User Story 5 — A toolbar you can read at a glance (P2)

### Implementation

**Wave 1 — independent (different files):**

- [x] **T019** [P] [US5] Add the pure More Actions composition function `buildMoreActions({ allCollapsed, companionInstalled, speckitAvailable })` returning the separator-delimited View / Maintenance entries per the contract · `src/features/specs/specsMoreActions.ts`
- [x] **T020** [P] [US5] Contribute the `speckit.specs.moreActions` command with the `$(ellipsis)` icon; reduce the Specs `view/title` to exactly Filter, Sort, More Actions, and New Spec (rightmost); remove the clear-filter, collapse/expand, install, and upgrade title entries while keeping every one of those commands registered and palette-reachable · `package.json`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T021** [US5] Register the More Actions handler — build the picker from `buildMoreActions()` against live context probes and dispatch the chosen command; make the filter command clear the filter on an empty submission; and rewrite the sort picker's title, placeholder, labels, and descriptions to the compact form · `src/features/specs/specCommands.ts`
- [x] **T022** [US5] Test the More Actions composition across every context combination (companion installed/not, spec-kit available/not, collapsed/expanded) and the sort picker's labels and current-selection check · `src/features/specs/specCommands.test.ts`
- [x] **T023** [US5] Extend the manifest test to assert the Specs title bar carries at most four actions and that each removed command still exists as a contributed command · `src/features/specs/__tests__/manifest.test.ts`

**Checkpoint**: the Specs title bar never shows more than four buttons, and nothing became unreachable.

---

## Phase 8: User Story 6 + 7 — Menus that agree, reveal that always works (P2)

### Implementation

**Wave 1 — independent (different files):**

- [x] **T024** [P] [US6] Rebuild the spec-row `view/item/context` menu to use the same `1_status` / `2_lifecycle` / `3_copy` / `4_reveal` / `5_danger` groups as the hover submenu, with `speckit.delete` isolated in `5_danger` and nowhere else; add `living-specs-orphan` and every file-backed Steering context value to the reveal-eligibility `when` clauses; keep `speckit.steering.delete` restricted to generated steering documents · `package.json`
- [x] **T025** [P] [US7] Give related-document rows an open-source inline action when a valid file URI exists, and confirm every file-backed row exposes a resolvable path to the generic reveal handler · `src/features/specs/specExplorerProvider.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T026** [US7] Add Living Specs provider tests: the disabled and empty states each return exactly one informative row (never a blank root), capabilities and orphans group correctly, orphan rows expose their exact path for reveal, and a missing capability offers no open command · `src/features/specs/__tests__/livingSpecsExplorerProvider.test.ts`
- [x] **T027** [US6] Extend the manifest test to assert hover-submenu and right-click parity (same commands, same group order) and the full reveal-eligibility matrix, including that missing-capability and empty rows are excluded · `src/features/specs/__tests__/manifest.test.ts`

**Checkpoint**: hover and right-click present the same safe order; every file-backed row can be revealed and no missing file can.

---

## Phase 9: User Story 8 + 9 — Steering hierarchy and the Configuration row (P3)

### Implementation

**Wave 1 — single file, dependent edits:**

- [x] **T028** [US8] Build the Steering root in one explicit order — Companion, Provider, Steering Docs, SpecKit Project Files, References — removing the `splice` positioning hack and renaming `SpecKit Files` to `SpecKit Project Files` · `src/features/steering/steeringExplorerProvider.ts`
- [x] **T029** [US8] Move the missing project-rule and user-rule create actions out of the root and into the provider's Project and User groups, using `User` consistently in place of `Global` · `src/features/steering/steeringExplorerProvider.ts`
- [x] **T030** [US9] Make the Companion Configuration row open `.specify/companion.yml` on click while still listing its setting groups as children · `src/features/steering/steeringExplorerProvider.ts`
- [x] **T031** [US8] Remove the artificial 100 ms loading flicker from the Steering refresh — invalidate synchronously and let the real asynchronous children communicate loading · `src/features/steering/steeringExplorerProvider.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T032** [US8] Add Steering provider tests: the root renders in the target order, the create-rule actions appear nested under Project/User only when the file is missing and their tooltips name the configured provider's filename, empty sections are omitted, and the Companion node behaves in both installed and uninstalled states · `src/features/steering/__tests__/steeringExplorerProvider.test.ts`

**Checkpoint**: the Steering tree has an obvious shape and the Configuration row opens the configuration.

---

## Phase 10: Polish

**Wave 1 — independent (different files):**

- [x] **T033** [P] [US3] Delete the now-unreferenced decorative icon assets and update `NOTICE.md` to stop attributing artwork the extension no longer distributes · `assets/icons/specs/`, `assets/icons/steering/`, `NOTICE.md`
- [x] **T034** [P] [US10] Rewrite `docs/sidebar.md` to match the shipped UI — view names, default expansion, the four-action toolbar and its More Actions picker, the Codicon-based icon meanings, hover actions, right-click menus, the provider-icon resolution table including Wibey's documented fallback, and the rebuilt Steering hierarchy · `docs/sidebar.md`
- [x] **T035** [P] [US10] Update the README's Sidebar at a Glance summary for the new view names, the collapsed-by-default rows, and the four-action toolbar · `README.md`
- [x] **T036** [P] [US10] Add a user-facing CHANGELOG entry under the current unreleased heading · `CHANGELOG.md`
- [x] **T037** [P] [US10] Commit the design plan that this feature implements · `docs/sidebar-redesign-plan.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T038** [US10] Run compile, the full Jest suite, and the packaging build; walk the design plan's 23 acceptance criteria and record which pass automatically and which need a human at the editor · `specs/396-sidebar-redesign/`

---

## Dependencies & Execution Order

- **Phase 2 (Foundational)** blocks everything: T001–T003 are independent; T004–T005 wait on T002/T003.
- **Phase 3** (T006 → T007) is independent of Phases 4–9 but must precede the manifest assertions they extend.
- **Phase 4** Wave 1 (T008, T009, T010) is independent; T011–T013 wait on it.
- **Phase 5** (T014) needs T002.
- **Phase 6** (T015–T017 same file, then T018) needs Phase 2.
- **Phase 7** Wave 1 (T019, T020) is independent; T021–T023 wait on it.
- **Phase 8** Wave 1 (T024, T025) is independent; T026–T027 wait on it.
- **Phase 9** is one dependent file (T028–T031), then T032.
- **Phase 10** Wave 1 (T033–T037) is fully independent; T038 is the final gate and waits on everything.
