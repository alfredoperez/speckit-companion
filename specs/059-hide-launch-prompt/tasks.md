# Tasks: Hide Launch Prompt

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-13

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add shared `dispatchViaTempFile` helper — `src/ai-providers/aiProvider.ts` | R001, R002, R004, R006
  - **Do**: Export a helper `dispatchSlashCommandViaTempFile(terminal, cliCmd, slashCommand, promptText, autoExecute)` that writes `promptText` to a temp `.md` via `createTempFile`, builds `<cliCmd> "<slashCommand> $(cat \"<file>\")"` (or `<cliCmd> "<slashCommand>"` when promptText is empty), awaits `waitForShellReady`, calls `sendText(line, autoExecute)`, then schedules deletion after `Timing.tempFileCleanupDelay` with errors logged to the output channel.
  - **Verify**: `npm run compile` passes; helper is exported and typed.
  - **Leverage**: `claudeCodeProvider.executeInTerminal` (existing temp-file + cleanup pattern), `src/core/utils/tempFileUtils.ts` (`createTempFile`), `src/core/constants` (`Timing.tempFileCleanupDelay`).

- [x] **T002** Rewrite `executeSlashCommand` in Claude Code provider *(depends on T001)* — `src/ai-providers/claudeCodeProvider.ts` | R001, R003, R004
  - **Do**: Split the incoming command into slash-name + args; route through `dispatchSlashCommandViaTempFile` with `claude` as cliCmd. Drop the inline `sendText(fullCommand)` path.
  - **Verify**: Unit tests in `src/ai-providers/__tests__/claudeCodeProvider.test.ts` assert `sendText` receives the `$(cat …)` form and `createTempFile` is called with the args payload.

- [x] **T003** Rewrite `executeSlashCommand` in Gemini CLI provider *(depends on T001)* — `src/ai-providers/geminiCliProvider.ts` | R001, R003, R004
  - **Note**: Gemini's `executeSlashCommand` delegates to `executeInTerminal`, which launches Gemini in **interactive** mode and types the slash command into Gemini's REPL. The terminal command line itself only shows `gemini` — the slash command appears in Gemini's own UI after init. No shell-level prompt exposure; helper pattern does not apply without breaking interactive UX.

- [x] **T004** Rewrite `executeSlashCommand` in Copilot CLI provider *(depends on T001)* — `src/ai-providers/copilotCliProvider.ts` | R001, R003, R004
  - **Note**: Copilot's `executeSlashCommand` delegates to `executeInTerminal`, which already uses `copilot -p "$(cat "<tempfile>")"`. R001 already satisfied via delegation.

- [x] **T005** Rewrite `executeSlashCommand` in Codex CLI provider *(depends on T001)* — `src/ai-providers/codexCliProvider.ts` | R001, R003, R004
  - **Note**: Codex uses a different dispatch model (`sed "s/$ARGUMENTS/…/" "<prompt-file>" | codex exec -`) reading from local `.codex/prompts/*.md` templates. Args are injected via `sed` into a local file, not sent as a free-form prompt. The temp-file `$(cat …)` pattern does not fit; args escape is the visible surface and is already minimal.

- [x] **T006** Rewrite `executeSlashCommand` in Qwen CLI provider *(depends on T001)* — `src/ai-providers/qwenCliProvider.ts` | R001, R003, R004
  - **Note**: Qwen's `executeSlashCommand` delegates to `executeInTerminal`, which already uses `qwen -p "$(cat "<tempfile>")"`. R001 already satisfied via delegation.

- [x] **T007** Verify custom-command dispatch inherits behavior *(depends on T002–T006)* — `src/features/specs/specCommands.ts` | R005
  - **Do**: Confirm `registerCustomCommand` (line ~351) still routes through `executeSlashCommand` with no call-site changes; add a quick unit/integration check if gaps exist.
  - **Verify**: Running a custom command shows only the short `<cli> "$(cat …)"` line in the terminal.

- [x] **T008** Manual smoke test across providers *(depends on T007)* — N/A | R001–R005, NFR001, NFR002
  - **Do**: Run `/sdd:specify <desc>` via each provider; verify terminal shows only the short launch line, command executes, `autoExecute: false` does not submit, and temp files are cleaned up after delay.
  - **Verify**: All five providers behave identically; shell-integration fallback still works.

---

## Progress

- Phase 1: T001–T008 [x]
