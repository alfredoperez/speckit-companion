import * as vscode from 'vscode';
import { BaseTreeDataProvider } from '../../core/providers';

export class OverviewItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        if (contextValue) {
            this.contextValue = contextValue;
        }
    }
}

export class OverviewProvider extends BaseTreeDataProvider<OverviewItem> {
    constructor(context: vscode.ExtensionContext) {
        super(context, { name: 'OverviewProvider' });
    }

    async getChildren(element?: OverviewItem): Promise<OverviewItem[]> {
        if (!element) {
            // Return empty array to show viewsWelcome content
            return [];
        }
        return [];
    }
}
