# Research: Codex CLI Provider

**Feature**: 012-codex-cli-provider
**Date**: 2026-01-25

## Research Questions

### RQ-1: Codex CLI Command Structure

**Decision**: Use `codex exec` subcommand for non-interactive execution with `--yolo` flag for bypassing approvals.

**Rationale**:
- `codex` (no subcommand) launches interactive TUI - unsuitable for extension automation
- `codex exec` (alias: `codex e`) runs non-interactively, designed for automation
- `--dangerously-bypass-approvals-and-sandbox` (or `--yolo`) provides equivalent to Claude's `--permission-mode bypassPermissions`
- Prompts can be passed directly as positional argument or via stdin with `-`

**Alternatives Considered**:
- `--full-auto` flag: Lower friction but still may prompt for some approvals
- Interactive mode with prompt injection: More complex, less reliable

**Command Patterns**:
```bash
# Terminal execution (visible, with approval bypass)
codex exec --yolo "PROMPT"

# Alternative: pipe from file
codex exec --yolo - < prompt.md

# Alternative: cat command substitution (matches Claude pattern)
codex exec --yolo "$(cat /path/to/prompt.md)"
```

### RQ-2: Installation Detection

**Decision**: Check for `codex --version` command.

**Rationale**: Standard CLI pattern used by all existing providers. Codex CLI follows npm installation via `npm i -g @openai/codex`.

**Command**: `codex --version`

### RQ-3: Headless/Background Execution

**Decision**: Use `codex exec` with `--json` flag for structured output in headless mode.

**Rationale**:
- `codex exec --json` prints newline-delimited JSON events
- `--output-last-message path` can write final response to file
- Better exit code tracking than raw terminal execution

**Headless Pattern**:
```bash
codex exec --yolo --json "PROMPT"
```

### RQ-4: Slash Command Execution

**Decision**: Convert slash commands to prompts with instruction to run the command.

**Rationale**:
- Codex CLI doesn't have native slash command support like Claude Code
- Skills are invoked with `$skill-name` syntax, not `/command`
- Best approach: wrap command in instruction prompt

**Pattern**:
```bash
codex exec --yolo "Run the following SpecKit command: /speckit.plan"
```

### RQ-5: Provider-Specific File Paths

**Decision**: Map Codex file conventions to ProviderPaths interface.

**Findings**:
| File Type | Codex Path | Notes |
|-----------|------------|-------|
| Steering File | `AGENTS.md` | Equivalent to CLAUDE.md |
| Steering Directory | `.codex/` | Additional AGENTS.md files |
| Agents Directory | N/A | Codex uses AGENTS.md hierarchy |
| Skills Directory | `.codex/skills` | Skill folders with SKILL.md |
| MCP Config | `~/.codex/config.toml` | TOML format (not JSON) |
| Hooks | Not supported | No hook system in Codex |

**Rationale**: AGENTS.md serves same purpose as CLAUDE.md (project instructions). Skills are in `.codex/skills/*/SKILL.md` format similar to Claude's skill structure.

### RQ-6: Windows/WSL Support

**Decision**: Apply same WSL path conversion as Claude Code provider.

**Rationale**:
- Codex CLI documentation notes "Windows support is experimental"
- Recommends using WSL for best experience
- Existing `convertPathIfWSL` helper already handles path translation

### RQ-7: Permission/Authentication

**Decision**: Do not manage authentication; let Codex CLI handle it.

**Rationale**:
- Codex CLI has its own `codex auth` command for setup
- Uses ChatGPT OAuth, device auth, or API key
- Extension should detect and guide user, not manage auth directly
- Matches spec assumption: "Users will authenticate Codex CLI independently"

### RQ-8: MCP Configuration Location

**Decision**: Use `~/.codex/config.toml` as MCP config path (home directory).

**Rationale**:
- Codex MCP servers configured in main config file
- `[mcp]` section in config.toml
- Can also use `codex mcp add/remove` CLI commands
- Different from Claude's per-project `.claude/settings.json`

## Technology Mapping

| Claude Code | Codex CLI | Notes |
|-------------|-----------|-------|
| `claude` | `codex exec` | Non-interactive execution |
| `--permission-mode bypassPermissions` | `--yolo` / `--dangerously-bypass-approvals-and-sandbox` | Bypass approvals |
| `CLAUDE.md` | `AGENTS.md` | Steering file |
| `.claude/steering/` | `.codex/` hierarchy | Additional steering |
| `.claude/agents/` | N/A (uses AGENTS.md) | Agent definitions |
| `.claude/skills/` | `.codex/skills/` | Skill definitions |
| `.claude/settings.json` | `~/.codex/config.toml` | Config location |
| Hooks | Not supported | N/A |

## Sources

- [Codex CLI Reference](https://developers.openai.com/codex/cli/reference/)
- [Codex CLI Features](https://developers.openai.com/codex/cli/features/)
- [AGENTS.md Guide](https://developers.openai.com/codex/guides/agents-md)
- [Codex Skills](https://developers.openai.com/codex/skills/)
- [@openai/codex npm package](https://www.npmjs.com/package/@openai/codex)
