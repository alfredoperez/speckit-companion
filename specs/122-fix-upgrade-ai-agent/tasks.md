# Tasks: Fix Upgrade Agent & Stale Setting Docs

**Input**: Design documents from `specs/122-fix-upgrade-ai-agent/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/agent-resolution.md, quickstart.md

**Tests**: Included. The plan and `contracts/agent-resolution.md` specify a BDD test contract (`specKitAgent.test.ts` NEW, `detector.test.ts` EXTEND) as explicit deliverables, so test tasks are part of this feature.

**Organization**: Tasks are grouped by user story. Because this fix is one shared resolver consumed by every upgrade path, the resolver itself is foundational; each user-story phase owns the verification that its provider class resolves correctly and is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths are included in each task

## Path Conventions

Single-project VS Code extension: source under `src/`, tests colocated as `*.test.ts`, docs under `docs/`.

---

## Phase 1: Setup

**Purpose**: Establish a green baseline and confirm the two defect sites before changing anything.

- [X] T001 Run `npm test` to confirm a green baseline, then confirm the two `--ai claude-code` literals in [src/speckit/detector.ts](src/speckit/detector.ts) (`upgradeProject()` ~L235, `upgradeAll()` ~L260) and the `detectHostIde()` instance method in [src/ai-providers/ideChatProvider.ts](src/ai-providers/ideChatProvider.ts). No code change.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared, total resolver and route both dispatch sites through it. This is the engine every provider story rides on.

**⚠️ CRITICAL**: US1, US2, and US3 all depend on this phase. (US4 — docs/code cleanup — is independent and may proceed in parallel.)

- [X] T002 [P] Extract the body of `IdeChatProvider.detectHostIde()` into a standalone exported `detectHostIde(): HostIde` in [src/ai-providers/ideChatProvider.ts](src/ai-providers/ideChatProvider.ts); make the instance method delegate to it (behavior-preserving for existing IDE-Chat callers). Export the `HostIde` type if not already exported.
- [X] T003 Create [src/speckit/specKitAgent.ts](src/speckit/specKitAgent.ts) exporting: `PROVIDER_TO_AGENT` (keyed by `AIProviders` values from [src/core/constants.ts](src/core/constants.ts)), the pure total `resolveSpecKitAgent(provider, host)` (direct providers per the contract table, `ide-chat` resolved by host: vscode→`copilot`, cursor→`cursor-agent`, windsurf→`windsurf`, antigravity→`agy`, unknown→`copilot`; any unrecognized/missing provider → `claude`; never returns `claude-code`), and the impure `getConfiguredSpecKitAgent()` (reads `speckit.aiProvider` via `vscode.workspace.getConfiguration`, calls `detectHostIde()`, returns `resolveSpecKitAgent(provider, host)`). Depends on T002.
- [X] T004 In [src/speckit/detector.ts](src/speckit/detector.ts), import `getConfiguredSpecKitAgent` and replace both `--ai claude-code` literals (in `upgradeProject()` and `upgradeAll()`) with `--ai ${getConfiguredSpecKitAgent()}`. Depends on T003.

**Checkpoint**: All providers now resolve to valid agents at both dispatch sites; `claude-code` is gone from runtime. User-story verification can begin.

---

## Phase 3: User Story 1 - Upgrade succeeds for a non-Claude provider (Priority: P1) 🎯 MVP

**Goal**: A non-Claude provider (Codex, Gemini, Copilot, Qwen, OpenCode) upgrades for *its own* assistant with no "Unknown agent" error.

**Independent Test**: Set provider to Codex, trigger Upgrade Project, confirm the dispatched command names `codex` and the CLI does not error.

- [X] T005 [P] [US1] In [src/speckit/specKitAgent.test.ts](src/speckit/specKitAgent.test.ts), add `describe('resolveSpecKitAgent')` cases asserting each direct non-Claude provider maps to its agent: `gemini`→`gemini`, `copilot`→`copilot`, `codex`→`codex`, `qwen`→`qwen`, `opencode`→`opencode` (one `it` per row).
- [X] T006 [US1] In [src/speckit/detector.test.ts](src/speckit/detector.test.ts), add a `describe('upgradeProject')` test: with `speckit.aiProvider` mocked to `codex`, the dispatched terminal text contains `--ai codex` and does not contain `claude-code`.

**Checkpoint**: The reported failure (non-Claude upgrade) is fixed and proven. MVP complete.

---

## Phase 4: User Story 2 - Default Claude path no longer sends an invalid identifier (Priority: P1)

**Goal**: The default provider upgrades with `--ai claude`, never `claude-code`.

**Independent Test**: Leave provider at default, trigger Upgrade Project, confirm the command names `claude` and contains no `claude-code`.

- [X] T007 [US2] In [src/speckit/specKitAgent.test.ts](src/speckit/specKitAgent.test.ts), add cases: `resolveSpecKitAgent('claude')` → `claude`, and a guard asserting no input in the contract table ever yields `claude-code`.
- [X] T008 [US2] In [src/speckit/detector.test.ts](src/speckit/detector.test.ts), add tests: with the default (`claude`) provider, both `upgradeProject()` and `upgradeAll()` dispatch `--ai claude`, contain no `claude-code`, and emit the same `--ai` value for the same provider (FR-006).

**Checkpoint**: Default experience succeeds; both P1 stories pass.

---

## Phase 5: User Story 3 - Providers without a direct CLI agent still resolve safely (Priority: P2)

**Goal**: `claude-vscode`, `ide-chat` (host-resolved), and any unrecognized/missing provider all resolve to a valid agent.

**Independent Test**: Set provider to the Claude VS Code panel (→`claude`) and to IDE Chat (→host-appropriate, default `copilot`), trigger upgrade, confirm a valid identifier is sent and the CLI does not error.

- [X] T009 [US3] In [src/speckit/specKitAgent.test.ts](src/speckit/specKitAgent.test.ts), add cases: `claude-vscode`→`claude`; each `ide-chat` host (vscode→`copilot`, cursor→`cursor-agent`, windsurf→`windsurf`, antigravity→`agy`); `ide-chat` with `unknown` host →`copilot`; and `undefined`/`''`/unrecognized provider →`claude` (FR-004, FR-005).

**Checkpoint**: Every supported provider plus the unknown-value fallback resolves to a valid agent.

---

## Phase 6: User Story 4 - Docs no longer point to a setting that doesn't exist (Priority: P2)

**Goal**: No remaining reference to `speckit.workflowEditor.enabled` as a live setting in docs or code.

**Independent Test**: `grep -rn "workflowEditor.enabled" docs/ README.md src/ webview/` returns zero matches.

- [X] T010 [US4] In [docs/how-it-works.md](docs/how-it-works.md), remove both `speckit.workflowEditor.enabled` references: the `// boolean` line in the Configuration Keys block (~L339) and the "Workflow editor not showing: check `speckit.workflowEditor.enabled`" troubleshooting item (~L596). The editor is no longer gated by a user setting, so drop the troubleshooting entry rather than repoint it at another toggle (FR-008, FR-010).
- [X] T011 [P] [US4] Delete the `workflowEditorEnabled: 'speckit.workflowEditor.enabled'` entry from `ConfigKeys` in [src/core/constants.ts](src/core/constants.ts) (~L60). It has zero other usages, so removal is inert (FR-009).

