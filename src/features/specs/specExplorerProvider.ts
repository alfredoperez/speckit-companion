import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BaseTreeDataProvider } from '../../core/providers';
import {
    getFeatureWorkflow,
    getWorkflow,
    normalizeWorkflowConfig,
    getStepFile,
    DEFAULT_WORKFLOW,
    WorkflowStepConfig,
} from '../workflows';
import { resolveSpecDirectories, hasDuplicateNames, deriveChangeRoot, type SpecDirectoryInfo } from '../../core/specDirectoryResolver';
import { ConfigKeys } from '../../core/constants';

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
     * Get list of specs from configured spec directories
     */
    private async getSpecs(): Promise<SpecInfo[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        try {
            return await resolveSpecDirectories(workspaceFolder.uri.fsPath);
        } catch {
            this.log('Error resolving spec directories');
            return [];
        }
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
            const duplicateNames = hasDuplicateNames(specs);
            const specItems = specs.map(spec => {
                const item = new SpecItem(
                    spec.name,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'spec',
                    this.context,
                    spec.name,
                    undefined,
                    undefined,
                    undefined,
                    spec.path
                );
                // Show parent path for disambiguation when names collide
                if (duplicateNames.has(spec.name)) {
                    const parentDir = spec.path.substring(0, spec.path.lastIndexOf('/'));
                    item.description = parentDir;
                }
                return item;
            });

            return specItems;
        } else if (element.contextValue === 'spec') {
            // Show spec documents based on active workflow steps
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
        // For subDir patterns like "specs/home/spec" → just show "Home"
        // Extract the meaningful middle part (folder name) when 3+ segments
        if (parts.length >= 3) {
            const folderName = parts[parts.length - 2];
            return folderName.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
        }
        // For 2 segments like "specs/navigation" → show "Navigation"
        if (parts.length === 2) {
            const name = parts[parts.length - 1];
            return name.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
        }
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
     * Resolve workflow steps for a feature directory.
     * Returns the steps array from the feature's workflow, falling back to the default.
     */
    private async resolveWorkflowSteps(featureDir: string): Promise<WorkflowStepConfig[]> {
        try {
            const ctx = await getFeatureWorkflow(featureDir);
            if (ctx) {
                const wf = getWorkflow(ctx.workflow);
                if (wf) {
                    const normalized = normalizeWorkflowConfig(wf);
                    if (normalized.steps && normalized.steps.length > 0) {
                        return normalized.steps;
                    }
                }
            }
        } catch {
            // fall through
        }

        // Fall back to defaultWorkflow setting
        const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
        const defaultWorkflowName = config.get<string>("defaultWorkflow", "default");
        if (defaultWorkflowName !== "default") {
            const wf = getWorkflow(defaultWorkflowName);
            if (wf) {
                const normalized = normalizeWorkflowConfig(wf);
                if (normalized.steps && normalized.steps.length > 0) {
                    return normalized.steps;
                }
            }
        }

        return DEFAULT_WORKFLOW.steps!;
    }

    /**
     * Get step-specific icon
     */
    private getStepIcon(stepName: string): string {
        const iconMap: Record<string, string> = {
            specify: 'chip',
            plan: 'layers',
            tasks: 'tasklist',
            implement: 'rocket',
        };
        return iconMap[stepName] || 'file';
    }

    /**
     * Get sub-files for a step: explicit subFiles list, or scan subDir
     */
    private getStepSubFiles(specFullPath: string, step: WorkflowStepConfig): string[] {
        if (step.subFiles && step.subFiles.length > 0) {
            // Return only those that exist
            return step.subFiles.filter(f => {
                try {
                    return fs.existsSync(path.join(specFullPath, f));
                } catch {
                    return false;
                }
            });
        }
        if (step.subDir) {
            const dirPath = path.join(specFullPath, step.subDir);
            const stepFile = getStepFile(step);
            const results: string[] = [];
            try {
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                for (const e of entries) {
                    if (e.isFile() && e.name.endsWith('.md')) {
                        // Flat .md files in subDir
                        results.push(`${step.subDir}/${e.name}`);
                    } else if (e.isDirectory()) {
                        // Subdirectory: check if step file exists inside
                        const subFilePath = path.join(dirPath, e.name, stepFile);
                        if (fs.existsSync(subFilePath)) {
                            results.push(`${step.subDir}/${e.name}/${stepFile}`);
                        }
                    }
                }
                return results.sort();
            } catch {
                return [];
            }
        }
        return [];
    }

    /**
     * Get SpecKit documents based on the active workflow's steps, with related docs
     */
    private async getSpecDocuments(specName: string, specPath: string): Promise<SpecItem[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const basePath = workspaceFolder.uri.fsPath;
        const specFullPath = path.join(basePath, specPath);

        // Compute change root for two-level layouts
        const changeRoot = deriveChangeRoot(specFullPath, basePath);
        const changeRootRelative = changeRoot ? path.relative(basePath, changeRoot).replace(/\\/g, '/') : null;

        const allSteps = await this.resolveWorkflowSteps(specFullPath);
        const steps = allSteps.filter(s => !s.actionOnly);

        // Scan for related documents not covered by any step
        const allRelatedDocs = this.getRelatedDocs(specFullPath);
        // Also scan changeRoot for related docs
        if (changeRoot && changeRoot !== specFullPath) {
            const changeRootRelated = this.getRelatedDocs(changeRoot);
            for (const doc of changeRootRelated) {
                if (!allRelatedDocs.includes(doc)) {
                    allRelatedDocs.push(doc);
                }
            }
        }
        const stepFiles = new Set(steps.map(s => getStepFile(s)));

        // Collect all sub-file paths across all steps so they can be excluded from related docs
        const allSubFiles = new Set<string>();
        for (const step of steps) {
            for (const sf of this.getStepSubFiles(specFullPath, step)) {
                allSubFiles.add(sf);
            }
        }

        const createOpenCommand = (filePath: string, title: string) => ({
            command: 'speckit.viewSpecDocument',
            title,
            arguments: [filePath]
        });

        const items: SpecItem[] = [];

        for (const step of steps) {
            const file = getStepFile(step);
            const label = step.label || step.name.charAt(0).toUpperCase() + step.name.slice(1);

            // Try specFullPath first, then changeRoot for the file
            let resolvedFilePath = path.join(specFullPath, file);
            let status = this.getDocumentStatus(resolvedFilePath);

            if (status === 'empty' && changeRoot && changeRoot !== specFullPath) {
                const changeRootFilePath = path.join(changeRoot, file);
                const changeRootStatus = this.getDocumentStatus(changeRootFilePath);
                if (changeRootStatus !== 'empty') {
                    resolvedFilePath = changeRootFilePath;
                    status = changeRootStatus;
                }
            }

            const iconName = this.getStepIcon(step.name);

            // Determine sub-files for this step
            const subFiles = this.getStepSubFiles(specFullPath, step);

            // If core file doesn't exist but sub-files do, treat step as complete
            if (status === 'empty' && subFiles.length > 0) {
                status = 'complete';
            }

            // Also include related docs that aren't step files (attach to plan-like step)
            let relatedForStep: string[] = [];
            if (step.includeRelatedDocs) {
                // Attach non-step related docs to this step per workflow config
                relatedForStep = allRelatedDocs.filter(d => !stepFiles.has(d) && !allSubFiles.has(d));
            }

            const childDocs = [...subFiles, ...relatedForStep];
            const collapsible = childDocs.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;

            const relativeFilePath = path.relative(basePath, resolvedFilePath).replace(/\\/g, '/');

            items.push(new SpecItem(
                label,
                collapsible,
                'spec-document',
                this.context,
                specName,
                step.name,
                createOpenCommand(resolvedFilePath, `Open ${label}`),
                relativeFilePath,
                specPath,
                status,
                childDocs.length > 0 ? childDocs : undefined,
                iconName
            ));
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
        public readonly relatedDocs?: string[],
        private readonly iconName?: string
    ) {
        super(label, collapsibleState);

        if (contextValue === 'spec-loading') {
            this.iconPath = new vscode.ThemeIcon('sync~spin');
            this.tooltip = 'Loading specs...';
        } else if (contextValue === 'spec') {
            this.iconPath = new vscode.ThemeIcon('beaker');
            this.tooltip = `SpecKit Spec: ${label}`;
        } else if (contextValue === 'spec-document') {
            // Set icon from explicit iconName or fallback to document type
            this.iconPath = new vscode.ThemeIcon(iconName || 'file');

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
