/**
 * SpecKit Companion - Staleness Detection
 * Reads file modification times for the core workflow documents and hands them
 * to the shared rule in the viewer core.
 */

import * as vscode from 'vscode';
import type { SpecDocument, StalenessMap } from './types';
import { stalenessFrom } from 'speckit-viewer/core/staleness';

export { isStalenessRelevant } from 'speckit-viewer/core/staleness';

/** Compute staleness for all core workflow documents. */
export async function computeStaleness(
    documents: SpecDocument[]
): Promise<StalenessMap> {
    const coreDocs = documents.filter(d => d.isCore);
    const docs = [];

    for (const doc of coreDocs) {
        let mtime: number | undefined;
        if (doc.exists) {
            try {
                mtime = (await vscode.workspace.fs.stat(vscode.Uri.file(doc.filePath))).mtime;
            } catch {
                // File not accessible: treat as non-existent
            }
        }
        docs.push({ type: doc.type, label: doc.label, exists: doc.exists, mtime });
    }

    return stalenessFrom(docs) as StalenessMap;
}
