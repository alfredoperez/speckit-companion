import * as vscode from 'vscode';
import { TempFileManager } from './tempFileManager';
import { SpecDraftManager } from './specDraftManager';
import { AIProviderFactory, getConfiguredProviderType } from '../../ai-providers';
import type {
    SpecEditorToExtensionMessage,
    ExtensionToSpecEditorMessage,
    AttachedImage,
    WorkflowDefinition
} from './types';
import { TURBO_WORKFLOW_NAME } from './types';
import { normalizeWorkflowConfig, resolveStepCommand, isWorkflowSupportedForProvider } from '../workflows';
import type { WorkflowConfig } from '../workflows';
import { formatCommandForProvider } from '../../ai-providers/aiProvider';
import { buildSpecifyCreationPreamble } from '../../ai-providers/promptBuilder';
import { resolveNewSpecProfileCommandWithFallback } from '../specs/profileDispatch';
import { isCompanionInstalled } from '../settings/companionPresetReconciler';
import { shouldShowInstallPrompt, readInstallPromptEnabled } from '../../speckit/specKitExtensionInstall';
import { renderInstallBannerHtml } from './installBanner';
import { AIProviders, WorkflowSteps, ConfigKeys } from '../../core/constants';
import { coerceLegacyBoolean } from '../../core/settingsMigration';

