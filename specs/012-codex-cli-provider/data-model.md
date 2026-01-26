# Data Model: Codex CLI Provider

**Feature**: 012-codex-cli-provider
**Date**: 2026-01-25

## Type Changes

### AIProviderType Union

```typescript
// Before
export type AIProviderType = 'claude' | 'gemini' | 'copilot';

// After
export type AIProviderType = 'claude' | 'gemini' | 'copilot' | 'codex';
```

### PROVIDER_PATHS Extension

```typescript
export const PROVIDER_PATHS: Record<AIProviderType, ProviderPaths> = {
    // ... existing providers ...

    codex: {
        steeringFile: 'AGENTS.md',
        steeringDir: '.codex',
        steeringPattern: 'AGENTS.md',
        agentsDir: '',  // Codex uses AGENTS.md hierarchy, not separate agents
        agentsPattern: '',
        skillsDir: '.codex/skills',
        skillsPattern: '*/SKILL.md',
        mcpConfigPath: '~/.codex/config.toml',  // Note: home directory, TOML format
        supportsHooks: false,
    },
};
```

## Provider Paths Comparison

| Path Property | Claude | Gemini | Copilot | Codex |
|---------------|--------|--------|---------|-------|
| steeringFile | `CLAUDE.md` | `GEMINI.md` | `.github/copilot-instructions.md` | `AGENTS.md` |
| steeringDir | `.claude/steering` | (empty) | `.github/instructions` | `.codex` |
| steeringPattern | `*.md` | `GEMINI.md` | `*.instructions.md` | `AGENTS.md` |
| agentsDir | `.claude/agents` | (empty) | `.github/agents` | (empty) |
| agentsPattern | `*.md` | (empty) | `*.agent.md` | (empty) |
| skillsDir | `.claude/skills` | (empty) | (empty) | `.codex/skills` |
| skillsPattern | `*/SKILL.md` | (empty) | (empty) | `*/SKILL.md` |
| mcpConfigPath | `.claude/settings.json` | `.gemini/settings.json` | `.copilot/mcp-config.json` | `~/.codex/config.toml` |
| supportsHooks | `true` | `false` | `false` | `false` |

## CodexCliProvider Class

```typescript
export class CodexCliProvider implements IAIProvider {
    public readonly name = 'Codex CLI';

    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private configManager: ConfigManager;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel);

    // IAIProvider interface
    async isInstalled(): Promise<boolean>;
    async executeInTerminal(prompt: string, title?: string): Promise<vscode.Terminal>;
    async executeHeadless(prompt: string): Promise<AIExecutionResult>;
    async executeSlashCommand(command: string, title?: string, autoExecute?: boolean): Promise<vscode.Terminal>;

    // Private helpers
    private async createTempFile(content: string, prefix?: string): Promise<string>;
    private convertPathIfWSL(filePath: string): string;
}
```

## Configuration Schema (package.json)

```json
{
    "speckit.aiProvider": {
        "type": "string",
        "default": "claude",
        "enum": ["claude", "gemini", "copilot", "codex"],
        "enumDescriptions": [
            "Claude Code - Full feature support (steering, agents, hooks, MCP)",
            "Gemini CLI - Steering and MCP support",
            "GitHub Copilot CLI - Steering, agents, and MCP (no hooks)",
            "Codex CLI - Steering, skills, and MCP support"
        ]
    }
}
```

## Command Mapping

| Operation | Command |
|-----------|---------|
| Version check | `codex --version` |
| Terminal prompt | `codex exec --yolo "$(cat "{promptFilePath}")"` |
| Headless prompt | `codex exec --yolo "$(cat "{promptFilePath}")"` |
| Slash command | `codex exec --yolo "Run the following command: {command}"` |

## Feature Support Matrix

| Feature | Claude | Gemini | Copilot | Codex |
|---------|--------|--------|---------|-------|
| Prompt execution | ✅ | ✅ | ✅ | ✅ |
| Headless mode | ✅ | ✅ | ✅ | ✅ |
| Slash commands | ✅ (native) | ✅ (wrapped) | ✅ (wrapped) | ✅ (wrapped) |
| Steering files | ✅ | ✅ | ✅ | ✅ |
| Agents | ✅ | ❌ | ✅ | ❌ |
| Skills | ✅ | ❌ | ❌ | ✅ |
| Hooks | ✅ | ❌ | ❌ | ❌ |
| MCP | ✅ | ✅ | ✅ | ✅ |
| Permissions | ✅ (managed) | ❌ | ❌ | ❌ |

## Validation Rules

1. Provider type must be one of: `'claude' | 'gemini' | 'copilot' | 'codex'`
2. Installation check must verify `codex` command exists
3. Prompt files must be cleaned up after execution (30s delay)
4. WSL path conversion applies on Windows platform
5. Terminal delay uses configured value (default 800ms)
