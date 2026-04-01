import * as vscode from 'vscode';
import { NotificationUtils } from './notificationUtils';

/**
 * Check if a CLI tool is installed and show a helpful error if not.
 * @param cliName - Display name of the CLI (e.g., 'Gemini CLI')
 * @param installCommand - Command to install the CLI (e.g., 'npm install -g @google/gemini-cli')
 * @param checkCommand - Command to check if CLI is installed (e.g., 'gemini --version')
 * @param outputChannel - Output channel for logging
 * @returns true if installed, throws if not
 */
export async function ensureCliInstalled(
    cliName: string,
    installCommand: string,
    checkCommand: string,
    outputChannel: vscode.OutputChannel
): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
        await execAsync(checkCommand);
    } catch {
        const action = await vscode.window.showErrorMessage(
            `${cliName} is not installed. Install it with: ${installCommand}`,
            'Copy Install Command'
        );
        if (action === 'Copy Install Command') {
            await vscode.env.clipboard.writeText(installCommand);
            NotificationUtils.showStatusBarMessage('$(check) Install command copied to clipboard');
        }
        throw new Error(`${cliName} is not installed`);
    }
}
