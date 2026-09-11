import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { livingPurposeBody } from '../spec-viewer/livingDocs';
import { BaseTreeDataProvider } from '../../core/providers';
import { CONTEXT_KEYS, setContextKey } from '../../core/utils/contextKeys';
import {
    readLivingSpecs,
    readCapabilityHealth,
    buildCapabilityTree,
    isPathWithinRoot,
    CapabilityHealth,
    CapabilityTreeNode,
    CapabilityTreeGroup,
    LivingSpecsListing,
    ResolvedCapability,
} from './livingSpecsModel';

type LivingSpecContextValue =
    | 'living-specs-empty'
    | 'living-specs-error'
    | 'living-specs-group'
    | 'living-specs-dir-group'
    | 'living-specs-capability'
    | 'living-specs-capability-drifted'
    | 'living-specs-capability-missing'
    | 'living-specs-tier'
    | 'living-specs-orphan';

/**
 * Tree view that lists the project's living specs — capabilities (with their
 * architecture/coverage tiers) and orphan `*.spec.md` files. Visibility is
 * gated in `package.json` on `speckit.companion.installed`; this provider only
 * renders. Data comes from the node-side reader (`readLivingSpecs`), so a
 * disabled/missing config yields a friendly empty state, never an error.
 */
export class LivingSpecsExplorerProvider extends BaseTreeDataProvider<LivingSpecItem> {
    constructor(context: vscode.ExtensionContext, outputChannel?: vscode.OutputChannel) {
        super(context, { name: 'LivingSpecsExplorerProvider', outputChannel });
    }

    private cached?: LivingSpecsListing;
    private healthCache = new Map<string, CapabilityHealth>();

    refresh(): void {
        this.cached = undefined;
        this.healthCache.clear();
        this._onDidChangeTreeData.fire();
    }

    private get workspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    private read(): LivingSpecsListing {
        if (this.cached) {
            return this.cached;
        }
        const root = this.workspaceRoot;
        if (!root) {
            return { enabled: false, capabilities: [], orphans: [], legacyStale: false, configured: false };
        }
        try {
            this.cached = readLivingSpecs(root);
        } catch {
            this.log('Failed to read living specs');
            this.cached = { enabled: false, capabilities: [], orphans: [], legacyStale: false, configured: false };
        }
        void setContextKey(CONTEXT_KEYS.livingSpecsConfigured, this.cached.configured);
        void setContextKey(CONTEXT_KEYS.livingSpecsHasCapabilities,
            this.cached.capabilities.length > 0 || this.cached.orphans.length > 0);
        return this.cached;
    }

    private openCommand(relPath: string): vscode.Command | undefined {
        const root = this.workspaceRoot;
        if (!root || !isPathWithinRoot(root, relPath)) {
            return undefined;
        }
        // Markdown tiers open in the rendered spec viewer (stepper-less living
        // mode); anything else falls back to the plain editor.
        if (relPath.endsWith('.md')) {
            return {
                command: 'speckit.viewSpecDocument',
                title: `Open ${relPath}`,
                arguments: [path.join(root, relPath), { living: true }],
            };
        }
        return {
            command: 'vscode.open',
            title: `Open ${relPath}`,
            arguments: [vscode.Uri.file(path.join(root, relPath))],
        };
    }

