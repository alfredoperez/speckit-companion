import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface SpecInfo {
    name: string;
    path: string;
}

/**
 * Status indicators for tree items (Unicode symbols)
 * More professional than emojis, maintains clean aesthetic
 */
const STATUS_INDICATORS = {
    empty: '○',      // Empty circle - not started
    partial: '◐',    // Half-filled - in progress
    complete: '●',   // Filled circle - complete
    loading: '◌'     // Dotted circle - loading
} as const;

type DocumentStatus = 'empty' | 'partial' | 'complete';

export class SpecExplorerProvider implements vscode.TreeDataProvider<SpecItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SpecItem | undefined | null | void> = new vscode.EventEmitter<SpecItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SpecItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private outputChannel: vscode.OutputChannel;
    private isLoading: boolean = false;

    constructor(private context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    refresh(): void {
        this.isLoading = true;
        this._onDidChangeTreeData.fire();

        setTimeout(() => {
            this.isLoading = false;
            this._onDidChangeTreeData.fire();
        }, 100);
    }

    getTreeItem(element: SpecItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get list of specs from specs/ directory
     */
    private async getSpecs(): Promise<SpecInfo[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const specs: SpecInfo[] = [];
        const specsPath = path.join(workspaceFolder.uri.fsPath, 'specs');

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(specsPath));
            for (const [name, type] of entries) {
                if (type === vscode.FileType.Directory) {
                    specs.push({ name, path: `specs/${name}` });
                }
            }
        } catch {
            // specs/ directory doesn't exist
            this.outputChannel.appendLine('[SpecExplorer] specs/ directory not found');
        }

        return specs;
    }

    async getChildren(element?: SpecItem): Promise<SpecItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        if (!element) {
            // Root level - show loading state or specs
            const items: SpecItem[] = [];

            if (this.isLoading) {
                items.push(new SpecItem(
                    'Loading specs...',
                    vscode.TreeItemCollapsibleState.None,
                    'spec-loading',
                    this.context
                ));
                return items;
            }

            // Show all specs
            const specs = await this.getSpecs();
            const specItems = specs.map(spec => new SpecItem(
                spec.name,
                vscode.TreeItemCollapsibleState.Expanded,
                'spec',
                this.context,
                spec.name,
                undefined,
                undefined,
                undefined,
                spec.path
            ));

            return specItems;
        } else if (element.contextValue === 'spec') {
            // Show spec documents (spec.md, plan.md, tasks.md)
            const specPath = element.specPath || `specs/${element.specName}`;
            return this.getSpecDocuments(element.specName!, specPath);
        } else if (element.contextValue?.startsWith('spec-document-') && element.relatedDocs && element.relatedDocs.length > 0) {
            // Show related documents as children
            return this.getRelatedDocItems(element);
        }

        return [];
    }

    /**
     * Check document status based on file existence and content
     */
    private getDocumentStatus(fullPath: string): DocumentStatus {
        try {
            if (!fs.existsSync(fullPath)) {
                return 'empty';
            }
            const content = fs.readFileSync(fullPath, 'utf-8').trim();
            if (content.length === 0) {
                return 'empty';
            }
            // Consider it complete if it has substantial content (more than just a title)
            const lines = content.split('\n').filter(l => l.trim().length > 0);
            if (lines.length > 3) {
                return 'complete';
            }
            return 'partial';
        } catch {
            return 'empty';
        }
    }

    /**
     * Scan for related documents in a spec folder
     * Returns files that are not spec.md, plan.md, or tasks.md
     */
    private getRelatedDocs(specFullPath: string): string[] {
        const mainDocs = ['spec.md', 'plan.md', 'tasks.md'];
        try {
            const files = fs.readdirSync(specFullPath);
            return files
                .filter(f => f.endsWith('.md') && !mainDocs.includes(f))
                .sort();
        } catch {
            return [];
        }
    }

    /**
     * Create tree items for related documents
     */
    private getRelatedDocItems(parentElement: SpecItem): SpecItem[] {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder || !parentElement.relatedDocs) {
            return [];
        }

        const basePath = workspaceFolder.uri.fsPath;
        const specPath = parentElement.specPath || `specs/${parentElement.specName}`;

        return parentElement.relatedDocs.map(fileName => {
            const fullPath = path.join(basePath, specPath, fileName);
            const status = this.getDocumentStatus(fullPath);

            return new SpecItem(
                fileName.replace('.md', ''),
                vscode.TreeItemCollapsibleState.None,
                'spec-related-doc',
                this.context,
                parentElement.specName,
                'related',
                {
                    command: 'vscode.openWith',
                    title: `Open ${fileName}`,
                    arguments: [
                        vscode.Uri.file(fullPath),
                        'speckit.workflowEditor'
                    ]
                },
                `${specPath}/${fileName}`,
                specPath,
                status
            );
        });
    }

    /**
     * Get SpecKit documents (spec.md, plan.md, tasks.md) with related docs grouped under plan
     */
    private getSpecDocuments(specName: string, specPath: string): SpecItem[] {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const basePath = workspaceFolder.uri.fsPath;
        const specFullPath = path.join(basePath, specPath);

        // Scan for related documents
        const relatedDocs = this.getRelatedDocs(specFullPath);

        // Open file directly with the workflow editor
        const createOpenCommand = (fileName: string, title: string) => ({
            command: 'vscode.openWith',
            title,
            arguments: [
                vscode.Uri.file(path.join(basePath, specPath, fileName)),
                'speckit.workflowEditor'
            ]
        });

        // Check status of each document
        const specStatus = this.getDocumentStatus(path.join(basePath, specPath, 'spec.md'));
        const planStatus = this.getDocumentStatus(path.join(basePath, specPath, 'plan.md'));
        const tasksStatus = this.getDocumentStatus(path.join(basePath, specPath, 'tasks.md'));

        // Plan is collapsible if it has related docs
        const planCollapsible = relatedDocs.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;

        return [
            new SpecItem(
                'spec',
                vscode.TreeItemCollapsibleState.None,
                'spec-document',
                this.context,
                specName,
                'spec',
                createOpenCommand('spec.md', 'Open Spec'),
                `${specPath}/spec.md`,
                specPath,
                specStatus
            ),
            new SpecItem(
                'plan',
                planCollapsible,
                'spec-document',
                this.context,
                specName,
                'plan',
                createOpenCommand('plan.md', 'Open Plan'),
                `${specPath}/plan.md`,
                specPath,
                planStatus,
                relatedDocs  // Pass related docs for children
            ),
            new SpecItem(
                'tasks',
                vscode.TreeItemCollapsibleState.None,
                'spec-document',
                this.context,
                specName,
                'tasks',
                createOpenCommand('tasks.md', 'Open Tasks'),
                `${specPath}/tasks.md`,
                specPath,
                tasksStatus
            )
        ];
    }
}

class SpecItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        private readonly context: vscode.ExtensionContext,
        public readonly specName?: string,
        public readonly documentType?: string,
        public readonly command?: vscode.Command,
        private readonly filePath?: string,
        public readonly specPath?: string,
        private readonly status?: DocumentStatus,
        public readonly relatedDocs?: string[]
    ) {
        super(label, collapsibleState);

        if (contextValue === 'spec-loading') {
            this.iconPath = new vscode.ThemeIcon('sync~spin');
            this.tooltip = 'Loading specs...';
        } else if (contextValue === 'spec') {
            this.iconPath = new vscode.ThemeIcon('beaker');
            this.tooltip = `SpecKit Spec: ${label}`;
        } else if (contextValue === 'spec-document') {
            // Set icon based on document type
            if (documentType === 'spec') {
                this.iconPath = new vscode.ThemeIcon('chip');
            } else if (documentType === 'plan') {
                this.iconPath = new vscode.ThemeIcon('layers');
            } else if (documentType === 'tasks') {
                this.iconPath = new vscode.ThemeIcon('tasklist');
            } else {
                this.iconPath = new vscode.ThemeIcon('file');
            }

            // Add status indicator to description
            const statusIndicator = status ? STATUS_INDICATORS[status] : STATUS_INDICATORS.empty;
            const statusLabel = status === 'complete' ? 'Complete' : status === 'partial' ? 'In Progress' : 'Not Started';

            this.description = `${statusIndicator}`;
            this.tooltip = `${documentType}: ${specName}/${label} — ${statusLabel}`;

            this.contextValue = `spec-document-${documentType}`;
        } else if (contextValue === 'spec-related-doc') {
            this.iconPath = new vscode.ThemeIcon('file-text');
            const statusIndicator = status ? STATUS_INDICATORS[status] : STATUS_INDICATORS.empty;
            this.description = `${statusIndicator}`;
            this.tooltip = `Related: ${label}.md`;
        }
    }
}
