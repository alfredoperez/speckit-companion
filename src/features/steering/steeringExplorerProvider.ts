import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SteeringManager } from './steeringManager';
import { getConfiguredProviderType, getProviderPaths, getProviderDisplayName, AIProviderType } from '../../ai-providers/aiProvider';
import { SpecKitFilesResult, SPECKIT_PATHS } from './types';
import { BaseTreeDataProvider } from '../../core/providers';
import { AgentManager, AgentInfo } from '../agents/agentManager';
import { SkillManager, SkillInfo, SkillType } from '../skills/skillManager';
import { AIProviders, TreeItemContext } from '../../core/constants';
import { isCompanionInstalled } from '../settings/companionPresetReconciler';
import { readCompanionConfigGroups, readCompanionCommands, readCompanionTemplates, isWithinRoot, companionCommandFilePath, COMPANION_STEERING_PATHS } from './companionSteering';

export class SteeringExplorerProvider extends BaseTreeDataProvider<SteeringItem> {
    private steeringManager!: SteeringManager;
    private agentManager: AgentManager | undefined;
    private skillManager: SkillManager | undefined;
    private agentProjectWatcher: vscode.FileSystemWatcher | undefined;
    private agentUserWatcher: vscode.FileSystemWatcher | undefined;
    private skillProjectWatcher: vscode.FileSystemWatcher | undefined;
    private skillUserWatcher: vscode.FileSystemWatcher | undefined;
    private skillPluginsWatcher: vscode.FileSystemWatcher | undefined;
    private companionConfigWatcher: vscode.FileSystemWatcher | undefined;
    private companionInstallWatcher: vscode.FileSystemWatcher | undefined;

