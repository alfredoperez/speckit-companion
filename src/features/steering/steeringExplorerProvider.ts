import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SteeringManager } from './steeringManager';
import { getConfiguredProviderType, getProviderPaths, AIProviderType } from '../../ai-providers/aiProvider';
import { SpecKitFilesResult, SPECKIT_PATHS } from './types';
import { BaseTreeDataProvider } from '../../core/providers';
import { AgentManager, AgentInfo } from '../agents/agentManager';
import { SkillManager, SkillInfo, SkillType } from '../skills/skillManager';
import { AIProviders, TreeItemContext } from '../../core/constants';

export class SteeringExplorerProvider extends BaseTreeDataProvider<SteeringItem> {
    private steeringManager!: SteeringManager;
    private agentManager: AgentManager | undefined;
    private skillManager: SkillManager | undefined;
    private agentProjectWatcher: vscode.FileSystemWatcher | undefined;
    private agentUserWatcher: vscode.FileSystemWatcher | undefined;
    private skillProjectWatcher: vscode.FileSystemWatcher | undefined;
    private skillUserWatcher: vscode.FileSystemWatcher | undefined;
    private skillPluginsWatcher: vscode.FileSystemWatcher | undefined;

    constructor(context: vscode.ExtensionContext) {
        super(context, { name: 'SteeringExplorerProvider' });
    }

    setSteeringManager(steeringManager: SteeringManager) {
        this.steeringManager = steeringManager;
    }

    setAgentManager(agentManager: AgentManager) {
        this.agentManager = agentManager;
        this.setupAgentFileWatchers();
    }

    setSkillManager(skillManager: SkillManager) {
        this.skillManager = skillManager;
        this.setupSkillFileWatchers();
    }

