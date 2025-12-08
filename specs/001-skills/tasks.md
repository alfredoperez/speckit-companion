# Tasks: Claude Code Skills Explorer

**Input**: Design documents from `/specs/001-skills/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested - test tasks are excluded.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: VS Code Extension at repository root
- Paths use `src/` for source code per plan.md structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency setup

- [X] T001 [P] Install js-yaml dependency via `npm install js-yaml @types/js-yaml`
- [X] T002 [P] Add `Views.skills` constant to `src/core/constants.ts`
- [X] T003 [P] Add `skillsDir` and `skillsPattern` to ProviderPaths interface in `src/ai-providers/aiProvider.ts`
- [X] T004 [P] Add Claude-only skills paths to PROVIDER_PATHS in `src/ai-providers/aiProvider.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**Critical**: Skills view and tree provider registration MUST be complete before user stories

- [X] T005 Create `src/features/skills/` directory structure
- [X] T006 [P] Create `SkillInfo` interface and `SkillType` type in `src/features/skills/skillManager.ts`
- [X] T007 [P] Create `SkillItem` class extending `vscode.TreeItem` in `src/features/skills/skillsExplorerProvider.ts`
- [X] T008 Create `src/features/skills/index.ts` with re-exports for SkillManager and SkillsExplorerProvider
- [X] T009 [P] Add skills view configuration to `package.json` (view definition with `when` clause, visibility setting)
- [X] T010 [P] Add refresh command definition to `package.json` (`speckit.skills.refresh`)
- [X] T011 [P] Add view/title menu entry for refresh button in `package.json`
- [X] T012 [P] Register SkillsExplorerProvider as TreeDataProvider in `src/extension.ts`
- [X] T013 [P] Register `speckit.skills.refresh` command in `src/extension.ts`

**Checkpoint**: Foundation ready - Skills view appears in sidebar (empty), refresh button visible

---

## Phase 3: User Story 1 - View Available Skills (Priority: P1) - MVP

**Goal**: Display all available Skills grouped by type (Plugin, User, Project) when Claude Code is selected

**Independent Test**: Select Claude Code as CLI, verify Skills section appears with skills grouped under Plugin/User/Project

### Implementation for User Story 1

- [X] T014 [P] [US1] Implement `SkillManager.parseSkillFile()` for YAML frontmatter parsing in `src/features/skills/skillManager.ts`
- [X] T015 [US1] Implement `SkillManager.getSkillsFromDirectory()` for scanning skill folders in `src/features/skills/skillManager.ts`
- [X] T016 [US1] Implement `SkillManager.getPluginSkills()` for reading from `installed_plugins.json` in `src/features/skills/skillManager.ts`
- [X] T017 [US1] Implement `SkillManager.getSkillList()` combining all skill sources in `src/features/skills/skillManager.ts`
- [X] T018 [P] [US1] Implement `SkillsExplorerProvider.getSkillGroups()` returning Plugin/User/Project group items in `src/features/skills/skillsExplorerProvider.ts`
- [X] T019 [P] [US1] Implement `SkillsExplorerProvider.getTreeItem()` returning skill items in `src/features/skills/skillsExplorerProvider.ts`
- [X] T020 [US1] Implement `SkillsExplorerProvider.getChildren()` with provider check and group handling in `src/features/skills/skillsExplorerProvider.ts`
- [X] T021 [US1] Add provider-conditional visibility check using `getConfiguredProviderType()` in `src/features/skills/skillsExplorerProvider.ts`
- [X] T022 [P] [US1] Handle edge case: folders without SKILL.md (ignore per FR-010) in `src/features/skills/skillManager.ts`
- [X] T023 [P] [US1] Handle edge case: invalid YAML frontmatter (show warning, use folder name) in `src/features/skills/skillManager.ts`
- [X] T024 [P] [US1] Handle edge case: non-existent skill directories (graceful handling per FR-011) in `src/features/skills/skillManager.ts`
- [X] T025 [US1] Handle edge case: empty skills state (show empty message) in `src/features/skills/skillsExplorerProvider.ts`

**Checkpoint**: User Story 1 complete - Skills display correctly grouped when Claude Code selected, hidden for other providers

---

## Phase 4: User Story 2 - Inspect Skill Details (Priority: P2)

**Goal**: Enable clicking skills to view SKILL.md and show description tooltip on hover

**Independent Test**: Click any skill item, verify SKILL.md opens; hover over skill, verify description tooltip appears

### Implementation for User Story 2

- [X] T026 [P] [US2] Add `command` property to SkillItem for opening SKILL.md on click in `src/features/skills/skillsExplorerProvider.ts`
- [X] T027 [P] [US2] Register `speckit.skills.openSkill` command in `src/extension.ts`
- [X] T028 [P] [US2] Implement openSkill command handler to open SKILL.md file in `src/extension.ts`
- [X] T029 [P] [US2] Set `tooltip` property on SkillItem to skill description in `src/features/skills/skillsExplorerProvider.ts`
- [X] T030 [P] [US2] Add `description` property showing allowed-tools count (if present) in `src/features/skills/skillsExplorerProvider.ts`

