# Tasks: Wibey CLI Provider Support

**Input**: Design documents from `specs/393-wibey-provider-support/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | quickstart.md ✅

**Scope**: This PR ships both the Wibey CLI (`wibey`) provider and the `wibey-vscode` panel provider. The panel provider does not wait on `wibey.sendPrompt` — it degrades gracefully through a runtime waterfall (`wibey.sendPrompt` command → URI handler → clipboard), so it works today on Wibey v1.0.19+ and light-up improves as `genaica/wibey-vscode-extension` adds the command/handler.

**User Stories addressed**: US1 (Wibey VS Code panel), US2 (Wibey CLI provider), US3 (Steering explorer)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US2 = Wibey CLI provider, US3 = Steering explorer)

---

## Phase 1: Foundational

**Purpose**: Add the `WIBEY` provider type constant — every other task depends on this symbol being exported.

**⚠️ CRITICAL**: T001 must complete before any other task begins.

- [x] T001 Add `WIBEY: 'wibey'` to the `AIProviders` const object in `src/core/constants.ts` (insert after the `CLAUDE_VSCODE` entry)

**Checkpoint**: `AIProviders.WIBEY` is exported; `AIProviderType` automatically includes `'wibey'` via the mapped type.

---

## Phase 2: User Story 2 — Wibey CLI Provider (Priority: P2 → promoted P1) 🎯 MVP

**Goal**: A developer can select "Wibey CLI" from the AI Provider dropdown and all SpecKit actions (Refine, workflow steps, inline comment resolution) dispatch to the `wibey` CLI in a VS Code terminal.

**Independent Test**: Set `speckit.aiProvider` to `wibey`. Click any workflow step button. Verify terminal titled `SpecKit - Wibey` opens and `wibey -p "…"` executes. See `quickstart.md` Scenarios 1–4.

- [x] T002 [P] [US2] Add `[AIProviders.WIBEY]` entry to `_PROVIDER_PATHS_RAW` in `src/ai-providers/aiProvider.ts` (insert after the `CLAUDE_VSCODE` entry) using the confirmed values: `steeringFile: 'AGENTS.md'`, `globalSteeringFile: null`, `steeringDir: ''`, `steeringPattern: 'AGENTS.md'`, `agentsDir: '.wibey/agents'`, `agentsPattern: '*.md'`, `skillsDir: '.wibey/skills'`, `skillsPattern: '*/SKILL.md'`, `mcpConfigPath: '.wibey/.mcp.json'`, `configDir: '.wibey'`, `supportsHooks: true`, `displayName: 'Wibey CLI'`, `commandFormat: 'dash'`, `quickPickIcon: '$(hubot)'`, `quickPickDescription: "Walmart's built-in AI coding assistant — terminal mode with full SDD support"`, `supportsInteractivePermissions: true`, `autoApproveFlag: ''`

- [x] T003 [P] [US2] Create new file `src/ai-providers/wibeyCliProvider.ts` — class `WibeyCliProvider` implementing `IAIProvider` directly (not extending `CliTerminalProvider`; same pattern as `GeminiCliProvider`). Interactive TUI mode: starts `wibey` interactively, waits 6 seconds for TUI to initialise, sends command as typed text. Reuses existing "SpecKit - Wibey" terminal via `vscode.window.terminals` scan. ⚠️ *Original plan was to extend `CliTerminalProvider` with `-p` flag; changed after real-world testing showed headless mode fails on macOS paths with spaces and exits Wibey after each task.*

- [x] T004 [US2] Add `import { WibeyCliProvider } from './wibeyCliProvider'` and `[AIProviders.WIBEY]: (ctx, out) => new WibeyCliProvider(ctx, out)` to `PROVIDER_CONSTRUCTORS` in `src/ai-providers/aiProviderFactory.ts` (depends on T003)

- [x] T005 [P] [US2] Append to all three arrays in `contributes.configuration["speckit.aiProvider"]` in `package.json`: add `"wibey"` to `enum` (line 824), `"Wibey CLI"` to `enumItemLabels` (line 834), `"Wibey CLI - Walmart's built-in AI coding assistant (dispatches SpecKit commands to the wibey CLI in a VS Code terminal)"` to `enumDescriptions` (line 844)

**Checkpoint**: Compile (`npm run compile`) + `npm test` must pass. Setting `speckit.aiProvider: 'wibey'` and clicking Refine or a workflow step should dispatch to a terminal running the `wibey` CLI.

---

## Phase 3: User Story 3 — Steering Explorer (Priority: P3)

**Goal**: When `wibey` is the active provider, the SpecKit steering explorer shows the correct Wibey paths (AGENTS.md, .wibey/skills/, .wibey/agents/).

**Independent Test**: Set `speckit.aiProvider` to `wibey`. Open the SpecKit sidebar → steering explorer. Verify it shows "Wibey CLI" as the provider header and lists AGENTS.md + .wibey/skills/ contents. See `quickstart.md` Scenario 5.

- [x] T006 [US3] Verify `src/features/steering/steeringExplorerProvider.ts` renders correctly for the `wibey` provider: (1) the provider header reads "Wibey CLI" via `getProviderDisplayName()`, (2) project steering file shows `AGENTS.md`, (3) skills list shows `.wibey/skills/` contents, (4) the empty `steeringDir: ''` case is handled gracefully (mirrors `opencode` provider which also uses `steeringDir: ''`). Apply fixes only if the explorer mishandles the empty `steeringDir` case.

**Checkpoint**: Steering explorer shows correct Wibey paths with no errors in the output channel.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [x] T007 [P] Open InnerSource issue on `genaica/wibey-vscode-extension` requesting `wibey.sendPrompt(text: string)` command to unblock the `wibey-vscode` panel provider (Phase 2). Issue body: explain SpecKit Companion's dispatch model, the gap in the current API, and the proposed implementation (see plan.md "Phase 2 Gate" section). Link the issue URL in a comment on PR #416.

- [x] T008 Run `npm run compile` (zero TypeScript errors) and `npm test` (all existing tests pass — no new test files needed since `WibeyCliProvider` has zero logic beyond the base class contract). Confirm `validateProviderRegistry` passes at module load.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **US2 (Phase 2)**: Depends on T001 — BLOCKS implementation
  - T002, T003, T005 can run in parallel after T001
  - T004 depends on T003 (imports `WibeyCliProvider`)
- **US3 (Phase 3)**: Depends on T002 (needs `PROVIDER_PATHS[WIBEY]` to be defined)
- **Polish (Phase 4)**: T007 can run anytime; T008 runs after Phase 2 is complete

### Execution Graph

```
T001
├── T002 [P]  (aiProvider.ts — PROVIDER_PATHS entry)
├── T003 [P]  (wibeyCliProvider.ts — new file)
│     └── T004  (aiProviderFactory.ts — depends on T003)
└── T005 [P]  (package.json — enum update)

