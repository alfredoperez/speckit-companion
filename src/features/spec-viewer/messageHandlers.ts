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
import { SPEC_CONTEXT_FILENAME } from '../specs/specContextReader';
import { extractBlock } from './extractBlock';
import { ConfigKeys, SpecStatuses, FooterActionIds } from '../../core/constants';
import { NotificationUtils } from '../../core/utils/notificationUtils';
import type { CustomCommandConfig } from '../../core/types/config';
import type { WorkflowStepConfig } from '../workflows/types';
import { getFeatureWorkflow, getWorkflowCommands } from '../workflows';
import { setStatus, reactivate, startStep, completeStep } from '../specs/stepLifecycle';
import type { StepName } from '../../core/types/specContext';
import { formatCommandForProvider } from '../../ai-providers/aiProvider';
import { buildPrompt, buildLifecyclePrompt } from '../../ai-providers/promptBuilder';

/**
 * Interface for message handler dependencies
 */
export interface MessageHandlerDependencies {
    getInstance: (specDirectory: string) => { state: SpecViewerState; debounceTimer: NodeJS.Timeout | undefined } | undefined;
    updateContent: (specDirectory: string, documentType: DocumentType) => Promise<void>;
    sendContentUpdateMessage: (specDirectory: string, documentType: DocumentType) => Promise<void>;
    refreshContextIfDisplaying: (specContextPath: string) => Promise<void>;
    resolveWorkflowSteps: (specDirectory: string) => Promise<WorkflowStepConfig[]>;
    executeInTerminal: (prompt: string) => Promise<void>;
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
                // Push viewerState (incl. transitions) — initial HTML hydrates
                // navState and markdown, but viewerState only flows via message.
                await deps.refreshContextIfDisplaying(
                    path.join(specDirectory, SPEC_CONTEXT_FILENAME),
                );
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
            case 'completeSpec':
                await handleLifecycleAction(specDirectory, SpecStatuses.COMPLETED, deps);
                break;
            case 'archiveSpec':
                await handleLifecycleAction(specDirectory, SpecStatuses.ARCHIVED, deps);
                break;
            case 'reactivateSpec':
                await handleLifecycleAction(specDirectory, SpecStatuses.ACTIVE, deps);
                break;
            case 'openFile':
                await handleOpenFile(message.filename, deps);
                break;
            case 'webviewError':
                deps.outputChannel.appendLine(
                    `[SpecViewer] Webview error (${message.source}): ${message.message}` +
                    (message.stack ? `\n${message.stack}` : ''),
                );
                break;
            case 'footerAction':
                switch (message.id) {
                    case FooterActionIds.ARCHIVE:
                        await handleLifecycleAction(specDirectory, SpecStatuses.ARCHIVED, deps);
                        break;
                    case FooterActionIds.REACTIVATE:
                        await handleLifecycleAction(specDirectory, SpecStatuses.ACTIVE, deps);
                        break;
                    case FooterActionIds.COMPLETE:
                        await handleLifecycleAction(specDirectory, SpecStatuses.COMPLETED, deps);
                        break;
                    case FooterActionIds.REGENERATE:
                        await handleRegenerate(specDirectory, deps);
                        break;
                    case FooterActionIds.APPROVE:
                    case FooterActionIds.START:
                        await handleApprove(specDirectory, deps);
                        break;
                    case FooterActionIds.SDD_AUTO:
                        await handleClarify(specDirectory, deps, '/sdd:auto');
                        break;
                    default:
                        deps.outputChannel.appendLine(`[SpecViewer] Unknown footerAction id: ${message.id}`);
                }
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

    // Full regeneration — matches sidebar navigation's appearance.
    await deps.updateContent(specDirectory, phase);
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
        if (isLifecycleStep(docType)) {
            await startStep(specDirectory, docType as StepName, 'extension');
        }
        await deps.updateContent(specDirectory, instance.state.currentDocument);
        await executeStepInTerminal(currentStep, specDirectory, deps);
    }
}

const LIFECYCLE_STEP_NAMES: ReadonlySet<string> = new Set([
    'specify',
    'clarify',
    'plan',
    'tasks',
    'analyze',
    'implement',
]);

