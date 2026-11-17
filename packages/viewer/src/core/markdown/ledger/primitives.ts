/**
 * Ledger primitives: small HTML-string builders shared by every Ledger
 * component. All repository text goes through escapeHtml; attributes are
 * restricted to values these functions build themselves.
 */

import { escapeHtml } from '../inline';

export type Family = 'story' | 'req' | 'decision' | 'task' | 'data' | 'guard';
export type Status = 'done' | 'running' | 'warn' | 'fail' | 'todo';

const FAMILY_ICON: Record<Family, string> = {
    story: 'person',
    req: 'checklist',
    decision: 'law',
    task: 'tasklist',
    data: 'database',
    guard: 'shield',
};

const ID_PATTERN = /^[A-Z]{1,4}-?\d{1,4}[a-z]?$/;

export function familyClass(family: Family): string {
    return `lg-fam-${family}`;
}

// Comment icon SVG for line action buttons
export const COMMENT_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 6h8m-4-4v8M6.099 19.5q-1.949-.192-2.927-1.172C2 17.157 2 15.271 2 11.5V11c0-3.771 0-5.657 1.172-6.828S6.229 3 10 3h1.5m-5 15c-.205 1.002-1.122 3.166-.184 3.865c.49.357 1.271-.024 2.834-.786c1.096-.535 2.206-1.148 3.405-1.424c.438-.1.885-.143 1.445-.155c3.771 0 5.657 0 6.828-1.172C21.947 17.21 21.998 15.44 22 12M8 14h6M8 9h3"/></svg>`;

export function codicon(name: string): string {
    return `<span class="codicon codicon-${name.replace(/[^a-z0-9-]/g, '')}" aria-hidden="true"></span>`;
}

export function eyebrow(family: Family, label: string, count?: string | number): string {
    const tail = count === undefined ? '' : ` <span class="lg-eyebrow-count">${escapeHtml(String(count))}</span>`;
    return `<span class="lg-eyebrow ${familyClass(family)}">${codicon(FAMILY_ICON[family])}${escapeHtml(label)}${tail}</span>`;
}

/** `US1` and `US-1` share one anchor; every other id keeps its own shape. */
export function slugForId(id: string): string {
    const slug = id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^us-?(\d)/, 'us-$1');
    return `ref-${slug}`;
}

export interface RefAnchorOptions {
    family?: Family;
    status?: Status;
    /** Short name the hover card shows above the text, e.g. "Requirement". */
    label?: string;
}

/** Attribute string (no leading space) that makes a row the target of an id chip. Every value is escaped. */
export function refAnchor(id: string, opts: RefAnchorOptions = {}): string {
    const attr = (name: string, value: string | undefined) => (value ? ` ${name}="${escapeHtml(value)}"` : '');
    return `id="${slugForId(id)}" data-ref-target="${escapeHtml(id)}"${attr('data-family', opts.family)}${attr('data-status', opts.status)}${attr('data-label', opts.label)}`;
}

export interface IdChipOptions {
    resolved?: boolean;
    /** A document the id lives in ("research" for `research.md R12`); the click switches to it. */
    doc?: string;
    status?: Status;
    title?: string;
}

/** A neutral id chip. Resolved ids are anchors to `#ref-<id>`; the hover card and Back pill attach by `data-ref`. */
export function idChip(id: string, opts: IdChipOptions = {}): string {
    const safe = escapeHtml(id);
    if (!ID_PATTERN.test(id) || opts.resolved === false) {
        return `<span class="lg-chip lg-chip--unresolved" title="Not found in this spec">${safe}</span>`;
    }
    const dot = opts.status ? statusDot(opts.status) : '';
    const title = opts.title ? ` title="${escapeHtml(opts.title).replace(/"/g, '&quot;')}"` : '';
    const doc = opts.doc && /^[a-z][a-z-]*$/.test(opts.doc) ? opts.doc : '';
    const docAttr = doc ? ` data-doc="${doc}"` : '';
    const label = doc ? `${doc}.md ${safe}` : safe;
    return `<a class="lg-chip" href="#${slugForId(id)}" data-ref="${safe}"${docAttr}${title}>${dot}${label}</a>`;
}

export function fileChip(path: string): string {
    const safe = escapeHtml(path);
    const name = escapeHtml(path.split('/').pop() ?? path);
    return `<span class="lg-chip lg-file" data-file="${safe.replace(/"/g, '&quot;')}">${codicon('file')}${name}</span>`;
}

export function statusDot(status: Status): string {
    return `<span class="lg-dot lg-dot--${status}" aria-hidden="true"></span>`;
}

/** P1 = three bars on, P3 = one. Neutral ink only. */
export function priorityMark(priority: number): string {
    const on = Math.max(1, 4 - priority);
    const bars = [1, 2, 3].map((n) => `<i${n <= on ? ' class="on"' : ''}></i>`).join('');
    return `<span class="lg-priority" aria-label="Priority ${priority}">${bars}<span>P${priority}</span></span>`;
}
