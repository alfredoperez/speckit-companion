import * as vscode from 'vscode';
import { BaseTreeDataProvider } from '../../core/providers';
import { Commands } from '../../core/constants';

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
    }

    async getChildren(element?: OverviewItem): Promise<OverviewItem[]> {
        if (element) { return []; }
        return [
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
