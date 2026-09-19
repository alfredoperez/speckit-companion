import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { convertPathIfWSL } from './pathUtils';

/**
 * Create a temporary file with content in the extension's global storage.
 * @param context - Extension context for storage path
 * @param content - File content to write
 * @param prefix - Filename prefix (e.g., 'prompt', 'background-prompt')
 * @param convertWSL - Whether to convert the path for WSL environments (default: false)
 * @returns The file path (WSL-converted if requested)
 */
export async function createTempFile(
    context: vscode.ExtensionContext,
    content: string,
    prefix: string = 'prompt',
    convertWSL: boolean = false
): Promise<string> {
    const tempDir = context.globalStorageUri.fsPath;
    await vscode.workspace.fs.createDirectory(context.globalStorageUri);

    const tempFile = path.join(tempDir, `${prefix}-${Date.now()}.md`);
    await fs.promises.writeFile(tempFile, content);

    return convertWSL ? convertPathIfWSL(tempFile) : tempFile;
}
