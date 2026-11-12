/**
 * Shared parsing for the Ledger research and data components: heading-bounded
 * sections, markdown tables and a small block renderer. Every builder returns a
 * single line of HTML (newlines inside code become `&#10;`) so the renderer
 * passes it through untouched.
 */

import { escapeHtml, parseInline } from '../inline';

export type DocKind = 'research' | 'data' | 'contract' | 'quickstart' | 'plan' | 'other';

export interface Heading {
    level: number;
    text: string;
}

export const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const FENCE = /^[ \t]*(```|~~~)/;

/** Which kind of design file this is, read from its first H1 outside a fence. */
export function docKind(markdown: string): DocKind {
    let inFence = false;
    for (const line of markdown.split('\n')) {
        if (FENCE.test(line)) { inFence = !inFence; continue; }
        if (inFence) continue;
        const m = line.match(/^#[ \t]+(.+)$/);
        if (!m) continue;
        const t = m[1]!;
        if (/^(?:Implementation Plan|Feature Specification|Tasks?)\b/i.test(t)) return /^Implementation Plan/i.test(t) ? 'plan' : 'other';
        if (/quickstart/i.test(t)) return 'quickstart';
        if (/data[- ]model|\bentities\b/i.test(t)) return 'data';
        if (/^contracts?\b|\bcontract\b/i.test(t)) return 'contract';
        if (/research/i.test(t)) return 'research';
        if (/\bplan\b|implementation/i.test(t)) return 'plan';
        return 'other';
    }
    if (/^##[ \t]+[RD]\d+\b/m.test(markdown)) return 'research';
    if (/^##[ \t]+Entities\b/im.test(markdown)) return 'data';
    return 'other';
}

/** Index of the first heading line (level <= maxLevel) at or after `from`, or lines.length. Fence-aware. */
export function nextHeading(lines: string[], from: number, maxLevel = 6): number {
    let inFence = false;
    for (let i = from; i < lines.length; i++) {
        if (FENCE.test(lines[i]!)) { inFence = !inFence; continue; }
        if (inFence) continue;
        const m = lines[i]!.match(HEADING);
        if (m && m[1]!.length <= maxLevel) return i;
    }
    return lines.length;
}

export interface SectionCtx {
    heading: Heading;
    /** Body lines before the first nested heading. */
    direct: string[];
    /** Every body line to the end of the section, nested headings included. */
    body: string[];
}

/**
 * Walk the document; at each heading of level 2-3 offer its section to `build`.
 * A non-null result replaces the whole section, null leaves the heading and moves on.
 */
export function mapSections(
    markdown: string,
    build: (s: SectionCtx, index: number) => string | null,
    levels: [number, number] = [2, 3],
): string {
    const lines = markdown.split('\n');
    const out: string[] = [];
    let inFence = false;
    let index = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (FENCE.test(line)) { inFence = !inFence; out.push(line); continue; }
        const m = inFence ? null : line.match(HEADING);
        if (!m || m[1]!.length < levels[0] || m[1]!.length > levels[1]) { out.push(line); continue; }
        const level = m[1]!.length;
        const end = nextHeading(lines, i + 1, level);
        const body = lines.slice(i + 1, end);
        const direct = body.slice(0, nextHeading(body, 0));
        const html = build({ heading: { level, text: m[2]! }, direct, body }, index);
        if (html === null) { out.push(line); continue; }
        index++;
        out.push(html);
        i = end - 1;
    }
    return out.join('\n');
}

export function splitRow(line: string): string[] {
    const cells: string[] = [];
    let cur = '';
    let tick = false;
    const s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
        if (c === '`') tick = !tick;
        if (c === '|' && !tick) { cells.push(cur.trim()); cur = ''; continue; }
        cur += c;
    }
    cells.push(cur.trim());
    return cells;
}

export interface Table {
    head: string[];
    rows: string[][];
}

export const isTableLine = (l: string): boolean => /^[ \t]*\|.*\|[ \t]*$/.test(l);
const isDivider = (l: string): boolean => /^[ \t]*\|?[ \t:|-]+\|[ \t:|-]*$/.test(l) && l.includes('-');

/** Parse consecutive table lines; null when there is no header and divider. */
export function parseTable(lines: string[]): Table | null {
    if (lines.length < 2 || !isDivider(lines[1]!)) return null;
    const head = splitRow(lines[0]!);
    const rows = lines.slice(2).map((l) => {
        const cells = splitRow(l);
        while (cells.length < head.length) cells.push('');
        return cells.slice(0, head.length);
    });
    return { head, rows };
}

