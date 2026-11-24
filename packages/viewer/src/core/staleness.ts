import type { StalenessInfo } from '../contract/viewer';
import { SpecStatuses } from './statuses';

/** A settled spec cannot be stale: the advice is about work still to do, and there is none. */
export function isStalenessRelevant(status: string | undefined): boolean {
    return status !== SpecStatuses.COMPLETED && status !== SpecStatuses.ARCHIVED;
}

/** A checkout or copy writes a spec's files in a burst, so mtimes that close are the same generation. */
export const SAME_GENERATION_MS = 1000;

/** One core document in workflow order; `mtime` is undefined when the file is missing or unreadable. */
export interface StalenessDoc {
    type: string;
    label: string;
    exists: boolean;
    mtime?: number;
}

const FRESH: StalenessInfo = { isStale: false, staleReason: '', newerUpstream: '' };

/** A document is stale when any earlier document in the workflow is newer by more than a second. */
export function stalenessFrom(docs: StalenessDoc[]): Record<string, StalenessInfo> {
    const map: Record<string, StalenessInfo> = {};
    const labels = new Map(docs.map(d => [d.type, d.label]));

    docs.forEach((doc, i) => {
        if (i === 0 || !doc.exists || doc.mtime === undefined) {
            map[doc.type] = { ...FRESH };
            return;
        }

        let newestType = '';
        let newestMtime = 0;
        for (const up of docs.slice(0, i)) {
            if (up.mtime !== undefined && up.mtime - doc.mtime > SAME_GENERATION_MS && up.mtime > newestMtime) {
                newestType = up.type;
                newestMtime = up.mtime;
            }
        }

        if (!newestType) {
            map[doc.type] = { ...FRESH };
            return;
        }
        const upstreamLabel = labels.get(newestType) || newestType;
        map[doc.type] = {
            isStale: true,
            staleReason: `${doc.label} was generated before the current ${upstreamLabel.toLowerCase()}. Consider regenerating.`,
            newerUpstream: upstreamLabel,
        };
    });

    return map;
}
