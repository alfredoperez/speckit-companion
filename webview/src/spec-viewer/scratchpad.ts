import type { NavState, SpecDocument } from './types';

/** Resolve the currently-active document from nav state. */
export function findActiveDoc(ns: NavState | null | undefined): SpecDocument | undefined {
    if (!ns) return undefined;
    return [...(ns.coreDocs ?? []), ...(ns.relatedDocs ?? [])].find(
        d => d.type === ns.currentDoc
    );
}
