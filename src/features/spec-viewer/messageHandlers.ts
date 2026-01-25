/**
 * SpecKit Companion - Message Handlers
 * Handles messages from the webview
 */

import * as vscode from 'vscode';
import {
    SpecViewerState,
    ViewerToExtensionMessage,
    DocumentType,
    PHASE_ENHANCEMENT_BUTTONS
} from './types';

/**
 * Interface for message handler dependencies
 */
export interface MessageHandlerDependencies {
    getInstance: (specDirectory: string) => { state: SpecViewerState; debounceTimer: NodeJS.Timeout | undefined } | undefined;
    updateContent: (specDirectory: string, documentType: DocumentType) => Promise<void>;
    sendContentUpdateMessage: (specDirectory: string, documentType: DocumentType) => Promise<void>;
    outputChannel: vscode.OutputChannel;
    context: vscode.ExtensionContext;
}

/**
 * Create message handlers for a spec directory
 */
export function createMessageHandlers(
    specDirectory: string,
    deps: MessageHandlerDependencies
) {
    return async (message: ViewerToExtensionMessage) => {
        deps.outputChannel.appendLine(`[SpecViewer] Received message: ${message.type}`);

        switch (message.type) {
            case 'switchDocument':
                await handleSwitchDocument(specDirectory, message.documentType, deps);
                break;
            case 'editDocument':
            case 'editSource':
                await handleEditDocument(specDirectory, deps);
                break;
            case 'refreshContent':
                await handleRefresh(specDirectory, deps);
                break;
            case 'ready':
                deps.outputChannel.appendLine('[SpecViewer] Webview ready');
                break;
            case 'stepperClick':
                await handleStepperClick(specDirectory, message.phase, deps);
                break;
            case 'regenerate':
                await handleRegenerate(specDirectory, deps);
                break;
            case 'approve':
                await handleApprove(specDirectory, deps);
                break;
            case 'clarify':
                await handleClarify(specDirectory, deps);
                break;
            case 'refineLine':
                await handleRefineLine(specDirectory, message.lineNum, message.content, message.instruction, deps);
                break;
            case 'editLine':
                await handleEditLine(specDirectory, message.lineNum, message.newText, deps);
                break;
            case 'removeLine':
                await handleRemoveLine(specDirectory, message.lineNum, deps);
                break;
            case 'toggleCheckbox':
                await handleToggleCheckbox(specDirectory, message.lineNum, message.checked, deps);
                break;
        }
    };
}

/**
 * Handle document switch request
 */
async function handleSwitchDocument(
    specDirectory: string,
    documentType: DocumentType,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
    if (!instance) return;

    // Debounce rapid clicks
    if (instance.debounceTimer) {
        clearTimeout(instance.debounceTimer);
    }

    instance.debounceTimer = setTimeout(async () => {
        // Use message-based update for smoother transition (no page flash)
        await deps.sendContentUpdateMessage(specDirectory, documentType);
    }, 50);
}

/**
 * Handle edit document request
 */
async function handleEditDocument(
    specDirectory: string,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
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
        deps.outputChannel.appendLine(`[SpecViewer] Opened for editing: ${currentDoc.filePath}`);
    } catch (error) {
        deps.outputChannel.appendLine(`[SpecViewer] Error opening document: ${error}`);
        vscode.window.showErrorMessage(`Failed to open document: ${error}`);
    }
}

/**
 * Handle refresh request
 */
async function handleRefresh(
    specDirectory: string,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
    if (!instance) return;
    await deps.updateContent(instance.state.specDirectory, instance.state.currentDocument);
}

/**
 * Handle stepper click - navigate to phase document
 */
async function handleStepperClick(
    specDirectory: string,
    phase: 'spec' | 'plan' | 'tasks' | 'done',
    deps: MessageHandlerDependencies
): Promise<void> {
    if (phase === 'done') return; // Done is not clickable
    // Use message-based update for smoother transition (no page flash)
    await deps.sendContentUpdateMessage(specDirectory, phase);
}

/**
 * Handle regenerate request
 */
async function handleRegenerate(
    specDirectory: string,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
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
async function handleApprove(
    specDirectory: string,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
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
async function handleClarify(
    specDirectory: string,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
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
async function handleRefineLine(
    specDirectory: string,
    lineNum: number,
    content: string,
    instruction: string,
    deps: MessageHandlerDependencies
): Promise<void> {
    deps.outputChannel.appendLine(`[SpecViewer] Refine line ${lineNum}: ${instruction}`);
    // TODO: Implement AI-based refinement
    vscode.window.showInformationMessage(`Refining line ${lineNum}...`);
}

/**
 * Handle edit line request
 */
async function handleEditLine(
    specDirectory: string,
    lineNum: number,
    newText: string,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
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
            deps.outputChannel.appendLine(`[SpecViewer] Edited line ${lineNum}`);
        }
    } catch (error) {
        deps.outputChannel.appendLine(`[SpecViewer] Error editing line: ${error}`);
    }
}

/**
 * Handle remove line request
 */
async function handleRemoveLine(
    specDirectory: string,
    lineNum: number,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
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
            deps.outputChannel.appendLine(`[SpecViewer] Removed line ${lineNum}`);
        }
    } catch (error) {
        deps.outputChannel.appendLine(`[SpecViewer] Error removing line: ${error}`);
    }
}

/**
 * Handle checkbox toggle request - updates [ ] to [x] or vice versa
 */
async function handleToggleCheckbox(
    specDirectory: string,
    lineNum: number,
    checked: boolean,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
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
                deps.outputChannel.appendLine(`[SpecViewer] Toggled checkbox on line ${lineNum} to ${checked ? 'checked' : 'unchecked'}`);
            }
        }
    } catch (error) {
        deps.outputChannel.appendLine(`[SpecViewer] Error toggling checkbox: ${error}`);
    }
}