    constructor(context: vscode.ExtensionContext) {
        super(context, { name: 'SteeringExplorerProvider' });
        this.setupCompanionFileWatchers();
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

    private setupCompanionFileWatchers(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }
        this.companionConfigWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, COMPANION_STEERING_PATHS.config)
        );
        this.companionConfigWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
        this.companionConfigWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
        this.companionConfigWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());

        this.companionInstallWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, COMPANION_STEERING_PATHS.manifest)
        );
        this.companionInstallWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
        this.companionInstallWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
        this.companionInstallWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
    }

    dispose(): void {
        this.agentProjectWatcher?.dispose();
        this.agentUserWatcher?.dispose();
        this.skillProjectWatcher?.dispose();
        this.skillUserWatcher?.dispose();
        this.skillPluginsWatcher?.dispose();
        this.companionConfigWatcher?.dispose();
        this.companionInstallWatcher?.dispose();
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
                getProviderDisplayName(getConfiguredProviderType()),
                vscode.TreeItemCollapsibleState.Collapsed,
                TreeItemContext.providerHeader,
                '',
                this.context
            ));

            // Companion group — install state, configuration, and command discovery.
            // Positioned as the second top-level entry (spliced in below).
            const companionNode = this.buildCompanionHeaderNode();

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

            if (companionNode) {
                // Second top-level entry when anything precedes it, else first.
                items.splice(Math.min(1, items.length), 0, companionNode);
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
        } else if (element.contextValue === TreeItemContext.companionHeader) {
            return this.getCompanionHeaderChildren();
        } else if (element.contextValue === TreeItemContext.companionConfigGroup) {
            return this.getCompanionConfigChildren();
        } else if (element.contextValue === TreeItemContext.companionCommandsGroup) {
            return this.getCompanionCommandChildren();
        } else if (element.contextValue === TreeItemContext.companionTemplatesGroup) {
            return this.getCompanionTemplateChildren();
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

    private companionWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    /** Root Companion node; icon/description reflect install state, collapsible only when it has children. */
    private buildCompanionHeaderNode(): SteeringItem | undefined {
        const root = this.companionWorkspaceRoot();
        if (!root) {
            return undefined;
        }
        const installed = isCompanionInstalled(root);

        // When installed the node always offers Configuration + Commands, so it's
        // collapsible without reading any file to decide; not installed = badge only.
        const item = new SteeringItem(
            'Companion',
            installed ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            TreeItemContext.companionHeader,
            '',
            this.context
        );

        if (installed) {
            item.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'assets/icons/moss.svg');
            item.tooltip = 'SpecKit Companion configuration and commands';
        } else {
            item.iconPath = new vscode.ThemeIcon('warning');
            item.description = 'Not installed';
            item.tooltip = 'SpecKit Companion extension is not installed in this project';
        }
        return item;
    }

    /** Configuration group (when the config has setting groups) and Commands group (when the manifest lists commands). */
    private getCompanionHeaderChildren(): SteeringItem[] {
        const root = this.companionWorkspaceRoot();
        if (!root || !isCompanionInstalled(root)) {
            return [];
        }
        // Always surface both groups when installed (matches the documented
        // structure); an empty group simply expands to nothing.
        const items: SteeringItem[] = [];

        const configPath = path.join(root, COMPANION_STEERING_PATHS.config);
        if (isWithinRoot(root, configPath)) {
            items.push(new SteeringItem(
                'Configuration',
                vscode.TreeItemCollapsibleState.Collapsed,
                TreeItemContext.companionConfigGroup,
                configPath,
                this.context
            ));
        }

        items.push(new SteeringItem(
            'Commands',
            vscode.TreeItemCollapsibleState.Collapsed,
            TreeItemContext.companionCommandsGroup,
            '',
            this.context
        ));

        if (readCompanionTemplates(root).length > 0) {
            items.push(new SteeringItem(
                'Templates',
                vscode.TreeItemCollapsibleState.Collapsed,
                TreeItemContext.companionTemplatesGroup,
                '',
                this.context
            ));
        }

        return items;
    }

    /** Setting-group entries from `.specify/companion.yml`; each opens the config file. */
    private getCompanionConfigChildren(): SteeringItem[] {
        const root = this.companionWorkspaceRoot();
        if (!root) {
            return [];
        }
        const configPath = path.join(root, COMPANION_STEERING_PATHS.config);
        if (!isWithinRoot(root, configPath)) {
            return [];
        }
        return readCompanionConfigGroups(root).map(group => {
            const item = new SteeringItem(
                group,
                vscode.TreeItemCollapsibleState.None,
                TreeItemContext.companionConfigItem,
                configPath,
                this.context,
                {
                    command: 'vscode.open',
                    title: 'Open Companion Configuration',
                    arguments: [vscode.Uri.file(configPath)]
                }
            );
            item.tooltip = `companion.yml › ${group}`;
            return item;
        });
    }

    /** Command entries from the installed manifest's `provides.commands`; each opens its command body file. */
    private getCompanionCommandChildren(): SteeringItem[] {
        const root = this.companionWorkspaceRoot();
        if (!root) {
            return [];
        }
        return readCompanionCommands(root).map(cmd => {
            const filePath = companionCommandFilePath(root, cmd.file);
            const item = new SteeringItem(
                cmd.name,
                vscode.TreeItemCollapsibleState.None,
                TreeItemContext.companionCommand,
                filePath ?? '',
                this.context,
                filePath
                    ? { command: 'vscode.open', title: `Open ${cmd.name}`, arguments: [vscode.Uri.file(filePath)] }
                    : undefined
            );
            item.tooltip = cmd.description || cmd.name;
            return item;
        });
    }

    /** Preset command-body templates the Companion ships; each opens its template file. */
    private getCompanionTemplateChildren(): SteeringItem[] {
        const root = this.companionWorkspaceRoot();
        if (!root) {
            return [];
        }
        return readCompanionTemplates(root).map(tpl => {
            const filePath = companionCommandFilePath(root, tpl.file);
            const item = new SteeringItem(
                tpl.name,
                vscode.TreeItemCollapsibleState.None,
                TreeItemContext.companionTemplate,
                filePath ?? '',
                this.context,
                filePath
                    ? { command: 'vscode.open', title: `Open ${tpl.name}`, arguments: [vscode.Uri.file(filePath)] }
                    : undefined
            );
            item.tooltip = `Companion template: ${tpl.name}`;
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
            this.iconPath = this.steerIcon('doc.svg');
            this.tooltip = resourcePath;
        } else if (contextValue === C.createGlobal) {
            this.iconPath = this.steerIcon('globe.svg');
            this.tooltip = 'Click to create Global CLAUDE.md';
        } else if (contextValue === C.createProject) {
            this.iconPath = this.steerIcon('folder.svg');
            this.tooltip = 'Click to create Project CLAUDE.md';
        } else if (contextValue === C.separator) {
            this.iconPath = undefined;
            this.description = undefined;
        } else if (contextValue === C.steeringHeader) {
            this.iconPath = this.steerIcon('folder.svg');
            this.tooltip = 'Generated project steering documents';
        } else if (contextValue === C.steeringDocument) {
            if (label === 'product') {
                this.iconPath = this.steerIcon('product.svg');
            } else if (label === 'tech') {
                this.iconPath = this.steerIcon('tech.svg');
            } else if (label === 'structure') {
                this.iconPath = this.steerIcon('structure.svg');
            } else {
                this.iconPath = this.steerIcon('doc.svg');
            }
            this.tooltip = `Steering document: ${resourcePath}`;
            this.description = filename;
        } else if (contextValue === C.speckitHeader) {
            this.iconPath = this.steerIcon('library.svg');
            this.tooltip = 'SpecKit project configuration files';
        } else if (contextValue === C.speckitConstitution) {
            this.iconPath = this.steerIcon('constitution.svg');
            this.tooltip = `Project Constitution: ${resourcePath}`;
        } else if (contextValue === C.speckitScriptsCategory) {
            this.iconPath = this.steerIcon('scripts.svg');
            this.tooltip = 'SpecKit automation scripts';
        } else if (contextValue === C.speckitScript) {
            this.iconPath = undefined;
            this.tooltip = `Script: ${resourcePath}`;
        } else if (contextValue === C.speckitTemplatesCategory) {
            this.iconPath = this.steerIcon('templates.svg');
            this.tooltip = 'SpecKit document templates';
        } else if (contextValue === C.speckitTemplate) {
            this.iconPath = undefined;
            this.tooltip = `Template: ${resourcePath}`;
        } else if (contextValue === C.providerHeader) {
            this.iconPath = this.providerIcon();
            this.tooltip = `${label} configuration files`;
        } else if (contextValue === C.providerProjectGroup) {
            this.iconPath = this.steerIcon('folder.svg');
            this.tooltip = 'Project-scoped configuration files';
        } else if (contextValue === C.providerUserGroup) {
            this.iconPath = this.steerIcon('globe.svg');
            this.tooltip = 'User-scoped configuration files';
        } else if (contextValue === C.providerAgentsGroup) {
            this.iconPath = this.steerIcon('agents.svg');
            this.tooltip = 'Agents';
        } else if (contextValue === C.providerSkillsGroup) {
            this.iconPath = this.steerIcon('skills.svg');
            this.tooltip = 'Skills';
        } else if (contextValue === C.providerSettings) {
            this.iconPath = this.steerIcon('settings.svg');
            this.tooltip = `Settings: ${resourcePath}`;
        } else if (contextValue === C.companionConfigGroup) {
            this.iconPath = this.steerIcon('settings.svg');
        } else if (contextValue === C.companionConfigItem) {
            this.iconPath = undefined;
        } else if (contextValue === C.companionCommandsGroup) {
            this.iconPath = this.steerIcon('commands.svg');
        } else if (contextValue === C.companionCommand) {
            this.iconPath = undefined;
        } else if (contextValue === C.companionTemplatesGroup) {
            this.iconPath = this.steerIcon('templates.svg');
        } else if (contextValue === C.companionTemplate) {
            this.iconPath = undefined;
        } else if (contextValue === C.agent) {
            this.iconPath = undefined;
        } else if (contextValue === C.skill) {
            this.iconPath = undefined;
        } else if (contextValue === C.skillWarning) {
            this.iconPath = this.steerIcon('warning.svg');
        }
    }

    private steerIcon(file: string): vscode.Uri {
        return vscode.Uri.joinPath(this.extContext.extensionUri, 'assets', 'icons', 'steering', file);
    }

    private providerIcon(): vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } {
        const p = (f: string) => vscode.Uri.joinPath(this.extContext.extensionUri, 'assets', 'icons', 'providers', f);
        const id = vscode.workspace.getConfiguration('speckit').get<string>('aiProvider') || 'claude';
        const colorful: Record<string, string> = {
            claude: 'claude.svg',
            'claude-vscode': 'claude.svg',
            gemini: 'gemini.svg',
            qwen: 'qwen.svg',
        };
        const monochrome: Record<string, string> = {
            copilot: 'copilot',
            codex: 'codex',
            opencode: 'opencode',
        };
        if (colorful[id]) {
            return p(colorful[id]);
        }
        if (monochrome[id]) {
            return { light: p(`${monochrome[id]}-light.svg`), dark: p(`${monochrome[id]}-dark.svg`) };
        }
        return this.steerIcon('agents.svg');
    }
}
