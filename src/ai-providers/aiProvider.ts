import * as vscode from 'vscode';
import { AIProviders } from '../core/constants';

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
     * The provider type identifier
     */
    readonly type: AIProviderType;

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

    /**
     * Get the CLI permission flag for this provider based on the unified speckit.permissionMode setting.
     * Returns an empty string when no bypass flag applies.
     */
    getPermissionFlag(): string;
}

/**
 * Read the unified permission mode from settings.
 */
export function readPermissionMode(): 'interactive' | 'auto-approve' {
    const config = vscode.workspace.getConfiguration('speckit');
    return config.get<'interactive' | 'auto-approve'>('permissionMode', 'interactive');
}

/**
 * Supported AI provider types (derived from AIProviders constant)
 */
export type AIProviderType = typeof AIProviders[keyof typeof AIProviders];

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
    /** Directory for skill definitions */
    skillsDir: string;
    /** Pattern for skill folders (each containing SKILL.md) */
    skillsPattern: string;
    /** Path to MCP config file (relative to home) */
    mcpConfigPath: string;
    /** Whether hooks are supported */
    supportsHooks: boolean;
    /** Human-readable provider name for UI display */
    displayName: string;
    /** How speckit commands are formatted: 'dot' = speckit.plan, 'dash' = speckit-plan */
    commandFormat: 'dot' | 'dash';
}

/**
 * Provider paths configuration for each provider type
 */
export const PROVIDER_PATHS: Record<AIProviderType, ProviderPaths> = {
    [AIProviders.CLAUDE]: {
        steeringFile: 'CLAUDE.md',
        steeringDir: '.claude/steering',
        steeringPattern: '*.md',
        agentsDir: '.claude/agents',
        agentsPattern: '*.md',
        skillsDir: '.claude/skills',
        skillsPattern: '*/SKILL.md',
        mcpConfigPath: '.claude/settings.json',
        supportsHooks: true,
        displayName: 'Claude',
        commandFormat: 'dash',
    },
    [AIProviders.GEMINI]: {
        steeringFile: 'GEMINI.md',
        steeringDir: '', // Gemini uses hierarchical GEMINI.md files
        steeringPattern: 'GEMINI.md',
        agentsDir: '', // Limited agent support
        agentsPattern: '',
        skillsDir: '', // Not supported
        skillsPattern: '',
        mcpConfigPath: '.gemini/settings.json',
        supportsHooks: false,
        displayName: 'Gemini',
        commandFormat: 'dot',
    },
    [AIProviders.COPILOT]: {
        steeringFile: '.github/copilot-instructions.md',
        steeringDir: '.github/instructions',
        steeringPattern: '*.instructions.md',
        agentsDir: '.github/agents',
        agentsPattern: '*.agent.md',
        skillsDir: '', // Not supported
        skillsPattern: '',
        mcpConfigPath: '.copilot/mcp-config.json',
        supportsHooks: false,
        displayName: 'Copilot',
        commandFormat: 'dot',
    },
    [AIProviders.CODEX]: {
        steeringFile: 'AGENTS.md',
        steeringDir: '.codex',
        steeringPattern: 'AGENTS.md',
        agentsDir: '', // Codex uses AGENTS.md hierarchy, not separate agents
        agentsPattern: '',
        skillsDir: '.codex/skills',
        skillsPattern: '*/SKILL.md',
        mcpConfigPath: '~/.codex/config.toml', // Note: home directory, TOML format
        supportsHooks: false,
        displayName: 'Codex',
        commandFormat: 'dash',
    },
    [AIProviders.QWEN]: {
        steeringFile: 'QWEN.md',
        steeringDir: '.qwen/steering',
        steeringPattern: '*.md',
        agentsDir: '',
        agentsPattern: '',
        skillsDir: '',
        skillsPattern: '',
        mcpConfigPath: '.qwen/settings.json',
        supportsHooks: false,
        displayName: 'Qwen',
        commandFormat: 'dot',
    },
};

