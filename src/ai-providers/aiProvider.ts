import * as vscode from 'vscode';
import * as fs from 'fs';
import { AIProviders, Timing } from '../core/constants';
import { waitForShellReady } from '../core/utils/terminalUtils';
import { createTempFile } from '../core/utils/tempFileUtils';

/**
 * Dispatch a slash command to a terminal via a temp file so the full prompt
 * content is hidden from the terminal scrollback. The resulting line is:
 *
 *   <cliInvocation> "<slashCommand> $(cat "<tempfile>")"
 *
 * When `promptText` is empty, no temp file is created and the line becomes:
 *
 *   <cliInvocation> "<slashCommand>"
 *
 * If `slashCommand` is empty (e.g. Copilot has no slash commands), the inner
 * quoted form is just `$(cat …)` / nothing.
 */
export async function dispatchSlashCommandViaTempFile(opts: {
    context: vscode.ExtensionContext;
    outputChannel: vscode.OutputChannel;
    terminal: vscode.Terminal;
    cliInvocation: string;
    slashCommand: string;
    promptText: string;
    autoExecute: boolean;
    logPrefix?: string;
}): Promise<void> {
    const { context, outputChannel, terminal, cliInvocation, slashCommand, promptText, autoExecute } = opts;
    const logPrefix = opts.logPrefix ?? 'AIProvider';

    let line: string;
    let tempFilePath: string | null = null;

    if (promptText && promptText.length > 0) {
        tempFilePath = await createTempFile(context, promptText, 'prompt', true);
        const inner = slashCommand
            ? `${slashCommand} $(cat "${tempFilePath}")`
            : `$(cat "${tempFilePath}")`;
        line = `${cliInvocation} "${inner}"`;
    } else {
        line = slashCommand
            ? `${cliInvocation} "${slashCommand}"`
            : cliInvocation;
    }

    await waitForShellReady(terminal);
    terminal.sendText(line, autoExecute);

    if (tempFilePath) {
        const fileToClean = tempFilePath;
        setTimeout(async () => {
            try {
                await fs.promises.unlink(fileToClean);
                outputChannel.appendLine(`[${logPrefix}] Cleaned up prompt file: ${fileToClean}`);
            } catch (e) {
                outputChannel.appendLine(`[${logPrefix}] Failed to cleanup temp file: ${e}`);
            }
        }, Timing.tempFileCleanupDelay);
    }
}

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
    /** Global steering file name relative to user home, or null if provider has no global file */
    globalSteeringFile: string | null;
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
    /** Workspace-relative provider config directory (e.g., '.claude', '.gemini') */
    configDir: string;
    /** Whether hooks are supported */
    supportsHooks: boolean;
    /** Human-readable provider name for UI display */
    displayName: string;
    /** How speckit commands are formatted: 'dot' = speckit.plan, 'dash' = speckit-plan */
    commandFormat: 'dot' | 'dash';
    /** Codicon string used in the provider QuickPick (e.g. '$(hubot)') */
    quickPickIcon: string;
    /** Description text shown in the provider QuickPick */
    quickPickDescription: string;
    /** Whether the CLI supports interactive permission prompting */
    supportsInteractivePermissions: boolean;
    /** Flag prepended to the CLI invocation when permission mode is 'auto-approve' (empty if none) */
    autoApproveFlag: string;
}

/**
 * Provider paths configuration for each provider type
 */
