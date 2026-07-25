# Tasks: CLI/Terminal Install Nudge for the Companion Extension

**Feature**: `564-cli-install-nudge` · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Task line format: `- [ ] **T###** [P?] [US#] Description · path`

## Phase 1: Setup

No new tooling or config. The change extends existing modules.

## Phase 2: Foundational (blocks all stories)

These build the shared predicate, classifier, and telemetry surface that every story depends on.

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US3] Add `providerDispatchesToTerminal(type)` and `EDITOR_DISPATCH_PROVIDERS` (IDE_CHAT, CLAUDE_VSCODE, WIBEY_VSCODE; neutral default = terminal) · src/ai-providers/aiProvider.ts
- [x] **T002** [P] [US1] Add `'terminal'` to the `InstallPromptSurface` union and the `INSTALL_PROMPT_SURFACES` set · src/core/telemetry.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** [US1] Create the nudge module: pure `shouldShowCliInstallNudge(input)` predicate + `maybeShowCliInstallNudge(context, root, providerType)` wrapper (session guard, same-gated `reportInstallPromptShown('terminal')`, non-blocking notification with Install/Don't-show-again, try/catch so it never throws) + a test-only session reset · src/speckit/cliInstallNudge.ts

## Phase 3: User Story 1 — Discover from the terminal flow (P1)

**Goal**: A terminal-CLI user dispatching a stock command sees the install hint once and the run proceeds.

**Independent Test**: With spec-kit detected, companion absent, not dismissed, dispatch a stock command via a terminal provider → one hint, command still runs.

### Implementation

**Wave 2 — single (edits one file, depends on T003):**

- [x] **T004** [US1] Wire `maybeShowCliInstallNudge` into the terminal stock-command dispatch chokepoints in `registerPhaseCommands`/`executeWorkflowStep`: call it before `executeInTerminal` when dispatching a stock `speckit.*` command, only when NOT `resolution.fellBack` (the fallback path already warns) · src/features/specs/specCommands.ts

**Checkpoint**: Story 1 works — the hint renders on a stock terminal dispatch and the command dispatches.

## Phase 4: User Story 2 — Never be nagged twice (P1)

**Goal**: One shared dismissal suppresses the hint on every surface, across sessions.

**Independent Test**: Dismiss from any surface → no terminal hint.

### Tests

- [x] **T005** [P] [US2] Test: `shouldShowCliInstallNudge` returns false when `dismissed` is true, and the wrapper reads `installNudgeDismissed` from globalState · src/speckit/__tests__/cliInstallNudge.test.ts

**Checkpoint**: The shared-dismissal path is covered (implementation reuses existing `dismissInstallNudge`; no new code beyond T003).

## Phase 5: User Story 3 — Stay quiet when not warranted (P2)

**Goal**: No hint for installed users, non-spec-kit projects, or editor-chat providers.

**Independent Test**: Each of (installed) / (no `.specify`) / (editor provider) → no hint.

### Tests

- [x] **T006** [P] [US3] Test: gate returns false when companion installed, when spec-kit not detected, when provider does not dispatch to terminal, and when already shown this session; returns true only on the full positive combination · src/speckit/__tests__/cliInstallNudge.test.ts
- [x] **T007** [P] [US3] Test: `providerDispatchesToTerminal` classifies every `AIProviders` enum value, with the three editor providers false and all others true (exhaustiveness) · src/ai-providers/__tests__/aiProvider.terminal.test.ts

**Checkpoint**: Gating is proven for every non-warranted case.

## Phase 6: Polish

**Wave 3 — independent (different files):**

- [x] **T008** [P] [US1] Test: the telemetry `shown` emit is gated on the same predicate as the render (no emit when the gate is false; one emit when true) · src/speckit/__tests__/cliInstallNudge.test.ts
- [x] **T009** [P] [US1] Document the terminal install surface in the README "Get Companion" / install-nudge section · README.md

**⟶ Wait, then:**

- [x] **T010** Validate against Success Criteria — run `npm run compile && npm test` (and `npm run package` if the manifest changed) · repo root

## Dependencies & Execution Order

- **Phase 2 (Foundational)** blocks everything. Wave 1 (T001, T002) is independent; T003 depends on both.
- **Phase 3** T004 depends on T003.
- **Phases 4–5** tests depend on T003 (and T001 for T007); independent of each other.
- **Phase 6** T008/T009 independent; T010 (validation) runs last.
