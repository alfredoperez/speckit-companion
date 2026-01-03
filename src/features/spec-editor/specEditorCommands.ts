import * as vscode from 'vscode';
import { SpecEditorProvider } from './specEditorProvider';
import { TempFileManager } from './tempFileManager';
import { SpecDraftManager } from './specDraftManager';

/**
 * Register spec editor commands and initialize managers
 */
export function registerSpecEditorCommands(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): void {
    // Initialize managers
    const tempFileManager = new TempFileManager(context);
    const draftManager = new SpecDraftManager(context);

    // Create provider instance
    const provider = new SpecEditorProvider(
        context,
        outputChannel,
        tempFileManager,
        draftManager
    );

    // Register open spec editor command
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.openSpecEditor', () => {
            provider.show();
        })
    );

    // Cleanup orphaned files on activation
    tempFileManager.cleanupOrphanedFiles().then(orphans => {
        if (orphans.length > 0) {
            outputChannel.appendLine(
                `[SpecEditor] Cleaned up ${orphans.length} orphaned temp file(s)`
            );
        }
    });

    // Cleanup old drafts on activation
    draftManager.cleanupOldDrafts().then(drafts => {
        if (drafts.length > 0) {
            outputChannel.appendLine(
                `[SpecEditor] Cleaned up ${drafts.length} old draft(s)`
            );
        }
    });

    outputChannel.appendLine('[SpecEditor] Commands registered');
}
