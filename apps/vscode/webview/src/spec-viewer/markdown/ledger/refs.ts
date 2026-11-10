/**
 * Ledger refs: turns ids in rendered prose into chips and marks the ones the
 * document cannot answer as unresolved.
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

function ownedBy(id: string, doc: string): boolean {
    if (/^(FR|SC|US)/i.test(id)) return doc === 'spec';
    if (/^T\d/i.test(id)) return doc === 'tasks';
    return doc === 'research' || doc === 'plan';
}

/** After a render: a same-document chip whose target row is absent becomes an unresolved chip. */
export function resolveLedgerRefs(root: ParentNode, currentDoc?: string): void {
    root.querySelectorAll<HTMLAnchorElement>('a.lg-chip[data-ref]:not([data-doc])').forEach((chip) => {
        if (currentDoc && !ownedBy(chip.dataset.ref ?? '', currentDoc)) return;
        const slug = (chip.getAttribute('href') ?? '').slice(1);
        if (root.querySelector(`[id="${slug.replace(/[^a-z0-9-]/g, '')}"]`)) return;
        const span = document.createElement('span');
        span.className = 'lg-chip lg-chip--unresolved';
        span.title = 'Not found in this spec';
        span.textContent = chip.textContent;
        chip.replaceWith(span);
    });
}