function isLifecycleStep(name: string): boolean {
    return LIFECYCLE_STEP_NAMES.has(name);
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

    // Mark the currently-viewed step as completed (independent of AI cooperation).
    if (isLifecycleStep(docType)) {
        await completeStep(specDirectory, docType as StepName, 'extension');
    }

    if (currentIndex >= 0 && currentIndex < navSteps.length - 1) {
        // Execute next step's command
        const nextStep = navSteps[currentIndex + 1];
        if (isLifecycleStep(nextStep.name)) {
            await startStep(specDirectory, nextStep.name as StepName, 'extension');
        }
        await deps.updateContent(specDirectory, instance.state.currentDocument);
        await executeStepInTerminal(nextStep, specDirectory, deps);
    } else if (currentIndex === navSteps.length - 1) {
        // Last navigable step: find the actionOnly implement step
        const implementStep = steps.find(s => s.actionOnly);
        if (implementStep) {
            if (isLifecycleStep(implementStep.name)) {
                await startStep(specDirectory, implementStep.name as StepName, 'extension');
            }
            await deps.updateContent(specDirectory, instance.state.currentDocument);
            await executeStepInTerminal(implementStep, specDirectory, deps);
        }
    }
}

/**
 * Execute a workflow step command in a VS Code terminal.
 * Uses changeRoot (if available) as the path argument so commands receive
 * the change root, not the nested spec dir.
 */
async function executeStepInTerminal(
    step: WorkflowStepConfig,
    specDirectory: string,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
    const targetPath = instance?.state.changeRoot || specDirectory;
    const label = step.label || step.name;
    const formatted = formatCommandForProvider(step.command);
    const rawPrompt = `/${formatted} ${targetPath}`;
    const prompt = buildPrompt({ command: rawPrompt, step: step.name, specDir: targetPath });
    deps.outputChannel.appendLine(`[SpecViewer] Executing step "${label}": ${rawPrompt}`);
    await deps.executeInTerminal(prompt);
}

/**
 * Handle lifecycle action (complete or archive a spec)
 */
