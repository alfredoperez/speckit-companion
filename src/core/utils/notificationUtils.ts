import * as vscode from 'vscode';

/**
 * Utility class for displaying notifications
 */
export class NotificationUtils {
    /**
     * Show a notification that automatically dismisses after a specified duration
     * @param message - The message to display
     * @param durationMs - Duration in milliseconds (default: 3000ms)
     */
    static async showAutoDismissNotification(message: string, durationMs: number = 3000): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: message,
            cancellable: false
        }, async () => {
            await new Promise(resolve => setTimeout(resolve, durationMs));
        });
    }

    /**
     * Show an error notification
     * @param message - The error message to display
     */
    static showError(message: string): void {
        vscode.window.showErrorMessage(message);
    }

    /**
     * Show a warning notification
     * @param message - The warning message to display
     */
    static showWarning(message: string): void {
        vscode.window.showWarningMessage(message);
    }

    /**
     * Show an information notification (standard, doesn't auto-dismiss)
     * @param message - The information message to display
     */
    static showInfo(message: string): void {
        vscode.window.showInformationMessage(message);
    }

    /**
     * Show a phase completion notification with action to open the tasks file
     * @param specName - Name of the spec (e.g., "remove-invoice-filters")
     * @param phaseName - Name of the completed phase (e.g., "Foundational")
     * @param tasksFilePath - Path to the tasks.md file
     */
    static async showPhaseCompleteNotification(
        specName: string,
        phaseName: string,
        tasksFilePath: string
    ): Promise<void> {
        const action = await vscode.window.showInformationMessage(
            `Phase "${phaseName}" completed in ${specName}`,
            'Open Tasks'
        );

        if (action === 'Open Tasks') {
            const uri = vscode.Uri.file(tasksFilePath);
            await vscode.commands.executeCommand('vscode.open', uri);
        }
    }
}