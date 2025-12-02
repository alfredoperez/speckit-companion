import * as vscode from 'vscode';
import { parseSpecInfo } from './workflow/specInfoParser';
import { generateWebviewHtml } from './workflow/htmlGenerator';
import { WorkflowActionHandlers } from './workflow/actionHandlers';
import type { WebviewToExtensionMessage } from '../../core/types';

/**
 * Custom editor provider for spec workflow files.
 * Renders markdown with action buttons for spec-driven development.
 */
export class WorkflowEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'speckit.workflowEditor';
    private readonly actionHandlers: WorkflowActionHandlers;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel
    ) {
        this.actionHandlers = new WorkflowActionHandlers(outputChannel);
    }

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
     * Called when a custom editor is opened
     */
    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.outputChannel.appendLine(`[WorkflowEditor] Opening: ${document.fileName}`);

        // Set up webview options
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'webview'),
                vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')
            ]
        };

        // Set initial HTML content
        const content = document.getText();
        const specInfo = parseSpecInfo(document);
        webviewPanel.webview.html = generateWebviewHtml(
            webviewPanel.webview,
            this.context.extensionUri,
            content,
            specInfo
        );

        // Handle messages from the webview
        const messageDisposable = webviewPanel.webview.onDidReceiveMessage(
            message => this.handleMessage(message, document, webviewPanel),
            undefined,
            this.context.subscriptions
        );

        // Sync document changes to webview
        const changeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                webviewPanel.webview.postMessage({
                    type: 'documentChanged',
                    content: document.getText()
                });
            }
        });

        // Clean up on dispose
        webviewPanel.onDidDispose(() => {
            messageDisposable.dispose();
            changeDisposable.dispose();
            this.outputChannel.appendLine(`[WorkflowEditor] Closed: ${document.fileName}`);
        });
    }

    /**
     * Handle messages from the webview
     */
    private async handleMessage(
        message: WebviewToExtensionMessage,
        document: vscode.TextDocument,
        _webviewPanel: vscode.WebviewPanel
    ): Promise<void> {
        this.outputChannel.appendLine(`[WorkflowEditor] Message: ${message.type}`);

        switch (message.type) {
            case 'editSource':
                await this.actionHandlers.editSource(document);
                break;

            case 'refineLine':
                await this.actionHandlers.refineLine(document, message.lineNum, message.content, message.instruction);
                break;

            case 'removeLine':
                await this.actionHandlers.removeLine(document, message.lineNum);
                break;

            case 'approveAndContinue':
                await this.actionHandlers.approveAndContinue(document);
                break;

            case 'regenerate':
                await this.actionHandlers.regenerateDocument(document);
                break;

            case 'navigateToPhase':
                await this.actionHandlers.navigateToPhase(document, message.phase);
                break;

            case 'generateContent':
                await this.actionHandlers.generateContent(document, message.command);
                break;

            case 'enhance':
                await this.actionHandlers.runEnhancementCommand(document, message.command);
                break;

            case 'switchTab':
                await this.actionHandlers.switchToDocument(document, message.fileName);
                break;
        }
    }
}
