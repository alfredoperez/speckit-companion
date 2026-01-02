import * as vscode from 'vscode';
import * as path from 'path';
import { parseSpecInfo } from './workflow/specInfoParser';
import { generateWebviewHtml } from './workflow/htmlGenerator';
import { WorkflowActionHandlers } from './workflow/actionHandlers';
import type { WebviewToExtensionMessage } from '../../core/types';
import { validateFileExists } from '../../core/utils/fileOpener';

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
        this.outputChannel.appendLine(`[WorkflowEditor] Document URI: ${document.uri.toString()}`);

        // Set up webview options
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'webview'),
                vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')
            ]
        };

        // Validate file exists before proceeding
        const fileExists = await validateFileExists(document.uri, this.outputChannel);
        if (!fileExists) {
            this.outputChannel.appendLine(`[WorkflowEditor] ERROR: File does not exist: ${document.fileName}`);
            webviewPanel.webview.html = this.getErrorHtml(document.fileName);
            return;
        }

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

            case 'editLine':
                await this.actionHandlers.editLine(document, message.lineNum, message.newText);
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

    /**
     * Generate error HTML when file cannot be opened
     */
    private getErrorHtml(filePath: string): string {
        const fileName = path.basename(filePath);
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Not Found</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }
        .error-container {
            text-align: center;
            max-width: 500px;
        }
        .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.6;
        }
        h1 {
            font-size: 1.5em;
            margin-bottom: 8px;
            color: var(--vscode-errorForeground);
        }
        p {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 16px;
            line-height: 1.5;
        }
        code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">&#128466;</div>
        <h1>File Not Found</h1>
        <p>Unable to open <code>${fileName}</code></p>
        <p>The file may have been moved, deleted, or is temporarily inaccessible. Try refreshing the explorer or checking the file path.</p>
    </div>
</body>
</html>`;
    }
}
