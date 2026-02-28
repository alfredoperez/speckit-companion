import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SteeringManager } from './steeringManager';
import { getConfiguredProviderType, getProviderPaths, AIProviderType } from '../../ai-providers/aiProvider';
import { SpecKitFilesResult, SPECKIT_PATHS } from './types';
import { BaseTreeDataProvider } from '../../core/providers';
import { getWorkflow } from '../../features/workflows/workflowManager';
import { WorkflowConfig } from '../../features/workflows/types';
import { ConfigKeys } from '../../core/constants';

export class SteeringExplorerProvider extends BaseTreeDataProvider<SteeringItem> {
    private steeringManager!: SteeringManager;

    constructor(context: vscode.ExtensionContext) {
        super(context, { name: 'SteeringExplorerProvider' });
        // We'll set the steering manager later from extension.ts
    }

    setSteeringManager(steeringManager: SteeringManager) {
        this.steeringManager = steeringManager;
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

            // Workflow Commands - show command files referenced by active workflow
            const workflowCommands = await this.getWorkflowCommandFiles();
            if (workflowCommands.length > 0) {
                items.push(new SteeringItem(
                    'Workflow Commands',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'workflow-commands-header',
                    '',
                    this.context
                ));
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
    private async getWorkflowCommandFiles(): Promise<Array<{ name: string; path: string }>> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return [];

        const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
        const defaultWorkflowName = config.get<string>('defaultWorkflow', 'default');
        const workflow = getWorkflow(defaultWorkflowName) || getWorkflow('default');
        if (!workflow || workflow.name === 'default') return [];

        return this.resolveWorkflowCommandFiles(workflow, workspaceFolder.uri.fsPath);
    }

    /**
     * Resolve command names from a workflow config to file paths
     */
    private resolveWorkflowCommandFiles(
        workflow: WorkflowConfig,
        workspaceRoot: string
    ): Array<{ name: string; path: string }> {
        const commandNames = new Set<string>();

        // Collect step commands that differ from defaults
        const stepKeys = ['step-specify', 'step-plan', 'step-tasks', 'step-implement'] as const;
        const defaults: Record<string, string> = {
            'step-specify': 'speckit.specify',
            'step-plan': 'speckit.plan',
            'step-tasks': 'speckit.tasks',
            'step-implement': 'speckit.implement',
        };

        for (const key of stepKeys) {
            const value = workflow[key];
            if (value && value !== defaults[key]) {
                commandNames.add(value);
            }
        }

        // Collect commands from customCommands setting
        const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
        const rawCommands = config.get<Array<Record<string, unknown> | string>>('customCommands', []);
        for (const entry of rawCommands) {
            if (typeof entry === 'string') continue;
            const cmd = (entry.command as string) || (entry.name ? `speckit.${entry.name}` : undefined);
            if (cmd) {
                // Strip leading slash and add to set
                commandNames.add(cmd.replace(/^\//, ''));
            }
        }

        // Resolve to file paths
        const files: Array<{ name: string; path: string }> = [];
        for (const cmdName of commandNames) {
            const filePath = path.join(workspaceRoot, '.claude', 'commands', `${cmdName}.md`);
            if (fs.existsSync(filePath)) {
                files.push({ name: `${cmdName}.md`, path: filePath });
            }
        }

        return files.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get children for the Workflow Commands header
     */
    private async getWorkflowCommandChildren(): Promise<SteeringItem[]> {
        const commandFiles = await this.getWorkflowCommandFiles();
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        return commandFiles.map(file => new SteeringItem(
            file.name.replace('.md', ''),
            vscode.TreeItemCollapsibleState.None,
            'workflow-command',
            file.path,
            this.context,
            {
                command: 'vscode.open',
                title: 'Open Workflow Command',
                arguments: [vscode.Uri.file(file.path)]
            },
            path.relative(workspacePath, file.path)
        ));
    }
}

class SteeringItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly resourcePath: string,
        private readonly extContext: vscode.ExtensionContext,
        public readonly command?: vscode.Command,
        private readonly filename?: string
    ) {
        super(label, collapsibleState);

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
            this.tooltip = 'Command files referenced by the active workflow';
        } else if (contextValue === 'workflow-command') {
            this.iconPath = new vscode.ThemeIcon('terminal');
            this.tooltip = `Workflow command: ${resourcePath}`;
            this.description = filename;
        }

        // Don't set resourceUri to avoid showing diagnostic counts
        // if (resourcePath) {
        //     this.resourceUri = vscode.Uri.file(resourcePath);
        // }
    }
}