/**
 * Format a speckit command for the given provider.
 * Converts canonical dot format (speckit.specify) to provider-specific format.
 * E.g., for Claude/Codex: speckit.specify → speckit-specify
 */
export function formatCommandForProvider(command: string, providerType?: AIProviderType): string {
    const config = vscode.workspace.getConfiguration('speckit');
    const userFormat = config.get<string>('commandFormat', 'auto');

    if (userFormat === 'dash') {
        return command.replace(/^speckit\./, 'speckit-');
    }
    if (userFormat === 'dot') {
        return command;
    }

    // auto — use provider default
    const type = providerType ?? getConfiguredProviderType();
    const { commandFormat } = PROVIDER_PATHS[type];
    if (commandFormat === 'dash') {
        return command.replace(/^speckit\./, 'speckit-');
    }
    return command;
}

/**
 * Check if the AI provider has been explicitly configured by the user.
 * Returns true if the setting exists at global, workspace, or folder level.
 * @returns True if provider has been explicitly set, false if using default
 */
export function isProviderConfigured(): boolean {
    const config = vscode.workspace.getConfiguration('speckit');
    const inspection = config.inspect<AIProviderType>('aiProvider');
    
    // Check if set at any level (global, workspace, or folder)
    return !!(inspection?.globalValue || inspection?.workspaceValue || inspection?.workspaceFolderValue);
}

/**
 * Get the configured AI provider type from settings
 */
export function getConfiguredProviderType(): AIProviderType {
    const config = vscode.workspace.getConfiguration('speckit');
    return config.get<AIProviderType>('aiProvider', AIProviders.CLAUDE);
}

/**
 * Prompt user to select their AI provider and save the selection.
 * Shows a QuickPick with available providers and saves choice to global settings.
 * 
 * @returns The selected provider type, or undefined if user cancelled.
 * 
 * @remarks
 * When undefined is returned (user cancelled), the caller should handle this case
 * appropriately - typically by showing an error and preventing further initialization.
 * If the caller continues without handling the cancellation, the extension will fall
 * back to the default provider ('claude') from settings, which may trigger unwanted
 * permission flows.
 */
export async function promptForProviderSelection(): Promise<AIProviderType | undefined> {
    const selection = await vscode.window.showQuickPick(
        [
            {
                label: '$(hubot) Claude Code',
                description: 'Full feature support: steering, agents, hooks, and MCP',
                value: AIProviders.CLAUDE as AIProviderType
            },
            {
                label: '$(github) GitHub Copilot CLI',
                description: 'Steering, agents, and MCP support (no hooks)',
                value: AIProviders.COPILOT as AIProviderType
            },
            {
                label: '$(sparkle) Gemini CLI',
                description: 'Steering and MCP support (no agents or hooks)',
                value: AIProviders.GEMINI as AIProviderType
            },
            {
                label: '$(terminal) Codex CLI',
                description: 'Steering, skills, and MCP support',
                value: AIProviders.CODEX as AIProviderType
            },
            {
                label: '$(hubot) Qwen Code',
                description: 'Steering and MCP support (no agents or hooks)',
                value: AIProviders.QWEN as AIProviderType
            }
        ],
        {
            placeHolder: 'Select your AI coding assistant',
            title: 'SpecKit Companion - Choose AI Provider',
            ignoreFocusOut: true
        }
    );

    if (selection) {
        const config = vscode.workspace.getConfiguration('speckit');
        await config.update('aiProvider', selection.value, vscode.ConfigurationTarget.Global);
        return selection.value;
    }
    
    return undefined;
}

/**
 * Get the paths configuration for the current provider
 */
export function getProviderPaths(providerType?: AIProviderType): ProviderPaths {
    const type = providerType ?? getConfiguredProviderType();
    return PROVIDER_PATHS[type];
}
