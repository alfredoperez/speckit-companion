# Data Model: Fix Upgrade Agent & Stale Setting Docs

**Branch**: `122-fix-upgrade-ai-agent` | **Date**: 2026-06-04

This feature introduces no persisted state and no new storage. The "entities" are in-memory value mappings and the inputs/outputs of a pure resolution function. They are documented here so the contract is unambiguous.

## Entities

### AI Provider setting

The user's configured assistant, read from `speckit.aiProvider` (VS Code settings). Domain is the `AIProviders` enum:

| Value           | Meaning                          |
|-----------------|----------------------------------|
| `claude`        | Claude terminal CLI (default)    |
| `claude-vscode` | Claude Code VS Code panel        |
| `gemini`        | Gemini CLI                       |
| `copilot`       | GitHub Copilot CLI               |
| `codex`         | Codex CLI                        |
| `qwen`          | Qwen Code CLI                    |
| `opencode`      | OpenCode CLI                     |
| `ide-chat`      | Host editor's built-in chat      |

Validation: any value outside this set (missing, empty, stale/renamed enum) is treated as **unrecognized** and resolves to the safe default agent.

### Host IDE

The detected host editor, used only when the provider is `ide-chat`. Domain (`HostIde`), produced from `vscode.env.uriScheme` with `vscode.env.appName` fallback:

`vscode` | `cursor` | `windsurf` | `antigravity` | `unknown`

### Spec-kit agent identifier

The output value passed to the CLI as `specify init … --ai <agent>`. Must always be a member of the CLI's accepted set (see research.md §1). The extension only emits: `claude`, `gemini`, `copilot`, `codex`, `qwen`, `opencode`, `cursor-agent`, `windsurf`, `agy`.

## Mapping rules (the resolution function)

`resolveSpecKitAgent(provider, host) → agent`

1. **Direct providers** — `claude`/`claude-vscode` → `claude`; `gemini` → `gemini`; `copilot` → `copilot`; `codex` → `codex`; `qwen` → `qwen`; `opencode` → `opencode`.
2. **IDE Chat** — when `provider === 'ide-chat'`, resolve by `host`: `vscode` → `copilot`; `cursor` → `cursor-agent`; `windsurf` → `windsurf`; `antigravity` → `agy`; `unknown` → `copilot`.
3. **Fallback** — any unrecognized/missing provider → `claude`.

Invariants:

- The function is **total**: every possible input yields a valid agent; it never returns `claude-code` or any non-CLI value.
- The function is **pure**: no I/O, no config reads — inputs in, agent out. The impure wrapper (`getConfiguredSpecKitAgent()`) reads the provider setting and detects the host, then calls this function.

## Removed entity

### `speckit.workflowEditor.enabled` (deleted)

A configuration key constant (`ConfigKeys.workflowEditorEnabled`) and two documentation references describing a setting the extension no longer contributes. No runtime reads exist. Status after this change: **absent everywhere** — not declared in `package.json`, not named in docs, not present as a constant.

## State transitions

None. The resolution is stateless and recomputed on each upgrade dispatch.
