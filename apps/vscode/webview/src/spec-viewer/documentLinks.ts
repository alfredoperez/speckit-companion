/**
 * SpecKit Companion - Document Links
 * A link inside a rendered spec document opens the document it names, or scrolls to its heading.
 */

import type { NavState, SpecDocument, VSCodeApi } from './types';
import { navState, viewerMode } from './signals';
import { slugify } from './markdown';
import { prefersReducedMotion } from './toc';

declare const vscode: VSCodeApi;

export type DocumentLink =
    | { kind: 'external' }
    | { kind: 'fragment'; fragment: string }
    | { kind: 'document'; doc: SpecDocument; fragment: string; core: boolean }
    | { kind: 'file'; filename: string };

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

let pending: { docType: string; fragment: string } | null = null;

function normalizePath(p: string): string {
    const out: string[] = [];
    for (const part of p.replace(/\\/g, '/').split('/')) {
        if (part === '' || part === '.') continue;
        if (part === '..') out.pop();
        else out.push(part);
    }
    return out.join('/');
}

function decode(text: string): string {
    try {
        return decodeURIComponent(text);
    } catch {
        return text;
    }
}

/** Where a link in the current document points, or null when it is not ours to handle. */
export function resolveDocumentLink(href: string, ns: NavState): DocumentLink | null {
    const raw = href.trim();
    if (!raw) return null;
    if (raw.startsWith('#')) return { kind: 'fragment', fragment: decode(raw.slice(1)) };
    if (EXTERNAL.test(raw)) return { kind: 'external' };

    const hashAt = raw.indexOf('#');
    const beforeHash = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
    const fragment = hashAt >= 0 ? decode(raw.slice(hashAt + 1)) : '';
    const target = decode(beforeHash.replace(/\?.*$/, ''));
    if (!target) return fragment ? { kind: 'fragment', fragment } : null;

    const related = ns.relatedDocs ?? [];
    const docs = [...(ns.coreDocs ?? []), ...related].filter(d => d.exists && d.filePath);
    const current = docs.find(d => d.type === ns.currentDoc);
    const base = current ? current.filePath.replace(/\\/g, '/').replace(/\/[^/]*$/, '') : '';
    const resolved = target.startsWith('/') ? normalizePath(target) : normalizePath(`${base}/${target}`);

    const match = docs.find(d => normalizePath(d.filePath) === resolved);
    if (match) return { kind: 'document', doc: match, fragment, core: !related.includes(match) };
    if (!current) return { kind: 'file', filename: target };
    return { kind: 'file', filename: base.startsWith('/') || target.startsWith('/') ? `/${resolved}` : resolved };
}

/** Scroll a heading of the rendered document into view; false when the document has no such heading. */
export function scrollToFragment(fragment: string): boolean {
    const root = document.getElementById('markdown-content');
    if (!root || !fragment) return false;
    const byId = (id: string) => (id ? root.querySelector<HTMLElement>(`#${CSS.escape(id)}`) : null);
    const el = byId(fragment) ?? byId(slugify(fragment));
    if (!el) return false;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    return true;
}

/** Called after a document renders: lands the scroll a link to another document asked for. */
export function applyPendingFragment(): void {
    if (!pending || pending.docType !== navState.value?.currentDoc) return;
    const { fragment } = pending;
    pending = null;
    scrollToFragment(fragment);
}

export function setupDocumentLinkClickHandler(): void {
    document.addEventListener('click', (e) => {
        const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>('#markdown-content a[href]');
        const ns = navState.value;
        if (!anchor || !ns) return;
        const link = resolveDocumentLink(anchor.getAttribute('href') ?? '', ns);
        if (!link || link.kind === 'external') return;

        e.preventDefault();
        if (link.kind === 'fragment') {
            scrollToFragment(link.fragment);
        } else if (link.kind === 'file') {
            vscode.postMessage({ type: 'openFile', filename: link.filename });
        } else if (link.doc.type === ns.currentDoc) {
            scrollToFragment(link.fragment);
        } else {
            pending = link.fragment ? { docType: link.doc.type, fragment: link.fragment } : null;
            viewerMode.value = 'document';
            vscode.postMessage(link.core
                ? { type: 'stepperClick', phase: link.doc.type }
                : { type: 'switchDocument', documentType: link.doc.type });
        }
    });
}
