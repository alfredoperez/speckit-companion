import * as vscode from 'vscode';
import * as path from 'path';
import {
    SpecViewerState,
    SpecDocument,
    DocumentType,
    CoreDocumentType,
    ExtensionToViewerMessage,
    ViewerToExtensionMessage,
    CORE_DOCUMENTS,
    CORE_DOCUMENT_FILES,
    CORE_DOCUMENT_DISPLAY_NAMES,
    EMPTY_STATE_MESSAGES,
    DEFAULT_EMPTY_MESSAGE,
    PhaseInfo,
    PHASE_ENHANCEMENT_BUTTONS,
    NavState
} from './types';

/**
 * Panel instance data for multi-panel support
 */
interface PanelInstance {
    panel: vscode.WebviewPanel;
    state: SpecViewerState;
    debounceTimer: NodeJS.Timeout | undefined;
}

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
 * Convert filename to display name (e.g., "research.md" -> "Research")
 */
function fileNameToDisplayName(fileName: string): string {
    const baseName = fileName.replace(/\.md$/i, '');
    // Convert kebab-case or snake_case to Title Case
    return baseName
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Convert filename to document type (e.g., "research.md" -> "research")
 */
function fileNameToDocType(fileName: string): string {
    return fileName.replace(/\.md$/i, '').toLowerCase();
}

/**
 * Check if a file path is a spec document
 */
export function isSpecDocument(filePath: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    return fileName.endsWith('.md') && filePath.includes('/specs/');
}

/**
 * Get document type from file path
 */
export function getDocumentTypeFromPath(filePath: string): DocumentType {
    const fileName = path.basename(filePath).toLowerCase();

    // Check core documents
    for (const [type, file] of Object.entries(CORE_DOCUMENT_FILES)) {
        if (fileName === file) {
            return type as CoreDocumentType;
        }
    }

    // Related document
    return fileNameToDocType(fileName);
}

/**
 * Get spec directory from file path
 */
export function getSpecDirectoryFromPath(filePath: string): string {
    return path.dirname(filePath);
}

/**
 * Provides the spec viewer webview panel for viewing spec documents.
 * Supports multiple panels - one per spec directory.
 */
export class SpecViewerProvider {
    /** Map of spec directory to panel instance */
    private panels: Map<string, PanelInstance> = new Map();

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel
    ) {}

    /**
     * Show the spec viewer with the specified document
     */
    public async show(filePath: string): Promise<void> {
        const specDirectory = getSpecDirectoryFromPath(filePath);
        const documentType = getDocumentTypeFromPath(filePath);

        this.outputChannel.appendLine(`[SpecViewer] Opening ${documentType} from ${specDirectory}`);

        // Check if panel already exists for this spec
        const existingInstance = this.panels.get(specDirectory);
        if (existingInstance) {
            // Update existing panel and reveal
            await this.updateContent(specDirectory, documentType);
            existingInstance.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        // Create new panel for this spec
        await this.createPanel(specDirectory, documentType);
    }

    /**
     * Get panel instance for a spec directory
     */
    private getInstance(specDirectory: string): PanelInstance | undefined {
        return this.panels.get(specDirectory);
    }

    /**
     * Refresh content if currently displaying the specified file
     */
    public async refreshIfDisplaying(filePath: string): Promise<void> {
        const specDirectory = getSpecDirectoryFromPath(filePath);
        const instance = this.panels.get(specDirectory);

        if (!instance) {
            return;
        }

        this.outputChannel.appendLine(`[SpecViewer] Refreshing due to file change: ${filePath}`);
        await this.updateContent(instance.state.specDirectory, instance.state.currentDocument);
    }

    /**
     * Handle file deletion
     */
    public handleFileDeleted(filePath: string): void {
        const specDirectory = getSpecDirectoryFromPath(filePath);
        const instance = this.panels.get(specDirectory);

        if (!instance) {
            return;
        }

        const documentType = getDocumentTypeFromPath(filePath);

        this.outputChannel.appendLine(`[SpecViewer] File deleted: ${filePath}`);

        // If the current document was deleted, show error message
        if (documentType === instance.state.currentDocument) {
            this.postMessage(specDirectory, {
                type: 'fileDeleted',
                filePath
            });
        }

        // Refresh documents list
        this.updateContent(instance.state.specDirectory, instance.state.currentDocument);
    }

    /**
     * Create the webview panel
     */
    private async createPanel(specDirectory: string, documentType: DocumentType): Promise<void> {
        const specName = path.basename(specDirectory);

        const panel = vscode.window.createWebviewPanel(
            'speckit.specViewer',
            `Spec: ${specName}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: false,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'webview'),
                    vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')
                ]
            }
        );

        // Initialize state with defaults
        const initialState: SpecViewerState = {
            specName,
            specDirectory,
            currentDocument: documentType,
            availableDocuments: [],
            lastUpdated: Date.now(),
            phases: [],
            currentPhase: 1,
            taskCompletionPercent: 0
        };

        // Create panel instance
        const instance: PanelInstance = {
            panel,
            state: initialState,
            debounceTimer: undefined
        };

        // Store in map
        this.panels.set(specDirectory, instance);

        // Handle disposal
        panel.onDidDispose(() => {
            this.outputChannel.appendLine(`[SpecViewer] Panel disposed for ${specDirectory}`);
            if (instance.debounceTimer) {
                clearTimeout(instance.debounceTimer);
            }
            this.panels.delete(specDirectory);
        });

        // Setup message handling
        this.setupMessageHandling(specDirectory);

        // Load initial content
        await this.updateContent(specDirectory, documentType);
    }

    /**
     * Setup message handling from webview
     */
    private setupMessageHandling(specDirectory: string): void {
        const instance = this.panels.get(specDirectory);
        if (!instance) return;

        instance.panel.webview.onDidReceiveMessage(
            async (message: ViewerToExtensionMessage) => {
                this.outputChannel.appendLine(`[SpecViewer] Received message: ${message.type}`);

                switch (message.type) {
                    case 'switchDocument':
                        await this.handleSwitchDocument(specDirectory, message.documentType);
                        break;
                    case 'editDocument':
                    case 'editSource':
                        await this.handleEditDocument(specDirectory);
                        break;
                    case 'refreshContent':
                        await this.handleRefresh(specDirectory);
                        break;
                    case 'ready':
                        this.outputChannel.appendLine('[SpecViewer] Webview ready');
                        break;
                    case 'stepperClick':
                        await this.handleStepperClick(specDirectory, message.phase);
                        break;
                    case 'regenerate':
                        await this.handleRegenerate(specDirectory);
                        break;
                    case 'approve':
                        await this.handleApprove(specDirectory);
                        break;
                    case 'clarify':
                        await this.handleClarify(specDirectory);
                        break;
                    case 'refineLine':
                        await this.handleRefineLine(specDirectory, message.lineNum, message.content, message.instruction);
                        break;
                    case 'editLine':
                        await this.handleEditLine(specDirectory, message.lineNum, message.newText);
                        break;
                    case 'removeLine':
                        await this.handleRemoveLine(specDirectory, message.lineNum);
                        break;
                    case 'toggleCheckbox':
                        await this.handleToggleCheckbox(specDirectory, message.lineNum, message.checked);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Handle document switch request
     */
    private async handleSwitchDocument(specDirectory: string, documentType: DocumentType): Promise<void> {
        const instance = this.panels.get(specDirectory);
        if (!instance) return;

        // Debounce rapid clicks
        if (instance.debounceTimer) {
            clearTimeout(instance.debounceTimer);
        }

        instance.debounceTimer = setTimeout(async () => {
            // Use message-based update for smoother transition (no page flash)
            await this.sendContentUpdateMessage(specDirectory, documentType);
        }, 50);
    }

    /**
     * Handle edit document request
     */
    private async handleEditDocument(specDirectory: string): Promise<void> {
        const instance = this.panels.get(specDirectory);
        if (!instance) return;

        const currentDoc = instance.state.availableDocuments.find(
            d => d.type === instance.state.currentDocument
        );

        if (!currentDoc || !currentDoc.exists) {
            vscode.window.showWarningMessage('Cannot edit: document not found');
            return;
        }

        try {
            const doc = await vscode.workspace.openTextDocument(currentDoc.filePath);
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            this.outputChannel.appendLine(`[SpecViewer] Opened for editing: ${currentDoc.filePath}`);
        } catch (error) {
            this.outputChannel.appendLine(`[SpecViewer] Error opening document: ${error}`);
            vscode.window.showErrorMessage(`Failed to open document: ${error}`);
        }
    }

    /**
     * Handle refresh request
     */
    private async handleRefresh(specDirectory: string): Promise<void> {
        const instance = this.panels.get(specDirectory);
        if (!instance) return;
        await this.updateContent(instance.state.specDirectory, instance.state.currentDocument);
    }

    /**
     * Handle stepper click - navigate to phase document
     */
    private async handleStepperClick(specDirectory: string, phase: 'spec' | 'plan' | 'tasks' | 'done'): Promise<void> {
        if (phase === 'done') return; // Done is not clickable
        // Use message-based update for smoother transition (no page flash)
        await this.sendContentUpdateMessage(specDirectory, phase);
    }

    /**
     * Handle regenerate request
     */
    private async handleRegenerate(specDirectory: string): Promise<void> {
        const instance = this.panels.get(specDirectory);
        if (!instance) return;

        const docType = instance.state.currentDocument;
        let command = '';

        if (docType === 'spec') {
            command = 'speckit.specify';
        } else if (docType === 'plan') {
            command = 'speckit.plan';
        } else if (docType === 'tasks') {
            command = 'speckit.tasks';
        }

        if (command) {
            // Pass specDirectory as argument
            vscode.commands.executeCommand(command, specDirectory);
        }
    }

    /**
     * Handle approve request - generate next phase or implement tasks
     */
    private async handleApprove(specDirectory: string): Promise<void> {
        const instance = this.panels.get(specDirectory);
        if (!instance) return;

        const docType = instance.state.currentDocument;

        if (docType === 'spec') {
            // Generate plan
            vscode.commands.executeCommand('speckit.plan', specDirectory);
        } else if (docType === 'plan') {
            // Generate tasks
            vscode.commands.executeCommand('speckit.tasks', specDirectory);
        } else if (docType === 'tasks') {
            // Implement tasks
            vscode.commands.executeCommand('speckit.implement', specDirectory);
        }
    }

    /**
     * Handle clarify/enhancement button
     */
    private async handleClarify(specDirectory: string): Promise<void> {
        const instance = this.panels.get(specDirectory);
        if (!instance) return;

        const docType = instance.state.currentDocument;
        if (docType === 'spec' || docType === 'plan' || docType === 'tasks') {
            const button = PHASE_ENHANCEMENT_BUTTONS[docType];
            if (button) {
                // Pass specDirectory as argument
                vscode.commands.executeCommand(button.command, specDirectory);
            }
        }
    }

    /**
     * Handle refine line request
     */
    private async handleRefineLine(specDirectory: string, lineNum: number, content: string, instruction: string): Promise<void> {
        this.outputChannel.appendLine(`[SpecViewer] Refine line ${lineNum}: ${instruction}`);
        // TODO: Implement AI-based refinement
        vscode.window.showInformationMessage(`Refining line ${lineNum}...`);
    }

    /**
     * Handle edit line request
     */
    private async handleEditLine(specDirectory: string, lineNum: number, newText: string): Promise<void> {
        const instance = this.panels.get(specDirectory);
        if (!instance) return;

        const currentDoc = instance.state.availableDocuments.find(
            d => d.type === instance.state.currentDocument
        );

        if (!currentDoc || !currentDoc.exists) return;

        try {
            const uri = vscode.Uri.file(currentDoc.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const edit = new vscode.WorkspaceEdit();

            if (lineNum > 0 && lineNum <= document.lineCount) {
                const line = document.lineAt(lineNum - 1);
                edit.replace(uri, line.range, newText);
                await vscode.workspace.applyEdit(edit);
                await document.save();
                this.outputChannel.appendLine(`[SpecViewer] Edited line ${lineNum}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`[SpecViewer] Error editing line: ${error}`);
        }
    }

    /**
     * Handle remove line request
     */
    private async handleRemoveLine(specDirectory: string, lineNum: number): Promise<void> {
        const instance = this.panels.get(specDirectory);
        if (!instance) return;

        const currentDoc = instance.state.availableDocuments.find(
            d => d.type === instance.state.currentDocument
        );

        if (!currentDoc || !currentDoc.exists) return;

        try {
            const uri = vscode.Uri.file(currentDoc.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const edit = new vscode.WorkspaceEdit();

            if (lineNum > 0 && lineNum <= document.lineCount) {
                const line = document.lineAt(lineNum - 1);
                const range = line.rangeIncludingLineBreak;
                edit.delete(uri, range);
                await vscode.workspace.applyEdit(edit);
                await document.save();
                this.outputChannel.appendLine(`[SpecViewer] Removed line ${lineNum}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`[SpecViewer] Error removing line: ${error}`);
        }
    }

    /**
     * Handle checkbox toggle request - updates [ ] to [x] or vice versa
     */
    private async handleToggleCheckbox(specDirectory: string, lineNum: number, checked: boolean): Promise<void> {
        const instance = this.panels.get(specDirectory);
        if (!instance) return;

        const currentDoc = instance.state.availableDocuments.find(
            d => d.type === instance.state.currentDocument
        );

        if (!currentDoc || !currentDoc.exists) return;

        try {
            const uri = vscode.Uri.file(currentDoc.filePath);
            const document = await vscode.workspace.openTextDocument(uri);

            if (lineNum > 0 && lineNum <= document.lineCount) {
                const line = document.lineAt(lineNum - 1);
                const lineText = line.text;

                // Replace [ ] with [x] or [x]/[X] with [ ]
                let newText: string;
                if (checked) {
                    newText = lineText.replace(/\[ \]/, '[x]');
                } else {
                    newText = lineText.replace(/\[[xX]\]/, '[ ]');
                }

                if (newText !== lineText) {
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(uri, line.range, newText);
                    await vscode.workspace.applyEdit(edit);
                    await document.save();
                    this.outputChannel.appendLine(`[SpecViewer] Toggled checkbox on line ${lineNum} to ${checked ? 'checked' : 'unchecked'}`);
                }
            }
        } catch (error) {
            this.outputChannel.appendLine(`[SpecViewer] Error toggling checkbox: ${error}`);
        }
    }

    /**
     * Update content in the panel
     */
    private async updateContent(specDirectory: string, documentType: DocumentType): Promise<void> {
        const instance = this.panels.get(specDirectory);
        if (!instance) return;

        try {
            // Scan for available documents
            const documents = await this.scanDocuments(specDirectory);
            const specName = path.basename(specDirectory);

            // Find the requested document (or fallback to first available)
            let doc = documents.find(d => d.type === documentType);
            if (!doc) {
                // Try to find first existing core document
                doc = documents.find(d => d.isCore && d.exists);
            }
            if (!doc) {
                doc = documents[0]; // Fallback to first document
            }

            // Read content
            let content = '';
            let emptyMessage = '';

            if (doc?.exists) {
                try {
                    const uri = vscode.Uri.file(doc.filePath);
                    const data = await vscode.workspace.fs.readFile(uri);
                    content = Buffer.from(data).toString('utf-8');
                } catch (error) {
                    this.outputChannel.appendLine(`[SpecViewer] Error reading ${doc.filePath}: ${error}`);
                    emptyMessage = `Error reading file: ${error}`;
                }
            } else {
                // Get empty state message
                if (doc?.type in EMPTY_STATE_MESSAGES) {
                    emptyMessage = EMPTY_STATE_MESSAGES[doc.type as CoreDocumentType];
                } else {
                    emptyMessage = DEFAULT_EMPTY_MESSAGE;
                }
            }

            // Calculate phases
            const phases = this.calculatePhases(documents, doc?.type || 'spec', content);
            const currentPhase = this.getPhaseNumber(doc?.type || 'spec');
            const taskCompletionPercent = this.calculateTaskCompletion(content, doc?.type || 'spec');

            // Update state
            instance.state = {
                specName,
                specDirectory,
                currentDocument: doc?.type || 'spec',
                availableDocuments: documents,
                lastUpdated: Date.now(),
                phases,
                currentPhase,
                taskCompletionPercent
            };

            // Update panel title
            const docDisplayName = doc?.displayName || 'Spec';
            instance.panel.title = `Spec: ${specName} - ${docDisplayName}`;

            // Generate and set HTML
            instance.panel.webview.html = this.generateHtml(
                content,
                emptyMessage,
                documents,
                doc?.type || 'spec',
                specName,
                phases,
                taskCompletionPercent
            );

            this.outputChannel.appendLine(
                `[SpecViewer] Updated content: ${specName}/${doc?.type || 'unknown'}`
            );
        } catch (error) {
            this.outputChannel.appendLine(`[SpecViewer] Error updating content: ${error}`);
            this.postMessage(specDirectory, {
                type: 'error',
                message: `Failed to load document: ${error}`,
                recoverable: true
            });
        }
    }

    /**
     * Calculate phase information for the stepper
     */
    private calculatePhases(documents: SpecDocument[], currentDocType: DocumentType, content: string): PhaseInfo[] {
        const specExists = documents.some(d => d.type === 'spec' && d.exists);
        const planExists = documents.some(d => d.type === 'plan' && d.exists);
        const tasksExists = documents.some(d => d.type === 'tasks' && d.exists);
        const taskCompletion = currentDocType === 'tasks' ? this.calculateTaskCompletion(content, 'tasks') : 0;

        return [
            {
                phase: 1,
                label: 'Spec',
                completed: specExists,
                active: currentDocType === 'spec'
            },
            {
                phase: 2,
                label: 'Plan',
                completed: planExists,
                active: currentDocType === 'plan'
            },
            {
                phase: 3,
                label: 'Tasks',
                completed: tasksExists,
                active: currentDocType === 'tasks',
                progressPercent: tasksExists ? taskCompletion : undefined
            },
            {
                phase: 4,
                label: 'Done',
                completed: taskCompletion === 100,
                active: false,
                progressPercent: tasksExists ? taskCompletion : undefined
            }
        ];
    }

    /**
     * Get phase number from document type
     */
    private getPhaseNumber(docType: DocumentType): 1 | 2 | 3 | 4 {
        switch (docType) {
            case 'spec': return 1;
            case 'plan': return 2;
            case 'tasks': return 3;
            default: return 1;
        }
    }

    /**
     * Calculate task completion percentage from content
     */
    private calculateTaskCompletion(content: string, docType: DocumentType): number {
        if (docType !== 'tasks' || !content) return 0;

        const checkboxPattern = /- \[([ xX])\]/g;
        const matches = content.matchAll(checkboxPattern);
        const matchArray = Array.from(matches);

        if (matchArray.length === 0) return 0;

        const completed = matchArray.filter(m => m[1].toLowerCase() === 'x').length;
        return Math.round((completed / matchArray.length) * 100);
    }

    /**
     * Scan spec directory for available documents
     */
    private async scanDocuments(specDirectory: string): Promise<SpecDocument[]> {
        const documents: SpecDocument[] = [];

        // Add core documents (always shown in tabs)
        for (const [type, fileName] of Object.entries(CORE_DOCUMENT_FILES)) {
            const filePath = path.join(specDirectory, fileName);
            const exists = await this.fileExists(filePath);

            documents.push({
                type: type as CoreDocumentType,
                displayName: CORE_DOCUMENT_DISPLAY_NAMES[type as CoreDocumentType],
                fileName,
                filePath,
                exists,
                isCore: true,
                category: 'core'
            });
        }

        // Scan for related documents
        try {
            const uri = vscode.Uri.file(specDirectory);
            const entries = await vscode.workspace.fs.readDirectory(uri);

            for (const [name, fileType] of entries) {
                if (fileType !== vscode.FileType.File) continue;
                if (!name.endsWith('.md')) continue;

                // Skip core documents (already added)
                if (Object.values(CORE_DOCUMENT_FILES).includes(name)) continue;

                const filePath = path.join(specDirectory, name);
                documents.push({
                    type: fileNameToDocType(name),
                    displayName: fileNameToDisplayName(name),
                    fileName: name,
                    filePath,
                    exists: true,
                    isCore: false,
                    category: 'related'
                });
            }
        } catch (error) {
            this.outputChannel.appendLine(`[SpecViewer] Error scanning directory: ${error}`);
        }

        // Sort: core documents first (in order), then related docs alphabetically
        documents.sort((a, b) => {
            if (a.isCore && !b.isCore) return -1;
            if (!a.isCore && b.isCore) return 1;
            if (a.isCore && b.isCore) {
                const order = ['spec', 'plan', 'tasks'];
                return order.indexOf(a.type) - order.indexOf(b.type);
            }
            return a.displayName.localeCompare(b.displayName);
        });

        return documents;
    }

    /**
     * Check if a file exists
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Post message to webview
     */
    private postMessage(specDirectory: string, message: ExtensionToViewerMessage): void {
        const instance = this.panels.get(specDirectory);
        instance?.panel.webview.postMessage(message);
    }

    /**
     * Send content update via message (no full HTML regeneration)
     * Used for smoother tab switching without page flash
     */
    private async sendContentUpdateMessage(specDirectory: string, documentType: DocumentType): Promise<void> {
        const instance = this.panels.get(specDirectory);
        if (!instance) return;

        try {
            // Find the requested document
            const doc = instance.state.availableDocuments.find(d => d.type === documentType);
            if (!doc) {
                this.outputChannel.appendLine(`[SpecViewer] Document not found: ${documentType}`);
                return;
            }

            // Read content
            let content = '';
            if (doc.exists) {
                try {
                    const uri = vscode.Uri.file(doc.filePath);
                    const data = await vscode.workspace.fs.readFile(uri);
                    content = Buffer.from(data).toString('utf-8');
                } catch (error) {
                    this.outputChannel.appendLine(`[SpecViewer] Error reading ${doc.filePath}: ${error}`);
                }
            }

            // Calculate task completion for tasks doc
            const taskCompletionPercent = this.calculateTaskCompletion(content, documentType);

            // Build navigation state
            const coreDocs = instance.state.availableDocuments.filter(d => d.category === 'core');
            const relatedDocs = instance.state.availableDocuments.filter(d => d.category === 'related');
            const isViewingRelatedDoc = !['spec', 'plan', 'tasks'].includes(documentType);
            const workflowPhase = this.calculateWorkflowPhase(coreDocs);

            const navState: NavState = {
                coreDocs,
                relatedDocs,
                currentDoc: documentType,
                workflowPhase,
                taskCompletionPercent,
                isViewingRelatedDoc
            };

            // Update internal state
            instance.state.currentDocument = documentType;
            instance.state.taskCompletionPercent = taskCompletionPercent;
            instance.state.currentPhase = this.getPhaseNumber(documentType);

            // Update panel title
            const docDisplayName = doc.displayName || 'Spec';
            instance.panel.title = `Spec: ${instance.state.specName} - ${docDisplayName}`;

            // Send content via message (no full HTML regeneration)
            const encodedContent = Buffer.from(content).toString('base64');
            this.postMessage(specDirectory, {
                type: 'contentUpdated',
                content: encodedContent,
                documentType,
                specName: instance.state.specName,
                navState
            });

            this.outputChannel.appendLine(
                `[SpecViewer] Sent content update: ${instance.state.specName}/${documentType}`
            );
        } catch (error) {
            this.outputChannel.appendLine(`[SpecViewer] Error sending content update: ${error}`);
        }
    }

    /**
     * Generate HTML for the webview
     */
    private generateHtml(
        content: string,
        emptyMessage: string,
        documents: SpecDocument[],
        currentDocType: DocumentType,
        specName: string,
        phases: PhaseInfo[],
        taskCompletionPercent: number
    ): string {
        // Get the instance to access its panel
        const specDirectory = documents[0]?.filePath ? path.dirname(documents[0].filePath) : '';
        const instance = this.panels.get(specDirectory);
        if (!instance) {
            return '<html><body>Error: Panel not found</body></html>';
        }

        const webview = instance.panel.webview;

        // Get URIs for resources
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'spec-viewer.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'spec-viewer.js')
        );

        const nonce = generateNonce();

        // Generate phase stepper
        const stepperHtml = this.generatePhaseStepper(phases, taskCompletionPercent);

        // Split documents by category
        const coreDocs = documents.filter(d => d.category === 'core');
        const relatedDocs = documents.filter(d => d.category === 'related');

        // Generate core tabs
        const coreTabsHtml = coreDocs.map(doc => {
            const activeClass = doc.type === currentDocType ? 'active' : '';
            const disabledClass = !doc.exists ? 'disabled' : '';
            const classes = `tab-button core ${activeClass} ${disabledClass}`.trim();
            return `<button class="${classes}" data-doc="${doc.type}" ${!doc.exists ? 'disabled' : ''}>${doc.displayName}</button>`;
        }).join('\n                    ');

        // Generate related tabs (only if there are related docs)
        const relatedTabsHtml = relatedDocs.length > 0 ? relatedDocs.map(doc => {
            const activeClass = doc.type === currentDocType ? 'active' : '';
            const classes = `tab-button related ${activeClass}`.trim();
            return `<button class="${classes}" data-doc="${doc.type}">${doc.displayName}</button>`;
        }).join('\n                    ') : '';

        // Generate content or empty state
        const contentHtml = content
            ? `<div id="markdown-content" data-raw="${this.escapeHtmlAttribute(content)}"></div>`
            : `<div class="empty-state">${this.escapeHtml(emptyMessage)}</div>`;

        // Get current document for edit button state
        const currentDoc = documents.find(d => d.type === currentDocType);
        const editDisabled = !currentDoc?.exists;

        // Get enhancement button for current phase
        const enhancementButton = currentDocType === 'spec' || currentDocType === 'plan' || currentDocType === 'tasks'
            ? PHASE_ENHANCEMENT_BUTTONS[currentDocType]
            : null;

        // Smart CTA button logic:
        // - Show "Generate Plan/Tasks" when next phase doesn't exist yet
        // - Hide when next phase already exists (user can navigate via tabs)
        // - For tasks: show "Implement Tasks" when not complete, hide when 100% complete
        const planExists = coreDocs.find(d => d.type === 'plan')?.exists ?? false;
        const tasksExists = coreDocs.find(d => d.type === 'tasks')?.exists ?? false;

        let showApproveButton = false;
        let approveText = '';

        if (currentDocType === 'spec') {
            // Show "Generate Plan" only if plan doesn't exist
            if (!planExists) {
                showApproveButton = true;
                approveText = 'Generate Plan';
            }
        } else if (currentDocType === 'plan') {
            // Show "Generate Tasks" only if tasks doesn't exist
            if (!tasksExists) {
                showApproveButton = true;
                approveText = 'Generate Tasks';
            }
        } else if (currentDocType === 'tasks') {
            // Show "Implement Tasks" only if not 100% complete
            if (taskCompletionPercent < 100) {
                showApproveButton = true;
                approveText = 'Implement Tasks';
            }
        }

        // Determine if viewing a related doc
        const isViewingRelatedDoc = !['spec', 'plan', 'tasks'].includes(currentDocType);

        // Calculate workflow phase (where we ARE in spec-driven development)
        const workflowPhase = this.calculateWorkflowPhase(coreDocs);

        // Generate the new compact nav
        const navHtml = this.generateCompactNav(
            coreDocs,
            relatedDocs,
            currentDocType,
            workflowPhase,
            isViewingRelatedDoc,
            taskCompletionPercent
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   style-src ${webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net;
                   script-src 'nonce-${nonce}' https://cdn.jsdelivr.net;
                   img-src ${webview.cspSource} data: https:;
                   font-src ${webview.cspSource} https://cdn.jsdelivr.net;">
    <link href="${styleUri}" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/styles/github-dark.min.css">
    <title>Spec: ${this.escapeHtml(specName)}</title>
</head>
<body style="background: var(--vscode-editor-background, #1e1e1e);">
    <div class="viewer-container">
        ${navHtml}

        <main class="content-area" id="content-area">
            ${contentHtml}
        </main>

        <footer class="actions">
            <div class="actions-left">
                ${enhancementButton ? `
                <button id="enhance" class="enhancement" data-command="${enhancementButton.command}" title="${enhancementButton.tooltip || ''}">
                    <span class="icon">${enhancementButton.icon}</span>
                    ${enhancementButton.label}
                </button>
                ` : ''}
            </div>
            <div class="actions-right">
                <button id="editSource" class="secondary" ${editDisabled ? 'disabled' : ''}>Edit Source</button>
                <button id="regenerate" class="secondary">Regenerate</button>
                ${showApproveButton ? `<button id="approve" class="primary">${approveText}</button>` : ''}
            </div>
        </footer>
    </div>

    <div class="loading-overlay" id="loading-overlay" style="display: none;">
        <div class="loading-spinner"></div>
    </div>

    <div class="refine-backdrop" id="refine-backdrop" style="display: none;"></div>
    <div class="refine-popover" id="refine-popover" style="display: none;">
        <div class="refine-popover-header">Refine this line</div>
        <div class="original-value-reference" id="refine-original">
            <span class="original-value-label">Original</span>
            <span id="refine-original-text"></span>
        </div>
        <input type="text" class="refine-input" id="refine-input" placeholder="Describe how to improve this line...">
        <div class="refine-popover-actions">
            <button class="refine-cancel" id="refine-cancel">Cancel</button>
            <button class="refine-submit" id="refine-submit">Refine</button>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/highlight.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/typescript.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/bash.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/json.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/yaml.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/css.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/languages/javascript.min.js" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js" nonce="${nonce}"></script>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    /**
     * Generate the phase stepper HTML
     */
    private generatePhaseStepper(phases: PhaseInfo[], taskCompletionPercent: number): string {
        const steps = phases.map((phase, index) => {
            const isActive = phase.active;
            const isCompleted = phase.completed;
            const isInProgress = phase.phase === 4 && taskCompletionPercent > 0 && taskCompletionPercent < 100;

            let indicator = phase.phase.toString();
            let stepClass = '';

            if (isCompleted) {
                indicator = '✓';
                stepClass = 'completed';
            }
            if (isActive) {
                stepClass += ' active';
            }
            if (isInProgress) {
                indicator = `${taskCompletionPercent}%`;
                stepClass = 'in-progress';
            }

            // For Done phase with completion
            if (phase.phase === 4) {
                if (taskCompletionPercent === 100) {
                    indicator = '✓';
                    stepClass = 'completed';
                } else if (taskCompletionPercent > 0) {
                    indicator = `${taskCompletionPercent}%`;
                    stepClass = 'in-progress';
                } else {
                    indicator = '4';
                }
            }

            const phaseKey = phase.phase === 1 ? 'spec' : phase.phase === 2 ? 'plan' : phase.phase === 3 ? 'tasks' : 'done';

            return `
                <div class="step ${stepClass.trim()}" data-phase="${phaseKey}">
                    <div class="step-indicator">${indicator}</div>
                    <div class="step-label">${phase.label}</div>
                </div>
            `;
        });

        // Add connectors between steps
        const stepsWithConnectors: string[] = [];
        for (let i = 0; i < steps.length; i++) {
            stepsWithConnectors.push(steps[i]);
            if (i < steps.length - 1) {
                const connectorClass = phases[i].completed ? 'completed' : '';
                const inProgressClass = phases[i].completed && !phases[i + 1].completed && phases[i + 1].progressPercent
                    ? 'in-progress' : '';
                stepsWithConnectors.push(`<div class="step-connector ${connectorClass} ${inProgressClass}"></div>`);
            }
        }

        return `
            <nav class="phase-stepper">
                ${stepsWithConnectors.join('\n')}
            </nav>
        `;
    }

    /**
     * Calculate current workflow phase based on which files exist
     * Returns: 'spec' | 'plan' | 'tasks' | 'done'
     */
    private calculateWorkflowPhase(coreDocs: SpecDocument[]): 'spec' | 'plan' | 'tasks' | 'done' {
        const specExists = coreDocs.find(d => d.type === 'spec')?.exists;
        const planExists = coreDocs.find(d => d.type === 'plan')?.exists;
        const tasksExists = coreDocs.find(d => d.type === 'tasks')?.exists;

        if (tasksExists) return 'tasks';
        if (planExists) return 'plan';
        if (specExists) return 'spec';
        return 'spec';
    }

    /**
     * Generate the unified navigation bar (merged tabs + stepper)
     */
    private generateCompactNav(
        coreDocs: SpecDocument[],
        relatedDocs: SpecDocument[],
        currentDocType: DocumentType,
        workflowPhase: 'spec' | 'plan' | 'tasks' | 'done',
        isViewingRelatedDoc: boolean,
        taskCompletionPercent: number
    ): string {
        // Calculate if project is complete (persists regardless of current view)
        const tasksDoc = coreDocs.find(d => d.type === 'tasks');
        const isProjectComplete = taskCompletionPercent === 100;

        // Unified step-tabs: each step is a tab with status indicator
        // Note: "Done" is no longer a step - it's shown as a completion badge instead
        const phases = ['spec', 'plan', 'tasks'] as const;
        const stepTabsHtml = phases.map((phase, i) => {
            const doc = coreDocs.find(d => d.type === phase);
            const exists = doc?.exists ?? false;
            const isViewing = phase === currentDocType || (isViewingRelatedDoc && phase === 'plan');
            const isWorkflow = phase === workflowPhase;
            const isClickable = exists || phase === 'spec';
            const inProgress = phase === 'tasks' && taskCompletionPercent > 0 && taskCompletionPercent < 100;

            // Review mode: viewing a completed step that isn't the current workflow phase
            // This helps distinguish "actively working on a step" vs "reviewing a completed step"
            const isReviewing = isViewing && exists && phase !== workflowPhase && !isViewingRelatedDoc;

            // Tasks-active: viewing tasks with progress (special prominent state)
            const isTasksActive = phase === 'tasks' && isViewing && inProgress;

            const classes = [
                'step-tab',
                exists ? 'exists' : '',
                isReviewing ? 'reviewing' : (isViewing ? 'viewing' : ''),
                isTasksActive ? 'tasks-active' : '',
                isWorkflow && !isViewing ? 'workflow' : '',
                !isClickable ? 'disabled' : '',
                inProgress && !isTasksActive ? 'in-progress' : ''
            ].filter(Boolean).join(' ');

            const label = phase.charAt(0).toUpperCase() + phase.slice(1);
            // Show percentage for tasks in-progress, checkmark for completed files
            const statusIcon = inProgress ? `${taskCompletionPercent}%` : (exists ? '✓' : '');

            // Connector line between steps
            const connector = i < phases.length - 1
                ? `<span class="step-connector ${exists ? 'filled' : ''}"></span>`
                : '';

            return `<button class="${classes}" data-phase="${phase}" ${!isClickable ? 'disabled' : ''}>
                <span class="step-status">${statusIcon}</span>
                <span class="step-label">${label}</span>
            </button>${connector}`;
        }).join('');

        // Add completion badge when tasks are 100% complete (persists when reviewing earlier steps)
        // Positioned on the right side of nav
        const completionBadge = isProjectComplete
            ? `<span class="completion-badge">🌱 Spec Completed</span>`
            : '';

        // Related docs bar - only show when viewing plan/tasks or their related docs
        // Hide when viewing spec since related docs typically belong to plan phase
        const showRelatedBar = relatedDocs.length > 0 && currentDocType !== 'spec';
        const isCoreDoc = ['spec', 'plan', 'tasks'].includes(currentDocType);

        // Get the parent phase for overview tab (spec, plan, or tasks)
        const parentPhase = isViewingRelatedDoc ? 'plan' : currentDocType;
        const parentDisplayName = parentPhase.charAt(0).toUpperCase() + parentPhase.slice(1);
        const isOverviewActive = isCoreDoc && !isViewingRelatedDoc;

        const relatedTabsHtml = relatedDocs.map(doc => {
            const isActive = doc.type === currentDocType;
            return `<button class="related-tab ${isActive ? 'active' : ''}" data-doc="${doc.type}">${doc.displayName}</button>`;
        }).join('');

        // Build the related bar with Overview tab and centered layout
        const relatedBarHtml = showRelatedBar
            ? `<div class="related-bar" style="${showRelatedBar ? '' : 'display: none;'}">
                    <div class="related-bar-content">
                        <button class="overview-tab ${isOverviewActive ? 'active' : ''}" data-doc="${parentPhase}">Overview</button>
                        <span class="overview-divider"></span>
                        <div class="related-tabs">${relatedTabsHtml}</div>
                    </div>
                </div>`
            : '';

        return `
            <nav class="compact-nav">
                <div class="nav-primary">
                    <div class="step-tabs">${stepTabsHtml}</div>
                    ${completionBadge}
                </div>
                ${relatedBarHtml}
            </nav>`;
    }

    /**
     * Escape HTML entities
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Escape for HTML attribute (more aggressive escaping)
     */
    private escapeHtmlAttribute(text: string): string {
        return Buffer.from(text).toString('base64');
    }
}
