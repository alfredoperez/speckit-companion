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
        const activeTabInput = vscode.window.tabGroups.activeTabGroup?.activeTab?.input;
        const isDiffContext =
            document.uri.scheme !== 'file' ||
            activeTabInput instanceof vscode.TabInputTextDiff;

        if (isDiffContext) {
            this.outputChannel.appendLine(
                `[WorkflowEditor] Diff context detected, skipping redirect: ${document.fileName}`
            );
            webviewPanel.webview.html = renderPlainText(document.getText());
            return;
        }

        this.outputChannel.appendLine(`[WorkflowEditor] Redirecting to SpecViewer: ${document.fileName}`);

        // Custom editors require HTML to be set
        webviewPanel.webview.html = '<!DOCTYPE html><html><body></body></html>';

        // Delegate to the spec viewer
        await vscode.commands.executeCommand('speckit.viewSpecDocument', document.fileName);

        // Defer closing the custom editor tab to let VS Code finish the transition
        setTimeout(() => webviewPanel.dispose(), 100);
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderPlainText(text: string): string {
    return `<!DOCTYPE html><html><body style="margin:0;padding:12px;font-family:var(--vscode-editor-font-family,monospace);font-size:var(--vscode-editor-font-size,13px);color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);"><pre style="white-space:pre-wrap;margin:0;">${escapeHtml(text)}</pre></body></html>`;
}
