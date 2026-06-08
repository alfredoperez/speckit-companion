# Phase 1 Data Model

This fix introduces no persisted data and no new runtime types. The spec's single key entity is the in-memory command string assembled at dispatch time.

## Entity: AI Provider Dispatch Command

The shell command the extension builds to hand a prompt to a chosen CLI, assembled by `CliTerminalProvider.prepareDispatch()` via `buildPromptDispatchCommand()`.

### Structure

```
<cliInvocation> <permissionFlag><promptFlag>"<substitution>"
```

| Part | Source | OpenCode value (after fix) |
|------|--------|----------------------------|
| `cliInvocation` | `cliBinary` | `opencode` |
| `permissionFlag` | `getPermissionFlag()` → `autoApproveFlag` | `''` (empty for OpenCode) |
| `promptFlag` | `cliPromptFlag()` | **`'run '`** (was `'-p '`) |
| `substitution` | shell-specific `$(cat …)` / `$(Get-Content …)` over the temp file | unchanged |

### The only field that changes

`promptFlag` for OpenCode: `'-p '` → `'run '`. Every other field — binary, permission flag, temp-file substitution — is identical before and after.

### Validation / Invariants

- **OpenCode**: `promptFlag === 'run '`, producing `opencode run "$(cat <tmp>)"`.
- **Regression invariant** (FR-003 / SC-002): for Copilot, Qwen, Codex, Claude, Gemini the assembled command is byte-for-byte identical to before this change. Copilot/Qwen keep `promptFlag === '-p '`; Codex/Claude build their own commands and never read `cliPromptFlag()`.

### State transitions

None — the command is constructed fresh per dispatch and discarded after the temp file is cleaned up.
