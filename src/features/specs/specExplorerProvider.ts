import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BaseTreeDataProvider } from '../../core/providers';
import {
    getFeatureWorkflow,
    resolveWorkflow,
    getWorkflow,
    normalizeWorkflowConfig,
    getStepFile,
    DEFAULT_WORKFLOW,
    WorkflowStepConfig,
    FeatureWorkflowContext,
    SpecStatus,
} from '../workflows';
import { resolveSpecDirectories, hasDuplicateNames, deriveChangeRoot, type SpecDirectoryInfo } from '../../core/specDirectoryResolver';
import { SpecStatuses, WorkflowSteps } from '../../core/constants';
import { readSpecContextSync } from './specContextManager';
import { isStepCompleted } from '../spec-viewer/stateDerivation';
import { StepName, STEP_NAMES } from '../../core/types/specContext';
import { SpecsFilterState } from './specsFilterState';
import { fuzzyMatch } from './fuzzyMatch';
import { SpecsSortState } from './specsSortState';
import { comparators, DEFAULT_SORT_MODE } from './specsSortMode';
import { fileNameToDisplayName } from '../spec-viewer/utils';

export interface SpecInfo {
    name: string;
    path: string;
}

type DocumentStatus = 'empty' | 'partial' | 'complete';

export class SpecExplorerProvider extends BaseTreeDataProvider<SpecItem> {
    public activeSpecName: string | null = null;
    public expandAllSpecs: boolean = true;

    constructor(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel,
        private readonly filterState?: SpecsFilterState,
        private readonly sortState?: SpecsSortState
    ) {
        super(context, { name: 'SpecExplorerProvider', outputChannel });
    }

