# Supported AI Providers

SpecKit Companion dispatches spec commands to the AI assistant you already use. Pick yours with **Settings > speckit.aiProvider**.

<!-- Column count must match the `speckit.aiProvider` enum length in package.json.
     The docs-consistency test in tests/integration/docs-consistency.test.ts enforces this on every `npm test`. -->

| Feature | Claude Code | GitHub Copilot CLI | Gemini CLI | Codex CLI | Qwen Code | OpenCode | IDE Chat | Claude in VS Code | Wibey CLI | Wibey (VS Code) | Antigravity |
|---------|-------------|-------------------|------------|-----------|-----------|----------|----------|-------------------|-----------|-----------------|-------------|
| **Steering File** | CLAUDE.md | .github/copilot-instructions.md | GEMINI.md | AGENTS.md | QWEN.md | AGENTS.md | Not supported | CLAUDE.md | AGENTS.md | AGENTS.md | AGENTS.md |
| **Steering Path** | .claude/steering/ | .github/instructions/*.instructions.md | Hierarchical GEMINI.md | Hierarchical AGENTS.md | .qwen/steering/ | Hierarchical AGENTS.md | Not supported | .claude/steering/ | Project root | Project root | Project root |
| **Agents** | .claude/agents/*.md | .github/agents/*.agent.md | Limited support | Hierarchical AGENTS.md | Not supported | .opencode/agent/*.md | Not supported | .claude/agents/*.md | .wibey/agents/*.md | .wibey/agents/*.md | Not supported |
| **Hooks** | .claude/settings.json | Not supported | Not supported | Not supported | Not supported | Not supported | Not supported | .claude/settings.json | .wibey/hooks/hooks.json | .wibey/hooks/hooks.json | Not supported |
| **MCP Servers** | .claude/settings.json | ~/.copilot/mcp-config.json | ~/.gemini/settings.json | ~/.codex/config.toml | ~/.qwen/settings.json | ~/.opencode/opencode.jsonc | Not supported | .claude/settings.json | .wibey/.mcp.json | .wibey/.mcp.json | Not supported |
| **CLI Command** | `claude` | `ghcs` / `gh copilot` | `gemini` | `codex` | `qwen` | `opencode` | Built-in editor chat (Copilot / Composer / Cascade) | Claude Code GUI panel (no terminal) | `wibey` | Wibey chat panel (no terminal) | `agy` |

Permission behavior (interactive vs. auto-approve) is a separate setting; see [Configuration](./configuration.md#permission-mode).

## IDE Chat

`IDE Chat` is not a CLI. Instead of spawning a terminal, it routes the assembled
prompt to your editor's built-in AI chat (GitHub Copilot in VS Code, Composer in
Cursor, Cascade in Windsurf), detected automatically. Because the chat must
recognize the `/speckit.*` commands, **spec-kit must be initialized for the host
editor** (run **SpecKit: Initialize Workspace**, i.e. `specify init`). When the
workspace is initialized, IDE Chat auto-submits the prompt; when it isn't, it
prefills the chat and shows a warning instead of sending a command the chat can't
run. This is one-way dispatch: it does not read responses back or sync status.

![SpecKit Companion dispatching /speckit.plan into GitHub Copilot Chat in VS Code](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/copilot.png)

## Claude in VS Code

`Claude in VS Code` dispatches to the **Claude Code GUI panel** instead of
spawning the `claude` CLI in a terminal, for users who live in the panel rather
than a terminal. It shares the same `.claude/` setup as the terminal `claude`
provider (steering, agents, hooks, MCP). The extension opens the panel via Claude
Code's URI handler and **prefills** the command; the Claude Code panel exposes no
programmatic submit, so you **press Enter** to run it.
Requires the [Claude Code extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code);
if it isn't installed, the provider suggests switching to terminal `claude`.

![SpecKit Companion dispatching /speckit.implement into the Claude Code panel in VS Code](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/claude-vscode.png)