    getChildren(element?: LivingSpecItem): Promise<LivingSpecItem[]> | LivingSpecItem[] {
        const listing = this.read();

        if (!element) {
            const notices: LivingSpecItem[] = [];
            if (listing.legacyStale) {
                notices.push(LivingSpecItem.info(
                    'Capabilities still listed in .specify/companion.yml',
                    'living-specs.yml is the registry and answers instead, so those entries are '
                    + 'ignored. Move any you still want into living-specs.yml, then delete the '
                    + 'livingSpecs block from .specify/companion.yml.',
                ));
            }

            // Root — empty state when off or nothing to show; otherwise the groups.
            const hasContent = listing.capabilities.length > 0 || listing.orphans.length > 0;
            if (listing.error) {
                // "Off" would send someone to fix a setting inside a file that never parsed.
                return [...notices, LivingSpecItem.problem("Can't read living-specs.yml", listing.error)];
            }
            if (!hasContent) {
                // Three situations, not two. "Off" tells someone to flip a flag,
                // which is unfollowable in a project that has no registry to flip
                // it in — the common case, since `specify init` writes none.
                let message: string;
                let tooltip: string;
                if (listing.enabled) {
                    // Set-up leaves a registry with nothing in it, and a row saying
                    // so is a dead end: the one thing to do next is adopt, and the
                    // wand that does it is an unlabelled icon in the title bar.
                    return notices;
                } else if (listing.configured) {
                    message = 'Living Specs are off';
                    tooltip = 'Set enabled: true in living-specs.yml to track capability specs.';
                } else {
                    // A project with no registry gets welcome content with a button:
                    // install the spec-kit extension, or set living specs up. VS Code
                    // only renders that when the tree is EMPTY, so a row here — even a
                    // helpful one — is what hides the only action a new user has.
                    return notices;
                }
                return [...notices, LivingSpecItem.info(message, tooltip)];
            }

            // Capabilities render as a directory tree that mirrors where their
            // specs live, so the shape matches the codebase; orphans keep their
            // own group below it.
            return this.renderNodes(buildCapabilityTree(listing.capabilities)).then(nodes => {
                const out = [...notices, ...nodes];
                if (listing.orphans.length > 0) {
                    out.push(LivingSpecItem.group('Orphans', 'living-specs-orphans', 'question'));
                }
                return out;
            });
        }

        if (element.contextValue === 'living-specs-dir-group' && element.treeChildren) {
            return this.renderNodes(element.treeChildren);
        }

        if (element.contextValue === 'living-specs-group' && element.groupId === 'living-specs-orphans') {
            return listing.orphans.map(orphan =>
                LivingSpecItem.leaf(
                    path.basename(orphan),
                    'living-specs-orphan',
                    'file',
                    orphan,
                    this.openCommand(orphan)
                )
            );
        }

        if (
            (element.contextValue === 'living-specs-capability' ||
                element.contextValue === 'living-specs-capability-drifted') &&
            element.capability
        ) {
            return this.tierChildren(element.capability);
        }

        return [];
    }

    /**
     * Turn capability-tree nodes into tree items: a directory node becomes a
     * collapsible group carrying its own children, a capability leaf gets its
     * best-effort row health (one time-bounded git call, cached).
     */
    private renderNodes(nodes: CapabilityTreeNode[]): Promise<LivingSpecItem[]> {
        return Promise.all(nodes.map(async node => {
            if (node.kind === 'group') {
                return LivingSpecItem.dirGroup(node);
            }
            const health = await this.health(node.capability);
            return this.capabilityItem(node.capability, health);
        }));
    }

    private async health(cap: ResolvedCapability): Promise<CapabilityHealth | undefined> {
        const root = this.workspaceRoot;
        if (!root) {
            return undefined;
        }
        const cached = this.healthCache.get(cap.spec);
        if (cached) {
            return cached;
        }
        try {
            const health = await readCapabilityHealth(root, cap);
            this.healthCache.set(cap.spec, health);
            return health;
        } catch {
            return undefined;
        }
    }

    private coverageInUse(): boolean {
        return (this.cached?.capabilities ?? []).some(c => c.tiers.some(t => t.kind === 'coverage'));
    }

    private capabilityItem(
        cap: ResolvedCapability,
        health?: CapabilityHealth,
    ): LivingSpecItem {
        // `tierChildren` always yields the Spec node, and a capability row has no
        // other children (see `getChildren`), so a lone Spec child is a disclosure
        // triangle over nothing — the row opens the spec itself instead. (Issue #449)
        const hasChildren = cap.exists && this.tierChildren(cap).length > 1;
        // The directory tree already shows where the spec lives, so the row drops
        // the old location word; drift promotes the row to its own context value
        // so the Update action can gate on it.
        const contextValue: LivingSpecContextValue = !cap.exists
            ? 'living-specs-capability-missing'
            : health?.drifted
                ? 'living-specs-capability-drifted'
                : 'living-specs-capability';
        const item = new LivingSpecItem(
            cap.name,
            hasChildren
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
            contextValue
        );
        const locationSentence = cap.location === 'colocated'
            ? 'Lives next to the code it describes'
            : 'Lives in the central specs folder';
        const suffixes: string[] = [];
        if (!cap.exists) {
            suffixes.push('not created');
        }
        const tooltipLines = [`${cap.name} — ${cap.spec}`];
        const purpose = this.purposeOf(cap);
        if (purpose) tooltipLines.push(purpose);
        tooltipLines.push(locationSentence);
        if (health?.coverage) {
            suffixes.push(`${health.coverage.covered}/${health.coverage.total} covered`);
            tooltipLines.push(`${health.coverage.covered} of ${health.coverage.total} requirements have a mapped test`);
        } else if (cap.exists && this.coverageInUse()) {
            // Once any capability has a coverage tier, one without it is a gap
            // worth a word. Before that it is just how the project is, and the
            // suffix on every row was the first thing a new user read.
            suffixes.push('no coverage file');
            tooltipLines.push('No coverage tier next to this spec, so no requirement is mapped to a test yet');
            tooltipLines.push('Check Requirement Coverage on this row writes one');
        }
        if (health?.drifted) {
            suffixes.push('drift');
            tooltipLines.push("Source files changed since the living spec's last commit");
            tooltipLines.push('Update to Match Code brings the spec back in line — the button on this row runs it');
        }
        item.description = suffixes.length > 0 ? suffixes.join(' · ') : undefined;
        if (health?.drifted) {
            // A different shape, not the same shape tinted: colour alone is not a
            // difference a reader can scan for, and it is nothing at all to someone
            // who cannot distinguish it.
            item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
        } else if (cap.exists) {
            item.iconPath = new vscode.ThemeIcon('symbol-namespace');
        } else {
            item.iconPath = new vscode.ThemeIcon('circle-outline');
        }
        item.tooltip = tooltipLines.join('\n');
        item.capability = cap;
        item.relPath = cap.spec;
        // A missing spec still opens: the viewer's empty state is where adoption starts.
        item.command = this.openCommand(cap.spec);
        return item;
    }