    setActiveSpec(specName: string): void {
        this.activeSpecName = specName;
        this._onDidChangeTreeData.fire();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
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

    /**
     * Read spec context to determine status for grouping
     */
    private getSpecStatus(specFullPath: string): SpecStatus {
        const context = readSpecContextSync(specFullPath);
        return context?.status || SpecStatuses.ACTIVE;
    }

    async getChildren(element?: SpecItem): Promise<SpecItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        if (!element) {
            // Root level - show loading state or group nodes
            if (this.isLoading) {
                return [new SpecItem(
                    'Loading specs...',
                    vscode.TreeItemCollapsibleState.None,
                    'spec-loading',
                    this.context
                )];
            }

            const specs = await this.getSpecs();
            if (specs.length === 0) {
                return [];
            }

            const workspaceFolder = vscode.workspace.workspaceFolders![0];
            const basePath = workspaceFolder.uri.fsPath;

            // Partition specs by status from .spec-context.json. Cache each spec's
            // context read so the fuzzy filter below can reuse specName without a
            // second disk read per spec.
            const activeSpecs: SpecInfo[] = [];
            const completedSpecs: SpecInfo[] = [];
            const archivedSpecs: SpecInfo[] = [];
            const specNameByPath = new Map<string, string | undefined>();
            const statusByPath = new Map<string, string | undefined>();

            for (const spec of specs) {
                const specFullPath = path.join(basePath, spec.path);
                const context = readSpecContextSync(specFullPath);
                const status = context?.status || SpecStatuses.ACTIVE;
                specNameByPath.set(spec.path, context?.specName);
                statusByPath.set(spec.path, context?.currentStep);
                if (status === SpecStatuses.COMPLETED) {
                    completedSpecs.push(spec);
                } else if (status === SpecStatuses.ARCHIVED) {
                    archivedSpecs.push(spec);
                } else {
                    activeSpecs.push(spec);
                }
            }

            // Apply fuzzy filter across slug + specName when a query is active.
            const query = this.filterState?.getQuery() ?? '';
            let filteredActive = activeSpecs;
            let filteredCompleted = completedSpecs;
            let filteredArchived = archivedSpecs;
            if (query.length > 0) {
                const matches = (spec: SpecInfo) =>
                    fuzzyMatch(query, spec.name, specNameByPath.get(spec.path));
                filteredActive = activeSpecs.filter(matches);
                filteredCompleted = completedSpecs.filter(matches);
                filteredArchived = archivedSpecs.filter(matches);
            }

            const noFilterMatch = query.length > 0
                && filteredActive.length === 0
                && filteredCompleted.length === 0
                && filteredArchived.length === 0;
            try {
                const p = vscode.commands.executeCommand('setContext', 'speckit.specs.noFilterMatch', noFilterMatch);
                Promise.resolve(p).catch(() => { /* fire-and-forget */ });
            } catch { /* fire-and-forget */ }

            // Dispatch on the active sort mode. Default ('number') preserves
            // the historical numeric-prefix-desc ordering so nothing changes
            // for users who never open the picker. Every comparator falls
            // back to numeric-prefix then name on ties so output is
            // deterministic across reloads.
            const mode = this.sortState?.getMode() ?? DEFAULT_SORT_MODE;
            const cmp = comparators[mode]({ basePath, specNameByPath, statusByPath });
            filteredActive.sort(cmp);
            filteredCompleted.sort(cmp);
            filteredArchived.sort(cmp);

            const items: SpecItem[] = [];

            // Group items get stable ids so VS Code preserves the user's
            // manual expand/collapse state across refreshes — the toggle
            // button only affects spec items, never groups.
            if (filteredActive.length > 0) {
                const activeGroup = new SpecItem(
                    `Active (${filteredActive.length})`,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'spec-group',
                    this.context
                );
                activeGroup.id = 'spec-group:active';
                activeGroup.groupSpecs = filteredActive;
                items.push(activeGroup);
            }

            if (filteredCompleted.length > 0) {
                const completedGroup = new SpecItem(
                    `Completed (${filteredCompleted.length})`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'spec-group',
                    this.context
                );
                completedGroup.id = 'spec-group:completed';
                completedGroup.groupSpecs = filteredCompleted;
                items.push(completedGroup);
            }

            if (filteredArchived.length > 0) {
                const archivedGroup = new SpecItem(
                    `Archived (${filteredArchived.length})`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'spec-group',
                    this.context
                );
                archivedGroup.id = 'spec-group:archived';
                archivedGroup.groupSpecs = filteredArchived;
                items.push(archivedGroup);
            }

            return items;
        } else if (element.contextValue === 'spec-group') {
            // Show specs within a group
            const specs = element.groupSpecs || [];
            const allSpecs = await this.getSpecs();
            const duplicateNames = hasDuplicateNames(allSpecs);

            const basePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
            return specs.map(spec => {
                const isActive = this.activeSpecName === spec.name;
                const specFullPath = path.join(basePath, spec.path);
                const specContext = readSpecContextSync(specFullPath);
                const item = new SpecItem(
                    spec.name,
                    this.expandAllSpecs
                        ? vscode.TreeItemCollapsibleState.Expanded
                        : vscode.TreeItemCollapsibleState.Collapsed,
                    'spec',
                    this.context,
                    spec.name,
                    undefined,
                    undefined,
                    undefined,
                    spec.path,
                    undefined,
                    undefined,
                    undefined,
                    isActive,
                    specContext
                );
                if (duplicateNames.has(spec.name)) {
                    const parentDir = spec.path.substring(0, spec.path.lastIndexOf('/'));
                    item.description = parentDir;
                }
                // Encode the toggle flag into the item id so VS Code treats
                // the item as fresh on each toggle and honors the emitted
                // collapsibleState (otherwise VS Code preserves the user's
                // last-known expansion state and ignores re-emits).
                item.id = `spec:${spec.path}:${this.expandAllSpecs ? 'e' : 'c'}`;
                return item;
            });
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
                    // Skip hidden directories
                    if (entry.name.startsWith('.')) {
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
     * Create tree items for related documents.
     * Returned from getChildren(stepItem) so VS Code renders them as tree
     * children of the step — indentation is handled natively by the tree view.
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
                : fileNameToDisplayName(relativePath);

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
     * When no workflow is persisted, auto-selects and persists the default.
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

        // No persisted workflow — resolve default without writing to disk
        const selected = await resolveWorkflow(featureDir);
        if (selected) {
            const normalized = normalizeWorkflowConfig(selected);
            if (normalized.steps && normalized.steps.length > 0) {
                return normalized.steps;
            }
        }

        return DEFAULT_WORKFLOW.steps!;
    }

    /**
     * Get display label for a step, with overrides for readability
     */
    private getStepLabel(step: WorkflowStepConfig): string {
        if (step.label) return step.label;
        const labelMap: Record<string, string> = {
            [WorkflowSteps.SPECIFY]: 'Specification',
        };
        return labelMap[step.name] || step.name.charAt(0).toUpperCase() + step.name.slice(1);
    }

    /**
     * Get sub-files for a step: explicit subFiles list, or scan subDir
     */
    private getStepSubFiles(specFullPath: string, step: WorkflowStepConfig): string[] {
        const results: string[] = [];

        // Collect explicit subFiles that exist
        if (step.subFiles && step.subFiles.length > 0) {
            for (const f of step.subFiles) {
                try {
                    if (fs.existsSync(path.join(specFullPath, f))) {
                        results.push(f);
                    }
                } catch { /* skip */ }
            }
        }

        // Collect subDir contents
        if (step.subDir) {
            const dirPath = path.join(specFullPath, step.subDir);
            const stepFile = getStepFile(step);
            try {
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                for (const e of entries) {
                    if (e.isFile() && e.name.endsWith('.md')) {
                        results.push(`${step.subDir}/${e.name}`);
                    } else if (e.isDirectory()) {
                        const subFilePath = path.join(dirPath, e.name, stepFile);
                        if (fs.existsSync(subFilePath)) {
                            results.push(`${step.subDir}/${e.name}/${stepFile}`);
                        }
                    }
                }
            } catch { /* skip */ }
        }

        return results.sort();
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
        const specContext = readSpecContextSync(specFullPath);

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
            const label = this.getStepLabel(step);

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
                undefined,
                undefined,
                specContext
            ));
        }

