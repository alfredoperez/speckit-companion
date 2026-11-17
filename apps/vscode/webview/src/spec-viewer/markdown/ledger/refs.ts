import { ownedBy } from 'speckit-viewer/core/markdown/ledger/refs';

export { linkifyIds } from 'speckit-viewer/core/markdown/ledger/refs';

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
