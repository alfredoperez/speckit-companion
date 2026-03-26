import * as vscode from 'vscode';

/**
 * Custom editor provider that redirects spec file opens to the SpecViewerProvider.
 * When a spec markdown file is clicked in the file explorer, this shim intercepts
 * the open, delegates to the speckit.viewSpecDocument command, and closes itself.
 */
export class WorkflowEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'speckit.workflowEditor';

    constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel
    ) {}

    /**
     * Register the custom editor provider
     */
    public static register(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ): vscode.Disposable {
        const provider = new WorkflowEditorProvider(context, outputChannel);
        return vscode.window.registerCustomEditorProvider(
            WorkflowEditorProvider.viewType,
            provider,
            {
                webviewOptions: { retainContextWhenHidden: false },
                supportsMultipleEditorsPerDocument: false
            }
        );
    }

    /**
     * Redirect to the SpecViewerProvider instead of rendering in this custom editor.
     */
    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.outputChannel.appendLine(`[WorkflowEditor] Redirecting to SpecViewer: ${document.fileName}`);

        // Custom editors require HTML to be set
        webviewPanel.webview.html = '<!DOCTYPE html><html><body></body></html>';

        // Delegate to the spec viewer
        await vscode.commands.executeCommand('speckit.viewSpecDocument', document.fileName);

        // Defer closing the custom editor tab to let VS Code finish the transition
        setTimeout(() => webviewPanel.dispose(), 100);
    }
}
