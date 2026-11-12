/**
 * Ledger refs: turns ids in rendered prose into chips and marks the ones the
 * document cannot answer as unresolved. The DOM pass that marks them lives with the host.
 */

import { idChip } from './primitives';

const ID_IN_PROSE = /(?<![\w./#-])(?:(spec|plan|tasks|research|data-model|quickstart)\.md\s+)?\b(FR-\d{3}|SC-\d{3}|US-?\d{1,3}|T\d{3,4}|R\d{1,3}|D\d{1,3})\b(?![\w-])/g;
const PROTECTED = /(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>|\x00CODE\d+\x00)/;

/** Chips for every id in already-escaped inline HTML; tags, links and stashed code are left alone. */
export function linkifyIds(html: string): string {
    return html
        .split(PROTECTED)
        .map((part, i) => (i % 2 === 1 ? part : part.replace(ID_IN_PROSE, (_m, doc: string | undefined, id: string) => idChip(id, { doc }))))
        .join('');
}

export function ownedBy(id: string, doc: string): boolean {
    if (/^(FR|SC|US)/i.test(id)) return doc === 'spec';
    if (/^T\d/i.test(id)) return doc === 'tasks';
    return doc === 'research' || doc === 'plan';
}