    private setupAgentFileWatchers(): void {
        const providerPaths = getProviderPaths();
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder && providerPaths.agentsDir) {
            const pattern = providerPaths.agentsPattern || '*.md';
            this.agentProjectWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceFolder, `${providerPaths.agentsDir}/**/${pattern}`)
            );
            this.agentProjectWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
            this.agentProjectWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
            this.agentProjectWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
        }

        if (providerPaths.agentsDir) {
            const userAgentsPath = path.join(os.homedir(), providerPaths.agentsDir);
            try {
                const pattern = providerPaths.agentsPattern || '*.md';
                this.agentUserWatcher = vscode.workspace.createFileSystemWatcher(
                    new vscode.RelativePattern(userAgentsPath, `**/${pattern}`)
                );
                this.agentUserWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
                this.agentUserWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
                this.agentUserWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
            } catch { /* user dir may not exist */ }
        }
    }

    private setupSkillFileWatchers(): void {
        const providerPaths = getProviderPaths();
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder && providerPaths.skillsDir) {
            this.skillProjectWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceFolder, `${providerPaths.skillsDir}/**/SKILL.md`)
            );
            this.skillProjectWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
            this.skillProjectWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
            this.skillProjectWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
        }

        if (providerPaths.skillsDir) {
            const userSkillsPath = path.join(os.homedir(), providerPaths.skillsDir);
            try {
                this.skillUserWatcher = vscode.workspace.createFileSystemWatcher(
                    new vscode.RelativePattern(userSkillsPath, '**/SKILL.md')
                );
                this.skillUserWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
                this.skillUserWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
                this.skillUserWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
            } catch { /* user dir may not exist */ }
        }

        // Plugins watcher is Claude-specific (no provider equivalent currently)
        const providerType = getConfiguredProviderType();
        if (providerType === AIProviders.CLAUDE) {
            const pluginsPath = path.join(os.homedir(), '.claude/plugins');
            try {
                this.skillPluginsWatcher = vscode.workspace.createFileSystemWatcher(
                    new vscode.RelativePattern(pluginsPath, 'installed_plugins.json')
                );
                this.skillPluginsWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
                this.skillPluginsWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
                this.skillPluginsWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
            } catch { /* plugins dir may not exist */ }
        }
    }

    dispose(): void {
        this.agentProjectWatcher?.dispose();
        this.agentUserWatcher?.dispose();
        this.skillProjectWatcher?.dispose();
        this.skillUserWatcher?.dispose();
        this.skillPluginsWatcher?.dispose();
        super.dispose();
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

    async getChildren(element?: SteeringItem): Promise<SteeringItem[]> {
        if (!element) {
            // Root level - show steering files based on provider
            const items: SteeringItem[] = [];

            if (this.isLoading) {
                items.push(new SteeringItem(
                    'Loading steering documents...',
                    vscode.TreeItemCollapsibleState.None,
                    'steering-loading',
                    '',
                    this.context
                ));
                return items;
            }

            const providerType = getConfiguredProviderType();
            const providerPaths = getProviderPaths(providerType);
            const { globalExists, projectExists } = this.getSteeringFilePaths(providerType, providerPaths);

            // Traditional steering documents - provider-specific
            if (vscode.workspace.workspaceFolders && providerPaths.steeringDir) {
                const steeringDocs = await this.getProviderSteeringDocuments(providerType, providerPaths);
                if (steeringDocs.length > 0) {
                    items.push(new SteeringItem(
                        'Steering Docs',
                        vscode.TreeItemCollapsibleState.Expanded,
                        TreeItemContext.steeringHeader,
                        '',
                        this.context
                    ));
                }
            }

            const specKitFiles = await this.getSpecKitFiles();
            const hasSpecKitContent = specKitFiles.constitution ||
                specKitFiles.scripts.length > 0 ||
                specKitFiles.templates.length > 0;

            if (hasSpecKitContent) {
                items.push(new SteeringItem(
                    'SpecKit Files',
                    vscode.TreeItemCollapsibleState.Expanded,
                    TreeItemContext.speckitHeader,
                    '',
                    this.context
                ));
            }

            // AI Provider section — CLAUDE.md, agents, skills, settings under provider name
            items.push(new SteeringItem(
                providerPaths.displayName,
                vscode.TreeItemCollapsibleState.Collapsed,
                TreeItemContext.providerHeader,
                '',
                this.context
            ));

            // Add create buttons for missing files (only providers that own a steering file)
            if (providerPaths.globalSteeringFile && !globalExists) {
                items.push(new SteeringItem(
                    'Create Global Rule',
                    vscode.TreeItemCollapsibleState.None,
                    TreeItemContext.createGlobal,
                    '',
                    this.context,
                    {
                        command: 'speckit.steering.createUserRule',
                        title: `Create Global ${providerPaths.steeringFile}`
                    }
                ));
            }

            if (vscode.workspace.workspaceFolders && providerPaths.steeringFile && !projectExists) {
                items.push(new SteeringItem(
                    'Create Project Rule',
                    vscode.TreeItemCollapsibleState.None,
                    TreeItemContext.createProject,
                    '',
                    this.context,
                    {
                        command: 'speckit.steering.createProjectRule',
                        title: `Create Project ${providerPaths.steeringFile}`
                    }
                ));
            }

            return items;
        } else if (element.contextValue === 'steering-header') {
            // Return steering documents as children of the header
            const items: SteeringItem[] = [];

            if (vscode.workspace.workspaceFolders && this.steeringManager) {
                const steeringDocs = await this.steeringManager.getSteeringDocuments();
                const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

                for (const doc of steeringDocs) {
                    // Calculate relative path from workspace root
                    const relativePath = path.relative(workspacePath, doc.path);
                    items.push(new SteeringItem(
                        doc.name,
                        vscode.TreeItemCollapsibleState.None,
                        'steering-document',
                        doc.path,
                        this.context,
                        {
                            command: 'vscode.open',
                            title: 'Open Steering Document',
                            arguments: [vscode.Uri.file(doc.path)]
                        },
                        relativePath // Pass relative path without prefix
                    ));
                }
            }

            return items;
        } else if (element.contextValue === 'speckit-header') {
            return this.getSpecKitHeaderChildren();
        } else if (element.contextValue === 'speckit-scripts-category') {
            return this.getSpecKitScripts();
        } else if (element.contextValue === 'speckit-templates-category') {
            return this.getSpecKitTemplates();
        } else if (element.contextValue === TreeItemContext.providerHeader) {
            return this.getProviderHeaderChildren();
        } else if (element.contextValue === TreeItemContext.providerProjectGroup) {
            return this.getProviderProjectChildren();
        } else if (element.contextValue === TreeItemContext.providerUserGroup) {
            return this.getProviderUserChildren();
        } else if (element.contextValue === TreeItemContext.providerAgentsGroup) {
            return this.getAgentsForScope(element.groupType as string);
        } else if (element.contextValue === TreeItemContext.providerSkillsGroup) {
            return this.getSkillsForScope(element.groupType as string);
        }

        return [];
    }

    /**
     * Get provider-specific steering file paths
     */
    private getSteeringFilePaths(_providerType: AIProviderType, providerPaths: ReturnType<typeof getProviderPaths>): {
        globalPath: string | null;
        projectPath: string | null;
        globalExists: boolean;
        projectExists: boolean;
    } {
        const home = os.homedir();
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        const globalPath = providerPaths.globalSteeringFile
            ? path.join(home, providerPaths.globalSteeringFile)
            : null;
        const projectPath = workspaceRoot
            ? path.join(workspaceRoot, providerPaths.steeringFile)
            : null;

        return {
            globalPath,
            projectPath,
            globalExists: globalPath ? fs.existsSync(globalPath) : false,
            projectExists: projectPath ? fs.existsSync(projectPath) : false,
        };
    }

    /**
     * Get provider-specific steering documents from steering directory
     */
    private async getProviderSteeringDocuments(
        providerType: AIProviderType,
        providerPaths: ReturnType<typeof getProviderPaths>
    ): Promise<Array<{ name: string; path: string }>> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder || !providerPaths.steeringDir) {
            return [];
        }

        const steeringPath = path.join(workspaceFolder.uri.fsPath, providerPaths.steeringDir);

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(steeringPath));
            const pattern = providerPaths.steeringPattern;

            return entries
                .filter(([name, type]) => {
                    if (type !== vscode.FileType.File) return false;
                    // Match against the pattern
                    if (pattern === '*.md') return name.endsWith('.md');
                    if (pattern === '*.instructions.md') return name.endsWith('.instructions.md');
                    return name.endsWith('.md');
                })
                .map(([name]) => ({
                    name: name.replace('.md', '').replace('.instructions', ''),
                    path: path.join(steeringPath, name)
                }));
        } catch {
            return [];
        }
    }

    /**
     * Scans .specify/ directory for SpecKit files
     */
    private async getSpecKitFiles(): Promise<SpecKitFilesResult> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return { constitution: null, scripts: [], templates: [] };
        }

        const result: SpecKitFilesResult = {
            constitution: null,
            scripts: [],
            templates: [],
        };

        // Check constitution
        const constitutionPath = path.join(workspaceFolder.uri.fsPath, SPECKIT_PATHS.CONSTITUTION);
        if (fs.existsSync(constitutionPath)) {
            result.constitution = {
                name: 'constitution.md',
                path: constitutionPath,
                type: 'constitution'
            };
        }

        // Check scripts directory (including subdirectories)
        const scriptsPath = path.join(workspaceFolder.uri.fsPath, SPECKIT_PATHS.SCRIPTS_DIR);
        result.scripts = await this.scanDirectory(scriptsPath, true, 'script');

        // Check templates directory
        const templatesPath = path.join(workspaceFolder.uri.fsPath, SPECKIT_PATHS.TEMPLATES_DIR);
        result.templates = await this.scanDirectory(templatesPath, true, 'template');

        return result;
    }

    /**
     * Helper to scan a directory for files
     */
    private async scanDirectory(
        dirPath: string,
        recursive: boolean,
        fileType: 'script' | 'template'
    ): Promise<Array<{ name: string; path: string; type: 'script' | 'template' }>> {
        const files: Array<{ name: string; path: string; type: 'script' | 'template' }> = [];

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));

            for (const [name, type] of entries) {
                const fullPath = path.join(dirPath, name);
                if (type === vscode.FileType.File) {
                    files.push({ name, path: fullPath, type: fileType });
                } else if (type === vscode.FileType.Directory && recursive) {
                    const subFiles = await this.scanDirectory(fullPath, true, fileType);
                    files.push(...subFiles);
                }
            }
        } catch {
            // Directory doesn't exist, return empty array
        }

        return files.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get children for the SpecKit header
     */
    private async getSpecKitHeaderChildren(): Promise<SteeringItem[]> {
        const items: SteeringItem[] = [];
        const specKitFiles = await this.getSpecKitFiles();
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        // Constitution
        if (specKitFiles.constitution) {
            items.push(new SteeringItem(
                'Constitution',
                vscode.TreeItemCollapsibleState.None,
                'speckit-constitution',
                specKitFiles.constitution.path,
                this.context,
                {
                    command: 'vscode.open',
                    title: 'Open Constitution',
                    arguments: [vscode.Uri.file(specKitFiles.constitution.path)]
                },
                path.relative(workspacePath, specKitFiles.constitution.path)
            ));
        }

        // Scripts category
        if (specKitFiles.scripts.length > 0) {
            items.push(new SteeringItem(
                'Scripts',
                vscode.TreeItemCollapsibleState.Expanded,
                'speckit-scripts-category',
                '',
                this.context
            ));
        }

        // Templates category
        if (specKitFiles.templates.length > 0) {
            items.push(new SteeringItem(
                'Templates',
                vscode.TreeItemCollapsibleState.Expanded,
                'speckit-templates-category',
                '',
                this.context
            ));
        }

        return items;
    }

    /**
     * Get script files for the Scripts category
     */
    private async getSpecKitScripts(): Promise<SteeringItem[]> {
        const specKitFiles = await this.getSpecKitFiles();
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        return specKitFiles.scripts.map(script => new SteeringItem(
            script.name,
            vscode.TreeItemCollapsibleState.None,
            'speckit-script',
            script.path,
            this.context,
            {
                command: 'vscode.open',
                title: 'Open Script',
                arguments: [vscode.Uri.file(script.path)]
            },
            path.relative(workspacePath, script.path)
        ));
    }

    /**
     * Get template files for the Templates category
     */
    private async getSpecKitTemplates(): Promise<SteeringItem[]> {
        const specKitFiles = await this.getSpecKitFiles();
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        return specKitFiles.templates.map(template => new SteeringItem(
            template.name,
            vscode.TreeItemCollapsibleState.None,
            'speckit-template',
            template.path,
            this.context,
            {
                command: 'vscode.open',
                title: 'Open Template',
                arguments: [vscode.Uri.file(template.path)]
            },
            path.relative(workspacePath, template.path)
        ));
    }

    /**
     * Get children for the provider header (Project, User sub-groups)
     */
    private async getProviderHeaderChildren(): Promise<SteeringItem[]> {
        const items: SteeringItem[] = [];

        items.push(new SteeringItem(
            'Project',
            vscode.TreeItemCollapsibleState.Collapsed,
            TreeItemContext.providerProjectGroup,
            '',
            this.context
        ));

        items.push(new SteeringItem(
            'User',
            vscode.TreeItemCollapsibleState.Collapsed,
            TreeItemContext.providerUserGroup,
            '',
            this.context
        ));

        return items;
    }

    /**
     * Get children for Project sub-group (CLAUDE.md, Agents, Skills, Settings)
     */
    private async getProviderProjectChildren(): Promise<SteeringItem[]> {
        const items: SteeringItem[] = [];
        const providerType = getConfiguredProviderType();
        const providerPaths = getProviderPaths(providerType);
        const { projectPath, projectExists } = this.getSteeringFilePaths(providerType, providerPaths);

        // Steering file (e.g., CLAUDE.md)
        if (projectExists && projectPath) {
            items.push(new SteeringItem(
                providerPaths.steeringFile,
                vscode.TreeItemCollapsibleState.None,
                TreeItemContext.steeringFile,
                projectPath,
                this.context,
                {
                    command: 'vscode.open',
                    title: `Open Project ${providerPaths.steeringFile}`,
                    arguments: [vscode.Uri.file(projectPath)]
                }
            ));
        }

        // Agents sub-header
        if (this.agentManager && providerPaths.agentsDir) {
            const agents = await this.agentManager.getAgentList('project');
            if (agents.length > 0) {
                items.push(new SteeringItem(
                    'Agents',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    TreeItemContext.providerAgentsGroup,
                    '',
                    this.context,
                    undefined,
                    undefined,
                    'project'
                ));
            }
        }

        // Skills sub-header
        if (this.skillManager && providerPaths.skillsDir) {
            const skills = await this.skillManager.getSkillList('project');
            if (skills.length > 0) {
                items.push(new SteeringItem(
                    'Skills',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    TreeItemContext.providerSkillsGroup,
                    '',
                    this.context,
                    undefined,
                    undefined,
                    'project'
                ));
            }
        }

        // Settings file
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            const settingsPath = path.join(workspaceRoot, providerPaths.mcpConfigPath);
            if (fs.existsSync(settingsPath)) {
                items.push(new SteeringItem(
                    'Settings',
                    vscode.TreeItemCollapsibleState.None,
                    TreeItemContext.providerSettings,
                    settingsPath,
                    this.context,
                    {
                        command: 'vscode.open',
                        title: 'Open Settings',
                        arguments: [vscode.Uri.file(settingsPath)]
                    }
                ));
            }
        }

        return items;
    }

    /**
     * Get children for User sub-group (CLAUDE.md, Agents, Skills, Settings)
     */
    private async getProviderUserChildren(): Promise<SteeringItem[]> {
        const items: SteeringItem[] = [];
        const providerType = getConfiguredProviderType();
        const providerPaths = getProviderPaths(providerType);
        const { globalPath, globalExists } = this.getSteeringFilePaths(providerType, providerPaths);

        // Steering file (e.g., CLAUDE.md)
        if (globalExists && globalPath) {
            items.push(new SteeringItem(
                providerPaths.steeringFile,
                vscode.TreeItemCollapsibleState.None,
                TreeItemContext.steeringFile,
                globalPath,
                this.context,
                {
                    command: 'vscode.open',
                    title: `Open User ${providerPaths.steeringFile}`,
                    arguments: [vscode.Uri.file(globalPath)]
                }
            ));
        }

        // Agents sub-header (user + plugin)
        if (this.agentManager && providerPaths.agentsDir) {
            const userAgents = await this.agentManager.getAgentList('user');
            let hasAgents = userAgents.length > 0;
            if (!hasAgents && providerType === AIProviders.CLAUDE) {
                const pluginAgents = await this.agentManager.getAgentList('plugin');
                hasAgents = pluginAgents.length > 0;
            }
            if (hasAgents) {
                items.push(new SteeringItem(
                    'Agents',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    TreeItemContext.providerAgentsGroup,
                    '',
                    this.context,
                    undefined,
                    undefined,
                    'user'
                ));
            }
        }

        // Skills sub-header (user + plugin)
        if (this.skillManager && providerPaths.skillsDir) {
            const userSkills = await this.skillManager.getSkillList('user');
            let hasSkills = userSkills.length > 0;
            if (!hasSkills && providerType === AIProviders.CLAUDE) {
                const pluginSkills = await this.skillManager.getSkillList('plugin');
                hasSkills = pluginSkills.length > 0;
            }
            if (hasSkills) {
                items.push(new SteeringItem(
                    'Skills',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    TreeItemContext.providerSkillsGroup,
                    '',
                    this.context,
                    undefined,
                    undefined,
                    'user'
                ));
            }
        }

        // Settings file
        const home = os.homedir();
        const userSettingsPath = path.join(home, providerPaths.mcpConfigPath);
        if (fs.existsSync(userSettingsPath)) {
            items.push(new SteeringItem(
                'Settings',
                vscode.TreeItemCollapsibleState.None,
                TreeItemContext.providerSettings,
                userSettingsPath,
                this.context,
                {
                    command: 'vscode.open',
                    title: 'Open User Settings',
                    arguments: [vscode.Uri.file(userSettingsPath)]
                }
            ));
        }

        return items;
    }

    /**
     * Get agents for a scope (project or user+plugin)
     */
    private async getAgentsForScope(scope: string): Promise<SteeringItem[]> {
        const providerType = getConfiguredProviderType();
        if (scope === 'project') {
            return this.getAgentChildren('project');
        }
        const items = await this.getAgentChildren('user');
        if (providerType === AIProviders.CLAUDE) {
            items.push(...await this.getAgentChildren('plugin'));
        }
        return items;
    }

    /**
     * Get skills for a scope (project or user+plugin)
     */
    private async getSkillsForScope(scope: string): Promise<SteeringItem[]> {
        const providerType = getConfiguredProviderType();
        if (scope === 'project') {
            return this.getSkillChildren('project');
        }
        const items = await this.getSkillChildren('user');
        if (providerType === AIProviders.CLAUDE) {
            items.push(...await this.getSkillChildren('plugin'));
        }
        return items;
    }

    /**
     * Get individual agents for a group type
     */
    private async getAgentChildren(type: 'project' | 'user' | 'plugin'): Promise<SteeringItem[]> {
        if (!this.agentManager) return [];
        const agents = await this.agentManager.getAgentList(type);
        return agents.map(agent => {
            const item = new SteeringItem(
                agent.name,
                vscode.TreeItemCollapsibleState.None,
                'agent',
                agent.path,
                this.context,
                {
                    command: 'vscode.open',
                    title: 'Open Agent',
                    arguments: [vscode.Uri.file(agent.path)]
                }
            );
            item.tooltip = agent.description || agent.name;
            if (agent.tools) {
                item.description = `Tools: ${agent.tools.length}`;
            }
            return item;
        });
    }

    /**
     * Get individual skills for a group type
     */
    private async getSkillChildren(type: SkillType): Promise<SteeringItem[]> {
        if (!this.skillManager) return [];
        const skills = await this.skillManager.getSkillList(type);
        return skills.map(skill => {
            const item = new SteeringItem(
                skill.name,
                vscode.TreeItemCollapsibleState.None,
                skill.hasWarning ? 'skill-warning' : 'skill',
                skill.path,
                this.context,
                {
                    command: 'vscode.open',
                    title: 'Open Skill',
                    arguments: [vscode.Uri.file(skill.path)]
                }
            );
            item.tooltip = skill.hasWarning
                ? 'Invalid SKILL.md frontmatter - using folder name'
                : (skill.description || skill.name);
            if (skill.allowedTools && skill.allowedTools.length > 0) {
                item.description = `${skill.allowedTools.length} tools`;
            }
            return item;
        });
    }


}