export const PROVIDER_PATHS: Record<AIProviderType, ProviderPaths> = {
    [AIProviders.CLAUDE]: {
        steeringFile: 'CLAUDE.md',
        globalSteeringFile: '.claude/CLAUDE.md',
        steeringDir: '.claude/steering',
        steeringPattern: '*.md',
        agentsDir: '.claude/agents',
        agentsPattern: '*.md',
        skillsDir: '.claude/skills',
        skillsPattern: '*/SKILL.md',
        mcpConfigPath: '.claude/settings.json',
        configDir: '.claude',
        supportsHooks: true,
        displayName: 'Claude',
        commandFormat: 'dash',
        quickPickIcon: '$(hubot)',
        quickPickDescription: 'Full feature support: steering, agents, hooks, and MCP',
        supportsInteractivePermissions: true,
        autoApproveFlag: '--permission-mode bypassPermissions ',
    },
    [AIProviders.GEMINI]: {
        steeringFile: 'GEMINI.md',
        globalSteeringFile: '.gemini/GEMINI.md',
        steeringDir: '', // Gemini uses hierarchical GEMINI.md files
        steeringPattern: 'GEMINI.md',
        agentsDir: '', // Limited agent support
        agentsPattern: '',
        skillsDir: '', // Not supported
        skillsPattern: '',
        mcpConfigPath: '.gemini/settings.json',
        configDir: '.gemini',
        supportsHooks: false,
        displayName: 'Gemini',
        commandFormat: 'dot',
        quickPickIcon: '$(sparkle)',
        quickPickDescription: 'Steering and MCP support (no agents or hooks)',
        supportsInteractivePermissions: true,
        autoApproveFlag: '',
    },
    [AIProviders.COPILOT]: {
        steeringFile: '.github/copilot-instructions.md',
        globalSteeringFile: null,
        steeringDir: '.github/instructions',
        steeringPattern: '*.instructions.md',
        agentsDir: '.github/agents',
        agentsPattern: '*.agent.md',
        skillsDir: '', // Not supported
        skillsPattern: '',
        mcpConfigPath: '.copilot/mcp-config.json',
        configDir: '.github',
        supportsHooks: false,
        displayName: 'Copilot',
        commandFormat: 'dot',
        quickPickIcon: '$(github)',
        quickPickDescription: 'Steering, agents, and MCP support (no hooks)',
        supportsInteractivePermissions: false,
        autoApproveFlag: '--yolo ',
    },
    [AIProviders.CODEX]: {
        steeringFile: 'AGENTS.md',
        globalSteeringFile: null,
        steeringDir: '.codex',
        steeringPattern: 'AGENTS.md',
        agentsDir: '', // Codex uses AGENTS.md hierarchy, not separate agents
        agentsPattern: '',
        skillsDir: '.codex/skills',
        skillsPattern: '*/SKILL.md',
        mcpConfigPath: '~/.codex/config.toml', // Note: home directory, TOML format
        configDir: '.codex',
        supportsHooks: false,
        displayName: 'Codex',
        commandFormat: 'dash',
        quickPickIcon: '$(terminal)',
        quickPickDescription: 'Steering, skills, and MCP support',
        supportsInteractivePermissions: true,
        autoApproveFlag: '',
    },
    [AIProviders.QWEN]: {
        steeringFile: 'QWEN.md',
        globalSteeringFile: '.qwen/QWEN.md',
        steeringDir: '.qwen/steering',
        steeringPattern: '*.md',
        agentsDir: '',
        agentsPattern: '',
        skillsDir: '',
        skillsPattern: '',
        mcpConfigPath: '.qwen/settings.json',
        configDir: '.qwen',
        supportsHooks: false,
        displayName: 'Qwen',
        commandFormat: 'dot',
        quickPickIcon: '$(hubot)',
        quickPickDescription: 'Steering and MCP support (no agents or hooks)',
        supportsInteractivePermissions: true,
        autoApproveFlag: '--yolo ',
    },
    [AIProviders.OPENCODE]: {
        steeringFile: 'AGENTS.md',
        globalSteeringFile: null,
        steeringDir: '',
        steeringPattern: 'AGENTS.md',
        agentsDir: '.opencode/agent',
        agentsPattern: '*.md',
        skillsDir: '',
        skillsPattern: '',
        mcpConfigPath: '.opencode/opencode.jsonc',
        configDir: '.opencode',
        supportsHooks: false,
        displayName: 'OpenCode',
        commandFormat: 'dot',
        quickPickIcon: '$(code)',
        quickPickDescription: 'Steering and agents support (AGENTS.md)',
        supportsInteractivePermissions: true,
        autoApproveFlag: '',
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
    const items = (Object.keys(PROVIDER_PATHS) as AIProviderType[]).map(type => {
        const p = PROVIDER_PATHS[type];
        return {
            label: `${p.quickPickIcon} ${p.displayName}`,
            description: p.quickPickDescription,
            value: type,
        };
    });
    const selection = await vscode.window.showQuickPick(
        items,
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
