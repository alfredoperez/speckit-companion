import * as vscode from 'vscode';

/**
 * Base class for TreeDataProvider implementations
 * Provides common functionality for tree views including:
 * - Event emitter for tree data changes
 * - Loading state management
 * - Refresh functionality
 * - Disposable pattern
 *
 * @example
 * class MyProvider extends BaseTreeDataProvider<MyItem> {
 *     async getChildren(element?: MyItem): Promise<MyItem[]> {
 *         // Implementation
 *     }
 * }
 */
export abstract class BaseTreeDataProvider<T extends vscode.TreeItem>
    implements vscode.TreeDataProvider<T>, vscode.Disposable
{
    protected readonly _onDidChangeTreeData = new vscode.EventEmitter<T | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    protected isLoading = false;
    protected readonly context: vscode.ExtensionContext;
    protected readonly name: string;
    protected readonly outputChannel?: vscode.OutputChannel;

    constructor(
        context: vscode.ExtensionContext,
        options?: { name?: string; outputChannel?: vscode.OutputChannel }
    ) {
        this.context = context;
        this.name = options?.name ?? this.constructor.name;
        this.outputChannel = options?.outputChannel;
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get the tree item representation
     */
    getTreeItem(element: T): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for the given element
     * Must be implemented by subclasses
     */
    abstract getChildren(element?: T): Promise<T[]> | T[];

    /**
     * Create a loading indicator tree item
     */
    protected createLoadingItem(label: string = 'Loading...'): T {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('loading~spin');
        return item as T;
    }

    /**
     * Log a message to the output channel
     */
    protected log(message: string): void {
        this.outputChannel?.appendLine(`[${this.name}] ${message}`);
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}

/**
 * A simple tree item implementation for use with BaseTreeDataProvider.
 * Extend this class or use it directly for basic tree items.
 */
export class BaseTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        if (contextValue) {
            this.contextValue = contextValue;
        }
    }
}
