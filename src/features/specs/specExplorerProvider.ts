import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BaseTreeDataProvider } from '../../core/providers';
import {
    getWorkflow,
    getFeatureWorkflow,
    DEFAULT_WORKFLOW,
    getStepFile,
    normalizeWorkflowConfig,
} from '../workflows';
import type { WorkflowStepConfig } from '../workflows';

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
            // Show workflow step documents dynamically
            const specPath = element.specPath || `specs/${element.specName}`;
            return await this.getSpecDocuments(element.specName!, specPath);
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
     * Returns files that are not step output files
     */
    private getRelatedDocs(specFullPath: string, steps: WorkflowStepConfig[]): string[] {
        const stepFiles = new Set(steps.map(s => getStepFile(s)));
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
                        // Skip step output files at root level
                        if (!relativePath && stepFiles.has(entry.name)) {
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
     * Resolve the active workflow's steps for a given spec directory
     */
    private async getWorkflowSteps(specFullPath: string): Promise<WorkflowStepConfig[]> {
        try {
            const featureContext = await getFeatureWorkflow(specFullPath);
            if (featureContext) {
                const workflow = getWorkflow(featureContext.workflow);
                if (workflow) {
                    const normalized = normalizeWorkflowConfig(workflow);
                    return normalized.steps ?? DEFAULT_WORKFLOW.steps!;
                }
            }
        } catch {
            // Fall through to default
        }
        return DEFAULT_WORKFLOW.steps!;
    }

    /**
     * Scan a directory for .md sub-files (non-recursive)
     */
    private scanSubDir(dirPath: string): string[] {
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            return entries
                .filter(e => e.isFile() && e.name.endsWith('.md'))
                .map(e => e.name)
                .sort();
        } catch {
            return [];
        }
    }

    /**
     * Get workflow step documents dynamically from the active workflow
     */
    private async getSpecDocuments(specName: string, specPath: string): Promise<SpecItem[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const basePath = workspaceFolder.uri.fsPath;
        const specFullPath = path.join(basePath, specPath);

        // Get workflow steps
        const steps = await this.getWorkflowSteps(specFullPath);

        // Scan for related documents (not associated with any step)
        const relatedDocs = this.getRelatedDocs(specFullPath, steps);

        const createOpenCommand = (fileName: string, title: string) => ({
            command: 'speckit.viewSpecDocument',
            title,
            arguments: [path.join(basePath, specPath, fileName)]
        });

        const items: SpecItem[] = [];

        for (const step of steps) {
            const stepFile = getStepFile(step);
            const stepLabel = step.label ?? step.name.charAt(0).toUpperCase() + step.name.slice(1);
            const status = this.getDocumentStatus(path.join(specFullPath, stepFile));

            // Determine sub-files for this step
            let childFiles: string[] = [];
            if (step.subFiles && step.subFiles.length > 0) {
                childFiles = step.subFiles;
            } else if (step.subDir) {
                const subDirPath = path.join(specFullPath, step.subDir);
                childFiles = this.scanSubDir(subDirPath).map(f => `${step.subDir}/${f}`);
            }

            // For the "plan" step (or any step with sub-files), also include related docs as children
            // This preserves the existing behavior where related docs appear under plan
            let stepRelatedDocs: string[] = [];
            if (step.includeRelatedDocs && relatedDocs.length > 0) {
                stepRelatedDocs = relatedDocs;
            }

            const allChildren = [...childFiles, ...stepRelatedDocs];
            const collapsible = allChildren.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;

            items.push(
                new SpecItem(
                    stepLabel.toLowerCase(),
                    collapsible,
                    'spec-document',
                    this.context,
                    specName,
                    step.name,
                    createOpenCommand(stepFile, `Open ${stepLabel}`),
                    `${specPath}/${stepFile}`,
                    specPath,
                    status,
                    allChildren.length > 0 ? allChildren : undefined
                )
            );
        }

        return items;
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
