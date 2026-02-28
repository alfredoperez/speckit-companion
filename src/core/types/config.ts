/**
 * Type definitions for configuration files
 */

// Claude config (~/.claude.json)
export interface ClaudeConfig {
    [key: string]: unknown;
}

// Claude settings.json in .claude directory
export interface ClaudeSettingsJson {
    hooks?: Record<string, HookTrigger[]>;
    [key: string]: unknown;
}

// Agent frontmatter (agentManager.ts)
export interface AgentFrontmatter {
    name?: string;
    description?: string;
    tools?: string | string[];
}

// Hook configuration (hooksExplorerProvider.ts)
export interface HookTrigger {
    event?: string;
    matcher?: string;
    hooks?: HookAction[];
}

export interface HookAction {
    type: 'command' | 'script';
    command?: string;
    script?: string;
}

export interface HookInfo {
    name: string;
    enabled: boolean;
    config: HookTrigger[];
    configPath: string;
}

// GitHub release (updateChecker.ts)
export interface GitHubRelease {
    tag_name: string;
    name: string;
    html_url: string;
}

// Installed plugins (agentManager.ts)
export interface InstalledPlugin {
    name?: string;
    version?: string;
    installPath?: string;
}

export interface InstalledPluginsFile {
    plugins?: InstalledPlugin[];
}

// Quick pick item with label
export interface LabeledItem {
    label: string;
}

// Spec tree item for quick pick
export interface SpecTreeItem {
    label: string;
    specPath?: string;
}

// Custom slash command configuration (settings)
export interface CustomCommandConfig {
    /** Optional friendly name (used for labels) */
    name?: string;
    /** Optional display title shown in quick pick */
    title?: string;
    /** Full slash command (e.g., "/speckit.review") */
    command?: string;
    /** Workflow step to show this command in: "spec", "plan", "tasks", or "all" */
    step?: string;
    /** Tooltip text shown on hover */
    tooltip?: string;
    /** Whether to append or inject the spec directory */
    requiresSpecDir?: boolean;
    /** Whether to auto-execute in terminal (default: true) */
    autoExecute?: boolean;
}
