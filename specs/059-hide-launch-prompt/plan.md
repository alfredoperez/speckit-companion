# Plan: Hide Launch Prompt

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-13

## Approach

Split every slash-command launch into two parts: the **command name** stays visible in the terminal, and **everything after it** (args + appended tracking boilerplate) is written to a temp `.md` file and inlined via `$(cat …)`. Dispatch form: `<cli> "<slash-command> $(cat "<tempfile>")"`. The user always sees which skill is running; multi-paragraph prompts stay hidden.

Example:

```
claude "/sdd:specify $(cat "/tmp/speckit-prompt-a3f2.md")"
```

Temp file contents: `<user-description>\n\n<tracking instructions>`.

## Technical Context

**Stack**: TypeScript 5.3+, VS Code Extension API
**Key Dependencies**: existing `createTempFile` util (`src/core/utils/tempFileUtils.ts`), `Timing.tempFileCleanupDelay` constant
**Constraints**: preserve `autoExecute` semantics and `waitForShellReady` behavior; POSIX shells only (matches current assumption)

## Files

### Create

_(none — reuse existing `createTempFile` + `Timing` utilities)_

### Modify

- `src/ai-providers/claudeCodeProvider.ts` — rewrite `executeSlashCommand` to split command name from args, write args+appended content to temp `.md`, send `claude "<slash-command> $(cat "<file>")"`, schedule cleanup. If args are empty, skip the temp file and send just `<cli> "<slash-command>"`.
- `src/ai-providers/geminiCliProvider.ts` — same pattern with `gemini` binary
- `src/ai-providers/copilotCliProvider.ts` — same pattern with `copilot` binary
- `src/ai-providers/codexCliProvider.ts` — same pattern with `codex` binary
- `src/ai-providers/qwenCliProvider.ts` — same pattern with `qwen` binary
- `src/ai-providers/aiProvider.ts` — if a shared helper makes sense, extract a `dispatchViaTempFile(terminal, cliCmd, promptText)` helper; otherwise leave interface untouched

## Testing Strategy

- **Unit**: extend existing provider tests under `src/ai-providers/__tests__/` to assert `sendText` receives the `$(cat …)` form and that `createTempFile` is called with the command payload
- **Manual**: run `/sdd:specify <desc>` via each provider's launch path; confirm terminal shows only the short `<cli> "$(cat …)"` line and the command executes correctly; verify `autoExecute: false` does not submit

## Risks

- Shell-quoting regressions across providers: mitigate by routing all five through one shared helper so quoting logic lives in one place
- Temp-file cleanup race with slow shell integration: reuse the proven `Timing.tempFileCleanupDelay` delay already used by `executeInTerminal`
