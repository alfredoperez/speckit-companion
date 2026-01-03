import * as vscode from 'vscode';
import { TempFileManager } from './tempFileManager';
import { SpecDraftManager } from './specDraftManager';
import { AIProviderFactory, getConfiguredProviderType } from '../../ai-providers';
import type {
    SpecEditorToExtensionMessage,
    ExtensionToSpecEditorMessage,
    AttachedImage
} from './types';

/**
 * Generates a random nonce for CSP
 */
function generateNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Generates a unique session ID
 */
function generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Provides the spec editor webview panel for creating rich specifications.
 * Handles multi-line text editing, image attachments, and submission to AI CLI.
 */
export class SpecEditorProvider {
    private panel: vscode.WebviewPanel | undefined;
    private sessionId: string | undefined;
    private attachedImages: Map<string, AttachedImage> = new Map();

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly tempFileManager: TempFileManager,
        private readonly draftManager: SpecDraftManager
    ) {}

    /**
     * Show the spec editor webview
     */
    public async show(): Promise<void> {
        // If panel exists, just reveal it
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        // Create new session
        this.sessionId = generateSessionId();
        this.attachedImages.clear();
        this.outputChannel.appendLine(`[SpecEditor] Starting new session: ${this.sessionId}`);

        // Create webview panel
        this.panel = vscode.window.createWebviewPanel(
            'speckit.specEditor',
            'New Spec',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: false,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'webview'),
                    vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
                    this.context.globalStorageUri
                ]
            }
        );

        // Set HTML content
        this.panel.webview.html = this.getWebviewHtml(this.panel.webview);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            (message: SpecEditorToExtensionMessage) => this.handleMessage(message),
            undefined,
            this.context.subscriptions
        );

        // Handle panel disposal
        this.panel.onDidDispose(() => {
            this.outputChannel.appendLine(`[SpecEditor] Panel disposed for session: ${this.sessionId}`);
            this.panel = undefined;
            this.sessionId = undefined;
        });
    }

    /**
     * Handle messages from the webview
     */
    private async handleMessage(message: SpecEditorToExtensionMessage): Promise<void> {
        this.outputChannel.appendLine(`[SpecEditor] Received message: ${message.type}`);

        switch (message.type) {
            case 'submit':
                await this.handleSubmit(message.content, message.images);
                break;

            case 'preview':
                await this.handlePreview();
                break;

            case 'attachImage':
                await this.handleAttachImage(message.name, message.size, message.dataUri);
                break;

            case 'removeImage':
                await this.handleRemoveImage(message.imageId);
                break;

            case 'requestTemplateDialog':
                await this.handleRequestTemplateDialog();
                break;

            case 'loadTemplate':
                await this.handleLoadTemplate(message.specPath);
                break;

            case 'cancel':
                this.handleCancel();
                break;
        }
    }

    /**
     * Handle spec submission
     */
    private async handleSubmit(content: string, imageIds: string[]): Promise<void> {
        if (!this.sessionId) {
            this.postMessage({ type: 'error', message: 'No active session' });
            return;
        }

        if (!content.trim()) {
            this.postMessage({ type: 'error', message: 'Spec content cannot be empty' });
            return;
        }

        try {
            this.postMessage({ type: 'submissionStarted' });
            this.outputChannel.appendLine(`[SpecEditor] Submitting spec with ${imageIds.length} images`);

            // Get attached images
            const images = imageIds
                .map(id => this.attachedImages.get(id))
                .filter((img): img is AttachedImage => img !== undefined);

            // Warn if images attached but provider has limited support
            if (images.length > 0) {
                const providerType = getConfiguredProviderType();
                if (providerType === 'copilot') {
                    vscode.window.showWarningMessage(
                        'GitHub Copilot CLI has limited image support. Images will be included as file references but may not be processed.'
                    );
                    this.outputChannel.appendLine('[SpecEditor] Warning: Copilot has limited image support');
                }
            }

            // Create temp file set
            const tempFileSet = await this.tempFileManager.createTempFileSet(
                this.sessionId,
                content,
                images
            );
            this.outputChannel.appendLine(`[SpecEditor] Created temp file set: ${tempFileSet.id}`);

            // Get AI provider and execute
            const provider = AIProviderFactory.getProvider(this.context, this.outputChannel);

            // Generate markdown with the content and image references
            const markdownContent = await this.tempFileManager.generateMarkdown(
                tempFileSet.id,
                content,
                images
            );

            // Prepend the speckit.specify command to trigger the workflow
            const prompt = `/speckit.specify ${markdownContent}`;

            // Execute in terminal
            await provider.executeInTerminal(prompt, 'SpecKit - New Spec');

            // Mark as submitted
            await this.tempFileManager.markSubmitted(tempFileSet.id);

            // Clean up session images
            if (this.sessionId) {
                await this.tempFileManager.cleanupSession(this.sessionId);
            }

            this.postMessage({ type: 'submissionComplete' });

            // Close panel after short delay
            setTimeout(() => {
                this.panel?.dispose();
            }, 500);

        } catch (error) {
            this.outputChannel.appendLine(`[SpecEditor] Submit error: ${error}`);
            this.postMessage({
                type: 'error',
                message: `Failed to submit spec: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    /**
     * Handle preview request
     */
    private async handlePreview(): Promise<void> {
        // The preview is handled in the webview itself
        // This could be extended to generate server-side markdown rendering
        this.outputChannel.appendLine('[SpecEditor] Preview requested');
    }

    /**
     * Handle image attachment
     */
    private async handleAttachImage(
        name: string,
        size: number,
        dataUri: string
    ): Promise<void> {
        if (!this.sessionId) {
            this.postMessage({ type: 'error', message: 'No active session' });
            return;
        }

        try {
            const image = await this.tempFileManager.saveImage(
                this.sessionId,
                name,
                dataUri
            );

            this.attachedImages.set(image.id, image);
            this.outputChannel.appendLine(`[SpecEditor] Image saved: ${image.id} (${name})`);

            // Use data URI for thumbnail display (more reliable in webviews)
            this.postMessage({
                type: 'imageSaved',
                imageId: image.id,
                thumbnailUri: image.thumbnailDataUri,
                originalName: name
            });

        } catch (error) {
            this.outputChannel.appendLine(`[SpecEditor] Image attach error: ${error}`);
            this.postMessage({
                type: 'error',
                message: `Failed to attach image: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    /**
     * Handle image removal
     */
    private async handleRemoveImage(imageId: string): Promise<void> {
        const image = this.attachedImages.get(imageId);
        if (!image) {
            return;
        }

        try {
            await this.tempFileManager.deleteImage(image.filePath);
            this.attachedImages.delete(imageId);
            this.outputChannel.appendLine(`[SpecEditor] Image removed: ${imageId}`);

            this.postMessage({ type: 'imageRemoved', imageId });
        } catch (error) {
            this.outputChannel.appendLine(`[SpecEditor] Image remove error: ${error}`);
        }
    }

    /**
     * Handle request to show template dialog
     */
    private async handleRequestTemplateDialog(): Promise<void> {
        const result = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Markdown files': ['md'],
                'All files': ['*']
            },
            title: 'Load Existing Spec'
        });

        if (result && result.length > 0) {
            await this.handleLoadTemplate(result[0].fsPath);
        }
    }

    /**
     * Handle template loading
     */
    private async handleLoadTemplate(specPath: string): Promise<void> {
        try {
            const content = await vscode.workspace.fs.readFile(vscode.Uri.file(specPath));
            const text = Buffer.from(content).toString('utf-8');

            this.outputChannel.appendLine(`[SpecEditor] Template loaded: ${specPath}`);
            this.postMessage({ type: 'templateLoaded', content: text });
        } catch (error) {
            this.outputChannel.appendLine(`[SpecEditor] Template load error: ${error}`);
            this.postMessage({
                type: 'error',
                message: `Failed to load template: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    /**
     * Handle cancel/close
     */
    private handleCancel(): void {
        this.outputChannel.appendLine('[SpecEditor] Cancelled by user');
        this.panel?.dispose();
    }

    /**
     * Post a message to the webview
     */
    private postMessage(message: ExtensionToSpecEditorMessage): void {
        this.panel?.webview.postMessage(message);
    }

    /**
     * Generate HTML for the webview
     */
    private getWebviewHtml(webview: vscode.Webview): string {
        // Get URIs for webview resources
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'spec-editor.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'spec-editor.js')
        );

        const nonce = generateNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   style-src ${webview.cspSource} 'unsafe-inline';
                   script-src 'nonce-${nonce}';
                   img-src ${webview.cspSource} data: https:;
                   font-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>New Spec</title>
</head>
<body>
    <div class="spec-editor" id="app">
        <header class="spec-editor-header">
            <h1>Create New Spec</h1>
            <p>Write a detailed specification for your feature or task</p>
        </header>

        <div class="spec-editor-content">
            <div id="error-container"></div>

            <div class="template-loader">
                <button class="load-template-btn" id="loadTemplateBtn">
                    <span class="codicon">📄</span>
                    Load Existing Spec
                </button>
            </div>

            <div class="editor-container">
                <label class="editor-label" for="specContent">Specification</label>
                <textarea
                    class="spec-editor-textarea"
                    id="specContent"
                    placeholder="Describe your feature or task in detail...

Example:
- What is the feature about?
- What problem does it solve?
- Who are the target users?
- What are the key requirements?
- Are there any constraints or dependencies?"
                ></textarea>
                <div class="char-count" id="charCount">0 / 50,000</div>
            </div>

            <div class="image-attachment-section">
                <div class="image-attachment-header">
                    <h3>Attachments</h3>
                    <button class="attach-image-btn" id="attachImageBtn">
                        <span class="codicon">📎</span>
                        Attach Image
                    </button>
                </div>
                <p class="paste-hint">Use the button above or paste (Ctrl+V / Cmd+V) to attach images</p>
                <div class="image-thumbnails" id="thumbnails"></div>
                <div class="image-size-info" id="sizeInfo"></div>
            </div>
        </div>

        <footer class="spec-editor-actions">
            <button class="btn-cancel" id="cancelBtn">Cancel</button>
            <div class="action-spacer"></div>
            <button class="btn-secondary" id="previewBtn">Preview</button>
            <button class="btn-primary" id="submitBtn">Submit to AI</button>
        </footer>

        <div class="keyboard-hints">
            <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to submit • <kbd>Esc</kbd> to cancel
        </div>
    </div>

    <div class="loading-overlay" id="loadingOverlay" style="display: none;">
        <div class="loading-spinner"></div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
