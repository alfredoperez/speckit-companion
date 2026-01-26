# Tasks: Codex CLI Provider

**Input**: Design documents from `/specs/012-codex-cli-provider/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Not requested in feature specification - implementation tasks only.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: VS Code extension with `src/` at repository root
- Paths follow existing structure in `src/ai-providers/`

---

## Phase 1: Setup (Type System Updates)

**Purpose**: Update type definitions and configuration to recognize Codex as a valid provider

- [x] T001 Add 'codex' to AIProviderType union in src/ai-providers/aiProvider.ts
- [x] T002 Add codex entry to PROVIDER_PATHS record in src/ai-providers/aiProvider.ts
- [x] T003 Add 'codex' enum value and description to package.json aiProvider configuration

---

## Phase 2: Foundational (Provider Infrastructure)

**Purpose**: Create the core provider class that MUST be complete before any user story features work

**⚠️ CRITICAL**: Provider class must exist before prompt execution, slash commands, or file management can be implemented

- [x] T004 Create codexCliProvider.ts with class skeleton implementing IAIProvider in src/ai-providers/codexCliProvider.ts
- [x] T005 Add constructor with context, outputChannel, and configManager initialization in src/ai-providers/codexCliProvider.ts
- [x] T006 Add createTempFile private helper method in src/ai-providers/codexCliProvider.ts
- [x] T007 Add convertPathIfWSL private helper method in src/ai-providers/codexCliProvider.ts
- [x] T008 Import CodexCliProvider in src/ai-providers/aiProviderFactory.ts
- [x] T009 Add 'codex' case to getProviderByType switch statement in src/ai-providers/aiProviderFactory.ts
- [x] T010 Add codex entry to getSupportedProviders array in src/ai-providers/aiProviderFactory.ts
- [x] T011 Export CodexCliProvider from src/ai-providers/index.ts

**Checkpoint**: Foundation ready - provider class exists and is registered in factory

---

## Phase 3: User Story 1 - Select Codex CLI as AI Provider (Priority: P1) 🎯 MVP

**Goal**: Users can select Codex CLI as their AI provider and the selection persists

**Independent Test**: Open VS Code, trigger provider selection prompt, choose "Codex CLI", verify setting persists in VS Code settings

### Implementation for User Story 1

- [x] T012 [US1] Implement isInstalled() method checking for 'codex --version' in src/ai-providers/codexCliProvider.ts
- [x] T013 [US1] Add Codex CLI option to promptForProviderSelection QuickPick in src/ai-providers/aiProvider.ts

**Checkpoint**: User Story 1 complete - users can select and persist Codex CLI as their provider

---

## Phase 4: User Story 2 - Execute Prompts via Codex CLI (Priority: P1)

**Goal**: Users can execute AI prompts through Codex CLI in visible terminals or headless mode

**Independent Test**: Select a spec file, click "Refine with AI", verify prompt executes in Codex CLI terminal with `codex exec --yolo` command

### Implementation for User Story 2

- [x] T014 [US2] Implement executeInTerminal() method using 'codex exec --yolo' command in src/ai-providers/codexCliProvider.ts
- [x] T015 [US2] Implement executeHeadless() method for background execution in src/ai-providers/codexCliProvider.ts
- [x] T016 [US2] Add installation check error handling with npm install guidance in src/ai-providers/codexCliProvider.ts

**Checkpoint**: User Story 2 complete - prompts execute via Codex CLI in terminal and headless modes

---

## Phase 5: User Story 3 - Execute Slash Commands (Priority: P2)

**Goal**: Users can run SpecKit slash commands through Codex CLI

**Independent Test**: Right-click a spec, select "Execute Plan" action, verify `/speckit.plan` runs in Codex CLI terminal

### Implementation for User Story 3

- [x] T017 [US3] Implement executeSlashCommand() method wrapping commands as prompts in src/ai-providers/codexCliProvider.ts

**Checkpoint**: User Story 3 complete - slash commands execute through Codex CLI

---

## Phase 6: User Story 4 - Codex-Specific File Management (Priority: P2)

**Goal**: Extension recognizes Codex CLI configuration files (AGENTS.md, .codex/ directory, skills)

**Independent Test**: Create AGENTS.md file in workspace, verify it appears in SpecKit steering tree view

### Implementation for User Story 4

- [x] T018 [US4] Verify PROVIDER_PATHS codex entry has correct steeringFile, steeringDir, skillsDir values in src/ai-providers/aiProvider.ts
- [x] T019 [US4] Verify skills tree view condition includes codex provider in package.json

**Checkpoint**: User Story 4 complete - Codex configuration files appear in tree views

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T020 Run npm run compile to verify no TypeScript errors
- [ ] T021 Test provider switching from other providers to Codex and back
- [ ] T022 Verify no regression in Claude Code, Gemini CLI, or Copilot CLI functionality

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority but US2 depends on US1 (provider must be selectable first)
  - US3 depends on US2 (slash commands use prompt execution infrastructure)
  - US4 can proceed independently after Foundational
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (provider must be registered and selectable)
- **User Story 3 (P2)**: Depends on US2 (uses executeInTerminal infrastructure)
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Only needs PROVIDER_PATHS entry

### Parallel Opportunities

- T001, T002, T003 are all in different files and can run in parallel
- T008, T009, T010, T011 can run in parallel (different files, after T004)
- T018, T019 can run in parallel with US3 implementation

---

## Parallel Example: Setup Phase

```bash
# Launch all Setup tasks together (different files):
Task: "Add 'codex' to AIProviderType union in src/ai-providers/aiProvider.ts"
Task: "Add codex entry to PROVIDER_PATHS record in src/ai-providers/aiProvider.ts"
Task: "Add 'codex' enum value and description to package.json aiProvider configuration"
```

## Parallel Example: Foundational Phase (after T004)

```bash
# Launch factory updates together (different files):
Task: "Import CodexCliProvider in src/ai-providers/aiProviderFactory.ts"
Task: "Export CodexCliProvider from src/ai-providers/index.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (type definitions)
2. Complete Phase 2: Foundational (provider class skeleton)
3. Complete Phase 3: User Story 1 (provider selection)
4. Complete Phase 4: User Story 2 (prompt execution)
5. **STOP and VALIDATE**: Test selecting Codex and running a prompt

### Incremental Delivery

1. Setup + Foundational → Provider registered in factory
2. Add User Story 1 → Provider selectable → Deploy/Demo (provider works!)
3. Add User Story 2 → Prompts execute → Deploy/Demo (MVP complete!)
4. Add User Story 3 → Slash commands work → Deploy/Demo
5. Add User Story 4 → File management → Deploy/Demo (feature complete)

### Files Modified Summary

| File | Phase | Change |
|------|-------|--------|
| src/ai-providers/aiProvider.ts | 1, 3 | Add type, paths, QuickPick option |
| src/ai-providers/codexCliProvider.ts | 2, 3, 4, 5 | New provider implementation |
| src/ai-providers/aiProviderFactory.ts | 2 | Add factory case |
| src/ai-providers/index.ts | 2 | Add export |
| package.json | 1, 6 | Add enum value, skills condition |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each phase or logical task group
- Stop at any checkpoint to validate story independently
- Codex CLI uses `codex exec --yolo` instead of Claude's `claude --permission-mode bypassPermissions`
- No permission management needed (Codex handles auth separately via `codex auth`)
