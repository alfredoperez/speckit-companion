# Contract: Spec-kit agent resolution

The extension exposes one internal contract for this feature: a pure function that maps the configured provider (plus host, for IDE Chat) to a spec-kit agent identifier, and an impure wrapper that supplies those inputs from the environment. Both upgrade dispatch paths consume the wrapper.

## `resolveSpecKitAgent(provider, host)` — pure

**Input**

- `provider: string | undefined` — raw value of `speckit.aiProvider` (may be undefined/empty/stale).
- `host: HostIde` — `'vscode' | 'cursor' | 'windsurf' | 'antigravity' | 'unknown'`; only consulted when `provider === 'ide-chat'`.

**Output**

- `agent: string` — always a member of the spec-kit CLI accepted set. Never `claude-code`.

**Contract table**

| provider        | host          | → agent        |
|-----------------|---------------|----------------|
| `claude`        | *(any)*       | `claude`       |
| `claude-vscode` | *(any)*       | `claude`       |
| `gemini`        | *(any)*       | `gemini`       |
| `copilot`       | *(any)*       | `copilot`      |
| `codex`         | *(any)*       | `codex`        |
| `qwen`          | *(any)*       | `qwen`         |
| `opencode`      | *(any)*       | `opencode`     |
| `ide-chat`      | `vscode`      | `copilot`      |
| `ide-chat`      | `cursor`      | `cursor-agent` |
| `ide-chat`      | `windsurf`    | `windsurf`     |
| `ide-chat`      | `antigravity` | `agy`          |
| `ide-chat`      | `unknown`     | `copilot`      |
| `undefined`/`''`/unknown value | *(any)* | `claude` |

**Guarantees**

- Total: no input throws; every input returns a valid agent.
- Pure: no config reads, no `vscode` API calls, no side effects.
- `claude-code` never appears in any output.

## `getConfiguredSpecKitAgent()` — impure wrapper

**Behavior**

1. Read `speckit.aiProvider` from `vscode.workspace.getConfiguration`.
2. Detect the host via the shared `detectHostIde()` (only meaningful for `ide-chat`).
3. Return `resolveSpecKitAgent(provider, host)`.

**Consumers**: `SpecKitDetector.upgradeProject()` and `SpecKitDetector.upgradeAll()` build their terminal command as
`specify init --here --force --ai ${getConfiguredSpecKitAgent()}`.

## Test contract (BDD)

Pure-function tests (`describe('resolveSpecKitAgent')`):

- maps every direct provider to its agent (one `it` per row).
- maps `claude-vscode` to `claude`.
- resolves each `ide-chat` host to the right agent (vscode→copilot, cursor→cursor-agent, windsurf→windsurf, antigravity→agy).
- falls back to `copilot` for `ide-chat` with `unknown` host.
- falls back to `claude` for undefined / empty / unrecognized provider values.
- never returns the string `claude-code` for any input in the table.

Dispatch tests (`describe('upgradeProject' / 'upgradeAll')`):

- the dispatched terminal text contains `--ai <resolved>` and does **not** contain `claude-code`, for at least the default (`claude`) and one non-Claude (`codex`) provider.
- both upgrade paths produce the same `--ai` value for the same provider.
