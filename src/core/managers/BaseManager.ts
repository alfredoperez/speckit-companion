import * as vscode from 'vscode';

/**
 * Base class for manager implementations
 * Provides common functionality for logging and workspace operations
 */
export abstract class BaseManager {
    protected readonly outputChannel: vscode.OutputChannel;
    protected readonly context: vscode.ExtensionContext;
    protected readonly name: string;

    constructor(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel,
        name: string
    ) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.name = name;
    }

    /**
     * Log a message to the output channel
     */
    protected log(message: string): void {
        this.outputChannel.appendLine(`[${this.name}] ${message}`);
    }

    /**
     * Log an error to the output channel
     */
    protected logError(message: string, error?: unknown): void {
        const errorDetail = error instanceof Error ? error.message : String(error || '');
        this.outputChannel.appendLine(`[${this.name}] ERROR: ${message}${errorDetail ? ` - ${errorDetail}` : ''}`);
    }

    /**
     * Get the workspace root path
     */
    protected getWorkspaceRoot(): string | undefined {
        const folders = vscode.workspace.workspaceFolders;
        return folders?.[0]?.uri.fsPath;
    }

    /**
     * Check if a workspace is open
     */
    protected hasWorkspace(): boolean {
        return !!this.getWorkspaceRoot();
    }
}
