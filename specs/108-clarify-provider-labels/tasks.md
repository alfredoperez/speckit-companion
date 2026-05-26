# Tasks: Clarify AI Provider Dropdown Labels

**Feature**: 108-clarify-provider-labels | **Branch**: `107-fix-inline-comment-persistence` (PR stack)  
**Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

---

## Summary

4 changes across 4 files, ~50 lines. No new classes, no migration, pure display layer. Task count: **9 tasks**.

| Phase                                 | Story | Tasks     |
| ------------------------------------- | ----- | --------- |
| 1 — Setup                             | —     | T001      |
| 2 — US1: Settings Editor Labels       | P1    | T002–T003 |
| 3 — US2: IDE-Aware `ide-chat` Label   | P2    | T004–T006 |
| 4 — US3: Consistent Labels Everywhere | P3    | T007–T008 |
| 5 — Polish                            | —     | T009      |

**MVP scope**: Phase 1 + Phase 2 (US1) — settings editor shows recognizable names immediately.

---

## Phase 1: Setup

**Goal**: Confirm baseline builds clean and all current `displayName` tests pass before touching anything.

**Independent Test**: `npm run compile` exits 0; `npm test` exits 0.

- [x] T001 Verify baseline — run `npm run compile && npm test` and confirm green before any edits

---

## Phase 2: User Story 1 — Recognizable Provider Labels in the Dropdown (P1)

**Goal**: Every provider option in the VS Code settings editor and custom QuickPick shows a human-readable brand name instead of the raw enum key.

**Independent Test**: Open **Settings → SpecKit → AI Provider** dropdown. Every entry now shows a friendly label (e.g., "Claude Code", "GitHub Copilot CLI") instead of `claude`, `copilot`, etc.

### Implementation for User Story 1

- [x] T002 [US1] Add `enumItemLabels` array to `speckit.aiProvider` in `package.json`

  ```json
  "enumItemLabels": [
    "Claude Code",
    "Claude Code (VS Code)",
    "Gemini CLI",
    "GitHub Copilot CLI",
    "Codex CLI",
    "Qwen Code",
    "OpenCode",
    "IDE Chat (Copilot · Cursor · Windsurf)"
  ]
  ```

- [x] T003 [US1] Update all 8 `displayName` strings in `PROVIDER_PATHS` in `src/ai-providers/aiProvider.ts`:
  - `claude` → `'Claude Code'`
  - `claude-vscode` → `'Claude Code (VS Code)'`
  - `gemini` → `'Gemini CLI'`
  - `copilot` → `'GitHub Copilot CLI'`
  - `codex` → `'Codex CLI'`
  - `qwen` → `'Qwen Code'`
  - `opencode` → `'OpenCode'` (unchanged)
  - `ide-chat` → `'IDE Chat'` (static fallback; runtime label added in T005)

**Checkpoint**: `npm run compile` passes. Open Settings dropdown — all labels show brand names.

---

## Phase 3: User Story 2 — IDE-Aware Label for `ide-chat` (P2)

**Goal**: The `ide-chat` option in the QuickPick shows "GitHub Copilot" in VS Code, "Cursor Chat" in Cursor, "Windsurf Chat" in Windsurf, and "IDE Chat" as fallback.

**Independent Test**: Launch the extension host in VS Code (`F5`). Open the SpecKit provider QuickPick (via command palette: "SpecKit: Set AI Provider"). The `ide-chat` entry shows "GitHub Copilot" not "IDE Chat".

### Implementation for User Story 2

- [x] T004 [US2] Add exported `getIdeChatDisplayName(): string` function in `src/ai-providers/ideChatProvider.ts`

  ```ts
  const IDE_DISPLAY_NAMES: Record<HostIde, string> = {
    vscode: 'GitHub Copilot',
    cursor: 'Cursor Chat',
    windsurf: 'Windsurf Chat',
    antigravity: 'IDE Chat',
    unknown: 'IDE Chat',
  };
  export function getIdeChatDisplayName(): string { ... }
  ```

  Update `detectHostIde()` to delegate to `getIdeChatDisplayName()` to avoid duplication.

- [x] T005 [P] [US2] Add exported `getProviderDisplayName(type: AIProviderType): string` in `src/ai-providers/aiProvider.ts`

  ```ts
  export function getProviderDisplayName(type: AIProviderType): string {
    if (type === AIProviders.IDE_CHAT) return getIdeChatDisplayName();
    return PROVIDER_PATHS[type].displayName;
  }
  ```

- [x] T006 [US2] Update the QuickPick label in `src/ai-providers/aiProvider.ts` to call `getProviderDisplayName(type)` instead of `p.quickPickIcon + p.displayName`

**Checkpoint**: `F5` launch, open provider QuickPick in VS Code → `ide-chat` entry reads "GitHub Copilot". `npm run compile` passes.

---

## Phase 4: User Story 3 — Consistent Labels Everywhere (P3)

**Goal**: The sidebar steering tree node that shows the active provider also displays the friendly name.

**Independent Test**: Set the provider to `ide-chat`. The SpecKit sidebar tree's provider header node shows "GitHub Copilot" (in VS Code), not "ide-chat" or "IDE Chat".

### Implementation for User Story 3

- [x] T007 [US3] In `src/features/steering/steeringExplorerProvider.ts`, import and use `getProviderDisplayName` for the provider tree header

- [x] T008 [P] [US3] Workspace search for remaining `providerPaths.displayName` usages — none found (no-op)

**Checkpoint**: Sidebar tree header shows IDE-specific "GitHub Copilot" (or correct brand name) for the active provider.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T009 No test updates needed — no tests asserted on old displayName strings

**Final check**: `npm run compile && npm test` — both pass. Open Settings dropdown, QuickPick, and sidebar tree — all show consistent friendly labels.

---

## Dependencies

```
T001 (baseline)
  └── T002, T003 (US1 — parallel, both only touch separate keys/lines)
        └── T004 (US2 — needs T003's PROVIDER_PATHS to be clean first)
              └── T005 (US2 — needs getIdeChatDisplayName from T004)
                    └── T006 (US2 — needs getProviderDisplayName from T005)
                    └── T007 (US3 — needs getProviderDisplayName from T005)
                          └── T008 (US3 — search pass, needs T007 done first)
T009 (polish — can run after T003 without blocking T004+)
```

**Parallel opportunities**: T002+T003 can be done in one pass (different sections of `package.json` vs `aiProvider.ts`). T005+T007 can be done together after T004.