export const colIndex = (head: string[], pattern: RegExp): number =>
    head.findIndex((h) => pattern.test(h.replace(/[*`]/g, '').trim()));

/** Code text that stays on one line of HTML. */
export const oneLine = (s: string): string => s.replace(/\n/g, '&#10;');

export function codeBlock(text: string): string {
    return `<pre class="lg-code"><code>${oneLine(escapeHtml(text))}</code></pre>`;
}

export function genericTable(t: Table): string {
    const th = t.head.map((h) => `<th>${parseInline(h)}</th>`).join('');
    const tr = t.rows.map((r) => `<tr>${r.map((c) => `<td>${parseInline(c)}</td>`).join('')}</tr>`).join('');
    return `<div class="table-scroll"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

export interface BlockOptions {
    table?: (t: Table) => string | null;
}

/** Render loose markdown (paragraphs, lists, fences, tables, sub-headings) as one line of HTML. */
export function renderBlocks(lines: string[], opts: BlockOptions = {}): string {
    const out: string[] = [];
    let para: string[] = [];
    const flush = () => {
        if (para.length) out.push(`<p>${parseInline(para.join(' '))}</p>`);
        para = [];
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const fence = line.match(FENCE);
        if (fence) {
            flush();
            const code: string[] = [];
            i++;
            while (i < lines.length && !lines[i]!.trim().startsWith(fence[1]!)) code.push(lines[i++]!);
            out.push(codeBlock(code.join('\n').replace(/^\n+|\n+$/g, '')));
            continue;
        }
        if (!line.trim() || /^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(line)) { flush(); continue; }
        if (isTableLine(line)) {
            flush();
            const tbl: string[] = [];
            while (i < lines.length && isTableLine(lines[i]!)) tbl.push(lines[i++]!);
            i--;
            const t = parseTable(tbl);
            out.push((t && opts.table?.(t)) || (t ? genericTable(t) : `<p>${parseInline(tbl.join(' '))}</p>`));
            continue;
        }
        const h = line.match(HEADING);
        if (h) { flush(); out.push(`<p class="lg-sub">${parseInline(h[2]!)}</p>`); continue; }
        if (/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/.test(line)) {
            flush();
            const ordered = /^[ \t]*\d/.test(line);
            const items: string[] = [];
            while (i < lines.length) {
                const m = lines[i]!.match(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(.*)$/);
                if (m) { items.push(m[1]!); i++; continue; }
                if (/^[ \t]+\S/.test(lines[i]!) && items.length) { items[items.length - 1] += ' ' + lines[i]!.trim(); i++; continue; }
                break;
            }
            i--;
            const tag = ordered ? 'ol' : 'ul';
            out.push(`<${tag} class="lg-list">${items.map((t) => `<li>${parseInline(t)}</li>`).join('')}</${tag}>`);
            continue;
        }
        para.push(line.trim());
    }
    flush();
    return out.join('');
}

/** Bold-label field lines: `**Label**: text` or `**Label:** text`. */
export const LABEL = /^[ \t]*(?:[-*+][ \t]+)?\*\*([A-Za-z][A-Za-z ]{1,30}?)[:.]?\*\*:?[ \t]*(.*)$/;

export interface Field {
    label: string;
    lines: string[];
}

/** Split a body into leading lines and labelled fields; a fence never starts a field. */
export function splitFields(lines: string[], known: RegExp): { lead: string[]; fields: Field[] } {
    const lead: string[] = [];
    const fields: Field[] = [];
    let inFence = false;
    for (const line of lines) {
        if (FENCE.test(line)) inFence = !inFence;
        const m = inFence ? null : line.match(LABEL);
        if (m && known.test(m[1]!.trim())) {
            fields.push({ label: m[1]!.trim().toLowerCase(), lines: m[2] ? [m[2]] : [] });
            continue;
        }
        (fields.length ? fields[fields.length - 1]!.lines : lead).push(line);
    }
    return { lead, fields };
}

const ID_IN_TEXT = /\b(?:[A-Z]{1,4}-\d{1,4}[a-z]?)\b/g;

/** Requirement-style ids named in a text, in order, unique. */
export function idsIn(text: string, limit = 4): string[] {
    const seen: string[] = [];
    for (const m of text.matchAll(ID_IN_TEXT)) if (!seen.includes(m[0])) seen.push(m[0]);
    return seen.slice(0, limit);
}

export const plain = (s: string): string => s.replace(/[*`]/g, '').trim();