/** The turbo specify twin the picker routes to when turbo is chosen. */
const TURBO_SPECIFY_COMMAND = 'speckit.companion.specify';

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
    private workflows: Map<string, WorkflowDefinition> = new Map();

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly tempFileManager: TempFileManager,
        private readonly draftManager: SpecDraftManager
    ) {}

    /**
     * Get available workflows from settings
     */
    private getWorkflows(): WorkflowDefinition[] {
        const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
        const customWorkflows = config.get<WorkflowConfig[]>('customWorkflows', []);
        const activeProvider = getConfiguredProviderType();

        // Always include default workflow (no provider declaration → never filtered)
        const workflows: WorkflowDefinition[] = [
            {
                name: 'speckit',
                displayName: 'SpecKit',
                description: 'Standard SpecKit workflow',
                stepSpecify: `/${formatCommandForProvider('speckit.specify')}`
            }
        ];

        // Add custom workflows the active provider supports
        for (const wf of customWorkflows) {
            if (wf.name && wf.name !== 'speckit' && wf.name !== 'default'
                && isWorkflowSupportedForProvider(wf, activeProvider)) {
                const normalized = normalizeWorkflowConfig(wf);
                workflows.push({
                    name: wf.name,
                    displayName: wf.displayName || wf.name,
                    description: wf.description,
                    stepSpecify: `/${formatCommandForProvider(resolveStepCommand(normalized, WorkflowSteps.SPECIFY))}`,
                    stepPlan: formatCommandForProvider(wf[WorkflowSteps.CONFIG_PLAN] || (normalized.steps?.find(s => s.name === WorkflowSteps.PLAN)?.command) || 'speckit.plan'),
                    stepImplement: formatCommandForProvider(wf[WorkflowSteps.CONFIG_IMPLEMENT] || (normalized.steps?.find(s => s.name === WorkflowSteps.IMPLEMENT)?.command) || 'speckit.implement'),
                    specifyCommands: (wf.commands || [])
                        .filter(c => c.step === WorkflowSteps.SPECIFY)
                        .map(c => ({ name: c.name, title: c.title || c.name, command: c.command, tooltip: c.tooltip })),
                });
            }
        }

        // Beta-gated + install-gated turbo picker option. Appended last so it
        // never reorders existing entries. Surfaces only when the turbo beta
        // toggle is on AND the Companion extension is installed in the project;
        // otherwise the dropdown is byte-identical to before. Picking it pins
        // turbo on the new spec at submit (see handleSubmit) — pure selection UI.
        //
        // Reserved-name guard: TURBO_WORKFLOW_NAME ('speckit-turbo') is meant to
        // be synthetic-only. If a user's custom workflow already claims that name,
        // the real one wins — appending the synthetic entry would render duplicate
        // <option value="speckit-turbo"> nodes and the this.workflows Map would
        // keep only the last, silently changing what gets dispatched/pinned. So we
        // skip the synthetic entry on collision and warn.
        const turboEntry = this.buildTurboWorkflowEntry();
        if (turboEntry) {
            if (workflows.some(wf => wf.name === TURBO_WORKFLOW_NAME)) {
                this.outputChannel.appendLine(
                    `[SpecEditor] Warning: a custom workflow uses the reserved name '${TURBO_WORKFLOW_NAME}' — skipping the synthetic turbo entry; the user's workflow wins`
                );
            } else {
                workflows.push(turboEntry);
            }
        }

        // Cache workflows for lookup. Rebuilt on every panel open; correctness
        // across an aiProvider change relies on that change forcing a window
        // reload (see extension.ts) which disposes this provider. If live
        // provider switching is ever added, rebuild this on panel reveal too.
        this.workflows.clear();
        for (const wf of workflows) {
            this.workflows.set(wf.name, wf);
        }

        return workflows;
    }

    /**
     * Build the synthetic "SpecKit Companion (Turbo)" picker entry, or undefined
     * when it must not appear. Returns undefined when the `turboWorkflowPicker`
     * toggle is off, OR when the Companion spec-kit extension is not installed in
     * the project (so an enabled toggle in a non-Companion project still hides it).
     * The toggle is a boolean opt-in; the label carries no badge.
     */
    /**
     * Non-blocking warning shown when a turbo specify dispatch was downgraded to
     * the stock command because the spec-kit extension is missing (FR-003). Offers
     * a one-click install without leaving the editor.
     */
    private warnFellBackToStock(): void {
        this.outputChannel.appendLine(
            '[SpecEditor] Turbo specify unavailable — spec-kit extension not installed; running stock speckit.specify.'
        );
        void vscode.window
            .showWarningMessage(
                'Turbo mode needs the companion spec-kit extension, which is not installed — creating this spec with the standard SpecKit flow instead.',
                'Install spec-kit Extension'
            )
            .then(choice => {
                if (choice === 'Install spec-kit Extension') {
                    void vscode.commands.executeCommand('speckit.companion.installSpecKitExtension');
                }
            });
    }

    private buildTurboWorkflowEntry(): WorkflowDefinition | undefined {
        const raw = vscode.workspace
            .getConfiguration(ConfigKeys.namespace)
            .get<unknown>('companion.turboWorkflowPicker', true);
        if (!coerceLegacyBoolean(raw, true)) {
            return undefined;
        }
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot || !isCompanionInstalled(workspaceRoot)) {
            return undefined;
        }
        return {
            name: TURBO_WORKFLOW_NAME,
            displayName: 'Turbo',
            description: `SpecKit Companion (Turbo) — pin turbo on this spec — leaner /speckit.companion.* pipeline, regardless of the project default.`,
            stepSpecify: `/${formatCommandForProvider(TURBO_SPECIFY_COMMAND)}`,
        };
    }

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
            case 'ready':
                await this.handleReady();
                break;

            case 'submit':
                await this.handleSubmit(message.content, message.images, message.workflow);
                break;

            case 'submitCommand':
                await this.handleSubmit(message.content, message.images, message.workflow, message.command);
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

            case 'cancel':
                this.handleCancel();
                break;

            case 'installSpecKitExtension':
                void vscode.commands.executeCommand('speckit.companion.installSpecKitExtension');
                break;

            case 'openReadme':
                void vscode.commands.executeCommand('speckit.companion.openReadme');
                break;
        }
    }

    /**
     * Handle webview ready - send initial data
     */
    private async handleReady(): Promise<void> {
        const workflows = this.getWorkflows();
        const defaultWorkflow = vscode.workspace
            .getConfiguration('speckit')
            .get<string>('defaultWorkflow', 'speckit');
        this.outputChannel.appendLine(`[SpecEditor] Sending ${workflows.length} workflows to webview (default: ${defaultWorkflow})`);
        this.postMessage({ type: 'init', workflows, defaultWorkflow });
    }

    /**
     * Handle spec submission
     */
    private async handleSubmit(content: string, imageIds: string[], workflowName: string, customCommand?: string): Promise<void> {
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
            this.outputChannel.appendLine(`[SpecEditor] Submitting spec with workflow: ${workflowName}, ${imageIds.length} images`);

            // Get selected workflow
            const workflow = this.workflows.get(workflowName) || this.workflows.get('speckit');
            if (!workflow) {
                throw new Error(`Workflow '${workflowName}' not found`);
            }

            // Get attached images
            const images = imageIds
                .map(id => this.attachedImages.get(id))
                .filter((img): img is AttachedImage => img !== undefined);

            const providerType = getConfiguredProviderType();

            // Warn if images attached but provider has limited support. OpenCode no
            // longer warns: its attached images are staged into a self-gitignored
            // workspace cache dir below so the sandboxed CLI can read them (#208).
            if (images.length > 0 && providerType === AIProviders.COPILOT) {
                vscode.window.showWarningMessage(
                    'GitHub Copilot CLI has limited image support. Images will be included as file references but may not be processed.'
                );
                this.outputChannel.appendLine('[SpecEditor] Warning: Copilot has limited image support');
            }

            // Create temp file set
            const tempFileSet = await this.tempFileManager.createTempFileSet(
                this.sessionId,
                content,
                images
            );
            this.outputChannel.appendLine(`[SpecEditor] Created temp file set: ${tempFileSet.id}`);

            // OpenCode sandboxes reads to the project root and rejects the
            // globalStorage image paths the temp set references. Stage the images
            // into a self-gitignored workspace cache dir and rewrite the temp
            // markdown's image references to the in-workspace copies so the agent
            // reads an in-project path. Other providers read globalStorage fine, so
            // this is OpenCode-only; on no-workspace/failure it falls back to the
            // original references (the staging helper returns an empty map).
            if (images.length > 0 && providerType === AIProviders.OPENCODE) {
                const rewriteMap = await this.tempFileManager.stageImagesInWorkspace(
                    tempFileSet.id,
                    images,
                    tempFileSet.imageFilePaths
                );
                if (Object.keys(rewriteMap).length > 0) {
                    await this.tempFileManager.rewriteImageRefsInFile(
                        tempFileSet.markdownFilePath,
                        rewriteMap
                    );
                    this.outputChannel.appendLine(
                        `[SpecEditor] Staged ${Object.keys(rewriteMap).length} image(s) in workspace for OpenCode`
                    );
                } else {
                    this.outputChannel.appendLine('[SpecEditor] OpenCode image staging skipped (no workspace or copy failed)');
                }
            }

            // Get AI provider and execute
            const provider = AIProviderFactory.getProvider(this.context, this.outputChannel);

            // Use custom command if provided, otherwise the workflow's specify command.
            // For the default SpecKit workflow, route to the turbo specify twin when the
            // project default is turbo — the new spec has no context to pin yet, so the
            // first step honors the project default directly.
            //
            // When the user explicitly picked the turbo workflow option, route to the
            // turbo specify twin unconditionally (ignoring the project default) and pin
            // `profile: turbo` in the seed write so the whole pipeline runs turbo.
            const pickedTurbo = !customCommand && workflowName === TURBO_WORKFLOW_NAME;
            let seedProfile: 'turbo' | undefined = pickedTurbo ? 'turbo' : undefined;
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            let command = customCommand ? `/${customCommand}` : workflow.stepSpecify;
            if (pickedTurbo) {
                // The turbo picker is only offered when the extension is installed
                // (buildTurboWorkflowEntry gates on it), but re-check installation
                // directly here so a stale selection can never dispatch an unresolvable
                // /speckit.companion.*. Note: an explicit turbo pick routes to the turbo
                // twin regardless of the project default, so the project-default resolver
                // can't be the guard — only the extension's on-disk presence can.
                if (!workspaceRoot || !isCompanionInstalled(workspaceRoot)) {
                    seedProfile = undefined;
                    command = `/${formatCommandForProvider('speckit.specify')}`;
                    this.warnFellBackToStock();
                } else {
                    command = `/${formatCommandForProvider(TURBO_SPECIFY_COMMAND)}`;
                }
            } else if (!customCommand && workflow.name === 'speckit') {
                const resolution = resolveNewSpecProfileCommandWithFallback('speckit.specify', workspaceRoot);
                command = `/${formatCommandForProvider(resolution.command)}`;
                if (resolution.fellBack) {
                    this.warnFellBackToStock();
                }
            }

            // The turbo picker is a synthetic entry, not a real workflow config.
            // Seed the `.spec-context.json` `workflow` field with the resolvable base
            // name ('speckit') so downstream step-resolution (getWorkflow) finds it;
            // turbo routing is carried entirely by the pinned `profile: turbo`, not
            // by this field. Other workflows seed their own name unchanged.
            const seedWorkflowName = pickedTurbo ? 'speckit' : workflowName;
            const specContextInstruction = buildSpecifyCreationPreamble(seedWorkflowName, null, seedProfile);
            if (specContextInstruction) {
                await this.tempFileManager.appendToMarkdownFile(
                    tempFileSet.markdownFilePath,
                    specContextInstruction
                );
            }

            const prompt = `${command} ${tempFileSet.markdownFilePath}`;
            this.outputChannel.appendLine(`[SpecEditor] Using command: ${command} (temp file: ${tempFileSet.markdownFilePath})`);

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
        const codiconCssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'codicons', 'codicon.css')
        );

        const nonce = generateNonce();

        // Install banner: shown only when the prompt is enabled AND the spec-kit
        // extension is missing — installed projects see nothing (zero-regression).
        // Visibility is the unit-tested gate; the markup is shared with the Activity panel.
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const installBanner = renderInstallBannerHtml(
            shouldShowInstallPrompt(
                readInstallPromptEnabled(),
                workspaceRoot ? isCompanionInstalled(workspaceRoot) : false
            )
        );

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
    <link href="${codiconCssUri}" rel="stylesheet">
    <title>New Spec</title>
</head>
<body>
    <div class="spec-editor" id="app">
        <header class="spec-editor-header">
            <h1>Create New Spec</h1>
            <p>Write a detailed specification for your feature or task</p>
        </header>

        <div class="spec-editor-content">
            ${installBanner}
            <div id="error-container"></div>

            <div class="workflow-row">
                <div class="workflow-selector" id="workflowSelector" style="display: none;">
                    <label for="workflowSelect">Workflow</label>
                    <select id="workflowSelect">
                        <option value="speckit">SpecKit</option>
                    </select>
                </div>
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
                        <span class="codicon codicon-file-media" aria-hidden="true"></span>
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
            <span id="commandButtons" style="display: none;"></span>
            <button class="btn-primary" id="submitBtn">Submit</button>
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