async function handleLifecycleAction(
    specDirectory: string,
    status: typeof SpecStatuses.COMPLETED | typeof SpecStatuses.ARCHIVED | typeof SpecStatuses.ACTIVE,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
    if (!instance) return;

    const label = status === SpecStatuses.ACTIVE ? 'reactivated' : status;
    deps.outputChannel.appendLine(`[SpecViewer] Setting spec status to ${status}: ${specDirectory}`);

    if (status === SpecStatuses.ACTIVE) {
        await reactivate(specDirectory);
    } else {
        await setStatus(specDirectory, status as 'completed' | 'archived');
    }
    await vscode.commands.executeCommand('speckit.refresh');
    await deps.updateContent(specDirectory, instance.state.currentDocument);

    NotificationUtils.showAutoDismissNotification(`Spec "${instance.state.specName}" marked as ${label}`);
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
        const rawPrompt = `${command} "${targetPath}"`;
        const isMultiStep = command.includes(':auto');
        const prompt = isMultiStep ? buildLifecyclePrompt(rawPrompt, targetPath) : rawPrompt;
        deps.outputChannel.appendLine(`[SpecViewer] Executing enhancement command "${label}": ${rawPrompt}`);
        await deps.executeInTerminal(prompt);
        return;
    }

    // Fall back to workflow commands
    const featureCtx = await getFeatureWorkflow(specDirectory, instance.state.changeRoot);
    if (featureCtx?.workflow) {
        for (const wfCmd of getWorkflowCommands(featureCtx.workflow)) {
            if (!wfCmd.command) continue;

            if (buttonCommand) {
                if (wfCmd.command !== buttonCommand) continue;
            } else {
                const step = wfCmd.step || 'all';
                if (step !== docType && step !== 'all') continue;
            }

            const targetPath = instance.state.changeRoot || specDirectory;
            const label = wfCmd.title || wfCmd.name || 'Enhancement';
            const rawPrompt = `${wfCmd.command} "${targetPath}"`;
            const isMultiStep = wfCmd.command.includes(':auto');
            const prompt = isMultiStep ? buildLifecyclePrompt(rawPrompt, targetPath) : rawPrompt;
            deps.outputChannel.appendLine(`[SpecViewer] Executing workflow command "${label}": ${rawPrompt}`);
            await deps.executeInTerminal(prompt);
            return;
        }
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
 * Dispatch inline-comment batches as a direct-edit prompt to the AI and
 * append the same batch to the matching scratchpad file as history.
 *
 * Never invoke a per-step slash command (e.g. /speckit.plan) — those re-run
 * setup scripts that overwrite the source from a template (issue #153).
 */
async function handleSubmitRefinements(
    specDirectory: string,
    refinements: Array<{ lineNum: number; lineContent: string; comment: string }>,
    deps: MessageHandlerDependencies
): Promise<void> {
    const instance = deps.getInstance(specDirectory);
    if (!instance) return;

    const docType = instance.state.currentDocument;
    const filename = `${docType}.md`;
    const targetPath = instance.state.changeRoot || specDirectory;

    // Read the source markdown so each refinement can be enriched with its
    // surrounding block (paragraph or list item) and nearest preceding heading.
    // Falls back to the passed-in single line if the source can't be read.
    const sourceDoc = instance.state.availableDocuments.find(
        d => d.isCore && d.type === docType,
    );
    let sourceLines: string[] | null = null;
    if (sourceDoc) {
        try {
            const data = await vscode.workspace.fs.readFile(vscode.Uri.file(sourceDoc.filePath));
            sourceLines = Buffer.from(data).toString('utf-8').split('\n');
        } catch {
            sourceLines = null;
        }
    }

    interface Enriched {
        lineNum: number;
        comment: string;
        heading: string | null;
        startLine: number;
        endLine: number;
        block: string;
    }
    const enriched: Enriched[] = refinements.map(r => {
        if (sourceLines) {
            const block = extractBlock(sourceLines, r.lineNum);
            if (block) {
                return {
                    lineNum: r.lineNum,
                    comment: r.comment,
                    heading: block.heading,
                    startLine: block.startLine,
                    endLine: block.endLine,
                    block: block.text,
                };
            }
        }
        return {
            lineNum: r.lineNum,
            comment: r.comment,
            heading: null,
            startLine: r.lineNum,
            endLine: r.lineNum,
            block: r.lineContent,
        };
    });

    const blockquote = (text: string) =>
        text.split('\n').map(l => `> ${l}`).join('\n');

    const formatRefinement = (r: Enriched, mode: 'prompt' | 'scratchpad'): string => {
        if (mode === 'prompt') {
            const range = r.startLine === r.endLine
                ? `Line ${r.lineNum}`
                : `Line ${r.lineNum} (block lines ${r.startLine}–${r.endLine})`;
            const where = r.heading ? `${range} in section "${r.heading}"` : range;
            const indented = blockquote(r.block).replace(/^/gm, '  ');
            return `- ${where}: ${r.comment}\n${indented}`;
        }
        const label = r.heading
            ? `Line ${r.lineNum} · ${r.heading}`
            : `Line ${r.lineNum}`;
        return [
            `### ${label}`,
            '',
            '**Original**',
            '',
            blockquote(r.block),
            '',
            '**Comment**',
            '',
            r.comment,
        ].join('\n');
    };

    const promptRefinementText = enriched
        .map(r => formatRefinement(r, 'prompt'))
        .join('\n\n');
    const scratchpadRefinementText = enriched
        .map(r => formatRefinement(r, 'scratchpad'))
        .join('\n\n');

    // Persist this batch to the matching scratchpad file. Synthesis emits one
    // scratchpad entry per existing core source doc, so when one matches the
    // current docType we append; otherwise we skip persistence and just
    // dispatch the AI prompt.
    const scratchpad = instance.state.availableDocuments.find(
        d => d.isScratchpad && d.scratchpadFor === docType,
    );
    if (scratchpad) {
        let existing = '';
        let wasFirstWrite = false;
        try {
            const data = await vscode.workspace.fs.readFile(vscode.Uri.file(scratchpad.filePath));
            existing = Buffer.from(data).toString('utf-8');
        } catch {
            wasFirstWrite = true;
        }
        try {
            const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
            const heading = `## Refinement batch · ${stamp} UTC`;
            // Newest batch on top — reads like a review feed. Earlier history
            // sits below a horizontal rule.
            const trimmedExisting = existing.replace(/^\s+|\s+$/g, '');
            const next = trimmedExisting
                ? `${heading}\n\n${scratchpadRefinementText}\n\n---\n\n${trimmedExisting}\n`
                : `${heading}\n\n${scratchpadRefinementText}\n`;
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(scratchpad.filePath),
                Buffer.from(next, 'utf-8'),
            );
            deps.outputChannel.appendLine(
                `[SpecViewer] Appended ${refinements.length} refinement(s) to ${scratchpad.fileName}`,
            );
            // First write needs an explicit re-scan so the chip appears
            // without waiting on the file watcher.
            if (wasFirstWrite) {
                await deps.updateContent(specDirectory, instance.state.currentDocument);
            }
        } catch (error) {
            deps.outputChannel.appendLine(`[SpecViewer] Error appending to scratchpad: ${error}`);
        }
    }

    const prompt = [
        `Edit ${targetPath}/${filename} in place to apply ONLY these line-specific refinements.`,
        `DO NOT regenerate from any template.`,
        `DO NOT run any setup script (e.g. setup-spec.sh, setup-plan.sh, setup-tasks.sh).`,
        `DO NOT replace the file — make targeted edits only.`,
        ``,
        `Refinements requested:`,
        promptRefinementText,
    ].join('\n');

    deps.outputChannel.appendLine(`[SpecViewer] Submitting ${refinements.length} refinements for ${docType} (direct edit)`);
    await deps.executeInTerminal(prompt);
}