**Checkpoint**: The phantom setting is absent from docs, code, and `package.json`.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify the whole change against the quickstart and success criteria.

- [X] T012 [P] Run quickstart greps: `grep -rn "claude-code" src/speckit/detector.ts` (expect zero — SC-003) and `grep -rn "workflowEditor.enabled" docs/ README.md src/ webview/` (expect zero — SC-006, SC-007).
- [X] T013 Run `npm run compile` then `npm test` and confirm both are green (resolver + dispatch suites pass).
- [X] T014 [P] Confirm [README.md](README.md) needs no change for this fix (no provider added, no live setting removed from its Configuration section) and contains no `workflowEditor.enabled` reference — per plan, the only user-facing doc touched is `docs/how-it-works.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks US1, US2, US3. (US4 is independent of Phase 2.)
- **US1 / US2 / US3 (Phases 3–5)**: All depend on Foundational. Once it's done, their test tasks are independent of one another.
- **US4 (Phase 6)**: Independent — can start immediately, even before Phase 2.
- **Polish (Phase 7)**: Depends on all desired stories being complete.

### Task-Level Dependencies

- T002 → T003 → T004 (host detector → resolver → routing).
- T006, T008 (dispatch tests) depend on T004.
- T005, T007, T009 (pure-function tests) depend on T003.
- T010, T011 depend on nothing (US4 is standalone).
- T012–T014 depend on all implementation/test tasks.

### Parallel Opportunities

- T002 and the entire US4 phase (T010, T011) can run in parallel from the start.
- T011 is [P] with T010 (different files).
- Within the test phases, T005 is [P] (its own file region); dispatch tests in `detector.test.ts` (T006, T008) share a file and run sequentially.
- T012 and T014 are [P] in the polish phase.

---

## Parallel Example

```bash
# From the start, independent tracks:
Track A (engine): T002 → T003 → T004
Track B (docs/code cleanup, US4): T010 (docs/how-it-works.md), T011 (src/core/constants.ts)

# After T003/T004 land, the verification tasks:
T005 (specKitAgent.test.ts) and T006 (detector.test.ts) can be written in parallel.
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup (green baseline).
2. Phase 2: Foundational — build `resolveSpecKitAgent` + `getConfiguredSpecKitAgent`, extract `detectHostIde()`, route both dispatch sites. This alone fixes every provider.
3. Phase 3: US1 — prove a non-Claude provider (Codex) upgrades cleanly. **STOP and VALIDATE** — this is the exact reported bug.

### Incremental Delivery

1. Foundational (+ US4 in parallel, since it's independent) → core fix + clean docs.
2. US1 → non-Claude providers proven (MVP).
3. US2 → default `claude` proven, no `claude-code`.
4. US3 → `claude-vscode`, IDE-Chat host resolution, and fallback proven.
5. Polish → quickstart greps + full test run.

### Notes

- The resolver is shared foundational code; the user-story phases differentiate by *verified behavior*, each independently testable via its own `describe`/`it` block.
- [P] = different files, no dependencies.
- Commit after each logical group; run `npm test` after T004 and again at T013.
