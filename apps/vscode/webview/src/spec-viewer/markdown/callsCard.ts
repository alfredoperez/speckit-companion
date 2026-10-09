import type { BlockContext } from './blockFences';
import type { FenceInfo } from './fenceInfo';
import { escapeHtml, fileRefHtml } from './inline';

export interface CallRow {
    mark: '+' | '~' | '-' | ' ';
    depth: number;
    name: string;
    path: string;
    line: number | null;
    isNew: boolean;
    sourceLine: number;
    guide: string;
    source: string;
}

export type ParsedCalls = { ok: true; rows: CallRow[] } | { ok: false; error: string };

export const STRIKE_LABEL = 'Strike this call from the plan';

const LOCATION = /^(.*?)\s+@\s+(\S+?)(?::(\d+))?$/;
const NEW_FILE = /\s*\*\*new\*\*\s*$/;
const MARKS = '+~- ';

function parseRow(row: string, sourceLine: number): Omit<CallRow, 'guide'> | string {
    if (row.includes('\t')) return 'a tab in the line';
    if (row.length < 2 || !MARKS.includes(row[0]) || row[1] !== ' ') return 'column 0 must be a mark followed by a space';
    const rest = row.slice(2);
    const indent = rest.length - rest.trimStart().length;
    if (indent % 2) return 'an odd indent';
    const found = rest.trim().match(LOCATION);
    if (!found) return 'no location after the name';
    const [, rawName, path, line] = found;
    const isNew = NEW_FILE.test(rawName);
    const name = rawName.replace(NEW_FILE, '').trim();
    const mark = row[0] as CallRow['mark'];
    if (!name) return 'no name before the location';
    if (isNew && mark !== '+') return 'a new file must be a + line';
    if (isNew && line) return 'a new file has no line';
    if (path.startsWith('/') || path.split('/').includes('..')) return 'a path outside the repo';
    return { mark, depth: indent / 2, name, path, line: line ? Number(line) : null, isNew, sourceLine, source: row.trim() };
}

function guides(rows: Omit<CallRow, 'guide'>[]): string[] {
    const hasLaterSibling = (index: number): boolean => {
        const depth = rows[index].depth;
        for (let j = index + 1; j < rows.length && rows[j].depth >= depth; j++) {
            if (rows[j].depth === depth) return true;
        }
        return false;
    };
    const open: boolean[] = [];
    return rows.map((row, index) => {
        if (row.depth === 0) return '';
        const later = hasLaterSibling(index);
        const prefix = open.slice(1, row.depth).map((on) => (on ? '│  ' : '   ')).join('');
        open[row.depth] = later;
        return prefix + (later ? '├─ ' : '└─ ');
    });
}

export function parseCalls(body: string, firstLine: number): ParsedCalls {
    const rows: Omit<CallRow, 'guide'>[] = [];
    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const text = lines[i].replace(/ +$/, '');
        if (!text.trim()) continue;
        const row = parseRow(text, firstLine + i);
        if (typeof row === 'string') return { ok: false, error: row };
        const expected = rows.length === 0 ? 0 : Math.min(row.depth, rows[rows.length - 1].depth + 1);
        if (rows.length === 0 && row.depth !== 0) return { ok: false, error: 'the entry point is not indented' };
        if (rows.length > 0 && row.depth === 0) return { ok: false, error: 'a second entry point' };
        if (row.depth !== expected) return { ok: false, error: 'a skipped level' };
        rows.push(row);
    }
    if (rows.length === 0) return { ok: false, error: 'an empty block' };
    const tree = guides(rows);
    return { ok: true, rows: rows.map((row, index) => ({ ...row, guide: tree[index] })) };
}

const TINT: Record<CallRow['mark'], string> = { '+': 'add', '~': 'chg', '-': 'del', ' ': 'same' };

function renderLocation(row: CallRow): string {
    const label = row.line === null ? row.path : `${row.path}:${row.line}`;
    const chip = row.isNew ? null : fileRefHtml(escapeHtml(row.path), row.line ?? NaN, escapeHtml(label));
    return `<span class="calls-where">${chip ?? escapeHtml(label)}</span>`;
}

function renderRow(row: CallRow): string {
    const strike = row.mark === ' '
        ? ''
        : `<button type="button" class="calls-strike" data-line="${row.sourceLine}" aria-label="${STRIKE_LABEL}">strike</button>`;
    const pill = row.isNew ? '<span class="calls-new">new file</span>' : '';
    const mark = row.mark === '-' ? '−' : row.mark.trim();
    return `<div class="calls-row calls-row--${TINT[row.mark]}"><span class="calls-mark">${mark}</span><span class="calls-tree">${row.guide}</span><span class="calls-name">${escapeHtml(row.name)}</span>${pill}${renderLocation(row)}${strike}<span class="line-content" hidden>${escapeHtml(row.source)}</span></div>`;
}

export function renderCallsCard(body: string, info: FenceInfo, context: BlockContext): string {
    const parsed = parseCalls(body, context.firstLine);
    if (!parsed.ok) return '';
    const { rows } = parsed;
    const count = (mark: CallRow['mark']): number => rows.filter((row) => row.mark === mark).length;
    const title = info.title || context.rawTitle;
    const titleHtml = title ? `<span class="calls-title">${escapeHtml(title)}</span>` : '';
    const counts = `<span class="calls-counts"><span class="calls-add">+${count('+')}</span> <span class="calls-del">−${count('-')}</span> <span class="calls-chg">~${count('~')}</span> · 1 entrypoint</span>`;
    const lines = rows.map((row) => context.wrapLine(renderRow(row), row.sourceLine)).join('');
    const note = context.note ? `<div class="calls-note">${escapeHtml(context.note)}</div>` : '';
    return `<div class="calls-card"><div class="calls-head"><span class="calls-badge">calls</span>${titleHtml}${counts}</div><div class="calls-rows">${lines}</div>${note}</div>`;
}
