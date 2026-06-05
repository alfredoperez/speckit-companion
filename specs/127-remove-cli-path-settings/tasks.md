# Tasks: Remove CLI Path Override Settings

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** Drop the path-override abstraction from the base provider — `src/ai-providers/cliTerminalProvider.ts` | R002
  - **Do**: Remove the abstract `cliPathSettingKey` field and the `getCliPath()` method. In `prepareDispatch`, resolve `cliPath` from `this.cliBinary` directly instead of `this.getCliPath()`.
  - **Verify**: File no longer references `cliPathSettingKey` or `getCliPath`; `prepareDispatch` uses `this.cliBinary`.
  - **Leverage**: existing `cliBinary` field already used by `isInstalled()`.

- [x] **T002** [P] Remove path key from Copilot provider *(depends on T001)* — `src/ai-providers/copilotCliProvider.ts` | R002
  - **Do**: Delete the `protected readonly cliPathSettingKey = 'copilotPath';` line.
  - **Verify**: No `cliPathSettingKey` reference remains.

- [x] **T003** [P] Remove path key from Qwen provider *(depends on T001)* — `src/ai-providers/qwenCliProvider.ts` | R002
  - **Do**: Delete the `protected readonly cliPathSettingKey = 'qwenPath';` line.
  - **Verify**: No `cliPathSettingKey` reference remains.

- [x] **T004** [P] Remove path key from OpenCode provider *(depends on T001)* — `src/ai-providers/openCodeProvider.ts` | R002
  - **Do**: Delete the `protected readonly cliPathSettingKey = 'opencodePath';` line.
  - **Verify**: No `cliPathSettingKey` reference remains.

- [x] **T005** [P] Remove null path key from Claude provider *(depends on T001)* — `src/ai-providers/claudeCodeProvider.ts` | R001, R002
  - **Do**: Delete the `protected readonly cliPathSettingKey = null;` line (field no longer exists on base).
  - **Verify**: No `cliPathSettingKey` reference remains.

- [x] **T006** [P] Remove null path key from Codex provider *(depends on T001)* — `src/ai-providers/codexCliProvider.ts` | R002
  - **Do**: Delete the `protected readonly cliPathSettingKey = null;` line.
  - **Verify**: No `cliPathSettingKey` reference remains.

- [x] **T007** [P] Collapse Gemini provider to bare binary + hard-coded delay — `src/ai-providers/geminiCliProvider.ts` | R002, R004
  - **Do**: Remove the `getCliPath()` override (use the bare `gemini` binary) and the `geminiInitDelay` config read; hard-code the 8000ms init delay.
  - **Verify**: No `geminiPath` or `geminiInitDelay` reference remains; init delay is a literal `8000`.

- [x] **T008** [P] Strip path + delay settings from manifest — `package.json` | R001, R004
  - **Do**: Remove the `speckit.claudePath`, `speckit.geminiPath`, `speckit.copilotPath`, `speckit.qwenPath`, `speckit.opencodePath`, and `speckit.geminiInitDelay` properties from `contributes.configuration`.
  - **Verify**: `grep -E "claudePath|geminiPath|copilotPath|qwenPath|opencodePath|geminiInitDelay" package.json` returns nothing.

- [x] **T009** [P] Remove orphaned keys from constants — `src/core/constants.ts` | R003, R004
  - **Do**: Remove `claudePath`, `qwenPath`, `geminiInitDelay` from `ConfigKeys`; remove `geminiInitDelay` (field + comment) from `Timing`.
  - **Verify**: No `claudePath` / `qwenPath` / `geminiInitDelay` reference remains in the file.

- [x] **T010** Build, sweep for stragglers, and run tests *(depends on T002, T003, T004, T005, T006, T007, T008, T009)* — `(repo-wide)` | R005, R006
  - **Do**: `grep -rn "cliPathSettingKey\|getCliPath\|geminiInitDelay\|claudePath\|geminiPath\|copilotPath\|qwenPath\|opencodePath" src/ webview/src/` and clean any remaining references (incl. tests). Run `npm run compile` then `npm test`. Confirm README has no doc section for these settings (grep already shows none).
  - **Verify**: Compile passes, tests pass, grep returns no stragglers.
