/**
 * SpecKit Companion - Document Scanner
 * Scans spec directories for available documents
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
    SpecDocument,
    CoreDocumentType,
    CORE_DOCUMENT_FILES,
    CORE_DOCUMENT_DISPLAY_NAMES
} from './types';
import { fileNameToDocType, fileNameToDisplayName } from './utils';

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
        return true;
    } catch {
        return false;
    }
}

/**
 * Convert nested file path to display name
 * e.g., "contracts/webview-messages.md" -> "Contracts: Webview Messages"
 */
function nestedFileToDisplayName(relativePath: string): string {
    const parts = relativePath.replace(/\.md$/i, '').split('/');
    return parts
        .map(part => part.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase()))
        .join(': ');
}

/**
 * Convert nested file path to document type
 * e.g., "contracts/webview-messages.md" -> "contracts/webview-messages"
 */
function nestedFileToDocType(relativePath: string): string {
    return relativePath.replace(/\.md$/i, '').toLowerCase();
}

/**
 * Recursively scan a directory for .md files
 */
async function scanDirectoryRecursive(
    dirPath: string,
    basePath: string,
    outputChannel: vscode.OutputChannel
): Promise<{ relativePath: string; fullPath: string }[]> {
    const results: { relativePath: string; fullPath: string }[] = [];

    try {
        const uri = vscode.Uri.file(dirPath);
        const entries = await vscode.workspace.fs.readDirectory(uri);

        for (const [name, fileType] of entries) {
            const fullPath = path.join(dirPath, name);
            const relativePath = path.relative(basePath, fullPath);

            // Skip hidden directories and special folders
            if (name.startsWith('.') || name === 'checklists') {
                continue;
            }

            if (fileType === vscode.FileType.Directory) {
                // Recurse into subdirectory
                const subResults = await scanDirectoryRecursive(fullPath, basePath, outputChannel);
                results.push(...subResults);
            } else if (fileType === vscode.FileType.File && name.endsWith('.md')) {
                results.push({ relativePath, fullPath });
            }
        }
    } catch (error) {
        outputChannel.appendLine(`[SpecViewer] Error scanning subdirectory ${dirPath}: ${error}`);
    }

    return results;
}

/**
 * Scan spec directory for available documents
 */
export async function scanDocuments(
    specDirectory: string,
    outputChannel: vscode.OutputChannel
): Promise<SpecDocument[]> {
    const documents: SpecDocument[] = [];

    // Add core documents (always shown in tabs)
    for (const [type, fileName] of Object.entries(CORE_DOCUMENT_FILES)) {
        const filePath = path.join(specDirectory, fileName);
        const exists = await fileExists(filePath);

        documents.push({
            type: type as CoreDocumentType,
            displayName: CORE_DOCUMENT_DISPLAY_NAMES[type as CoreDocumentType],
            fileName,
            filePath,
            exists,
            isCore: true,
            category: 'core'
        });
    }

    // Scan for related documents (including subdirectories)
    try {
        const allFiles = await scanDirectoryRecursive(specDirectory, specDirectory, outputChannel);

        for (const { relativePath, fullPath } of allFiles) {
            const fileName = path.basename(relativePath);

            // Skip core documents (already added)
            if (Object.values(CORE_DOCUMENT_FILES).includes(fileName) && !relativePath.includes('/')) {
                continue;
            }

            // Determine if this is a nested file (contains path separator)
            const isNested = relativePath.includes('/') || relativePath.includes(path.sep);

            documents.push({
                type: isNested ? nestedFileToDocType(relativePath) : fileNameToDocType(fileName),
                displayName: isNested ? nestedFileToDisplayName(relativePath) : fileNameToDisplayName(fileName),
                fileName: relativePath, // Use relative path for nested files
                filePath: fullPath,
                exists: true,
                isCore: false,
                category: 'related'
            });
        }
    } catch (error) {
        outputChannel.appendLine(`[SpecViewer] Error scanning directory: ${error}`);
    }

    // Sort: core documents first (in order), then related docs alphabetically
    documents.sort((a, b) => {
        if (a.isCore && !b.isCore) return -1;
        if (!a.isCore && b.isCore) return 1;
        if (a.isCore && b.isCore) {
            const order = ['spec', 'plan', 'tasks'];
            return order.indexOf(a.type) - order.indexOf(b.type);
        }
        return a.displayName.localeCompare(b.displayName);
    });

    return documents;
}
