/**
 * Type definitions for configuration files
 */

// Claude config (~/.claude.json)
export interface ClaudeConfig {
    bypassPermissionsModeAccepted?: boolean;
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
