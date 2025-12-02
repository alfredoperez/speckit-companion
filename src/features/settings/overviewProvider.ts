import * as vscode from 'vscode';

export class OverviewProvider implements vscode.TreeDataProvider<OverviewItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<OverviewItem | undefined | null | void> = new vscode.EventEmitter<OverviewItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<OverviewItem | undefined | null | void> = this._onDidChangeTreeData.event;
    
    constructor(private context: vscode.ExtensionContext) {}
    
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    getTreeItem(element: OverviewItem): vscode.TreeItem {
        return element;
    }
    
    async getChildren(element?: OverviewItem): Promise<OverviewItem[]> {
        if (!element) {
            // 返回空数组以显示 viewsWelcome 内容
            return [];
        }
        return [];
    }
}

class OverviewItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}