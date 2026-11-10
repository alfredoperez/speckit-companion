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

export function codicon(name: string): string {
    return `<span class="codicon codicon-${name.replace(/[^a-z0-9-]/g, '')}" aria-hidden="true"></span>`;
}

export function eyebrow(family: Family, label: string, count?: string | number): string {
    const tail = count === undefined ? '' : ` <span class="lg-eyebrow-count">${escapeHtml(String(count))}</span>`;
    return `<span class="lg-eyebrow ${familyClass(family)}">${codicon(FAMILY_ICON[family])}${escapeHtml(label)}${tail}</span>`;
}

export function slugForId(id: string): string {
    return `ref-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export interface IdChipOptions {
    resolved?: boolean;
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
    return `<a class="lg-chip" href="#${slugForId(id)}" data-ref="${safe}"${title}>${dot}${safe}</a>`;
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
export function priorityMark(priority: 1 | 2 | 3): string {
    const on = 4 - priority;
    const bars = [1, 2, 3].map((n) => `<i${n <= on ? ' class="on"' : ''}></i>`).join('');
    return `<span class="lg-priority" aria-label="Priority ${priority}">${bars}<span>P${priority}</span></span>`;
}