    /** The first sentence of the spec's purpose, so a row says what it is about. */
    private purposeOf(cap: ResolvedCapability): string | undefined {
        const root = this.workspaceRoot;
        if (!root || !cap.exists) return undefined;
        try {
            const body = livingPurposeBody(fs.readFileSync(path.join(root, cap.spec), 'utf-8'));
            return body.split(/(?<=\.)\s/)[0]?.trim() || undefined;
        } catch {
            return undefined;
        }
    }

    private tierChildren(cap: ResolvedCapability): LivingSpecItem[] {
        const children: LivingSpecItem[] = [];
        // The spec tier first, then existing architecture/coverage siblings.
        children.push(
            LivingSpecItem.leaf('Spec', 'living-specs-tier', 'book', cap.spec, this.openCommand(cap.spec))
        );
        for (const tier of cap.tiers) {
            const label = tier.kind === 'rules' ? 'Rules' : 'Coverage';
            const icon = tier.kind === 'rules' ? 'law' : 'checklist';
            children.push(
                LivingSpecItem.leaf(label, 'living-specs-tier', icon, tier.path, this.openCommand(tier.path))
            );
        }
        return children;
    }
}

class LivingSpecItem extends vscode.TreeItem {
    public groupId?: string;
    public capability?: ResolvedCapability;
    /** POSIX repo-relative path this row points at — copy/reveal/delete resolve from it. */
    public relPath?: string;
    /** Children of a directory group, rendered lazily on expand. */
    public treeChildren?: CapabilityTreeNode[];

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: LivingSpecContextValue
    ) {
        super(label, collapsibleState);
    }

    static info(label: string, tooltip: string): LivingSpecItem {
        const item = new LivingSpecItem(label, vscode.TreeItemCollapsibleState.None, 'living-specs-empty');
        item.iconPath = new vscode.ThemeIcon('info');
        item.tooltip = tooltip;
        return item;
    }

    static problem(label: string, tooltip: string): LivingSpecItem {
        const item = new LivingSpecItem(label, vscode.TreeItemCollapsibleState.None, 'living-specs-error');
        item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('list.errorForeground'));
        item.tooltip = tooltip;
        item.description = 'fix the file to list capabilities';
        return item;
    }

    static group(label: string, groupId: string, icon: string): LivingSpecItem {
        const item = new LivingSpecItem(label, vscode.TreeItemCollapsibleState.Expanded, 'living-specs-group');
        item.groupId = groupId;
        item.id = `living-specs-group:${groupId}`;
        item.iconPath = new vscode.ThemeIcon(icon);
        return item;
    }

    static dirGroup(node: CapabilityTreeGroup): LivingSpecItem {
        const item = new LivingSpecItem(node.name, vscode.TreeItemCollapsibleState.Expanded, 'living-specs-dir-group');
        item.id = `living-specs-dir:${node.path}`;
        item.iconPath = new vscode.ThemeIcon('folder');
        item.treeChildren = node.children;
        return item;
    }

    static leaf(
        label: string,
        contextValue: LivingSpecContextValue,
        icon: string,
        relPath: string,
        command?: vscode.Command
    ): LivingSpecItem {
        const item = new LivingSpecItem(label, vscode.TreeItemCollapsibleState.None, contextValue);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.tooltip = relPath;
        item.relPath = relPath;
        item.command = command;
        return item;
    }
}
