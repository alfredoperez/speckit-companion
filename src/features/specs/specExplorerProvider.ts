import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BaseTreeDataProvider } from '../../core/providers';

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

export class SpecExplorerProvider extends BaseTreeDataProvider<SpecItem> {
    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        super(context, { name: 'SpecExplorerProvider', outputChannel });
    }

    refresh(): void {
        this.isLoading = true;
        this._onDidChangeTreeData.fire();

        setTimeout(() => {
            this.isLoading = false;
            this._onDidChangeTreeData.fire();
        }, 100);
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
            this.log('specs/ directory not found');
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
     * Scan for related documents in a spec folder (including subdirectories)
     * Returns files that are not spec.md, plan.md, or tasks.md
     */
    private getRelatedDocs(specFullPath: string): string[] {
        const mainDocs = ['spec.md', 'plan.md', 'tasks.md'];
        const results: string[] = [];

        const scanDir = (dirPath: string, relativePath: string = '') => {
            try {
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    // Skip hidden directories and checklists
                    if (entry.name.startsWith('.') || entry.name === 'checklists') {
                        continue;
                    }

                    const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

                    if (entry.isDirectory()) {
                        scanDir(path.join(dirPath, entry.name), entryRelativePath);
                    } else if (entry.isFile() && entry.name.endsWith('.md')) {
                        // Skip core docs at root level
                        if (!relativePath && mainDocs.includes(entry.name)) {
                            continue;
                        }
                        results.push(entryRelativePath);
                    }
                }
            } catch {
                // Directory read error
            }
        };

        scanDir(specFullPath);
        return results.sort();
    }

    /**
     * Convert nested file path to display name
     * e.g., "contracts/webview-messages.md" -> "Contracts: Webview Messages"
     */
    private nestedFileToDisplayName(relativePath: string): string {
        const parts = relativePath.replace(/\.md$/i, '').split('/');
        return parts
            .map(part => part.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase()))
            .join(': ');
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

        return parentElement.relatedDocs.map(relativePath => {
            const fullPath = path.join(basePath, specPath, relativePath);
            const status = this.getDocumentStatus(fullPath);
            const isNested = relativePath.includes('/');
            const displayName = isNested
                ? this.nestedFileToDisplayName(relativePath)
                : relativePath.replace('.md', '');

            return new SpecItem(
                displayName,
                vscode.TreeItemCollapsibleState.None,
                'spec-related-doc',
                this.context,
                parentElement.specName,
                'related',
                {
                    command: 'speckit.viewSpecDocument',
                    title: `Open ${relativePath}`,
                    arguments: [fullPath]
                },
                `${specPath}/${relativePath}`,
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

        // Open file in unified spec viewer webview (singleton panel with tabs)
        const createOpenCommand = (fileName: string, title: string) => ({
            command: 'speckit.viewSpecDocument',
            title,
            arguments: [path.join(basePath, specPath, fileName)]
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
        private readonly extContext: vscode.ExtensionContext,
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

            // Set resourceUri so inline actions can resolve the file path
            if (filePath) {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    this.resourceUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, filePath));
                }
            }
        } else if (contextValue === 'spec-related-doc') {
            this.iconPath = new vscode.ThemeIcon('file-text');
            const statusIndicator = status ? STATUS_INDICATORS[status] : STATUS_INDICATORS.empty;
            this.description = `${statusIndicator}`;
            this.tooltip = `Related: ${label}.md`;
        }
    }
}
