# Contract: CLI Dispatch Command Strings

The "interface" this CLI-integration feature exposes is the exact shell command sent to the terminal for each provider. This contract pins the OpenCode change and the no-regression guarantee for the others. `<tmp>` denotes the generated temp prompt-file path.

## OpenCode — the fix

| Shell | Before (broken) | After (fixed) |
|-------|-----------------|---------------|
| bash / unknown | `opencode -p "$(cat "<tmp>")"` | `opencode run "$(cat "<tmp>")"` |
| PowerShell | `opencode -p "$(Get-Content -Raw '<tmp>')"` | `opencode run "$(Get-Content -Raw '<tmp>')"` |
| cmd.exe | `opencode -p "<inline prompt>"` | `opencode run "<inline prompt>"` |

**Required behavior**: the `After` command causes OpenCode to read the message and start its task (FR-002 / SC-001). Only the `-p ` → `run ` token differs; temp-file delivery and the `"$(cat …)"` substitution are unchanged (FR-004).

## Regression matrix — MUST stay byte-for-byte unchanged (FR-003 / SC-002)

| Provider | Command (bash) | Why unaffected |
|----------|----------------|----------------|
| GitHub Copilot | `copilot -p "$(cat "<tmp>")"` | keeps default `cliPromptFlag()` = `-p `; native temp path; slash stripped in `preprocessPrompt` |
| Qwen | `qwen --yolo -p "$(cat "<tmp>")"` | keeps default `-p `; `--yolo` permission flag intact |
| Codex | `cat "<tmp>" | codex exec -` | overrides `prepareDispatch()`; never reads `cliPromptFlag()` |
| Claude Code | builds its own command (system-prompt aware) | does not use the default prompt flag |
| Gemini | starts interactively, then sends the prompt | outside the `CliTerminalProvider` dispatch path |

## Verification

- **Automated**: `src/ai-providers/__tests__/openCodeDispatch.test.ts` instantiates `OpenCodeProvider` and asserts the dispatched `commandLine` contains `opencode run "` and does **not** contain `-p`; it also asserts `QwenCliProvider` / `CopilotCliProvider` still emit their `-p ` forms (regression guard).
- **Manual**: see [quickstart.md](../quickstart.md).