**Checkpoint**: User Story 2 complete - Clicking opens SKILL.md, tooltip shows description

---

## Phase 5: User Story 3 - Refresh Skills List (Priority: P3)

**Goal**: Allow manual refresh of skills list to detect newly added/removed skills

**Independent Test**: Add new skill folder with SKILL.md, click refresh, verify new skill appears

### Implementation for User Story 3

- [X] T031 [US3] Implement `SkillsExplorerProvider.refresh()` method firing tree data change event in `src/features/skills/skillsExplorerProvider.ts`
- [X] T032 [US3] Connect refresh command to `skillsExplorer.refresh()` in `src/extension.ts`
- [X] T033 [P] [US3] Add file watchers for `~/.claude/skills/` and `.claude/skills/` in `src/features/skills/skillsExplorerProvider.ts`
- [X] T034 [P] [US3] Add file watcher for `~/.claude/plugins/installed_plugins.json` in `src/features/skills/skillsExplorerProvider.ts`
- [X] T035 [US3] Implement `setupFileWatchers()` method to auto-refresh on file changes in `src/features/skills/skillsExplorerProvider.ts`

**Checkpoint**: User Story 3 complete - Refresh button works, file changes trigger auto-refresh

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements and consistency checks

- [X] T036 [P] Add appropriate icons: `$(extensions)` for plugin group, `$(globe)` for user group, `$(root-folder)` for project group, `$(symbol-misc)` for skill items in `src/features/skills/skillsExplorerProvider.ts`
- [X] T037 [P] Add warning icon `$(warning)` for skills with invalid frontmatter in `src/features/skills/skillsExplorerProvider.ts`
- [X] T038 [P] Add loading state item with `$(sync~spin)` during async operations in `src/features/skills/skillsExplorerProvider.ts`
- [X] T039 Add "Skills not supported" message item when non-Claude provider selected in `src/features/skills/skillsExplorerProvider.ts`
- [X] T040 Run quickstart.md validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in priority order (P1 → P2 → P3)
  - US2 depends on US1 (needs skills displayed to click/hover)
  - US3 can technically run in parallel with US2 but logically follows
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Core functionality
- **User Story 2 (P2)**: Can start after US1 - Requires skills to be displayed
- **User Story 3 (P3)**: Can start after US1 - Requires skills to be displayed

### Within Each User Story

- Models/interfaces before services
- Services before provider methods
- Core implementation before edge cases
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T001, T002, T003, T004 ALL parallel (different files/concerns)
- **Phase 2**: T006 + T007 parallel (different files), T009 + T010 + T011 parallel (package.json sections), T012 + T013 parallel (extension.ts registrations)
- **US1**: T014 + T018 + T019 parallel (different files), T022 + T023 + T024 parallel (edge cases in skillManager)
- **US2**: T026 + T029 + T030 parallel (provider), T027 + T028 parallel (extension.ts)
- **US3**: T033 + T034 parallel (file watchers)
- **Phase 6**: T036, T037, T038 parallel (icon additions)

---

## Parallel Example: Phase 1 Setup

```bash
# Launch ALL Phase 1 tasks in parallel:
Task: "Install js-yaml dependency via npm install js-yaml @types/js-yaml"
Task: "Add Views.skills constant to src/core/constants.ts"
Task: "Add skillsDir and skillsPattern to ProviderPaths interface in src/ai-providers/aiProvider.ts"
Task: "Add Claude-only skills paths to PROVIDER_PATHS in src/ai-providers/aiProvider.ts"
```

---

## Parallel Example: Phase 2 Foundational

```bash
# After T005 (directory creation), launch in parallel:
Task: "Create SkillInfo interface in src/features/skills/skillManager.ts"
Task: "Create SkillItem class in src/features/skills/skillsExplorerProvider.ts"

# Then launch package.json tasks in parallel:
Task: "Add skills view configuration to package.json"
Task: "Add refresh command definition to package.json"
Task: "Add view/title menu entry to package.json"

# Then launch extension.ts tasks in parallel:
Task: "Register SkillsExplorerProvider as TreeDataProvider in src/extension.ts"
Task: "Register speckit.skills.refresh command in src/extension.ts"
```

## Parallel Example: Phase 6 Polish

```bash
# Launch all icon tasks together:
Task: "Add appropriate icons for groups in src/features/skills/skillsExplorerProvider.ts"
Task: "Add warning icon for invalid frontmatter in src/features/skills/skillsExplorerProvider.ts"
Task: "Add loading state item in src/features/skills/skillsExplorerProvider.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test skill detection and grouping independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test skill viewing → Deploy/Demo (MVP!)
3. Add User Story 2 → Test click/hover → Deploy/Demo
4. Add User Story 3 → Test refresh → Deploy/Demo
5. Complete Polish phase → Final release

---

## Notes

- [P] tasks = different files or independent additions, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Skills feature follows existing AgentsExplorer pattern in codebase
