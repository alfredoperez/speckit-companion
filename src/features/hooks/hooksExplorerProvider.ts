import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getConfiguredProviderType } from '../../ai-providers/aiProvider';
import { BaseTreeDataProvider } from '../../core/providers';
import type { HookTrigger, HookAction, HookInfo, ClaudeSettingsJson } from '../../core/types/config';

export class HooksExplorerProvider extends BaseTreeDataProvider<HookItem> {
    constructor(context: vscode.ExtensionContext) {
        super(context, { name: 'HooksExplorerProvider' });
        // Start with loading state
        this.isLoading = true;
        this.loadHooks().then(() => {
            this.isLoading = false;
            this.refresh();
        });
    }

    private async loadHooks(): Promise<void> {
        // Simulate async loading (reading files is actually quite fast)
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    async getChildren(element?: HookItem): Promise<HookItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        // Hooks are only supported for Claude Code
        const providerType = getConfiguredProviderType();
        if (providerType !== 'claude' && !element) {
            return [
                new HookItem(
                    `Hooks not supported for ${providerType === 'gemini' ? 'Gemini CLI' : 'GitHub Copilot CLI'}`,
                    vscode.TreeItemCollapsibleState.None,
                    'hooks-not-supported',
                    'not-supported',
                    undefined,
                    this.context
                )
            ];
        }

        if (!element) {
            // Show loading state
            if (this.isLoading) {
                return [
                    new HookItem(
                        'Loading agent hooks...',
                        vscode.TreeItemCollapsibleState.None,
                        'loading',
                        'loading',
                        undefined,
                        this.context
                    )
                ];
            }

            // Show Claude Code hooks directly at root level
            const hooks = await this.getClaudeCodeHooks();
            if (hooks.length === 0) {
                return [
                    new HookItem(
                        'No Claude Code hooks configured',
                        vscode.TreeItemCollapsibleState.None,
                        'no-hooks',
                        'no-hooks',
                        undefined,
                        this.context
                    )
                ];
            }

            return hooks.map(hook => new HookItem(
                hook.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                'hook',
                `claude-hook-${hook.name}`,
                undefined, // Remove command to allow default expand/collapse on click
                this.context,
                hook.enabled,
                hook.config,
                hook.configPath // Save configPath for later use
            ));
        } else if (element.contextValue === 'hook' && element.hookConfig) {
            // Show hook details as children
            const config = element.hookConfig;
            const items: HookItem[] = [];

            // Show each trigger configuration
            if (Array.isArray(config)) {
                config.forEach((trigger, index) => {
                    items.push(new HookItem(
                        `Trigger ${index + 1}`,
                        vscode.TreeItemCollapsibleState.Expanded,
                        'hook-trigger',
                        `trigger-${element.id}-${index}`,
                        element.configPath ? {
                            command: 'vscode.open',
                            title: 'Open Configuration File',
                            arguments: [vscode.Uri.file(element.configPath)]
                        } : undefined,
                        this.context,
                        undefined,
                        trigger
                    ));
                });
            }

            return items;
        } else if (element.contextValue === 'hook-trigger' && element.hookConfig) {
            // Show trigger details - when contextValue is 'hook-trigger', hookConfig is always a single trigger
            const trigger = element.hookConfig as HookTrigger;
            const items: HookItem[] = [];

            if (trigger.matcher !== undefined) {
                items.push(new HookItem(
                    `Matcher: ${trigger.matcher || '(empty)'}`,
                    vscode.TreeItemCollapsibleState.None,
                    'hook-detail',
                    `${element.id}-matcher`,
                    element.command, // Keep parent's command (open config)
                    this.context
                ));
            }

            if (trigger.hooks && Array.isArray(trigger.hooks)) {
                trigger.hooks.forEach((hook: HookAction, index: number) => {
                    if (hook.type === 'command') {
                        items.push(new HookItem(
                            `Command: ${hook.command}`,
                            vscode.TreeItemCollapsibleState.None,
                            'hook-command', // Use specific contextValue
                            `${element.id}-command-${index}`,
                            {
                                command: 'kfc.hooks.copyCommand',
                                title: 'Copy Command',
                                arguments: [hook.command]
                            },
                            this.context
                        ));
                    }
                });
            }

            return items;
        }

        return [];
    }

