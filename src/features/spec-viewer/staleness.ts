/**
 * SpecKit Companion - Staleness Detection
 * Compares file modification timestamps across workflow documents
 * to detect when downstream artifacts are outdated.
 */

import * as vscode from 'vscode';
import type { SpecDocument, StalenessMap, StalenessInfo } from './types';

/**
 * Compute staleness for all core workflow documents.
 * A document is stale if any preceding document in the workflow
 * has a strictly newer mtime.
 */
export async function computeStaleness(
    documents: SpecDocument[]
): Promise<StalenessMap> {
    const coreDocs = documents.filter(d => d.isCore);
    const stalenessMap: StalenessMap = {};

    // Collect mtimes for all existing core docs
    const mtimes = new Map<string, number>();
    const labels = new Map<string, string>();

    for (const doc of coreDocs) {
        labels.set(doc.type, doc.label);
        if (!doc.exists) continue;

        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(doc.filePath));
            mtimes.set(doc.type, stat.mtime);
        } catch {
            // File not accessible — treat as non-existent
        }
    }

    // Check each core doc against all preceding docs
    for (let i = 0; i < coreDocs.length; i++) {
        const doc = coreDocs[i];
        const docMtime = mtimes.get(doc.type);

        // First doc is never stale; non-existent docs are not stale
        if (i === 0 || !doc.exists || docMtime === undefined) {
            stalenessMap[doc.type] = {
                isStale: false,
                staleReason: '',
                newerUpstream: ''
            };
            continue;
        }

        // Find the newest upstream that is strictly newer than this doc
        let newestUpstreamType = '';
        let newestUpstreamMtime = 0;

        for (let j = 0; j < i; j++) {
            const upstreamType = coreDocs[j].type;
            const upstreamMtime = mtimes.get(upstreamType);
            if (upstreamMtime !== undefined && upstreamMtime > docMtime && upstreamMtime > newestUpstreamMtime) {
                newestUpstreamType = upstreamType;
                newestUpstreamMtime = upstreamMtime;
            }
        }

        if (newestUpstreamType) {
            const upstreamLabel = labels.get(newestUpstreamType) || newestUpstreamType;
            const docLabel = doc.label.toLowerCase();
            stalenessMap[doc.type] = {
                isStale: true,
                staleReason: `${doc.label} was generated before the current ${upstreamLabel.toLowerCase()}. Consider regenerating.`,
                newerUpstream: upstreamLabel
            };
        } else {
            stalenessMap[doc.type] = {
                isStale: false,
                staleReason: '',
                newerUpstream: ''
            };
        }
    }

    return stalenessMap;
}
