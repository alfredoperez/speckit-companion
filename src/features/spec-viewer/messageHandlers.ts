/**
 * SpecKit Companion - Message Handlers
 * Handles messages from the webview
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
    SpecViewerState,
    ViewerToExtensionMessage,
    DocumentType,
} from './types';
import { ConfigKeys } from '../../core/constants';
import { NotificationUtils } from '../../core/utils/notificationUtils';
import type { CustomCommandConfig } from '../../core/types/config';
import type { WorkflowStepConfig } from '../workflows/types';
import { getAIProvider } from '../../extension';

/**
 * Interface for message handler dependencies
 */
export interface MessageHandlerDependencies {
    getInstance: (specDirectory: string) => { state: SpecViewerState; debounceTimer: NodeJS.Timeout | undefined } | undefined;
    updateContent: (specDirectory: string, documentType: DocumentType) => Promise<void>;
    sendContentUpdateMessage: (specDirectory: string, documentType: DocumentType) => Promise<void>;
    resolveWorkflowSteps: (specDirectory: string) => Promise<WorkflowStepConfig[]>;
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
                await handleClarify(specDirectory, deps, message.command);
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
            case 'submitRefinements':
                await handleSubmitRefinements(specDirectory, message.refinements, deps);
                break;
            case 'openFile':
                await handleOpenFile(message.filename, deps);
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
    phase: string,
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
    const steps = await deps.resolveWorkflowSteps(specDirectory);
    const currentStep = steps.find(s => s.name === docType);

    if (currentStep) {
        executeStepInTerminal(currentStep, specDirectory, deps);
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
    const steps = await deps.resolveWorkflowSteps(specDirectory);
    // Filter out actionOnly steps for navigation purposes
    const navSteps = steps.filter(s => !s.actionOnly);
    let currentIndex = navSteps.findIndex(s => s.name === docType);
    if (currentIndex < 0) {
        // Viewing a related doc — resolve parent step
        const relatedDoc = instance.state.availableDocuments.find(
            d => d.type === docType && d.category === 'related'
        );
        if (relatedDoc?.parentStep) {
            currentIndex = navSteps.findIndex(s => s.name === relatedDoc.parentStep);
        }
    }

    if (currentIndex >= 0 && currentIndex < navSteps.length - 1) {
        // Execute next step's command
        const nextStep = navSteps[currentIndex + 1];
        executeStepInTerminal(nextStep, specDirectory, deps);
    } else if (currentIndex === navSteps.length - 1) {
        // Last navigable step: find the actionOnly implement step
        const implementStep = steps.find(s => s.actionOnly);
        if (implementStep) {
            executeStepInTerminal(implementStep, specDirectory, deps);
        }
    }
}

/**
 * Execute a workflow step command in the terminal.
 * Uses changeRoot (if available) as the path argument so commands receive
 * the change root, not the nested spec dir.
 */
function executeStepInTerminal(
    step: WorkflowStepConfig,
    specDirectory: string,
    deps: MessageHandlerDependencies
): void {
    const instance = deps.getInstance(specDirectory);
    const targetPath = instance?.state.changeRoot || specDirectory;
    const label = step.label || step.name;
    const prompt = `/${step.command} ${targetPath}`;
    deps.outputChannel.appendLine(`[SpecViewer] Executing step "${label}": ${prompt}`);
    getAIProvider().executeInTerminal(prompt, `SpecKit - ${label}`);
}

/**
 * Handle clarify/enhancement button - executes the matching customCommand in the AI terminal
 */
async function handleClarify(
    specDirectory: string,
    deps: MessageHandlerDependencies,
    buttonCommand?: string
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
    if (!instance) return;

    const docType = instance.state.currentDocument;

    const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
    const rawCommands = config.get<Array<CustomCommandConfig | string>>('customCommands', []);

    // Find the matching command - prefer exact match from button, fall back to first match for step
    for (const entry of rawCommands) {
        if (typeof entry === 'string') continue;

        const command = entry.command || (entry.name ? `/speckit.${entry.name}` : undefined);
        if (!command) continue;

        // If button sent a specific command, match it; otherwise match by step
        if (buttonCommand) {
            if (command !== buttonCommand) continue;
        } else {
            const step = entry.step || 'all';
            if (step !== docType && step !== 'all') continue;
        }

        const targetPath = instance.state.changeRoot || specDirectory;
        const label = entry.title || entry.name || 'Enhancement';
        const prompt = `${command} "${targetPath}"`;
        deps.outputChannel.appendLine(`[SpecViewer] Executing enhancement command: ${prompt}`);
        getAIProvider().executeInTerminal(prompt, `SpecKit - ${label}`);
        return;
    }

    deps.outputChannel.appendLine(`[SpecViewer] No custom command configured for step: ${docType}`);
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
    NotificationUtils.showStatusBarMessage(`$(sync~spin) Refining line ${lineNum}...`);
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

/**
 * Handle open file request from a file reference click
 */
async function handleOpenFile(
    filename: string,
    deps: MessageHandlerDependencies
): Promise<void> {
    const basename = path.basename(filename);
    const results = await vscode.workspace.findFiles(`**/${basename}`, null, 1);
    if (results.length === 0) {
        vscode.window.showWarningMessage(`File not found in workspace: ${basename}`);
        return;
    }
    try {
        const doc = await vscode.workspace.openTextDocument(results[0]);
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
        deps.outputChannel.appendLine(`[SpecViewer] Opened file ref: ${results[0].fsPath}`);
    } catch (error) {
        deps.outputChannel.appendLine(`[SpecViewer] Error opening file ref: ${error}`);
    }
}

/**
 * Handle submit refinements - run current phase command with refinement context
 */
async function handleSubmitRefinements(
    specDirectory: string,
    refinements: Array<{ lineNum: number; lineContent: string; comment: string }>,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
    if (!instance) return;

    const docType = instance.state.currentDocument;

    // Format refinements as context string
    const refinementText = refinements
        .map(r => `- Line ${r.lineNum} ("${r.lineContent.slice(0, 50)}${r.lineContent.length > 50 ? '...' : ''}"): ${r.comment}`)
        .join('\n');

    const context = `\n\nRefinements requested:\n${refinementText}`;

    // Determine command from workflow steps
    const steps = await deps.resolveWorkflowSteps(specDirectory);
    const currentStep = steps.find(s => s.name === docType);

    if (currentStep) {
        const targetPath = instance.state.changeRoot || specDirectory;
        const label = currentStep.label || currentStep.name;
        const prompt = `/${currentStep.command} ${targetPath}${context}`;
        deps.outputChannel.appendLine(`[SpecViewer] Submitting ${refinements.length} refinements for ${docType}`);
        getAIProvider().executeInTerminal(prompt, `SpecKit - Refine ${label}`);
    } else {
        deps.outputChannel.appendLine(`[SpecViewer] No workflow step found for: ${docType}`);
    }
}
