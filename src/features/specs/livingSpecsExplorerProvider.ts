import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTreeDataProvider } from '../../core/providers';
import {
    readLivingSpecs,
    readCapabilityHealth,
    isPathWithinRoot,
    CapabilityHealth,
    LivingSpecsListing,
    ResolvedCapability,
} from './livingSpecsModel';

type LivingSpecContextValue =
    | 'living-specs-empty'
    | 'living-specs-group'
    | 'living-specs-capability'
    | 'living-specs-capability-missing'
    | 'living-specs-tier'
    | 'living-specs-orphan';

/** Folder of a posix relative spec path, or '' when it sits at the root. */
function posixDirname(specPath: string): string {
    const dir = path.posix.dirname(specPath);
    return dir === '.' || dir === '' ? '' : dir;
}

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
            return { enabled: false, capabilities: [], orphans: [] };
        }
        try {
            this.cached = readLivingSpecs(root);
        } catch {
            this.log('Failed to read living specs');
            this.cached = { enabled: false, capabilities: [], orphans: [] };
        }
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
            // Root — empty state when off or nothing to show; otherwise the groups.
            const hasContent = listing.capabilities.length > 0 || listing.orphans.length > 0;
            if (!hasContent) {
                const message = listing.enabled
                    ? 'No living specs yet'
                    : 'Living Specs are off';
                const tooltip = listing.enabled
                    ? 'Adopt a code area to create and register your first living spec.'
                    : 'Enable livingSpecs in .specify/companion.yml to track capability specs.';
                return [LivingSpecItem.info(message, tooltip)];
            }

            const groups: LivingSpecItem[] = [];
            if (listing.capabilities.length > 0) {
                groups.push(LivingSpecItem.group('Capabilities', 'living-specs-capabilities', 'library'));
            }
            if (listing.orphans.length > 0) {
                groups.push(LivingSpecItem.group('Orphans', 'living-specs-orphans', 'question'));
            }
            return groups;
        }

        if (element.contextValue === 'living-specs-group' && element.groupId === 'living-specs-capabilities') {
            // Health is async (one time-bounded git call per capability) and
            // best-effort — a failed/absent computation renders the row as before.
            return Promise.all(listing.capabilities.map(async cap => {
                const health = await this.health(cap);
                return this.capabilityItem(cap, health);
            }));
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

        if (element.contextValue === 'living-specs-capability' && element.capability) {
            return this.tierChildren(element.capability);
        }

        return [];
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

    private capabilityItem(cap: ResolvedCapability, health?: CapabilityHealth): LivingSpecItem {
        const hasChildren = cap.exists && this.tierChildren(cap).length > 0;
        const item = new LivingSpecItem(
            cap.name,
            hasChildren
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
            cap.exists ? 'living-specs-capability' : 'living-specs-capability-missing'
        );
        // Plain-language location: "colocated" reads as jargon in the tree, so
        // for a spec that lives next to the code we show its folder instead, and
        // for a central spec we say "central". The exact path + a full-sentence
        // explanation move to the tooltip. (Issue #421)
        const locationLabel = cap.location === 'colocated'
            ? (posixDirname(cap.spec) || 'next to code')
            : 'central';
        const base = cap.exists ? locationLabel : `${locationLabel} · not created`;
        const locationSentence = cap.location === 'colocated'
            ? 'Lives next to the code it describes'
            : 'Lives in the central specs folder';
        const suffixes: string[] = [];
        const tooltipLines = [`${cap.name} — ${cap.spec}`, locationSentence];
        if (health?.coverage) {
            suffixes.push(`${health.coverage.covered}/${health.coverage.total} covered`);
            tooltipLines.push(`${health.coverage.covered} of ${health.coverage.total} requirements have a mapped test`);
        }
        if (health?.drifted) {
            suffixes.push('drift');
            tooltipLines.push("Source files changed since the living spec's last commit");
        }
        item.description = suffixes.length > 0 ? `${base} · ${suffixes.join(' · ')}` : base;
        if (health?.drifted) {
            item.iconPath = new vscode.ThemeIcon('symbol-namespace', new vscode.ThemeColor('list.warningForeground'));
        } else if (cap.exists) {
            item.iconPath = new vscode.ThemeIcon('symbol-namespace');
        } else {
            item.iconPath = new vscode.ThemeIcon('circle-outline');
        }
        item.tooltip = tooltipLines.join('\n');
        item.capability = cap;
        if (cap.exists) {
            item.command = this.openCommand(cap.spec);
        }
        return item;
    }

    private tierChildren(cap: ResolvedCapability): LivingSpecItem[] {
        const children: LivingSpecItem[] = [];
        // The spec tier first, then existing architecture/coverage siblings.
        children.push(
            LivingSpecItem.leaf('Spec', 'living-specs-tier', 'book', cap.spec, this.openCommand(cap.spec))
        );
        for (const tier of cap.tiers) {
            const label = tier.kind === 'arch' ? 'Architecture' : 'Coverage';
            const icon = tier.kind === 'arch' ? 'type-hierarchy' : 'checklist';
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

    static group(label: string, groupId: string, icon: string): LivingSpecItem {
        const item = new LivingSpecItem(label, vscode.TreeItemCollapsibleState.Expanded, 'living-specs-group');
        item.groupId = groupId;
        item.id = `living-specs-group:${groupId}`;
        item.iconPath = new vscode.ThemeIcon(icon);
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
        item.command = command;
        return item;
    }
}
