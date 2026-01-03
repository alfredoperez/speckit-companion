import * as vscode from 'vscode';
import * as path from 'path';
import { AgentManager, AgentInfo } from './agentManager';
import { getConfiguredProviderType, getProviderPaths } from '../../ai-providers/aiProvider';
import { BaseTreeDataProvider } from '../../core/providers';

export class AgentsExplorerProvider extends BaseTreeDataProvider<AgentItem> {
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private userFileWatcher: vscode.FileSystemWatcher | undefined;

    constructor(
        context: vscode.ExtensionContext,
        private agentManager: AgentManager,
        outputChannel: vscode.OutputChannel
    ) {
        super(context, { name: 'AgentsExplorerProvider', outputChannel });
        this.setupFileWatchers();
    }

    refresh(): void {
        this.isLoading = true;
        this._onDidChangeTreeData.fire(); // Show loading state immediately

        // Simulate async loading
        setTimeout(() => {
            this.isLoading = false;
            this._onDidChangeTreeData.fire(); // Show actual content
        }, 100);
    }

    async getChildren(element?: AgentItem): Promise<AgentItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        const providerType = getConfiguredProviderType();

        // Gemini has limited agent support
        if (providerType === 'gemini' && !element) {
            return [new AgentItem(
                'Agents not supported for Gemini CLI',
                vscode.TreeItemCollapsibleState.None,
                'agent-not-supported'
            )];
        }

        if (!element) {
            // Root level - show loading state or agent groups
            const items: AgentItem[] = [];

            if (this.isLoading) {
                items.push(new AgentItem(
                    'Loading agents...',
                    vscode.TreeItemCollapsibleState.None,
                    'agent-loading'
                ));
                return items;
            }

            // Plugin agents group (Claude only - from installed Claude Code plugins)
            if (providerType === 'claude') {
                const pluginAgents = await this.agentManager.getAgentList('plugin');
                if (pluginAgents.length > 0) {
                    items.push(new AgentItem(
                        'Plugin Agents',
                        vscode.TreeItemCollapsibleState.Expanded,
                        'agent-group',
                        'plugin'
                    ));
                }

                // User agents group (Claude only)
                items.push(new AgentItem(
                    'User Agents',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'agent-group',
                    'user'
                ));
            }

            // Project agents group - provider-specific directory
            const projectAgents = await this.agentManager.getAgentList('project');
            if (projectAgents.length > 0 || vscode.workspace.workspaceFolders) {
                items.push(new AgentItem(
                    'Project Agents',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'agent-group',
                    'project'
                ));
            }

            return items;
        } else if (element.contextValue === 'agent-group') {
            // Show agents under the group
            const agents = await this.agentManager.getAgentList(element.groupType as 'project' | 'user' | 'plugin');
            return agents.map(agent => new AgentItem(
                agent.name,
                vscode.TreeItemCollapsibleState.None,
                'agent',
                undefined,
                agent
            ));
        }

        return [];
    }

    private setupFileWatchers(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        // Watch project agents directory
        if (workspaceFolder) {
            const projectAgentsPattern = new vscode.RelativePattern(
                workspaceFolder,
                '.claude/agents/**/*.md'
            );

            this.fileWatcher = vscode.workspace.createFileSystemWatcher(projectAgentsPattern);

            // File watcher changes should refresh without loading animation
            this.fileWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
            this.fileWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
            this.fileWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
        }

        // Watch user agents directory (including subdirectories)
        const userAgentsPath = path.join(require('os').homedir(), '.claude/agents');
        const userAgentsPattern = new vscode.RelativePattern(
            userAgentsPath,
            '**/*.md'
        );

        try {
            this.userFileWatcher = vscode.workspace.createFileSystemWatcher(userAgentsPattern);

            // File watcher changes should refresh without loading animation
            this.userFileWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
            this.userFileWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
            this.userFileWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
        } catch (error) {
            this.log(`Failed to watch user agents directory: ${error}`);
        }
    }

    dispose(): void {
        this.fileWatcher?.dispose();
        this.userFileWatcher?.dispose();
        super.dispose();
    }
}

class AgentItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly groupType?: string,
        public readonly agentInfo?: AgentInfo
    ) {
        super(label, collapsibleState);

        if (contextValue === 'agent-loading') {
            // Loading state with spinning icon
            this.iconPath = new vscode.ThemeIcon('sync~spin');
            this.tooltip = 'Loading agents...';
        } else if (contextValue === 'agent-not-supported') {
            this.iconPath = new vscode.ThemeIcon('info');
            this.tooltip = 'This provider does not support custom agents';
        } else if (contextValue === 'agent-group') {
            // Use icons similar to Steering Explorer
            if (groupType === 'plugin') {
                this.iconPath = new vscode.ThemeIcon('extensions');
                this.tooltip = 'Agents from installed Claude Code plugins';
            } else if (groupType === 'user') {
                this.iconPath = new vscode.ThemeIcon('globe');
                this.tooltip = 'User-wide agents available across all projects';
            } else {
                this.iconPath = new vscode.ThemeIcon('root-folder');
                this.tooltip = 'Project-specific agents';
            }
        } else if (contextValue === 'agent' && agentInfo) {
            this.iconPath = new vscode.ThemeIcon('robot');
            this.tooltip = agentInfo.description || agentInfo.name;
            this.description = agentInfo.tools ? `Tools: ${agentInfo.tools.length}` : undefined;

            // Add command to open agent file
            this.command = {
                command: 'vscode.open',
                title: 'Open Agent',
                arguments: [vscode.Uri.file(agentInfo.path)]
            };
        }
    }
}
