import type { BlockContext } from './blockFences';
import type { FenceInfo } from './fenceInfo';
import { escapeHtml, parseInline } from './inline';

export type PartKind = 'title' | 'row' | 'text' | 'chip' | 'button' | 'field' | 'list';
export type PartMark = 'new' | 'changed';

export interface ScreenPart {
    kind: PartKind;
    text: string;
    items: string[];
    mark: PartMark | null;
    dot: number | null;
    children: ScreenPart[];
}

export interface ScreenNote {
    n: number;
    lead: string;
    rest: string;
}

export interface ScreenDef {
    name: string;
    title: string;
    parts: ScreenPart[];
    notes: ScreenNote[];
}

export type ParsedScreen = { ok: true; parts: ScreenPart[]; dots: number[] } | { ok: false; error: string };

export const MAX_PARTS = 14;
export const MAX_DOTS = 5;

const KINDS: readonly string[] = ['title', 'row', 'text', 'chip', 'button', 'field', 'list'];
const TRAILER = /(?:^|[\s:])\((new|changed|\d{1,2})\)\s*$/;
const NAME = /^[A-Za-z][\w-]{0,31}$/;
export const NOTE_LINE = /^\d{1,2}:\s+\S/;

interface Line extends Omit<ScreenPart, 'children'> {
    depth: number;
}

function parseLine(raw: string): Line | string {
    if (raw.includes('\t')) return 'a tab in the line';
    const indent = raw.length - raw.trimStart().length;
    if (indent % 2) return 'an odd indent';
    let rest = raw.trim();
    let mark: PartMark | null = null;
    let dot: number | null = null;
    for (let found = rest.match(TRAILER); found; found = rest.match(TRAILER)) {
        if (/^\d/.test(found[1])) {
            if (dot !== null) return 'two dots on one part';
            dot = Number(found[1]);
        } else {
            if (mark !== null) return 'two marks on one part';
            mark = found[1] as PartMark;
        }
        rest = rest.slice(0, found.index! + (found[0][0] === ':' ? 1 : 0)).trimEnd();
    }
    const head = rest.match(/^([a-z]+):(?:\s+(.*))?$/);
    if (!head) return 'a line with no part kind';
    if (!KINDS.includes(head[1])) return 'an unknown part';
    const kind = head[1] as PartKind;
    const text = (head[2] ?? '').trim();
    if (kind === 'row' && text) return 'a row holds no text of its own';
    if (kind !== 'row' && !text) return `a ${kind} with no text`;
    const items = kind === 'list' ? text.split('|').map((item) => item.trim()) : [];
    if (items.some((item) => !item)) return 'an empty list item';
    if (dot !== null && dot < 1) return 'a dot must be 1 or more';
    return { depth: indent / 2, kind, text, items, mark, dot };
}

export function parseScreen(body: string): ParsedScreen {
    const roots: ScreenPart[] = [];
    const stack: ScreenPart[] = [];
    const dots: number[] = [];
    let count = 0;
    for (const raw of body.split('\n')) {
        const text = raw.replace(/ +$/, '');
        if (!text.trim()) continue;
        const line = parseLine(text);
        if (typeof line === 'string') return { ok: false, error: line };
        if (line.depth > stack.length) return { ok: false, error: 'a skipped level' };
        if (line.depth > 0 && stack[line.depth - 1].kind !== 'row') return { ok: false, error: 'a part nested inside something that is not a row' };
        stack.length = line.depth;
        const { depth, ...fields } = line;
        const part: ScreenPart = { ...fields, children: [] };
        (depth === 0 ? roots : stack[depth - 1].children).push(part);
        stack.push(part);
        count++;
        if (part.dot !== null) dots.push(part.dot);
    }
    if (count === 0) return { ok: false, error: 'an empty block' };
    if (count > MAX_PARTS) return { ok: false, error: `more than ${MAX_PARTS} parts` };
    if (dots.length > MAX_DOTS) return { ok: false, error: `more than ${MAX_DOTS} dots` };
    if (new Set(dots).size !== dots.length) return { ok: false, error: 'the same dot twice' };
    const emptyRow = (list: ScreenPart[]): boolean => list.some((p) => (p.kind === 'row' && !p.children.length) || emptyRow(p.children));
    if (emptyRow(roots)) return { ok: false, error: 'a row with nothing in it' };
    return { ok: true, parts: roots, dots };
}

export function parseNote(line: string): ScreenNote | null {
    const found = line.trim().match(/^(\d{1,2}):\s+(.+)$/);
    if (!found) return null;
    const text = found[2].trim();
    const sentence = text.match(/^(.+?[.!?])(?:\s+(.*))?$/);
    return { n: Number(found[1]), lead: sentence ? sentence[1] : text, rest: sentence?.[2] ?? '' };
}

/** `<name> <title>` as written after the `screen` word, or null when there is no usable name. */
export function parseScreenHeader(rawTitle: string): { name: string; title: string } | null {
    const [name = '', ...title] = rawTitle.trim().split(/\s+/);
    return NAME.test(name) ? { name, title: title.join(' ') } : null;
}

/** The screen a fence and the numbered lines after it describe, or null when any rule is broken. */
export function buildScreen(rawTitle: string, body: string, noteLines: string[]): ScreenDef | null {
    const header = parseScreenHeader(rawTitle);
    const parsed = parseScreen(body);
    if (!header || !parsed.ok) return null;
    const notes = noteLines.map(parseNote);
    if (notes.some((note) => !note)) return null;
    const list = (notes as ScreenNote[]).sort((a, b) => a.n - b.n);
    const numbers = list.map((note) => note.n);
    const same = numbers.length === parsed.dots.length && [...parsed.dots].sort((a, b) => a - b).every((n, i) => n === numbers[i]);
    if (!same || new Set(numbers).size !== numbers.length) return null;
    return { ...header, parts: parsed.parts, notes: list };
}