After T002: T006  (steering explorer verification)
After T004 + T005: T008  (compile + test)
Anytime: T007  (InnerSource issue)
```

### Parallel Opportunities

After T001 completes, three tasks can run in parallel:
- **T002**: `src/ai-providers/aiProvider.ts`
- **T003**: `src/ai-providers/wibeyCliProvider.ts` (new file)
- **T005**: `package.json`

---

## Parallel Execution Example: Phase 2 (US2)

```bash
# After T001 is done, launch these three simultaneously:
Task T002: "Add WIBEY entry to _PROVIDER_PATHS_RAW in src/ai-providers/aiProvider.ts"
Task T003: "Create src/ai-providers/wibeyCliProvider.ts"
Task T005: "Update package.json enum arrays"

# Then (depends on T003):
Task T004: "Wire WibeyCliProvider into aiProviderFactory.ts"

# Then validate:
Task T008: "npm run compile && npm test"
```

---

## Implementation Strategy

### MVP (User Story 2 only — 5 tasks)

1. T001 — Add `AIProviders.WIBEY` constant
2. T002 + T003 + T005 in parallel — provider paths, class file, package.json
3. T004 — Factory wiring (depends on T003)
4. T008 — Compile + test gate

**Stop and validate**: Set `speckit.aiProvider: 'wibey'`, click Refine → terminal opens.

### Full Delivery (both stories — all 8 tasks)

Add after MVP:
5. T006 — Steering explorer verification (may require minor fix)
6. T007 — Open InnerSource issue for `wibey.sendPrompt` (Phase 2 gate)

---

## Notes

- [P] tasks = different files, no shared state dependencies
- [Story] label maps each task to its user story for traceability
- T006 is expected to be verification-only (no code changes) since `steeringExplorerProvider.ts` is config-driven via `getProviderPaths()`
- `validateProviderRegistry` runs at module load (extension activation) and will surface any misconfigured `PROVIDER_PATHS` entry immediately — the test run in T008 confirms it
- US1 (`wibey-vscode` panel provider) is intentionally absent — deferred to Phase 2 pending `wibey.sendPrompt` in `genaica/wibey-vscode-extension`
