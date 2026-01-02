import * as vscode from 'vscode';
import * as path from 'path';

export interface FileOpenOptions {
    retries?: number;
    retryDelayMs?: number;
    editorId?: string;
    outputChannel?: vscode.OutputChannel;
}

const DEFAULT_OPTIONS = {
    retries: 3,
    retryDelayMs: 100,
    editorId: 'speckit.workflowEditor'
};

/**
 * Delay utility for retry logic
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate that a file exists and is accessible
 */
export async function validateFileExists(
    uri: vscode.Uri,
    outputChannel?: vscode.OutputChannel
): Promise<boolean> {
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        outputChannel?.appendLine(`[FileOpener] File validated: ${uri.fsPath} (${stat.size} bytes)`);
        return true;
    } catch (error) {
        outputChannel?.appendLine(`[FileOpener] File validation failed: ${uri.fsPath} - ${error}`);
        return false;
    }
}

/**
 * Open a file with retry logic and proper error handling
 */
export async function openFileWithRetry(
    uri: vscode.Uri,
    options: FileOpenOptions = {}
): Promise<boolean> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const { retries, retryDelayMs, editorId, outputChannel } = opts;

    for (let attempt = 1; attempt <= retries; attempt++) {
        outputChannel?.appendLine(`[FileOpener] Attempt ${attempt}/${retries} to open: ${uri.fsPath}`);

        // Validate file exists before each attempt
        const exists = await validateFileExists(uri, outputChannel);
        if (!exists) {
            outputChannel?.appendLine(`[FileOpener] File not found, waiting ${retryDelayMs! * attempt}ms before retry...`);
            if (attempt < retries) {
                await delay(retryDelayMs! * attempt); // Exponential backoff
            }
            continue;
        }

        try {
            await vscode.commands.executeCommand('vscode.openWith', uri, editorId);
            outputChannel?.appendLine(`[FileOpener] Successfully opened: ${uri.fsPath}`);
            return true;
        } catch (error) {
            outputChannel?.appendLine(`[FileOpener] Error on attempt ${attempt}: ${error}`);

            if (attempt < retries) {
                await delay(retryDelayMs! * attempt);
            }
        }
    }

    outputChannel?.appendLine(`[FileOpener] Failed to open after ${retries} attempts: ${uri.fsPath}`);
    return false;
}

/**
 * Open a spec file with user feedback on failure
 */
export async function openSpecFile(
    filePath: string,
    options: FileOpenOptions = {}
): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    const success = await openFileWithRetry(uri, options);

    if (!success) {
        const fileName = path.basename(filePath);
        const action = await vscode.window.showErrorMessage(
            `Unable to open file: ${fileName}. The file may not exist or is temporarily inaccessible.`,
            'Retry',
            'Open in Text Editor'
        );

        if (action === 'Retry') {
            await openSpecFile(filePath, options);
        } else if (action === 'Open in Text Editor') {
            try {
                await vscode.commands.executeCommand('vscode.open', uri);
            } catch {
                vscode.window.showErrorMessage(`File not found: ${filePath}`);
            }
        }
    }
}
