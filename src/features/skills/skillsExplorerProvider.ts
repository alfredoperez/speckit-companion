import * as vscode from 'vscode';
import * as path from 'path';
import { SkillManager, SkillInfo, SkillType } from './skillManager';
import { getConfiguredProviderType } from '../../ai-providers/aiProvider';

export class SkillsExplorerProvider implements vscode.TreeDataProvider<SkillItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SkillItem | undefined | null | void> = new vscode.EventEmitter<SkillItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SkillItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projectFileWatcher: vscode.FileSystemWatcher | undefined;
    private userFileWatcher: vscode.FileSystemWatcher | undefined;
    private pluginsFileWatcher: vscode.FileSystemWatcher | undefined;
    private isLoading: boolean = false;

    constructor(
        private context: vscode.ExtensionContext,
        private skillManager: SkillManager,
        private outputChannel: vscode.OutputChannel
    ) {
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

    getTreeItem(element: SkillItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SkillItem): Promise<SkillItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        const providerType = getConfiguredProviderType();

        // Skills are only supported for Claude Code
        if (providerType !== 'claude' && !element) {
            return [new SkillItem(
                'Skills only available for Claude Code',
                vscode.TreeItemCollapsibleState.None,
                'skill-not-supported'
            )];
        }

        if (!element) {
            // Root level - show loading state or skill groups
            const items: SkillItem[] = [];

            if (this.isLoading) {
                items.push(new SkillItem(
                    'Loading skills...',
                    vscode.TreeItemCollapsibleState.None,
                    'skill-loading'
                ));
                return items;
            }

            // Check if there are any skills
            const allSkills = await this.skillManager.getSkillList('all');
            if (allSkills.length === 0) {
                return [new SkillItem(
                    'No skills found',
                    vscode.TreeItemCollapsibleState.None,
                    'skill-empty'
                )];
            }

            // Plugin skills group
            const pluginSkills = await this.skillManager.getSkillList('plugin');
            if (pluginSkills.length > 0) {
                items.push(new SkillItem(
                    'Plugin Skills',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'skill-group',
                    'plugin'
                ));
            }

            // User skills group
            const userSkills = await this.skillManager.getSkillList('user');
            if (userSkills.length > 0) {
                items.push(new SkillItem(
                    'User Skills',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'skill-group',
                    'user'
                ));
            }

            // Project skills group
            const projectSkills = await this.skillManager.getSkillList('project');
            if (projectSkills.length > 0) {
                items.push(new SkillItem(
                    'Project Skills',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'skill-group',
                    'project'
                ));
            }

            return items;
        } else if (element.contextValue === 'skill-group') {
            // Show skills under the group
            const skills = await this.skillManager.getSkillList(element.groupType as SkillType);
            return skills.map(skill => new SkillItem(
                skill.name,
                vscode.TreeItemCollapsibleState.None,
                'skill',
                undefined,
                skill
            ));
        }

        return [];
    }

    private setupFileWatchers(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        // Watch project skills directory
        if (workspaceFolder) {
            const projectSkillsPattern = new vscode.RelativePattern(
                workspaceFolder,
                '.claude/skills/**/SKILL.md'
            );

            this.projectFileWatcher = vscode.workspace.createFileSystemWatcher(projectSkillsPattern);

            this.projectFileWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
            this.projectFileWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
            this.projectFileWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
        }

        // Watch user skills directory
        const userSkillsPath = path.join(require('os').homedir(), '.claude/skills');
        const userSkillsPattern = new vscode.RelativePattern(
            userSkillsPath,
            '**/SKILL.md'
        );

        try {
            this.userFileWatcher = vscode.workspace.createFileSystemWatcher(userSkillsPattern);

            this.userFileWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
            this.userFileWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
            this.userFileWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
        } catch (error) {
            this.outputChannel.appendLine(`[SkillsExplorer] Failed to watch user skills directory: ${error}`);
        }

        // Watch installed_plugins.json for plugin skill changes
        const pluginsPath = path.join(require('os').homedir(), '.claude/plugins/installed_plugins.json');
        const pluginsPattern = new vscode.RelativePattern(
            path.dirname(pluginsPath),
            'installed_plugins.json'
        );

        try {
            this.pluginsFileWatcher = vscode.workspace.createFileSystemWatcher(pluginsPattern);

            this.pluginsFileWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
            this.pluginsFileWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
            this.pluginsFileWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
        } catch (error) {
            this.outputChannel.appendLine(`[SkillsExplorer] Failed to watch plugins file: ${error}`);
        }
    }

    dispose(): void {
        this.projectFileWatcher?.dispose();
        this.userFileWatcher?.dispose();
        this.pluginsFileWatcher?.dispose();
    }
}

export class SkillItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly groupType?: string,
        public readonly skillInfo?: SkillInfo
    ) {
        super(label, collapsibleState);

        if (contextValue === 'skill-loading') {
            this.iconPath = new vscode.ThemeIcon('sync~spin');
            this.tooltip = 'Loading skills...';
        } else if (contextValue === 'skill-not-supported') {
            this.iconPath = new vscode.ThemeIcon('info');
            this.tooltip = 'Skills are only supported for Claude Code';
        } else if (contextValue === 'skill-empty') {
            this.iconPath = new vscode.ThemeIcon('info');
            this.tooltip = 'No skills found in ~/.claude/skills/ or .claude/skills/';
        } else if (contextValue === 'skill-group') {
            if (groupType === 'plugin') {
                this.iconPath = new vscode.ThemeIcon('extensions');
                this.tooltip = 'Skills from installed Claude Code plugins';
            } else if (groupType === 'user') {
                this.iconPath = new vscode.ThemeIcon('globe');
                this.tooltip = 'User-wide skills available across all projects';
            } else {
                this.iconPath = new vscode.ThemeIcon('root-folder');
                this.tooltip = 'Project-specific skills';
            }
        } else if (contextValue === 'skill' && skillInfo) {
            // Use warning icon for skills with invalid frontmatter
            if (skillInfo.hasWarning) {
                this.iconPath = new vscode.ThemeIcon('warning');
                this.tooltip = 'Invalid SKILL.md frontmatter - using folder name';
            } else {
                this.iconPath = new vscode.ThemeIcon('symbol-misc');
                this.tooltip = skillInfo.description || skillInfo.name;
            }

            // Show allowed-tools count if present
            if (skillInfo.allowedTools && skillInfo.allowedTools.length > 0) {
                this.description = `${skillInfo.allowedTools.length} tools`;
            }

            // Add command to open SKILL.md file on click
            this.command = {
                command: 'vscode.open',
                title: 'Open Skill',
                arguments: [vscode.Uri.file(skillInfo.path)]
            };
        }
    }
}