class SteeringItem extends vscode.TreeItem {
    public readonly groupType?: string;

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly resourcePath: string,
        private readonly extContext: vscode.ExtensionContext,
        public readonly command?: vscode.Command,
        private readonly filename?: string,
        groupType?: string
    ) {
        super(label, collapsibleState);
        this.groupType = groupType;

        const C = TreeItemContext;

        if (contextValue === C.steeringLoading) {
            this.iconPath = new vscode.ThemeIcon('sync~spin');
            this.tooltip = 'Loading steering documents...';
        } else if (contextValue === C.steeringFile) {
            this.iconPath = new vscode.ThemeIcon('markdown');
            this.tooltip = resourcePath;
        } else if (contextValue === C.createGlobal) {
            this.iconPath = new vscode.ThemeIcon('globe');
            this.tooltip = 'Click to create Global CLAUDE.md';
        } else if (contextValue === C.createProject) {
            this.iconPath = new vscode.ThemeIcon('root-folder');
            this.tooltip = 'Click to create Project CLAUDE.md';
        } else if (contextValue === C.separator) {
            this.iconPath = undefined;
            this.description = undefined;
        } else if (contextValue === C.steeringHeader) {
            this.iconPath = new vscode.ThemeIcon('folder-library');
            this.tooltip = 'Generated project steering documents';
        } else if (contextValue === C.steeringDocument) {
            if (label === 'product') {
                this.iconPath = new vscode.ThemeIcon('lightbulb-empty');
            } else if (label === 'tech') {
                this.iconPath = new vscode.ThemeIcon('circuit-board');
            } else if (label === 'structure') {
                this.iconPath = new vscode.ThemeIcon('list-tree');
            } else {
                this.iconPath = new vscode.ThemeIcon('file');
            }
            this.tooltip = `Steering document: ${resourcePath}`;
            this.description = filename;
        } else if (contextValue === C.speckitHeader) {
            this.iconPath = new vscode.ThemeIcon('package');
            this.tooltip = 'SpecKit project configuration files';
        } else if (contextValue === C.speckitConstitution) {
            this.iconPath = new vscode.ThemeIcon('law');
            this.tooltip = `Project Constitution: ${resourcePath}`;
            this.description = filename;
        } else if (contextValue === C.speckitScriptsCategory) {
            this.iconPath = new vscode.ThemeIcon('code');
            this.tooltip = 'SpecKit automation scripts';
        } else if (contextValue === C.speckitScript) {
            this.iconPath = new vscode.ThemeIcon('terminal');
            this.tooltip = `Script: ${resourcePath}`;
            this.description = filename;
        } else if (contextValue === C.speckitTemplatesCategory) {
            this.iconPath = new vscode.ThemeIcon('note');
            this.tooltip = 'SpecKit document templates';
        } else if (contextValue === C.speckitTemplate) {
            this.iconPath = new vscode.ThemeIcon('file');
            this.tooltip = `Template: ${resourcePath}`;
            this.description = filename;
        } else if (contextValue === C.providerHeader) {
            this.iconPath = new vscode.ThemeIcon('hubot');
            this.tooltip = `${label} configuration files`;
        } else if (contextValue === C.providerProjectGroup) {
            this.iconPath = new vscode.ThemeIcon('root-folder');
            this.tooltip = 'Project-scoped configuration files';
        } else if (contextValue === C.providerUserGroup) {
            this.iconPath = new vscode.ThemeIcon('globe');
            this.tooltip = 'User-scoped configuration files';
        } else if (contextValue === C.providerAgentsGroup) {
            this.iconPath = new vscode.ThemeIcon('robot');
            this.tooltip = 'Agents';
        } else if (contextValue === C.providerSkillsGroup) {
            this.iconPath = new vscode.ThemeIcon('symbol-misc');
            this.tooltip = 'Skills';
        } else if (contextValue === C.providerSettings) {
            this.iconPath = new vscode.ThemeIcon('settings-gear');
            this.tooltip = `Settings: ${resourcePath}`;
        } else if (contextValue === C.agent) {
            this.iconPath = new vscode.ThemeIcon('robot');
        } else if (contextValue === C.skill) {
            this.iconPath = new vscode.ThemeIcon('symbol-misc');
        } else if (contextValue === C.skillWarning) {
            this.iconPath = new vscode.ThemeIcon('warning');
        }
    }
}