    private async getClaudeCodeHooks(): Promise<HookInfo[]> {
        const hooks: HookInfo[] = [];

        // Check workspace .claude/settings.json first
        if (vscode.workspace.workspaceFolders) {
            const workspaceConfigPath = path.join(
                vscode.workspace.workspaceFolders[0].uri.fsPath,
                '.claude',
                'settings.json'
            );
            if (fs.existsSync(workspaceConfigPath)) {
                try {
                    const config: ClaudeSettingsJson = JSON.parse(fs.readFileSync(workspaceConfigPath, 'utf8'));
                    if (config.hooks) {
                        Object.entries(config.hooks).forEach(([name, value]) => {
                            hooks.push({
                                name,
                                enabled: true,
                                config: value,
                                configPath: workspaceConfigPath
                            });
                        });
                    }
                } catch (error) {
                    this.log(`Failed to read workspace Claude Code hooks: ${error}`);
                }
            }
        }

        // Then check global ~/.claude/settings.json
        try {
            const claudeConfigPath = path.join(process.env.HOME || '', '.claude', 'settings.json');
            if (fs.existsSync(claudeConfigPath)) {
                const config: ClaudeSettingsJson = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'));
                if (config.hooks) {
                    Object.entries(config.hooks).forEach(([name, value]) => {
                        // Only add if not already added from workspace
                        if (!hooks.find(h => h.name === name)) {
                            hooks.push({
                                name,
                                enabled: true,
                                config: value,
                                configPath: claudeConfigPath
                            });
                        }
                    });
                }
            }
        } catch (error) {
            this.log(`Failed to read global Claude Code hooks: ${error}`);
        }
        return hooks;
    }
}

class HookItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly id: string,
        public readonly command?: vscode.Command,
        private readonly extContext?: vscode.ExtensionContext,
        public readonly enabled?: boolean,
        public readonly hookConfig?: HookTrigger | HookTrigger[],
        public readonly configPath?: string
    ) {
        super(label, collapsibleState);

        // Set appropriate icons
        if (contextValue === 'loading') {
            this.iconPath = new vscode.ThemeIcon('sync~spin');
        } else if (contextValue === 'hooks-not-supported') {
            this.iconPath = new vscode.ThemeIcon('info');
            this.tooltip = 'Hooks are only available with Claude Code';
        } else if (contextValue === 'no-hooks') {
            this.iconPath = new vscode.ThemeIcon('info');
        } else if (contextValue === 'hook') {
            this.iconPath = new vscode.ThemeIcon('activate-breakpoints');
        } else if (contextValue === 'hook-trigger') {
            this.iconPath = new vscode.ThemeIcon('run');
        } else if (contextValue === 'hook-detail') {
            if (label.startsWith('Matcher:')) {
                this.iconPath = new vscode.ThemeIcon('filter');
            } else if (label.startsWith('Command:')) {
                this.iconPath = new vscode.ThemeIcon('terminal');
            } else {
                this.iconPath = new vscode.ThemeIcon('circle-outline');
            }
        } else if (contextValue === 'hook-command') {
            this.iconPath = new vscode.ThemeIcon('terminal');
        } else if (extContext) {
            this.iconPath = {
                light: vscode.Uri.file(extContext.asAbsolutePath('icons/zap.svg')),
                dark: vscode.Uri.file(extContext.asAbsolutePath('icons/zap.svg'))
            };
        } else {
            this.iconPath = new vscode.ThemeIcon('activate-breakpoints');
        }

        // Set tooltips
        if (contextValue === 'no-hooks') {
            this.tooltip = 'Configure hooks in Claude Code CLI';
        } else if (contextValue === 'hook-detail' && label.startsWith('Command:')) {
            this.tooltip = label.substring(9); // Show full command in tooltip
        } else {
            this.tooltip = label;
        }
    }
}
