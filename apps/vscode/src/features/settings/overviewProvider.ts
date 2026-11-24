import * as vscode from 'vscode';
import { BaseTreeDataProvider } from '../../core/providers';
import { Commands } from '../../core/constants';
import { getProjectRoot, onDidChangeProjectRoot } from '../../core/projectRoot';
import { gatherProjectHealth, HealthCheck } from './projectHealth';
import { resetSpecifyVersion } from '../../speckit/specKitUpgrade';

const HEALTH_ROOT = 'health-root';
export const HEALTH_FIX_COMMAND = 'speckit.projectHealth.fix';

export function healthItem(check: HealthCheck): OverviewItem {
    const item = new OverviewItem(check.label, vscode.TreeItemCollapsibleState.None, `health-${check.id}`,
        check.ok ? 'pass' : 'warning',
        check.ok ? undefined : { command: HEALTH_FIX_COMMAND, title: check.fixTitle, arguments: [check.fixCommand] });
    item.description = check.detail;
    item.tooltip = check.ok ? `${check.label}: ${check.detail}` : `${check.label}: ${check.detail}. Click to run "${check.fixTitle}" (${check.fixCommand}).`;
    return item;
}

export class OverviewItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        contextValue?: string,
        icon?: string,
        command?: vscode.Command
    ) {
        super(label, collapsibleState);
        if (contextValue) { this.contextValue = contextValue; }
        if (icon) { this.iconPath = new vscode.ThemeIcon(icon); }
        if (command) { this.command = command; }
    }
}

export class OverviewProvider extends BaseTreeDataProvider<OverviewItem> {
    constructor(context: vscode.ExtensionContext) {
        super(context, { name: 'OverviewProvider' });
        context.subscriptions.push(
            vscode.commands.registerCommand(HEALTH_FIX_COMMAND, async (fixCommand: string) => {
                try {
                    await vscode.commands.executeCommand(fixCommand);
                } finally {
                    this.refreshHealth();
                }
            }),
            this,
        );
        this.watchRoot();
        context.subscriptions.push(
            onDidChangeProjectRoot(() => { this.watchRoot(); this.refreshHealth(); }),
            vscode.window.onDidCloseTerminal(() => this.refreshHealth()),
            { dispose: () => { this.unwatch(); clearTimeout(this.pending); } },
        );
    }

    private rootWatch: vscode.Disposable[] = [];
    private pending?: ReturnType<typeof setTimeout>;

    private unwatch(): void {
        for (const d of this.rootWatch) { d.dispose(); }
        this.rootWatch = [];
    }

    private watchRoot(): void {
        this.unwatch();
        const root = getProjectRoot();
        if (!root) { return; }
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, '.specify/**'));
        const refresh = () => this.refreshHealth();
        this.rootWatch = [watcher, watcher.onDidCreate(refresh), watcher.onDidChange(refresh), watcher.onDidDelete(refresh)];
    }

    /** Drops the cached CLI version and redraws the health rows, once per burst of changes. */
    refreshHealth(): void {
        clearTimeout(this.pending);
        this.pending = setTimeout(() => {
            resetSpecifyVersion();
            this.refresh();
        }, 500);
    }

    async getChildren(element?: OverviewItem): Promise<OverviewItem[]> {
        if (element?.contextValue === HEALTH_ROOT) {
            const root = getProjectRoot();
            if (!root) { return []; }
            try {
                return (await gatherProjectHealth(root)).map(healthItem);
            } catch {
                return [new OverviewItem('Could not check the project', vscode.TreeItemCollapsibleState.None, 'health-error', 'warning')];
            }
        }
        if (element) { return []; }
        return [
            new OverviewItem('Project health', vscode.TreeItemCollapsibleState.Collapsed, HEALTH_ROOT, 'heart'),
            new OverviewItem('Workflow Builder', vscode.TreeItemCollapsibleState.None,
                'pipeline-builder', 'circuit-board',
                { command: 'speckit.companion.openPipelineBuilder', title: 'Open Workflow Builder' }),
            new OverviewItem('Open Settings', vscode.TreeItemCollapsibleState.None,
                'settings-open', 'gear', { command: Commands.settings.open, title: 'Open Settings' }),
            new OverviewItem('Report a Bug', vscode.TreeItemCollapsibleState.None,
                'feedback-bug', 'bug', { command: Commands.feedback.bugReport, title: 'Report a Bug' }),
            new OverviewItem('Request a Feature', vscode.TreeItemCollapsibleState.None,
                'feedback-feature', 'lightbulb', { command: Commands.feedback.featureRequest, title: 'Request a Feature' }),
            new OverviewItem('Rate on Marketplace', vscode.TreeItemCollapsibleState.None,
                'feedback-review', 'star-empty', { command: Commands.feedback.review, title: 'Rate on Marketplace' }),
        ];
    }
}
