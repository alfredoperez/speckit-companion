import type { BlockContext, BlockPin } from './blockFences';
import type { FenceInfo } from './fenceInfo';
import { escapeHtml, fileRefHtml, parseInline } from './inline';

export interface CodeInfo {
    kind: 'sketch' | 'cite';
    file: string;
    from: number;
    to: number | null;
    hl: Array<[number, number]>;
}

export interface CodeLine {
    number: number;
    text: string;
    sourceLine: number;
    highlighted: boolean;
    pins: BlockPin[];
}

export type ParsedCode = { ok: true; lines: CodeLine[] } | { ok: false; error: string };

const CARD_INFO = /^(sketch(\s|$)|\S+:\d+-\d+(\s|$))/;
const CITATION = /^(.+):(\d{1,7})-(\d{1,7})$/;
const HIGHLIGHT = /^hl=(\d{1,7}(?:-\d{1,7})?(?:,\d{1,7}(?:-\d{1,7})?)*)$/;
const OUTSIDE_REPO = /^([a-z]:|[\\/])/i;

/** Whether the text after a fence's language asks for a code card at all. */
export const isCodeCardInfo = (rawTitle: string): boolean => CARD_INFO.test(rawTitle);

export function parseCodeInfo(rawTitle: string): CodeInfo | null {
    const words = rawTitle.trim().split(/\s+/);
    const cited = words[0].match(CITATION);
    const sketch = words[0] === 'sketch';
    if (!sketch && !cited) return null;
    const file = sketch ? words[1] ?? '' : cited![1];
    const from = sketch ? 1 : Number(cited![2]);
    const to = sketch ? null : Number(cited![3]);
    if (!file || file.startsWith('hl=')) return null;
    if (OUTSIDE_REPO.test(file) || file.split(/[\\/]/).includes('..')) return null;
    if (to !== null && (from < 1 || to < from)) return null;

    const rest = words.slice(sketch ? 2 : 1);
    if (rest.length > 1) return null;
    const hl: Array<[number, number]> = [];
    if (rest.length === 1) {
        const listed = rest[0].match(HIGHLIGHT);
        if (!listed) return null;
        for (const part of listed[1].split(',')) {
            const [first, last = first] = part.split('-').map(Number);
            if (last < first) return null;
            hl.push([first, last]);
        }
    }
    return { kind: sketch ? 'sketch' : 'cite', file, from, to, hl };
}

export function parseCode(body: string, info: CodeInfo, context: Pick<BlockContext, 'firstLine' | 'pins'>): ParsedCode {
    if (!body.trim()) return { ok: false, error: 'an empty block' };
    const texts = body.split('\n');
    const last = info.from + texts.length - 1;
    if (info.to !== null && info.to !== last) return { ok: false, error: 'the body is not as long as the cited range' };
    const shown = (line: number): boolean => line >= info.from && line <= last;
    if (info.hl.some(([first, end]) => !shown(first) || !shown(end))) return { ok: false, error: 'a highlight outside the lines' };
    for (const pin of context.pins) {
        if (!shown(pin.line)) return { ok: false, error: 'a pin outside the lines' };
        if (!pin.text) return { ok: false, error: 'a pin with no text' };
    }
    const lines = texts.map((text, index) => {
        const number = info.from + index;
        return {
            number,
            text,
            sourceLine: context.firstLine + index,
            highlighted: info.hl.some(([first, end]) => number >= first && number <= end),
            pins: context.pins.filter((pin) => pin.line === number),
        };
    });
    return { ok: true, lines };
}

function renderFile(info: CodeInfo): string {
    const text = escapeHtml(info.file);
    const chip = info.kind === 'cite' ? fileRefHtml(text, info.from, text) : null;
    return `<span class="code-file">${chip ?? text}</span>`;
}

function renderKind(info: CodeInfo): string {
    const label = info.to === null ? 'sketch' : info.to === info.from ? `line ${info.from}` : `lines ${info.from}-${info.to}`;
    return `<span class="code-kind code-kind--${info.kind}">${label}</span>`;
}

function renderPin(pin: BlockPin, context: BlockContext): string {
    const row = `<div class="code-pin" role="note"><span class="code-pin-text">${parseInline(pin.text)}</span><span class="line-content" hidden>${escapeHtml(pin.source)}</span></div>`;
    return context.wrapLine(row, pin.sourceLine);
}

function renderLine(line: CodeLine, context: BlockContext): string {
    const tint = `${line.highlighted ? ' code-row--hl' : ''}${line.pins.length ? ' code-row--pinned' : ''}`;
    const text = escapeHtml(line.text);
    const row = `<div class="code-row${tint}"><span class="code-num">${line.number}</span><code class="code-text">${text}</code><span class="line-content" hidden>${text}</span></div>`;
    return context.wrapLine(row, line.sourceLine) + line.pins.map((pin) => renderPin(pin, context)).join('');
}

export function renderCodeCard(body: string, fence: FenceInfo, context: BlockContext): string {
    const info = parseCodeInfo(context.rawTitle);
    if (!info) return '';
    const parsed = parseCode(body, info, context);
    if (!parsed.ok) return '';
    const language = fence.language ? ` data-language="${fence.language}"` : '';
    const head = `<div class="code-head"><span class="code-badge">code</span>${renderFile(info)}${renderKind(info)}</div>`;
    const lines = parsed.lines.map((line) => renderLine(line, context)).join('');
    return `<div class="code-card code-card--${info.kind}"${language}>${head}<div class="code-lines">${lines}</div></div>`;
}