        return items;
    }
}

class SpecItem extends vscode.TreeItem {
    public fileUri?: vscode.Uri;
    public groupSpecs?: SpecInfo[];

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        private readonly extContext: vscode.ExtensionContext,
        public readonly specName?: string,
        public readonly documentType?: string,
        public readonly command?: vscode.Command,
        public readonly filePath?: string,
        public readonly specPath?: string,
        private readonly status?: DocumentStatus,
        public readonly relatedDocs?: string[],
        private readonly iconName?: string,
        private readonly isActive?: boolean,
        private readonly specContext?: FeatureWorkflowContext
    ) {
        super(label, collapsibleState);

        if (contextValue === 'spec-loading') {
            this.iconPath = new vscode.ThemeIcon('sync~spin');
            this.tooltip = 'Loading specs...';
        } else if (contextValue === 'spec-group') {
            const groupIcons: Record<string, string> = {
                'Active': 'pulse',
                'Completed': 'check',
                'Archived': 'archive',
            };
            const groupTooltips: Record<string, string> = {
                'Active': 'Specs in progress',
                'Completed': 'Completed specs',
                'Archived': 'Archived specs',
            };
            const baseLabel = label.split(' (')[0];
            this.iconPath = new vscode.ThemeIcon(groupIcons[baseLabel] || 'pulse');
            this.tooltip = groupTooltips[baseLabel] || label;
        } else if (contextValue === 'spec') {
            if (isActive) {
                this.iconPath = new vscode.ThemeIcon('sync~spin');
            } else if (specContext?.status === SpecStatuses.COMPLETED) {
                this.iconPath = new vscode.ThemeIcon('beaker', new vscode.ThemeColor('testing.iconPassed'));
            } else if (specContext?.currentStep) {
                this.iconPath = new vscode.ThemeIcon('beaker', new vscode.ThemeColor('charts.blue'));
            } else {
                this.iconPath = new vscode.ThemeIcon('beaker');
            }
            this.tooltip = `SpecKit Spec: ${label}`;
        } else if (contextValue === 'spec-document') {
            const statusLabel = status === 'complete' ? 'Complete' : status === 'partial' ? 'In Progress' : 'Not Started';
            this.tooltip = `${documentType}: ${specName}/${label} — ${statusLabel}`;

            if (status === 'empty') {
                this.description = 'not created';
            }

            this.contextValue = `spec-document-${documentType}`;

            // Apply step status colors from specContext (only for active specs — completed specs use the green beaker).
            // stepHistory may be missing or partial; isStepCompleted infers completion from currentStep ordering when an
            // entry isn't present, so fall back to {} rather than guarding the call (otherwise specs with no stepHistory
            // never show the completed icon even though the workflow has moved past the step).
            if (specContext && documentType && specContext.status !== SpecStatuses.COMPLETED && specContext.status !== SpecStatuses.ARCHIVED) {
                const stepHistory = specContext.stepHistory ?? {};
                const stepName = documentType as StepName;
                const cs = (specContext.currentStep ?? 'specify') as StepName;
                if (STEP_NAMES.includes(stepName) && isStepCompleted(stepName, cs, stepHistory)) {
                    this.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
                } else if (specContext.currentStep === documentType) {
                    this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.blue'));
                }
            }

            // Store file URI for inline actions (avoid resourceUri to prevent
            // VS Code from dimming git-ignored files in the tree view)
            if (filePath) {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    this.fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, filePath));
                }
            }
        } else if (contextValue === 'spec-related-doc') {
            // No icon — makes the tree-depth indentation visually obvious.
            // The chevron column on siblings + the missing icon here shifts
            // the label inward so sub-files clearly nest under their parent.
            this.tooltip = `Related: ${label}.md`;
        }
    }
}
