import * as vscode from 'vscode';
import { IAIProvider } from '../../ai-providers/aiProvider';

/**
 * Register workflow editor action commands
 */
export function registerWorkflowEditorCommands(
    context: vscode.ExtensionContext,
    aiProvider: IAIProvider,
    outputChannel: vscode.OutputChannel
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.workflowEditor.refineSection',
            async (uri: vscode.Uri, sectionId: string, prompt: string) => {
                outputChannel.appendLine(`[WorkflowEditor] Refine section command: ${sectionId}`);
                await aiProvider.executeInTerminal(prompt, 'Refining Section');
            }
        ),

        vscode.commands.registerCommand('speckit.workflowEditor.removeSection',
            async (uri: vscode.Uri, sectionId: string) => {
                outputChannel.appendLine(`[WorkflowEditor] Remove section command: ${sectionId}`);
            }
        ),

        vscode.commands.registerCommand('speckit.workflowEditor.addUserStory',
            async (uri: vscode.Uri) => {
                outputChannel.appendLine(`[WorkflowEditor] Add user story command`);
            }
        ),

        vscode.commands.registerCommand('speckit.workflowEditor.approveAndContinue',
            async (uri: vscode.Uri) => {
                outputChannel.appendLine(`[WorkflowEditor] Approve and continue command`);
            }
        ),

        vscode.commands.registerCommand('speckit.workflowEditor.regenerate',
            async (uri: vscode.Uri) => {
                outputChannel.appendLine(`[WorkflowEditor] Regenerate command`);
            }
        ),

        vscode.commands.registerCommand('speckit.workflowEditor.navigateToPhase',
            async (uri: vscode.Uri, phase: string) => {
                outputChannel.appendLine(`[WorkflowEditor] Navigate to phase command: ${phase}`);
            }
        ),

        vscode.commands.registerCommand('speckit.workflowEditor.editSource',
            async (uri: vscode.Uri) => {
                outputChannel.appendLine(`[WorkflowEditor] Edit source command`);
            }
        )
    );
}
