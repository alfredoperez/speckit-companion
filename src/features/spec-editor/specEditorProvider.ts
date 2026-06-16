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
import { normalizeWorkflowConfig, resolveStepCommand, isWorkflowSupportedForProvider, isCompanionSelectable } from '../workflows';
import type { WorkflowConfig } from '../workflows';
import { formatCommandForProvider } from '../../ai-providers/aiProvider';
import { buildSpecifyCreationPreamble } from '../../ai-providers/promptBuilder';
import { resolveDispatchForRoot } from '../specs/profileDispatch';
import { isCompanionInstalled } from '../settings/companionPresetReconciler';
import { shouldShowInstallPrompt, readInstallPromptEnabled } from '../../speckit/specKitExtensionInstall';
import { renderInstallBannerHtml } from './installBanner';
import { AIProviders, WorkflowSteps, ConfigKeys, COMPANION_WORKFLOW_NAME } from '../../core/constants';
import { sendTelemetryEvent } from '../../core/telemetry';
import * as crypto from 'crypto';

/** The Companion specify command the picker dispatches when the Companion workflow is chosen. */
const COMPANION_SPECIFY_COMMAND = 'speckit.companion.specify';

/** The Companion auto orchestrator the Run button dispatches — runs the whole pipeline hands-off. */
const COMPANION_AUTO_COMMAND = 'speckit.companion.auto';

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

        // SpecKit is always offered. Companion is added to the Create-Spec picker
        // only behind the single beta gate (the Companion-workflow setting on AND the
        // companion piece installed) — same predicate as the workflow manager — so
        // the picker never lists an option that silently falls back to stock.
        const workflows: WorkflowDefinition[] = [
            {
                name: 'speckit',
                displayName: 'SpecKit',
                description: 'Standard SpecKit workflow',
                stepSpecify: `/${formatCommandForProvider('speckit.specify')}`
            }
        ];
        if (isCompanionSelectable()) {
            workflows.push({
                name: COMPANION_WORKFLOW_NAME,
                displayName: 'SpecKit Companion',
                description: 'Leaner SpecKit Companion pipeline with built-in right-sizing, through to mark-complete.',
                stepSpecify: `/${formatCommandForProvider(COMPANION_SPECIFY_COMMAND)}`,
            });
        }

        // Add custom workflows the active provider supports
        for (const wf of customWorkflows) {
            if (wf.name && wf.name !== 'speckit' && wf.name !== 'default'
                && wf.name !== COMPANION_WORKFLOW_NAME
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
     * Non-blocking warning shown when a Companion specify dispatch was downgraded
     * to the stock command because the spec-kit extension is missing
     * (FR-006/FR-007). Offers a one-click install without leaving the editor.
     */
    private warnFellBackToStock(): void {
        this.outputChannel.appendLine(
            '[SpecEditor] Companion specify unavailable — spec-kit extension not installed; running stock speckit.specify.'
        );
        void vscode.window
            .showWarningMessage(
                'The SpecKit Companion workflow needs the companion spec-kit extension, which is not installed — creating this spec with the standard SpecKit flow instead.',
                'Install spec-kit Extension'
            )
            .then(choice => {
                if (choice === 'Install spec-kit Extension') {
                    void vscode.commands.executeCommand('speckit.companion.installSpecKitExtension');
                }
            });
    }

    /**
     * Non-blocking warning shown when Run (auto) is requested but the spec-kit
     * extension is missing. Auto has no stock twin, so it is suppressed rather
     * than downgraded — the run does not start.
     */
    private warnAutoUnavailable(): void {
        this.outputChannel.appendLine(
            '[SpecEditor] Companion auto unavailable — spec-kit extension not installed; Run aborted.'
        );
        void vscode.window
            .showWarningMessage(
                'Run needs the companion spec-kit extension, which is not installed — install it, then use Run to build the whole spec hands-off.',
                'Install spec-kit Extension'
            )
            .then(choice => {
                if (choice === 'Install spec-kit Extension') {
                    void vscode.commands.executeCommand('speckit.companion.installSpecKitExtension');
                }
            });
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

            case 'submitAuto':
                await this.handleSubmit(message.content, message.images, message.workflow, undefined, true);
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
    private async handleSubmit(content: string, imageIds: string[], workflowName: string, customCommand?: string, auto?: boolean): Promise<void> {
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
            // When the SpecKit Companion workflow is chosen, dispatch its specify
            // command — but guard the missing-extension case: downgrade to stock
            // speckit.specify (and warn) when the spec-kit extension is absent so a
            // Companion pick never dispatches an unresolvable /speckit.companion.*.
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            let command = customCommand ? `/${customCommand}` : workflow.stepSpecify;
            if (auto) {
                // Auto has no stock twin, so a missing extension suppresses it (command: null) — warn and abort.
                const resolution = resolveDispatchForRoot(COMPANION_AUTO_COMMAND, workspaceRoot);
                if (!resolution.command) {
                    this.warnAutoUnavailable();
                    this.postMessage({ type: 'error', message: 'Run needs the companion spec-kit extension, which is not installed.' });
                    return;
                }
                command = `/${formatCommandForProvider(resolution.command)}`;
            } else if (!customCommand && workflowName === COMPANION_WORKFLOW_NAME) {
                const resolution = resolveDispatchForRoot(COMPANION_SPECIFY_COMMAND, workspaceRoot);
                // specify always has a stock twin, so command is never suppressed (null) here.
                command = `/${formatCommandForProvider(resolution.command ?? 'speckit.specify')}`;
                if (resolution.fellBack) {
                    this.warnFellBackToStock();
                }
            }

            // Seed the chosen workflow name verbatim into `.spec-context.json` so
            // downstream step-resolution (getWorkflow) dispatches the right command
            // family for every step. A Companion pick seeds `companion` even when the
            // extension is missing — each step then applies the same fallback.
            const specContextInstruction = buildSpecifyCreationPreamble(auto ? COMPANION_WORKFLOW_NAME : workflowName, null);
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

            // Anonymous spec.created. The spec dir doesn't exist yet (the AI
            // creates it), so the persisted per-spec id is minted lazily on the
            // first later event; this carries a fresh id as a creation marker.
            // Workflow is derived from the resolved command (a Companion pick routes
            // via the `companion.*` family) so a missing-extension downgrade to stock
            // is reported as `speckit`, matching what actually ran.
            sendTelemetryEvent('spec.created', {
                providerId: providerType,
                workflow: command.includes('companion.') ? COMPANION_WORKFLOW_NAME : 'speckit',
                specInstanceId: crypto.randomUUID(),
            });

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
    <div class="spec-editor" id="app" aria-busy="false">
        <main class="spec-editor-column">
            <header class="spec-editor-header">
                <h1>Create New Spec</h1>
                <p>Describe your feature — or just paste a link — and the AI will generate the spec, plan, and tasks for it.</p>
            </header>

            <div class="spec-editor-content">
                ${installBanner}
                <div id="error-container" role="alert" aria-live="assertive"></div>

                <div class="workflow-row">
                    <div class="workflow-selector" id="workflowSelector" style="display: none;">
                        <label for="workflowSelect">Workflow</label>
                        <select id="workflowSelect">
                            <option value="speckit">SpecKit</option>
                        </select>
                    </div>
                </div>

                <div class="editor-container">
                    <label class="editor-label sr-only" for="specContent">Specification</label>
                    <p class="helper-text sr-only" id="helperText">Write as much or as little as you like — even just a Jira or GitHub link on its own works, and the AI will pull the details from it.</p>
                    <textarea
                        class="spec-editor-textarea"
                        id="specContent"
                        aria-describedby="helperText charCount"
                        placeholder="Describe your feature or task in detail — or just paste a link below and skip the description entirely.&#10;&#10;What helps:&#10;- What is the feature about?&#10;- What problem does it solve?&#10;- Who is it for?&#10;- Key requirements, constraints, or dependencies?&#10;&#10;Or paste a reference link on its own:&#10;- Jira:  https://your-org.atlassian.net/browse/PROJ-1234&#10;- GitHub:  https://github.com/your-org/your-repo/issues/42"
                    ></textarea>
                    <div class="editor-footer-row">
                        <button class="attach-image-btn" id="attachImageBtn" aria-label="Attach image (or paste an image to attach)">
                            <span class="codicon codicon-file-media" aria-hidden="true"></span>
                            Attach image
                        </button>
                        <div class="char-count sr-only" id="charCount">0 / 50,000</div>
                    </div>
                    <div class="image-thumbnails" id="thumbnails"></div>
                    <div class="image-size-info" id="sizeInfo"></div>
                </div>
            </div>

            <footer class="spec-editor-actions">
                <div class="keyboard-hints" id="keyboardHints">
                    <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to submit • <kbd>Esc</kbd> to cancel
                </div>
                <div class="action-spacer"></div>
                <span id="commandButtons" style="display: none;"></span>
                <button class="btn-cancel" id="cancelBtn">Cancel</button>
                <button class="btn-secondary" id="runBtn" title="Build the whole spec hands-off — specify → plan → tasks → implement → completed, no pauses" disabled>Run</button>
                <button class="btn-primary" id="submitBtn" disabled>Create Spec</button>
            </footer>
        </main>

        <div class="sr-only" id="sr-status" role="status" aria-live="polite"></div>
    </div>

    <div class="loading-overlay" id="loadingOverlay" role="status" aria-live="polite" aria-hidden="true" style="display: none;">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p class="loading-text">Creating your spec…</p>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
