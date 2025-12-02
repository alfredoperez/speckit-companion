import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SteeringManager } from './steeringManager';
import { getConfiguredProviderType, getProviderPaths, AIProviderType } from '../../ai-providers/aiProvider';

export class SteeringExplorerProvider implements vscode.TreeDataProvider<SteeringItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SteeringItem | undefined | null | void> = new vscode.EventEmitter<SteeringItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SteeringItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private steeringManager!: SteeringManager;
    private isLoading: boolean = false;

    constructor(private context: vscode.ExtensionContext) {
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

    getTreeItem(element: SteeringItem): vscode.TreeItem {
        return element;
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
}

class SteeringItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly resourcePath: string,
        private readonly context: vscode.ExtensionContext,
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
        }

        // Don't set resourceUri to avoid showing diagnostic counts
        // if (resourcePath) {
        //     this.resourceUri = vscode.Uri.file(resourcePath);
        // }
    }
}