const dotHtml = (part: ScreenPart, notes: Map<number, ScreenNote>): string => {
    if (part.dot === null) return '';
    const note = notes.get(part.dot);
    const label = escapeHtml(`Note ${part.dot}: ${(note?.lead ?? '').replace(/\*\*|`/g, '')}`);
    return `<button type="button" class="screen-dot" data-n="${part.dot}" aria-label="${label}">${part.dot}</button>`;
};

function renderPart(part: ScreenPart, notes: Map<number, ScreenNote>): string {
    const mark = part.mark ? ` screen-part--${part.mark}` : '';
    const hint = part.mark ? `<span class="screen-sr"> (${part.mark})</span>` : '';
    const dot = dotHtml(part, notes);
    const open = `<div class="screen-part screen-part--${part.kind}${mark}">`;
    const text = escapeHtml(part.text);
    switch (part.kind) {
        case 'row':
            return `${open}${part.children.map((child) => renderPart(child, notes)).join('')}${hint}${dot}</div>`;
        case 'field':
            return `${open}<span class="screen-label">${text}${hint}</span><span class="screen-input"></span>${dot}</div>`;
        case 'list':
            return `${open}<ul class="screen-items">${part.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>${hint}${dot}</div>`;
        default:
            return `${open}<span class="screen-text">${text}</span>${hint}${dot}</div>`;
    }
}

const noteHtml = (note: ScreenNote): string => {
    const text = note.rest ? `${note.lead} ${note.rest}` : note.lead;
    if (text.includes('**')) return parseInline(text);
    return `<strong>${parseInline(note.lead)}</strong>${note.rest ? ` ${parseInline(note.rest)}` : ''}`;
};

const countMarks = (parts: ScreenPart[], mark: PartMark): number =>
    parts.reduce((sum, part) => sum + (part.mark === mark ? 1 : 0) + countMarks(part.children, mark), 0);

function countHtml(def: ScreenDef): { html: string; label: string } {
    const bits: { html: string; label: string }[] = [];
    const added = countMarks(def.parts, 'new');
    const changed = countMarks(def.parts, 'changed');
    if (added) bits.push({ html: `<span class="screen-count-new">${added} new</span>`, label: `${added} new` });
    if (changed) bits.push({ html: `<span class="screen-count-changed">${changed} changed</span>`, label: `${changed} changed` });
    if (def.notes.length) {
        const label = `${def.notes.length} ${def.notes.length === 1 ? 'note' : 'notes'}`;
        bits.push({ html: label, label });
    }
    return { html: bits.map((b) => b.html).join(' · '), label: bits.map((b) => b.label).join(', ') };
}

/** The card for a built screen. `hidden` is the text a line comment on the whole block quotes. */
export function renderScreenCard(def: ScreenDef, hidden = ''): string {
    const notes = new Map(def.notes.map((note) => [note.n, note] as const));
    const summary = countHtml(def);
    const count = summary.html
        ? `<span class="screen-count" title="${escapeHtml(summary.label)}" aria-label="${escapeHtml(summary.label)}">${summary.html}</span>`
        : '';
    const quote = hidden ? `<span class="line-content" hidden>${escapeHtml(hidden)}</span>` : '';
    const list = def.notes.length
        ? `<ol class="screen-notes">${def.notes.map((note) => `<li class="screen-note" value="${note.n}" data-n="${note.n}" tabindex="0"><span class="screen-note-n" aria-hidden="true">${note.n}</span><span class="screen-note-text">${noteHtml(note)}</span></li>`).join('')}</ol>`
        : '';
    const frame = def.parts.map((part) => renderPart(part, notes)).join('');
    return `<div class="screen-card" data-screen="${escapeHtml(def.name)}"><div class="screen-head"><span class="screen-badge">screen</span><span class="screen-title">${escapeHtml(def.title || def.name)}</span>${count}</div>${quote}<div class="screen-body"><div class="screen-frame">${frame}</div>${list}</div></div>`;
}

export function renderScreenBlock(body: string, _info: FenceInfo, context: BlockContext): string {
    const def = buildScreen(context.rawTitle, body, context.numberedNotes ?? []);
    if (!def) return '';
    return context.wrapLine(renderScreenCard(def, `screen ${context.rawTitle}`.trim()), context.firstLine);
}

let index = new Map<string, ScreenDef>();

/** Reads every valid `screen` fence in a document so another block can draw one by name. */
export function indexScreens(lines: string[]): void {
    index = new Map();
    for (let i = 0; i < lines.length; i++) {
        const open = lines[i].trim().match(/^```screen(?:\s+(.*))?$/);
        if (!open) continue;
        const body: string[] = [];
        let end = i + 1;
        while (end < lines.length && !lines[end].trim().startsWith('```')) body.push(lines[end++]);
        let at = end + 1;
        while (at < lines.length && !lines[at].trim()) at++;
        const noteLines: string[] = [];
        while (at < lines.length && NOTE_LINE.test(lines[at])) noteLines.push(lines[at++]);
        const def = buildScreen(open[1] ?? '', body.join('\n'), noteLines);
        if (def && !index.has(def.name)) index.set(def.name, def);
        i = end;
    }
}

/** The card for the screen with this name in the document being rendered, or null when there is none. */
export function renderScreenByName(name: string): string | null {
    const def = index.get(name);
    return def ? renderScreenCard(def) : null;
}
