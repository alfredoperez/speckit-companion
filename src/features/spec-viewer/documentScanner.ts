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
import type { WorkflowStepConfig } from '../workflows';
import { getStepFile } from '../workflows';

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
 * @param steps Optional workflow steps to use for core document identification.
 *              When provided, uses step file mappings instead of hard-coded CORE_DOCUMENT_FILES.
 */
export async function scanDocuments(
    specDirectory: string,
    outputChannel: vscode.OutputChannel,
    steps?: WorkflowStepConfig[]
): Promise<SpecDocument[]> {
    const documents: SpecDocument[] = [];

    // Build core document list from workflow steps or fallback to defaults
    const coreFiles: { type: string; fileName: string; displayName: string }[] = [];
    if (steps && steps.length > 0) {
        for (const step of steps) {
            const fileName = getStepFile(step);
            const displayName = step.label ?? step.name.charAt(0).toUpperCase() + step.name.slice(1);
            coreFiles.push({ type: step.name, fileName, displayName });
        }
    } else {
        for (const [type, fileName] of Object.entries(CORE_DOCUMENT_FILES)) {
            coreFiles.push({
                type,
                fileName,
                displayName: CORE_DOCUMENT_DISPLAY_NAMES[type as CoreDocumentType]
            });
        }
    }

    const coreFileNames = new Set(coreFiles.map(c => c.fileName));

    // Add core documents (always shown in tabs)
    for (const core of coreFiles) {
        const filePath = path.join(specDirectory, core.fileName);
        const exists = await fileExists(filePath);

        documents.push({
            type: core.type,
            displayName: core.displayName,
            fileName: core.fileName,
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
            if (coreFileNames.has(fileName) && !relativePath.includes('/')) {
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

    // Sort: core documents first (in step order), then related docs alphabetically
    const coreOrder = coreFiles.map(c => c.type);
    documents.sort((a, b) => {
        if (a.isCore && !b.isCore) return -1;
        if (!a.isCore && b.isCore) return 1;
        if (a.isCore && b.isCore) {
            return coreOrder.indexOf(a.type) - coreOrder.indexOf(b.type);
        }
        return a.displayName.localeCompare(b.displayName);
    });

    return documents;
}
