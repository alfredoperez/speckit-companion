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

    // Scan for related documents
    try {
        const uri = vscode.Uri.file(specDirectory);
        const entries = await vscode.workspace.fs.readDirectory(uri);

        for (const [name, fileType] of entries) {
            if (fileType !== vscode.FileType.File) continue;
            if (!name.endsWith('.md')) continue;

            // Skip core documents (already added)
            if (Object.values(CORE_DOCUMENT_FILES).includes(name)) continue;

            const filePath = path.join(specDirectory, name);
            documents.push({
                type: fileNameToDocType(name),
                displayName: fileNameToDisplayName(name),
                fileName: name,
                filePath,
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
