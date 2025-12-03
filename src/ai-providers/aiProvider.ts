import * as vscode from 'vscode';

/**
 * Result from executing an AI command
 */
export interface AIExecutionResult {
    exitCode: number | undefined;
    output?: string;
}

/**
 * Abstract interface for AI assistant providers.
 * Implementations can support different AI CLI tools (Claude Code, Gemini CLI, etc.)
 */
export interface IAIProvider {
    /**
     * The name of the AI provider (e.g., "Claude Code", "Gemini CLI")
     */
    readonly name: string;

    /**
     * Check if the AI CLI is installed and available
     */
    isInstalled(): Promise<boolean>;

    /**
     * Execute a prompt in a visible terminal (split view)
     * @param prompt The prompt to send to the AI
     * @param title The terminal title
     * @returns The terminal instance
     */
    executeInTerminal(prompt: string, title?: string): Promise<vscode.Terminal>;

    /**
     * Execute a prompt in headless/background mode
     * @param prompt The prompt to send to the AI
     * @returns Execution result with exit code
     */
    executeHeadless(prompt: string): Promise<AIExecutionResult>;

    /**
     * Execute a slash command
     * @param command The slash command (e.g., "/speckit.specify")
     * @param title Optional terminal title
     * @param autoExecute If false, shows command but waits for user to press Enter (default: true)
     */
    executeSlashCommand(command: string, title?: string, autoExecute?: boolean): Promise<vscode.Terminal>;
}

/**
 * Supported AI provider types
 */
export type AIProviderType = 'claude' | 'gemini' | 'copilot';

/**
 * Provider configuration paths and patterns
 */
export interface ProviderPaths {
    /** Main steering file name (e.g., CLAUDE.md, GEMINI.md) */
    steeringFile: string;
    /** Directory for additional steering files */
    steeringDir: string;
    /** Pattern for steering files in the directory */
    steeringPattern: string;
    /** Directory for agent definitions */
    agentsDir: string;
    /** Pattern for agent files */
    agentsPattern: string;
    /** Path to MCP config file (relative to home) */
    mcpConfigPath: string;
    /** Whether hooks are supported */
    supportsHooks: boolean;
}

/**
 * Provider paths configuration for each provider type
 */
export const PROVIDER_PATHS: Record<AIProviderType, ProviderPaths> = {
    claude: {
        steeringFile: 'CLAUDE.md',
        steeringDir: '.claude/steering',
        steeringPattern: '*.md',
        agentsDir: '.claude/agents',
        agentsPattern: '*.md',
        mcpConfigPath: '.claude/settings.json',
        supportsHooks: true,
    },
    gemini: {
        steeringFile: 'GEMINI.md',
        steeringDir: '', // Gemini uses hierarchical GEMINI.md files
        steeringPattern: 'GEMINI.md',
        agentsDir: '', // Limited agent support
        agentsPattern: '',
        mcpConfigPath: '.gemini/settings.json',
        supportsHooks: false,
    },
    copilot: {
        steeringFile: '.github/copilot-instructions.md',
        steeringDir: '.github/instructions',
        steeringPattern: '*.instructions.md',
        agentsDir: '.github/agents',
        agentsPattern: '*.agent.md',
        mcpConfigPath: '.copilot/mcp-config.json',
        supportsHooks: false,
    },
};

/**
 * Get the configured AI provider type from settings
 */
export function getConfiguredProviderType(): AIProviderType {
    const config = vscode.workspace.getConfiguration('speckit');
    return config.get<AIProviderType>('aiProvider', 'claude');
}

/**
 * Get the paths configuration for the current provider
 */
export function getProviderPaths(providerType?: AIProviderType): ProviderPaths {
    const type = providerType ?? getConfiguredProviderType();
    return PROVIDER_PATHS[type];
}
