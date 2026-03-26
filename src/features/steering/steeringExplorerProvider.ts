import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SteeringManager } from './steeringManager';
import { getConfiguredProviderType, getProviderPaths, AIProviderType } from '../../ai-providers/aiProvider';
import { SpecKitFilesResult, SPECKIT_PATHS } from './types';
import { BaseTreeDataProvider } from '../../core/providers';
import { getWorkflow } from '../../features/workflows/workflowManager';
import { WorkflowConfig } from '../../features/workflows/types';
import { ConfigKeys } from '../../core/constants';
import { AgentManager, AgentInfo } from '../agents/agentManager';
import { SkillManager, SkillInfo, SkillType } from '../skills/skillManager';
import type { HookTrigger, HookAction, HookInfo, ClaudeSettingsJson } from '../../core/types/config';

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
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            this.agentProjectWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceFolder, '.claude/agents/**/*.md')
            );
            this.agentProjectWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
            this.agentProjectWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
            this.agentProjectWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
        }

        const userAgentsPath = path.join(os.homedir(), '.claude/agents');
        try {
            this.agentUserWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(userAgentsPath, '**/*.md')
            );
            this.agentUserWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
            this.agentUserWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
            this.agentUserWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
        } catch { /* user dir may not exist */ }
    }

    private setupSkillFileWatchers(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            this.skillProjectWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceFolder, '.claude/skills/**/SKILL.md')
            );
            this.skillProjectWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
            this.skillProjectWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
            this.skillProjectWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
        }

        const userSkillsPath = path.join(os.homedir(), '.claude/skills');
        try {
            this.skillUserWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(userSkillsPath, '**/SKILL.md')
            );
            this.skillUserWatcher.onDidCreate(() => this._onDidChangeTreeData.fire());
            this.skillUserWatcher.onDidChange(() => this._onDidChangeTreeData.fire());
            this.skillUserWatcher.onDidDelete(() => this._onDidChangeTreeData.fire());
        } catch { /* user dir may not exist */ }

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

            // Get provider-specific paths
            const { globalPath, projectPath, globalExists, projectExists } = this.getSteeringFilePaths(providerType, providerPaths);

            // Show Global Rule if exists
            if (globalExists && globalPath) {
                items.push(new SteeringItem(
                    'Global Rule',
                    vscode.TreeItemCollapsibleState.None,
                    'claude-md-global',
                    globalPath,
                    this.context,
                    {
                        command: 'vscode.open',
                        title: `Open Global ${providerPaths.steeringFile}`,
                        arguments: [vscode.Uri.file(globalPath)]
                    }
                ));
            }

            // Show Project Rule if exists
            if (projectExists && projectPath) {
                items.push(new SteeringItem(
                    'Project Rule',
                    vscode.TreeItemCollapsibleState.None,
                    'claude-md-project',
                    projectPath,
                    this.context,
                    {
                        command: 'vscode.open',
                        title: `Open Project ${providerPaths.steeringFile}`,
                        arguments: [vscode.Uri.file(projectPath)]
                    }
                ));
            }

            // Traditional steering documents - provider-specific
            if (vscode.workspace.workspaceFolders && providerPaths.steeringDir) {
                const steeringDocs = await this.getProviderSteeringDocuments(providerType, providerPaths);
                if (steeringDocs.length > 0) {
                    items.push(new SteeringItem(
                        'Steering Docs',
                        vscode.TreeItemCollapsibleState.Expanded,
                        'steering-header',
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
                    'speckit-header',
                    '',
                    this.context
                ));
            }

            // Workflow Steps - show steps/commands referenced by active workflow
            const workflowStepRefs = await this.getWorkflowStepRefs();
            if (workflowStepRefs.length > 0) {
                items.push(new SteeringItem(
                    'Workflow',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'workflow-commands-header',
                    '',
                    this.context
                ));
            }

            // Agents group — show if provider supports agents
            if (this.agentManager && getProviderPaths(providerType).agentsDir) {
                const allAgents = [
                    ...await this.agentManager.getAgentList('plugin'),
                    ...await this.agentManager.getAgentList('user'),
                    ...await this.agentManager.getAgentList('project'),
                ];
                if (allAgents.length > 0) {
                    items.push(new SteeringItem(
                        'Agents',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'agents-header',
                        '',
                        this.context
                    ));
                }
            }

            // Skills group — only for Claude/Codex
            if (this.skillManager && (providerType === 'claude' || providerType === 'codex')) {
                const allSkills = await this.skillManager.getSkillList('all');
                if (allSkills.length > 0) {
                    items.push(new SteeringItem(
                        'Skills',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'skills-header',
                        '',
                        this.context
                    ));
                }
            }

            // Hooks group — only for providers that support hooks
            if (getProviderPaths(providerType).supportsHooks) {
                const hooks = await this.getClaudeCodeHooks();
                if (hooks.length > 0) {
                    items.push(new SteeringItem(
                        'Hooks',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'hooks-header',
                        '',
                        this.context
                    ));
                }
            }

            // Add create buttons for missing files (Claude only for now)
            if (providerType === 'claude') {
                if (!globalExists) {
                    items.push(new SteeringItem(
                        'Create Global Rule',
                        vscode.TreeItemCollapsibleState.None,
                        'create-global-claude',
                        '',
                        this.context,
                        {
                            command: 'speckit.steering.createUserRule',
                            title: 'Create Global CLAUDE.md'
                        }
                    ));
                }

                if (vscode.workspace.workspaceFolders && !projectExists) {
                    items.push(new SteeringItem(
                        'Create Project Rule',
                        vscode.TreeItemCollapsibleState.None,
                        'create-project-claude',
                        '',
                        this.context,
                        {
                            command: 'speckit.steering.createProjectRule',
                            title: 'Create Project CLAUDE.md'
                        }
                    ));
                }
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
        } else if (element.contextValue === 'workflow-commands-header') {
            return this.getWorkflowCommandChildren();
        } else if (element.contextValue === 'agents-header') {
            return this.getAgentsGroupChildren();
        } else if (element.contextValue === 'agents-group') {
            return this.getAgentChildren(element.groupType as 'project' | 'user' | 'plugin');
        } else if (element.contextValue === 'skills-header') {
            return this.getSkillsGroupChildren();
        } else if (element.contextValue === 'skills-group') {
            return this.getSkillChildren(element.groupType as SkillType);
        } else if (element.contextValue === 'hooks-header') {
            return this.getHooksChildren();
        } else if (element.contextValue === 'hook') {
            return this.getHookTriggerChildren(element);
        } else if (element.contextValue === 'hook-trigger') {
            return this.getHookTriggerDetails(element);
        }

        return [];
    }

    /**
     * Get provider-specific steering file paths
     */
    private getSteeringFilePaths(providerType: AIProviderType, providerPaths: ReturnType<typeof getProviderPaths>): {
        globalPath: string | null;
        projectPath: string | null;
        globalExists: boolean;
        projectExists: boolean;
    } {
        const home = process.env.HOME || '';
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        let globalPath: string | null = null;
        let projectPath: string | null = null;

        switch (providerType) {
            case 'claude':
                globalPath = path.join(home, '.claude', 'CLAUDE.md');
                projectPath = workspaceRoot ? path.join(workspaceRoot, 'CLAUDE.md') : null;
                break;
            case 'gemini':
                globalPath = path.join(home, '.gemini', 'GEMINI.md');
                projectPath = workspaceRoot ? path.join(workspaceRoot, 'GEMINI.md') : null;
                break;
            case 'copilot':
                // Copilot doesn't have a global file in the same way
                globalPath = null;
                projectPath = workspaceRoot ? path.join(workspaceRoot, '.github', 'copilot-instructions.md') : null;
                break;
            case 'qwen':
                globalPath = path.join(home, '.qwen', 'QWEN.md');
                projectPath = workspaceRoot ? path.join(workspaceRoot, 'QWEN.md') : null;
                break;
        }

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
     * Get workflow command files referenced by the active workflow
     */
    /**
     * Get all workflow step references for the active workflow.
     * Returns step names with resolved file paths (command .md, skill SKILL.md, or null).
     */
    private async getWorkflowStepRefs(): Promise<Array<{ label: string; command: string; path: string | null; type: 'step' | 'custom-command' }>> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return [];

        const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
        const defaultWorkflowName = config.get<string>('defaultWorkflow', 'default');
        const workflow = getWorkflow(defaultWorkflowName) || getWorkflow('default');
        if (!workflow || workflow.name === 'default') {
            // Fall back: check if any custom workflows are configured at all
            const customWorkflows = config.get<Array<Record<string, unknown>>>('customWorkflows', []);
            if (customWorkflows.length === 0) return [];
            // Use the first configured workflow
            const first = getWorkflow(customWorkflows[0].name as string);
            if (!first) return [];
            return this.resolveWorkflowStepRefs(first, workspaceFolder.uri.fsPath);
        }

        return this.resolveWorkflowStepRefs(workflow, workspaceFolder.uri.fsPath);
    }

    /**
     * Get agent sub-groups (Plugin, User, Project)
     */
    private async getAgentsGroupChildren(): Promise<SteeringItem[]> {
        if (!this.agentManager) return [];
        const items: SteeringItem[] = [];
        const providerType = getConfiguredProviderType();

        if (providerType === 'claude') {
            const pluginAgents = await this.agentManager.getAgentList('plugin');
            if (pluginAgents.length > 0) {
                items.push(new SteeringItem(
                    'Plugin Agents',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'agents-group',
                    '',
                    this.context,
                    undefined,
                    undefined,
                    'plugin'
                ));
            }

            const userAgents = await this.agentManager.getAgentList('user');
            items.push(new SteeringItem(
                'User Agents',
                vscode.TreeItemCollapsibleState.Collapsed,
                'agents-group',
                '',
                this.context,
                undefined,
                undefined,
                'user'
            ));
        }

        const projectAgents = await this.agentManager.getAgentList('project');
        if (projectAgents.length > 0 || vscode.workspace.workspaceFolders) {
            items.push(new SteeringItem(
                'Project Agents',
                vscode.TreeItemCollapsibleState.Collapsed,
                'agents-group',
                '',
                this.context,
                undefined,
                undefined,
                'project'
            ));
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
     * Get skill sub-groups (Plugin, User, Project)
     */
    private async getSkillsGroupChildren(): Promise<SteeringItem[]> {
        if (!this.skillManager) return [];
        const items: SteeringItem[] = [];

        const pluginSkills = await this.skillManager.getSkillList('plugin');
        if (pluginSkills.length > 0) {
            items.push(new SteeringItem(
                'Plugin Skills',
                vscode.TreeItemCollapsibleState.Collapsed,
                'skills-group',
                '',
                this.context,
                undefined,
                undefined,
                'plugin'
            ));
        }

        const userSkills = await this.skillManager.getSkillList('user');
        if (userSkills.length > 0) {
            items.push(new SteeringItem(
                'User Skills',
                vscode.TreeItemCollapsibleState.Collapsed,
                'skills-group',
                '',
                this.context,
                undefined,
                undefined,
                'user'
            ));
        }

        const projectSkills = await this.skillManager.getSkillList('project');
        if (projectSkills.length > 0) {
            items.push(new SteeringItem(
                'Project Skills',
                vscode.TreeItemCollapsibleState.Collapsed,
                'skills-group',
                '',
                this.context,
                undefined,
                undefined,
                'project'
            ));
        }

        return items;
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

    /**
     * Get Claude Code hooks from settings files
     */
    private async getClaudeCodeHooks(): Promise<HookInfo[]> {
        const hooks: HookInfo[] = [];

        // Check workspace .claude/settings.json first
        if (vscode.workspace.workspaceFolders) {
            const workspaceConfigPath = path.join(
                vscode.workspace.workspaceFolders[0].uri.fsPath,
                '.claude', 'settings.json'
            );
            if (fs.existsSync(workspaceConfigPath)) {
                try {
                    const config: ClaudeSettingsJson = JSON.parse(fs.readFileSync(workspaceConfigPath, 'utf8'));
                    if (config.hooks) {
                        for (const [name, value] of Object.entries(config.hooks)) {
                            hooks.push({ name, enabled: true, config: value, configPath: workspaceConfigPath });
                        }
                    }
                } catch { /* ignore parse errors */ }
            }
        }

        // Then check global ~/.claude/settings.json
        try {
            const claudeConfigPath = path.join(os.homedir(), '.claude', 'settings.json');
            if (fs.existsSync(claudeConfigPath)) {
                const config: ClaudeSettingsJson = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'));
                if (config.hooks) {
                    for (const [name, value] of Object.entries(config.hooks)) {
                        if (!hooks.find(h => h.name === name)) {
                            hooks.push({ name, enabled: true, config: value, configPath: claudeConfigPath });
                        }
                    }
                }
            }
        } catch { /* ignore parse errors */ }

        return hooks;
    }

    /**
     * Get hooks as tree items
     */
    private async getHooksChildren(): Promise<SteeringItem[]> {
        const hooks = await this.getClaudeCodeHooks();
        return hooks.map(hook => {
            const item = new SteeringItem(
                hook.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                'hook',
                '',
                this.context
            );
            item.hookConfig = hook.config;
            item.hookConfigPath = hook.configPath;
            return item;
        });
    }

    /**
     * Get trigger children for a hook
     */
    private getHookTriggerChildren(element: SteeringItem): SteeringItem[] {
        if (!element.hookConfig || !Array.isArray(element.hookConfig)) return [];
        return (element.hookConfig as HookTrigger[]).map((trigger, index) => {
            const item = new SteeringItem(
                `Trigger ${index + 1}`,
                vscode.TreeItemCollapsibleState.Expanded,
                'hook-trigger',
                '',
                this.context,
                element.hookConfigPath ? {
                    command: 'vscode.open',
                    title: 'Open Configuration File',
                    arguments: [vscode.Uri.file(element.hookConfigPath)]
                } : undefined
            );
            item.hookConfig = trigger;
            return item;
        });
    }

    /**
     * Get details for a single hook trigger
     */
    private getHookTriggerDetails(element: SteeringItem): SteeringItem[] {
        const trigger = element.hookConfig as HookTrigger;
        if (!trigger) return [];
        const items: SteeringItem[] = [];

        if (trigger.matcher !== undefined) {
            items.push(new SteeringItem(
                `Matcher: ${trigger.matcher || '(empty)'}`,
                vscode.TreeItemCollapsibleState.None,
                'hook-detail',
                '',
                this.context,
                element.command
            ));
        }

        if (trigger.hooks && Array.isArray(trigger.hooks)) {
            for (const hook of trigger.hooks) {
                if (hook.type === 'command' && hook.command) {
                    items.push(new SteeringItem(
                        `Command: ${hook.command}`,
                        vscode.TreeItemCollapsibleState.None,
                        'hook-command',
                        '',
                        this.context
                    ));
                }
            }
        }

        return items;
    }

    /**
     * Resolve all workflow step references to backing files.
     * Searches: .claude/commands/, ~/.claude/commands/, skill SKILL.md paths
     */
    private resolveWorkflowStepRefs(
        workflow: WorkflowConfig,
        workspaceRoot: string
    ): Array<{ label: string; command: string; path: string | null; type: 'step' | 'custom-command' }> {
        const refs: Array<{ label: string; command: string; path: string | null; type: 'step' | 'custom-command' }> = [];
        const seen = new Set<string>();
        const home = os.homedir();

        const resolveCommandPath = (cmd: string): string | null => {
            // 1. Project .claude/commands/
            const projectCmd = path.join(workspaceRoot, '.claude', 'commands', `${cmd}.md`);
            if (fs.existsSync(projectCmd)) return projectCmd;

            // 2. User ~/.claude/commands/
            const userCmd = path.join(home, '.claude', 'commands', `${cmd}.md`);
            if (fs.existsSync(userCmd)) return userCmd;

            // 3. Skill SKILL.md — command format "prefix.name" or "prefix:name" maps to skill dir
            // Check project skills
            const skillName = cmd.includes(':') ? cmd.split(':').pop()! : cmd.split('.').pop()!;
            const skillPrefix = cmd.includes(':') ? cmd.split(':')[0] : cmd.split('.')[0];

            // Plugin skills: ~/.claude/plugins/marketplaces/*/skills/{name}/SKILL.md
            const pluginsBase = path.join(home, '.claude', 'plugins', 'marketplaces');
            if (fs.existsSync(pluginsBase)) {
                try {
                    for (const marketplace of fs.readdirSync(pluginsBase)) {
                        // Match marketplace name containing the prefix (e.g., "sdd-marketplace" for "sdd")
                        const skillsDir = path.join(pluginsBase, marketplace, 'skills', skillName);
                        const skillFile = path.join(skillsDir, 'SKILL.md');
                        if (fs.existsSync(skillFile)) return skillFile;
                    }
                } catch { /* ignore */ }
            }

            // User skills: ~/.claude/skills/{name}/SKILL.md
            const userSkill = path.join(home, '.claude', 'skills', skillName, 'SKILL.md');
            if (fs.existsSync(userSkill)) return userSkill;

            // Project skills: .claude/skills/{name}/SKILL.md
            const projectSkill = path.join(workspaceRoot, '.claude', 'skills', skillName, 'SKILL.md');
            if (fs.existsSync(projectSkill)) return projectSkill;

            return null;
        };

        // Collect from steps[] array
        if (workflow.steps && workflow.steps.length > 0) {
            for (const step of workflow.steps) {
                if (step.command && !seen.has(step.command)) {
                    seen.add(step.command);
                    refs.push({
                        label: step.label || step.name,
                        command: step.command,
                        path: resolveCommandPath(step.command),
                        type: 'step',
                    });
                }
            }
        }

        // Collect from legacy step-* keys
        const stepKeys = ['step-specify', 'step-plan', 'step-tasks', 'step-implement'] as const;
        const legacyLabels: Record<string, string> = {
            'step-specify': 'Specify', 'step-plan': 'Plan',
            'step-tasks': 'Tasks', 'step-implement': 'Implement',
        };
        for (const key of stepKeys) {
            const value = workflow[key];
            if (value && !seen.has(value)) {
                seen.add(value);
                refs.push({
                    label: legacyLabels[key],
                    command: value,
                    path: resolveCommandPath(value),
                    type: 'step',
                });
            }
        }

        // Collect from customCommands setting
        const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
        const rawCommands = config.get<Array<Record<string, unknown> | string>>('customCommands', []);
        for (const entry of rawCommands) {
            if (typeof entry === 'string') continue;
            const cmd = (entry.command as string) || (entry.name ? `speckit.${entry.name}` : undefined);
            if (cmd) {
                const cleaned = cmd.replace(/^\//, '');
                if (!seen.has(cleaned)) {
                    seen.add(cleaned);
                    refs.push({
                        label: (entry.title as string) || (entry.name as string) || cleaned,
                        command: cleaned,
                        path: resolveCommandPath(cleaned),
                        type: 'custom-command',
                    });
                }
            }
        }

        return refs;
    }

    /**
     * Get children for the Workflow Commands header
     */
    private async getWorkflowCommandChildren(): Promise<SteeringItem[]> {
        const stepRefs = await this.getWorkflowStepRefs();
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        return stepRefs.map(ref => {
            const icon = ref.type === 'step' ? 'play' : 'terminal';
            const relativePath = ref.path ? path.relative(workspacePath, ref.path) : ref.command;

            const item = new SteeringItem(
                ref.label,
                vscode.TreeItemCollapsibleState.None,
                'workflow-command',
                ref.path || '',
                this.context,
                ref.path ? {
                    command: 'vscode.open',
                    title: 'Open',
                    arguments: [vscode.Uri.file(ref.path)]
                } : undefined,
                relativePath
            );
            item.iconPath = new vscode.ThemeIcon(icon);
            item.tooltip = ref.path
                ? `${ref.command} → ${relativePath}`
                : `${ref.command} (no backing file found)`;
            return item;
        });
    }
}

class SteeringItem extends vscode.TreeItem {
    public readonly groupType?: string;
    public hookConfig?: HookTrigger | HookTrigger[];
    public hookConfigPath?: string;

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

        // Set appropriate icons based on type
        if (contextValue === 'steering-loading') {
            this.iconPath = new vscode.ThemeIcon('sync~spin');
            this.tooltip = 'Loading steering documents...';
        } else if (contextValue === 'claude-md-global') {
            this.iconPath = new vscode.ThemeIcon('globe');
            this.tooltip = `Global CLAUDE.md: ${resourcePath}`;
            this.description = '~/.claude/CLAUDE.md';
        } else if (contextValue === 'claude-md-project') {
            this.iconPath = new vscode.ThemeIcon('root-folder');
            this.tooltip = `Project CLAUDE.md: ${resourcePath}`;
            this.description = 'CLAUDE.md';
        } else if (contextValue === 'create-global-claude') {
            this.iconPath = new vscode.ThemeIcon('globe');
            this.tooltip = 'Click to create Global CLAUDE.md';
        } else if (contextValue === 'create-project-claude') {
            this.iconPath = new vscode.ThemeIcon('root-folder');
            this.tooltip = 'Click to create Project CLAUDE.md';
        } else if (contextValue === 'separator') {
            this.iconPath = undefined;
            this.description = undefined;
        } else if (contextValue === 'steering-header') {
            this.iconPath = new vscode.ThemeIcon('folder-library');
            this.description = undefined;
            // Make it visually distinct but not clickable
            this.tooltip = 'Generated project steering documents';
        } else if (contextValue === 'steering-document') {
            // Different icons for different steering documents
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
            this.description = filename; // Show the relative path
        } else if (contextValue === 'speckit-header') {
            this.iconPath = new vscode.ThemeIcon('package');
            this.tooltip = 'SpecKit project configuration files';
        } else if (contextValue === 'speckit-constitution') {
            this.iconPath = new vscode.ThemeIcon('law');
            this.tooltip = `Project Constitution: ${resourcePath}`;
            this.description = filename;
        } else if (contextValue === 'speckit-scripts-category') {
            this.iconPath = new vscode.ThemeIcon('code');
            this.tooltip = 'SpecKit automation scripts';
        } else if (contextValue === 'speckit-script') {
            this.iconPath = new vscode.ThemeIcon('terminal');
            this.tooltip = `Script: ${resourcePath}`;
            this.description = filename;
        } else if (contextValue === 'speckit-templates-category') {
            this.iconPath = new vscode.ThemeIcon('note');
            this.tooltip = 'SpecKit document templates';
        } else if (contextValue === 'speckit-template') {
            this.iconPath = new vscode.ThemeIcon('file');
            this.tooltip = `Template: ${resourcePath}`;
            this.description = filename;
        } else if (contextValue === 'workflow-commands-header') {
            this.iconPath = new vscode.ThemeIcon('rocket');
            this.tooltip = 'Steps and commands in the active workflow';
        } else if (contextValue === 'workflow-command') {
            this.iconPath = new vscode.ThemeIcon('terminal');
            this.tooltip = `Workflow command: ${resourcePath}`;
            this.description = filename;
        } else if (contextValue === 'agents-header') {
            this.iconPath = new vscode.ThemeIcon('robot');
            this.tooltip = 'Custom agents';
        } else if (contextValue === 'agents-group') {
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
        } else if (contextValue === 'agent') {
            this.iconPath = new vscode.ThemeIcon('robot');
        } else if (contextValue === 'skills-header') {
            this.iconPath = new vscode.ThemeIcon('extensions');
            this.tooltip = 'Claude Code skills';
        } else if (contextValue === 'skills-group') {
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
        } else if (contextValue === 'skill') {
            this.iconPath = new vscode.ThemeIcon('symbol-misc');
        } else if (contextValue === 'skill-warning') {
            this.iconPath = new vscode.ThemeIcon('warning');
        } else if (contextValue === 'hooks-header') {
            this.iconPath = new vscode.ThemeIcon('activate-breakpoints');
            this.tooltip = 'Claude Code hooks';
        } else if (contextValue === 'hook') {
            this.iconPath = new vscode.ThemeIcon('activate-breakpoints');
        } else if (contextValue === 'hook-trigger') {
            this.iconPath = new vscode.ThemeIcon('run');
        } else if (contextValue === 'hook-detail') {
            this.iconPath = label.startsWith('Matcher:')
                ? new vscode.ThemeIcon('filter')
                : new vscode.ThemeIcon('circle-outline');
        } else if (contextValue === 'hook-command') {
            this.iconPath = new vscode.ThemeIcon('terminal');
        }

        // Don't set resourceUri to avoid showing diagnostic counts
        // if (resourcePath) {
        //     this.resourceUri = vscode.Uri.file(resourcePath);
        // }
    }
}
