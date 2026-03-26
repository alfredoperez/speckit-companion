import * as vscode from 'vscode';
import { UpdateChecker } from './updateChecker';

/**
 * Register utility commands (settings, updates)
 */
export function registerUtilityCommands(
    context: vscode.ExtensionContext,
    updateChecker: UpdateChecker,
    outputChannel: vscode.OutputChannel
): void {
    // Update checker command
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.checkForUpdates', async () => {
            outputChannel.appendLine('Manual update check requested');
            await updateChecker.checkForUpdates(true);
        })
    );

    // Settings command
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.settings.open', async () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'speckit');
        })
    );

    // Feedback commands
    const FEEDBACK_URLS = {
        bugReport: 'https://github.com/alfredoperez/speckit-companion/issues/new?template=bug_report.md',
        featureRequest: 'https://github.com/alfredoperez/speckit-companion/issues/new?labels=enhancement&template=feature_request.md',
        review: 'https://marketplace.visualstudio.com/items?itemName=alfredoperez.speckit-companion&ssr=false#review-details',
    } as const;

    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.feedback.bugReport', async () => {
            await vscode.env.openExternal(vscode.Uri.parse(FEEDBACK_URLS.bugReport));
        }),
        vscode.commands.registerCommand('speckit.feedback.featureRequest', async () => {
            await vscode.env.openExternal(vscode.Uri.parse(FEEDBACK_URLS.featureRequest));
        }),
        vscode.commands.registerCommand('speckit.feedback.review', async () => {
            await vscode.env.openExternal(vscode.Uri.parse(FEEDBACK_URLS.review));
        })
    );
}
