# Tasks: Update Architecture & Documentation

**Input**: Design documents from `/specs/045-update-docs/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested. No test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Audit the actual codebase to establish source of truth before modifying any docs

- [x] T001 Audit actual `src/` directory tree and compare against data-model.md entity listing to confirm accuracy
- [x] T002 Audit actual `webview/` directory tree and compare against data-model.md entity listing to confirm accuracy
- [x] T003 [P] Audit registered tree views in `package.json` contributes.views section to confirm exactly 3 views
- [x] T004 [P] Audit AI provider files in `src/ai-providers/` to confirm all 5 providers and their capabilities

**Checkpoint**: Source of truth established - documentation updates can begin

---

## Phase 2: User Story 1 - Developer Onboarding via Architecture Docs (Priority: P1)

**Goal**: Rewrite `docs/architecture.md` so the directory structure and key components accurately reflect the current codebase

**Independent Test**: A developer unfamiliar with the project can read `docs/architecture.md` and correctly identify where to find any feature module, provider, or manager class without searching the filesystem

### Implementation for User Story 1

- [x] T005 [US1] Replace the phantom `src/` directory tree in `docs/architecture.md` with the actual structure: `core/`, `features/` (10 modules), `ai-providers/`, `speckit/`
- [x] T006 [US1] Replace the phantom `webview/` directory tree in `docs/architecture.md` with the actual structure: `spec-viewer/`, `spec-editor/`, `markdown/`, `render/`, `ui/`, and `styles/` with partials
- [x] T007 [US1] Remove all phantom component references from `docs/architecture.md` (no `agentsExplorerProvider.ts`, `hooksExplorerProvider.ts`, `mcpExplorerProvider.ts`, no `commands/`, `constants/`, `services/`, `shared/`, `watchers/`, `providers/` top-level dirs)
- [x] T008 [US1] Update the key components section in `docs/architecture.md` to list actual providers: SpecExplorerProvider, SteeringExplorerProvider, OverviewProvider, SpecViewerProvider, SpecEditorProvider, WorkflowEditorProvider
- [x] T009 [US1] Update the feature modules listing in `docs/architecture.md` to include all 10 modules: agents, permission, settings, skills, spec-editor, spec-viewer, specs, steering, workflow-editor, workflows

**Checkpoint**: `docs/architecture.md` is fully accurate - every path listed exists on disk, every component named exists in code

---

## Phase 3: User Story 2 - Developer Understanding Feature Docs (Priority: P2)

**Goal**: Update `docs/how-it-works.md` to accurately reflect all 5 AI providers, 3 tree views, correct project structure, and full capabilities matrix

**Independent Test**: A developer reading `docs/how-it-works.md` can correctly enumerate all supported AI providers, all tree views, and the activation flow without encountering references to non-existent components

### Implementation for User Story 2

- [x] T010 [US2] Update the AI providers section in `docs/how-it-works.md` to list all 5 providers: Claude Code, GitHub Copilot CLI, Gemini CLI, Codex CLI, Qwen CLI
- [x] T011 [US2] Update the provider capabilities matrix in `docs/how-it-works.md` to include Codex and Qwen with accurate capability flags based on their provider implementations in `src/ai-providers/`
- [x] T012 [US2] Fix the tree views section in `docs/how-it-works.md` from 7 views to 3 views: explorer (SpecExplorerProvider), steering (SteeringExplorerProvider), settings (OverviewProvider)
- [x] T013 [US2] Update all Mermaid diagrams in `docs/how-it-works.md` to show "Specs | Steering | Settings" instead of "Specs | Steering | MCP | Agents | Skills | Hooks"
- [x] T014 [US2] Update the project structure section in `docs/how-it-works.md` to include spec-viewer/, spec-editor/, workflows/ feature modules and remove phantom hooks/, mcp/ directories
- [x] T015 [US2] Update the activation flow description in `docs/how-it-works.md` to say "Register TreeDataProviders 3 views" instead of 7
- [x] T016 [US2] Update the configuration keys section in `docs/how-it-works.md` to include all settings from `package.json`: speckit.specDirectories, speckit.customWorkflows, speckit.defaultWorkflow, speckit.customCommands, speckit.qwenPath, speckit.permissionMode
- [x] T017 [US2] Update the webview description in `docs/how-it-works.md` to accurately describe spec-viewer, spec-editor, and workflow editor webviews with their actual file structure

**Checkpoint**: `docs/how-it-works.md` accurately describes all providers, views, and structure

---

## Phase 4: User Story 3 - Contributor Updating CLAUDE.md (Priority: P3)

**Goal**: Verify `CLAUDE.md` project structure matches the actual filesystem layout

**Independent Test**: The project structure in `CLAUDE.md` matches the actual filesystem layout when compared directory-by-directory

### Implementation for User Story 3

- [x] T018 [US3] Verify the project structure section in `CLAUDE.md` matches actual `src/` and `webview/` directories and update if any discrepancies are found

**Checkpoint**: `CLAUDE.md` is verified accurate

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all documentation files

- [x] T019 Run full validation: confirm every directory path listed across all docs exists on disk (0 phantom paths per SC-001)
- [x] T020 Run full validation: confirm every class/provider name referenced across all docs exists in codebase (0 phantom references per SC-002)
- [x] T021 Verify all 5 AI providers are documented with accurate capabilities (SC-003) and tree view count = 3 (SC-004)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **US1 - Architecture Docs (Phase 2)**: Depends on Setup audit completion
- **US2 - How-It-Works Docs (Phase 3)**: Depends on Setup audit completion; independent of US1
- **US3 - CLAUDE.md (Phase 4)**: Depends on Setup audit completion; independent of US1/US2
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Setup - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Setup - Independent of US1
- **User Story 3 (P3)**: Can start after Setup - Independent of US1/US2

### Parallel Opportunities

- T003 and T004 in Setup can run in parallel
- All three user stories (Phases 2-4) can run in parallel after Setup
- Within US1: T005-T009 are sequential (all modify same file `docs/architecture.md`)
- Within US2: T010-T017 are sequential (all modify same file `docs/how-it-works.md`)
- US3 is a single task

---

## Parallel Example: After Setup

```bash
# All three user stories can start simultaneously:
Task: US1 - Rewrite docs/architecture.md (T005-T009)
Task: US2 - Update docs/how-it-works.md (T010-T017)
Task: US3 - Verify CLAUDE.md (T018)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (audit codebase)
2. Complete Phase 2: User Story 1 (architecture.md rewrite)
3. **STOP and VALIDATE**: Every path in architecture.md exists on disk
4. Ship if ready

### Incremental Delivery

1. Complete Setup -> Source of truth established
2. Add User Story 1 -> architecture.md accurate -> Ship
3. Add User Story 2 -> how-it-works.md accurate -> Ship
4. Add User Story 3 -> CLAUDE.md verified -> Ship
5. Polish -> Full validation across all docs

---

## Notes

- No source code changes — documentation-only feature
- All modifications target existing files, no new files created
- CLAUDE.md already accurate per D3 research decision — US3 is verification only
- Within each user story, tasks are sequential because they modify the same file
- Parallelism exists across user stories, not within them
