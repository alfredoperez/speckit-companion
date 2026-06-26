# Tasks: Companion home in the Steering view

**Feature**: `382-companion-steering-view` · **Size**: normal · **Issue**: #381

## Phase 1: Setup

**Wave 1 — independent (different files):**

- [x] **T001** [P] Author the moss icon SVG (round moss creature + one sprouting leaf, flat bold shapes readable at 16px, moss greens) · assets/icons/moss.svg
- [x] **T002** [P] Add the Companion `TreeItemContext` values (`companionHeader`, `companionConfigGroup`, `companionConfigItem`, `companionCommandsGroup`, `companionCommand`) · src/core/constants.ts

## Phase 2: Foundational

Core readers shared by every story, with no `vscode` dependency (testable).

**Wave 2 — single task (blocks the provider wiring):**

- [x] **T003** Create the `companionSteering.ts` reader module: `readCompanionConfigGroups(root)` (top-level keys of `.specify/companion.yml`, `[]` on absent/unparseable), `readCompanionCommands(root)` (parse `.specify/extensions/companion/extension.yml` → `provides.commands` to `{name,description}[]`, `[]` on absent/unparseable/malformed), `isWithinRoot(root, candidate)` (path within workspace root) · src/features/steering/companionSteering.ts

## Phase 3: User Story 1 — install state + inline install (P1)

**Goal**: Companion node shows install state and offers an inline install when absent.

**Independent Test**: Open Steering with no `.specify/extensions/companion/`; node shows "Not installed" + inline install.

**Wave 3 — single task (root-level node):**

- [x] **T004** [US1] In `getChildren()` root branch, push the Companion `companion-header` node; gate icon/description on `isCompanionInstalled(root)` — moss SVG when installed (via `context.extensionUri`), `warning` ThemeIcon + `description: "Not installed"` when not; set `collapsibleState` to `Collapsed` only when installed, else `None` · src/features/steering/steeringExplorerProvider.ts

**⟶ Wait for Wave 3, then:**

- [x] **T005** [US1] Add the inline install menu entry: `view/item/context`, `group: "inline"`, `when: view == speckit.views.steering && viewItem == companion-header && !speckit.companion.installed`, command `speckit.companion.installSpecKitExtension` · package.json

**Checkpoint**: Not-installed projects show the Companion node with the indicator and a working inline install.

## Phase 4: User Story 2 — Configuration group (P2)

**Goal**: Installed projects show the configuration setting groups; clicking opens the file.

**Independent Test**: Installed project with `.specify/companion.yml`; expand Companion → Configuration lists top-level keys, click opens file.

**Wave 4 — single task (depends on T003, T004):**

- [x] **T006** [US2] Handle `companion-header` children: when installed and `.specify/companion.yml` exists, emit the `companion-config-group` node; its `companion-config-item` children = `readCompanionConfigGroups(root)`, each with a `vscode.open` command on the config file guarded by `isWithinRoot` (drop out-of-root). Omit the group when the file is absent · src/features/steering/steeringExplorerProvider.ts

**Checkpoint**: Configuration group lists setting groups and opens the file; absent file shows nothing.

## Phase 5: User Story 3 — Commands group (P2)

**Goal**: Installed projects list the Companion commands from the installed manifest.

**Independent Test**: Installed project; expand Companion → Commands lists every manifest command with its description on hover.

**Wave 5 — single task (depends on T003, T004):**

- [x] **T007** [US3] Handle `companion-header` and `companion-commands-group` children: emit the `companion-commands-group` node when installed; its `companion-command` children = `readCompanionCommands(root)`, label = command name, tooltip = description, no open action · src/features/steering/steeringExplorerProvider.ts

**Checkpoint**: Commands group lists manifest commands; empty/absent manifest → empty group, no crash.

## Phase 6: User Story 4 — refresh (P3)

**Wave 6 — single task (depends on the provider existing):**

- [x] **T008** [US4] Add a `setupCompanionFileWatchers()` watching `.specify/companion.yml` (create/change/delete) and `.specify/extensions/companion/extension.yml` (create/delete) that fires `_onDidChangeTreeData`; call it from the constructor/setup path and dispose it · src/features/steering/steeringExplorerProvider.ts

**Checkpoint**: Install-state and config edits refresh the node without a window reload.

## Phase 7: Polish

**Wave 7 — independent (different files):**

- [x] **T009** [P] Unit tests for `companionSteering.ts`: config-groups from a fixture, commands from a manifest fixture, empty on missing/malformed, and `isWithinRoot` accepts in-root / rejects `..` and absolute · src/features/steering/companionSteering.test.ts
- [x] **T010** [P] Docs: Steering section in `docs/sidebar.md` (Companion group, moss icon, not-installed indicator + inline install, Configuration/Commands children) · docs/sidebar.md
- [x] **T011** [P] Docs: "Sidebar at a Glance" in `README.md` — note the Companion group in the Steering view · README.md

**⟶ Wait for Wave 7, then:**

- [x] **T012** Validate against Success Criteria: `npm run compile && npm test` green; eyeball the tree wiring for installed/not-installed branches · (verification)

## Dependencies & Execution Order

- **Setup (T001, T002)** → independent, run in parallel.
- **Foundational (T003)** blocks all story phases (provider reads it).
- **US1 (T004 → T005)** is the entry point; T004 (node) before T005 (menu).
- **US2 (T006)** and **US3 (T007)** both depend on T003 + T004; they touch the same file (`steeringExplorerProvider.ts`) so run sequentially, not in one wave.
- **US4 (T008)** depends on the provider existing; same file, sequential.
- **Polish (T009–T011)** independent across three files; **T012** last.
