import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { SpecInfo } from '../../../core/types';
import { parseSpecInfo } from './specInfoParser';

/**
 * Action handlers for the workflow editor
 */
export class WorkflowActionHandlers {
    constructor(private readonly outputChannel: vscode.OutputChannel) {}

    /**
     * Open document in default text editor
     */
    async editSource(document: vscode.TextDocument): Promise<void> {
        this.outputChannel.appendLine(`[WorkflowEditor] Edit source: ${document.fileName}`);
        await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
    }

    /**
     * Switch to a different document in the same spec folder
     */
    async switchToDocument(currentDocument: vscode.TextDocument, fileName: string): Promise<void> {
        const specInfo = parseSpecInfo(currentDocument);
        const targetPath = path.join(specInfo.specDir, fileName);
        const targetUri = vscode.Uri.file(targetPath);

        if (fs.existsSync(targetPath)) {
            await vscode.commands.executeCommand('vscode.openWith', targetUri, 'speckit.workflowEditor');
        }
    }

    /**
     * Run contextual enhancement command (Clarify, Checklist, Analyze)
     */
    async runEnhancementCommand(document: vscode.TextDocument, command: string): Promise<void> {
        this.outputChannel.appendLine(`[WorkflowEditor] Enhancement command: ${command}`);

        const specInfo = parseSpecInfo(document);
        await vscode.commands.executeCommand(`speckit.${command}`, specInfo.specDir);
    }

    /**
     * Refine a specific line with Claude
     */
    async refineLine(
        document: vscode.TextDocument,
        lineNum: number,
        content: string,
        instruction: string
    ): Promise<void> {
        this.outputChannel.appendLine(`[WorkflowEditor] Refine line ${lineNum}: ${instruction}`);

        const prompt = `Please refine the following line from my spec document.

**Line ${lineNum + 1}:**
${content}

**Refinement request:**
${instruction}

Please provide an improved version of this line that:
1. Addresses the refinement request
2. Is clear and specific
3. Fits the context of a specification document

Spec file: ${document.fileName}`;

        await vscode.commands.executeCommand('speckit.workflowEditor.refineLine', document.uri, lineNum, prompt);
    }

    /**
     * Remove a line from the document (immediate, no confirmation)
     */
    async removeLine(document: vscode.TextDocument, lineNum: number): Promise<void> {
        this.outputChannel.appendLine(`[WorkflowEditor] Remove line: ${lineNum}`);

        const text = document.getText();
        const lines = text.split('\n');

        if (lineNum < 0 || lineNum >= lines.length) {
            this.outputChannel.appendLine(`[WorkflowEditor] Invalid line number: ${lineNum}`);
            return;
        }

        // Remove the line
        lines.splice(lineNum, 1);

        // Apply edit
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
        );
        edit.replace(document.uri, fullRange, lines.join('\n'));
        await vscode.workspace.applyEdit(edit);
    }

    /**
     * Approve current phase and navigate to next
     */
    async approveAndContinue(document: vscode.TextDocument): Promise<void> {
        this.outputChannel.appendLine(`[WorkflowEditor] Approve and continue`);

        const specInfo = parseSpecInfo(document);
        const nextPhase = specInfo.currentPhase < 3 ? specInfo.currentPhase + 1 : 3;

        // Determine next file (SpecKit format)
        const nextFileName = nextPhase === 2 ? 'plan.md' : 'tasks.md';

        const nextFilePath = path.join(specInfo.specDir, nextFileName);
        const nextFileUri = vscode.Uri.file(nextFilePath);

        // Check if next file exists
        if (fs.existsSync(nextFilePath)) {
            // Open with the workflow editor
            await vscode.commands.executeCommand('vscode.openWith', nextFileUri, 'speckit.workflowEditor');
        } else {
            // Generate immediately without confirmation
            await this.generateContent(document, nextPhase === 2 ? 'plan' : 'tasks');
        }
    }

    /**
     * Regenerate the current document
     */
    async regenerateDocument(document: vscode.TextDocument): Promise<void> {
        this.outputChannel.appendLine(`[WorkflowEditor] Regenerate document`);

        const specInfo = parseSpecInfo(document);
        let command: string;

        if (specInfo.currentPhase === 1) {
            command = 'specify';
        } else if (specInfo.currentPhase === 2) {
            command = 'plan';
        } else {
            command = 'tasks';
        }

        await this.generateContent(document, command);
    }

    /**
     * Navigate to a different phase document
     */
    async navigateToPhase(document: vscode.TextDocument, phase: string): Promise<void> {
        this.outputChannel.appendLine(`[WorkflowEditor] Navigate to phase: ${phase}`);

        const specInfo = parseSpecInfo(document);

        // SpecKit format file names
        const fileName = phase === 'spec' ? 'spec.md' :
                        phase === 'plan' ? 'plan.md' : 'tasks.md';

        const filePath = path.join(specInfo.specDir, fileName);
        const fileUri = vscode.Uri.file(filePath);

        try {
            // Check if file exists
            await vscode.workspace.fs.stat(fileUri);
            // Open with the workflow editor
            await vscode.commands.executeCommand('vscode.openWith', fileUri, 'speckit.workflowEditor');
        } catch (error) {
            vscode.window.showWarningMessage(`${fileName} does not exist yet.`);
        }
    }

    /**
     * Generate content using Claude
     */
    async generateContent(document: vscode.TextDocument, command: string): Promise<void> {
        this.outputChannel.appendLine(`[WorkflowEditor] Generate content: ${command}`);

        const specInfo = parseSpecInfo(document);
        await vscode.commands.executeCommand(`speckit.${command}`, specInfo.specDir);
    }
}
