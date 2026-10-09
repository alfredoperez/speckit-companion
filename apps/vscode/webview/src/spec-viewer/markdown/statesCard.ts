import type { BlockContext } from './blockFences';
import type { FenceInfo } from './fenceInfo';
import { escapeHtml } from './inline';
import { renderScreenFrameByName } from './screenCard';

export interface StateItem {
    name: string;
    sentence: string;
    start: boolean;
    final: boolean;
    proposed: boolean;
    /** The screen this state names; the card draws its wireframe under the caption. */
    shows: string | null;
}

export interface StateArrow {
    from: number;
    to: number;
    label: string;
    proposed: boolean;
}

export interface ParsedStates {
    states: StateItem[];
    arrows: StateArrow[];
    /** Grid cells hold a state's index, or -1 for an empty cell. */
    grid: number[][];
    start: number;
}

export type StatesResult = ({ ok: true } & ParsedStates) | { ok: false; error: string };

export const MAX_STATES = 8;
export const MAX_COLUMNS = 4;
export const MAX_ROWS = 3;

const TRAILER = /\s*(\((?:start|final|proposed)\)|shows\s+[\w.-]+)\s*$/;

function parseState(text: string, names: Set<string>): StateItem | string {
    const colon = text.indexOf(':');
    const name = colon < 0 ? '' : text.slice(0, colon).trim();
    if (!name) return 'a state line needs `name: one sentence`';
    if (names.has(name)) return `the state "${name}" is written twice`;
    let rest = text.slice(colon + 1).trim();
    const state: StateItem = { name, sentence: '', start: false, final: false, proposed: false, shows: null };
    for (let found = rest.match(TRAILER); found; found = rest.match(TRAILER)) {
        const mark = found[1];
        if (mark.startsWith('shows')) state.shows = mark.replace(/^shows\s+/, '');
        else state[mark.slice(1, -1) as 'start' | 'final' | 'proposed'] = true;
        rest = rest.slice(0, found.index).trim();
    }
    if (!rest) return `the state "${name}" has no sentence`;
    state.sentence = rest;
    return state;
}

export function parseStates(body: string): StatesResult {
    const states: StateItem[] = [];
    const arrowLines: string[] = [];
    const gridLines: string[] = [];
    let inGrid = false;
    for (const raw of body.split('\n')) {
        const text = raw.trim();
        if (!text) continue;
        if (/^grid:\s*$/i.test(text)) {
            if (inGrid) return { ok: false, error: 'a second grid' };
            inGrid = true;
        } else if (inGrid) gridLines.push(text);
        else if (/^[^:]*->/.test(text)) arrowLines.push(text);
        else {
            const state = parseState(text, new Set(states.map((s) => s.name)));
            if (typeof state === 'string') return { ok: false, error: state };
            states.push(state);
        }
    }
    if (states.length === 0) return { ok: false, error: 'no states' };
    if (states.length > MAX_STATES) return { ok: false, error: `more than ${MAX_STATES} states` };
    const index = new Map(states.map((s, i) => [s.name, i]));

    const arrows: StateArrow[] = [];
    for (const line of arrowLines) {
        const found = line.match(/^(.+?)\s*->\s*([^:]+?)\s*(?::\s*(.*))?$/);
        if (!found) return { ok: false, error: 'an arrow needs `from -> to: label`' };
        let label = (found[3] ?? '').trim();
        const proposed = /\(proposed\)\s*$/.test(label) || (!label && /\(proposed\)\s*$/.test(found[2]));
        label = label.replace(/\s*\(proposed\)\s*$/, '');
        const toName = found[2].replace(/\s*\(proposed\)\s*$/, '');
        const from = index.get(found[1].trim());
        const to = index.get(toName);
        if (from === undefined || to === undefined) return { ok: false, error: 'an arrow names a state that is not listed' };
        arrows.push({ from, to, label, proposed });
    }

    if (gridLines.length === 0) return { ok: false, error: 'no grid' };
    if (gridLines.length > MAX_ROWS) return { ok: false, error: `more than ${MAX_ROWS} grid rows` };
    const grid: number[][] = [];
    const placed = new Set<number>();
    for (const line of gridLines) {
        const cells = line.includes('|') ? line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()) : line.split(/\s+/);
        const row: number[] = [];
        for (const cell of cells) {
            if (cell === '.' || cell === '') { row.push(-1); continue; }
            const at = index.get(cell);
            if (at === undefined) return { ok: false, error: `the grid names "${cell}", which is not a state` };
            if (placed.has(at)) return { ok: false, error: `the grid places "${cell}" twice` };
            placed.add(at);
            row.push(at);
        }
        grid.push(row);
    }
    const columns = Math.max(...grid.map((row) => row.length));
    if (columns > MAX_COLUMNS) return { ok: false, error: `more than ${MAX_COLUMNS} grid columns` };
    grid.forEach((row) => { while (row.length < columns) row.push(-1); });
    while (grid.length > 1 && grid[grid.length - 1].every((cell) => cell === -1)) grid.pop();
    if (placed.size !== states.length) return { ok: false, error: 'a state is missing from the grid' };

    const starts = states.map((s, i) => (s.start ? i : -1)).filter((i) => i >= 0);
    if (starts.length > 1) return { ok: false, error: 'more than one start state' };
    return { ok: true, states, arrows, grid, start: starts[0] ?? 0 };
}

export const CHAR_W = 7.6;
export const BOX_PAD_X = 14;
export const MIN_BOX_W = 120;
export const MAX_BOX_W = 200;
export const CELL_H = 52;
const MAX_CHARS = Math.floor((MAX_BOX_W - BOX_PAD_X * 2) / CHAR_W);
const GAP_X = 104;
const GAP_Y = 64;
const PAD_X = 24;
const PAD_Y = 36;
const LANE = 10;

interface Point { x: number; y: number }

export function shortName(name: string): string {
    return name.length > MAX_CHARS ? `${name.slice(0, MAX_CHARS - 1)}…` : name;
}

function boxWidth(states: StateItem[]): number {
    const chars = Math.max(...states.map((s) => shortName(s.name).length));
    return Math.min(MAX_BOX_W, Math.max(MIN_BOX_W, Math.ceil(chars * CHAR_W + BOX_PAD_X * 2)));
}

function layout(grid: number[][], cellW: number): { width: number; height: number; centres: Map<number, Point> } {
    const columns = grid[0].length;
    const width = PAD_X * 2 + columns * cellW + (columns - 1) * GAP_X;
    const height = PAD_Y * 2 + grid.length * CELL_H + (grid.length - 1) * GAP_Y;
    const centres = new Map<number, Point>();
    grid.forEach((row, r) => row.forEach((at, c) => {
        if (at >= 0) centres.set(at, { x: PAD_X + c * (cellW + GAP_X) + cellW / 2, y: PAD_Y + r * (CELL_H + GAP_Y) + CELL_H / 2 });
    }));
    return { width, height, centres };
}

const round = (n: number): number => Math.round(n * 10) / 10;

/** Where a ray from a box's centre toward `to` leaves the box. */
function edge(from: Point, to: Point, cellW: number): Point {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const scale = Math.min(dx ? cellW / 2 / Math.abs(dx) : Infinity, dy ? CELL_H / 2 / Math.abs(dy) : Infinity);
    return { x: from.x + dx * scale, y: from.y + dy * scale };
}

export const MAX_LABELLED_ARROWS = 8;
export const LABEL_CHAR_W = 7;
export const LABEL_H = 16;
const VIEW_PAD = 10;
const CLEAR = 4;

export interface Rect { x: number; y: number; w: number; h: number }

interface Drawn { html: string; points: Point[]; label: Rect | null }

const sample = (p: Point, c: Point, q: Point): Point[] =>
    [0, 0.25, 0.5, 0.75, 1].map((t) => ({
        x: (1 - t) * (1 - t) * p.x + 2 * (1 - t) * t * c.x + t * t * q.x,
        y: (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * c.y + t * t * q.y,
    }));

export function labelRect(text: string, at: Point, anchor: string): Rect {
    const w = text.length * LABEL_CHAR_W + 6;
    const x = anchor === 'start' ? at.x : anchor === 'end' ? at.x - w : at.x - w / 2;
    return { x, y: at.y - LABEL_H / 2, w, h: LABEL_H };
}

interface ArrowContext {
    centres: Map<number, Point>;
    cellW: number;
    paired: boolean;
    labelled: boolean;
}

function crossedCentre(p: Point, q: Point, arrow: StateArrow, ctx: ArrowContext): Point | null {
    for (let step = 1; step < 24; step++) {
        const t = step / 24;
        const x = p.x + (q.x - p.x) * t;
        const y = p.y + (q.y - p.y) * t;
        for (const [at, c] of ctx.centres) {
            if (at === arrow.from || at === arrow.to) continue;
            if (Math.abs(x - c.x) < ctx.cellW / 2 + CLEAR && Math.abs(y - c.y) < CELL_H / 2 + CLEAR) return c;
        }
    }
    return null;
}

function renderArrow(arrow: StateArrow, ctx: ArrowContext): Drawn {
    const { centres, cellW, paired, labelled } = ctx;
    const a = centres.get(arrow.from) as Point;
    const b = centres.get(arrow.to) as Point;
    const cls = `states-arrow${arrow.proposed ? ' states-arrow--proposed' : ''}`;
    const marker = arrow.proposed ? 'states-head-proposed' : 'states-head';
    const wrap = (inner: string): string => `<g class="states-edge" data-from="${arrow.from}">${inner}</g>`;
    const text = (at: Point, anchor: string): string => labelled && arrow.label
        ? `<text class="states-label" x="${round(at.x)}" y="${round(at.y)}" text-anchor="${anchor}" dominant-baseline="central">${escapeHtml(arrow.label)}</text>`
        : '';
    const rect = (at: Point, anchor: string): Rect | null => (labelled && arrow.label ? labelRect(arrow.label, at, anchor) : null);

    if (arrow.from === arrow.to) {
        const x = a.x;
        const top = a.y - CELL_H / 2;
        const d = `M ${round(x - 18)} ${round(top)} C ${round(x - 18)} ${round(top - 30)}, ${round(x + 18)} ${round(top - 30)}, ${round(x + 18)} ${round(top)}`;
        const at = { x, y: top - 32 };
        return {
            html: wrap(`<path class="${cls}" d="${d}" marker-end="url(#${marker})"/>${text(at, 'middle')}`),
            points: [{ x: x - 18, y: top }, { x: x + 18, y: top }, { x, y: top - 23 }],
            label: rect(at, 'middle'),
        };
    }
    const nx = b.y - a.y;
    const ny = a.x - b.x;
    const length = Math.hypot(nx, ny) || 1;
    const ux = nx / length;
    const uy = ny / length;
    const shift = paired ? LANE : 0;
    const ox = ux * shift;
    const oy = uy * shift;
    const p = edge({ x: a.x + ox, y: a.y + oy }, { x: b.x + ox, y: b.y + oy }, cellW);
    const q = edge({ x: b.x + ox, y: b.y + oy }, { x: a.x + ox, y: a.y + oy }, cellW);

    const crossed = crossedCentre(p, q, arrow, ctx);
    if (crossed) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const side = ux * (crossed.x - mid.x) + uy * (crossed.y - mid.y) > 0 ? -1 : 1;
        const bow = CELL_H + 40 + (paired && arrow.from > arrow.to ? 2 * LANE + 16 : 0);
        const control = { x: mid.x + ux * side * bow, y: mid.y + uy * side * bow };
        const start = edge(a, control, cellW);
        const end = edge(b, control, cellW);
        const apex = { x: (start.x + 2 * control.x + end.x) / 4, y: (start.y + 2 * control.y + end.y) / 4 };
        const d = `M ${round(start.x)} ${round(start.y)} Q ${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`;
        return {
            html: wrap(`<path class="${cls}" d="${d}" marker-end="url(#${marker})"/>${text(apex, 'middle')}`),
            points: sample(start, control, end),
            label: rect(apex, 'middle'),
        };
    }
    const upright = Math.abs(ux) > 0.7;
    const reach = paired ? shift + (upright ? 6 : 8) : 0;
    const at = { x: (p.x + q.x) / 2 + ux * reach, y: (p.y + q.y) / 2 + uy * reach };
    const anchor = paired && upright ? (ux > 0 ? 'start' : 'end') : 'middle';
    return {
        html: wrap(`<path class="${cls}" d="M ${round(p.x)} ${round(p.y)} L ${round(q.x)} ${round(q.y)}" marker-end="url(#${marker})"/>${text(at, anchor)}`),
        points: [p, q],
        label: rect(at, anchor),
    };
}

/** The viewBox that holds every box, arrow and label, with a little room. */
export function viewBoxOf(width: number, height: number, drawn: Drawn[]): { x: number; y: number; w: number; h: number } {
    let x0 = 0, y0 = 0, x1 = width, y1 = height;
    for (const item of drawn) {
        for (const pt of item.points) {
            x0 = Math.min(x0, pt.x); x1 = Math.max(x1, pt.x);
            y0 = Math.min(y0, pt.y); y1 = Math.max(y1, pt.y);
        }
        if (item.label) {
            x0 = Math.min(x0, item.label.x); x1 = Math.max(x1, item.label.x + item.label.w);
            y0 = Math.min(y0, item.label.y); y1 = Math.max(y1, item.label.y + item.label.h);
        }
    }
    const x = Math.floor(x0 - VIEW_PAD);
    const y = Math.floor(y0 - VIEW_PAD);
    return { x, y, w: Math.ceil(x1 + VIEW_PAD) - x, h: Math.ceil(y1 + VIEW_PAD) - y };
}

/** What the diagram would draw for these arrows: the viewBox and every label rectangle, for the tests. */
export function diagramGeometry(parsed: ParsedStates, forceLabels = false): { viewBox: Rect; labels: Rect[]; labelled: boolean } {
    const cellW = boxWidth(parsed.states);
    const { width, height, centres } = layout(parsed.grid, cellW);
    const labelled = forceLabels || parsed.arrows.length <= MAX_LABELLED_ARROWS;
    const pairs = new Set(parsed.arrows.map((arrow) => `${arrow.from}>${arrow.to}`));
    const drawn = parsed.arrows.map((arrow) =>
        renderArrow(arrow, { centres, cellW, labelled, paired: arrow.from !== arrow.to && pairs.has(`${arrow.to}>${arrow.from}`) }));
    const box = viewBoxOf(width, height, drawn);
    return { viewBox: { x: box.x, y: box.y, w: box.w, h: box.h }, labels: drawn.flatMap((d) => (d.label ? [d.label] : [])), labelled };
}

function renderDiagram(parsed: ParsedStates): string {
    const cellW = boxWidth(parsed.states);
    const { width, height, centres } = layout(parsed.grid, cellW);
    const labelled = parsed.arrows.length <= MAX_LABELLED_ARROWS;
    const pairs = new Set(parsed.arrows.map((arrow) => `${arrow.from}>${arrow.to}`));
    const drawn = parsed.arrows.map((arrow) =>
        renderArrow(arrow, { centres, cellW, labelled, paired: arrow.from !== arrow.to && pairs.has(`${arrow.to}>${arrow.from}`) }));
    const box = viewBoxOf(width, height, drawn);
    const head = (id: string, cls: string): string =>
        `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="${cls}" d="M 0 0 L 10 5 L 0 10 z"/></marker>`;
    const defs = `<defs>${head('states-head', 'states-tip')}${head('states-head-proposed', 'states-tip states-tip--proposed')}</defs>`;
    const edges = drawn.map((d) => d.html).join('')
        .replace(new RegExp(`data-from="${parsed.start}"`, 'g'), `data-from="${parsed.start}" data-out="true"`);
    const dense = labelled ? '' : ' states-svg--dense';
    const svg = `<svg class="states-svg${dense}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" role="presentation" focusable="false">${defs}${edges}</svg>`;
    const percent = (n: number, of: number): number => Math.round((n / of) * 10000) / 100;
    const buttons = parsed.states.map((state, i) => {
        const tag = [i === parsed.start ? 'start' : '', state.final ? 'final' : ''].filter(Boolean).join(' · ');
        const tagHtml = tag ? `<span class="states-tag">${tag}</span>` : '';
        const shown = shortName(state.name);
        const titleAttr = shown === state.name ? '' : ` title="${escapeHtml(state.name).replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"`;
        const at = centres.get(i) as Point;
        const cls = ['states-state', i === parsed.start ? 'is-selected' : '', state.proposed ? 'states-state--proposed' : '']
            .filter(Boolean).join(' ');
        const style = `left:${percent(at.x - cellW / 2 - box.x, box.w)}%;top:${percent(at.y - CELL_H / 2 - box.y, box.h)}%;width:${percent(cellW, box.w)}%;height:${percent(CELL_H, box.h)}%`;
        return `<button type="button" class="${cls}" data-state="${i}" aria-pressed="${i === parsed.start}"${titleAttr} style="${style}"><span class="states-name">${escapeHtml(shown)}</span>${tagHtml}</button>`;
    }).join('');
    return `<div class="states-stage" style="--w:${box.w};max-width:${box.w}px;aspect-ratio:${box.w} / ${box.h}">${svg}${buttons}</div>`;
}

/** One state's outgoing moves as `→ Target: label` lines; empty when it has none. */
function movesHtml(parsed: ParsedStates, from: number): string {
    const moves = parsed.arrows.filter((arrow) => arrow.from === from);
    if (!moves.length) return '';
    const lines = moves.map((arrow) => {
        const label = arrow.label ? `: ${escapeHtml(arrow.label)}` : '';
        const tag = arrow.proposed ? ' <span class="states-move-tag">(proposed)</span>' : '';
        return `<span class="states-move${arrow.proposed ? ' states-move--proposed' : ''}">→ <strong>${escapeHtml(parsed.states[arrow.to].name)}</strong>${label}${tag}</span>`;
    }).join('');
    return `<span class="states-moves">${lines}</span>`;
}

export function renderStatesCard(body: string, info: FenceInfo, context: BlockContext): string {
    const parsed = parseStates(body);
    if (!parsed.ok) return '';
    const { states, start } = parsed;
    const proposed = states.filter((s) => s.proposed).length;
    const title = info.title || context.rawTitle;
    const titleHtml = title ? `<span class="states-title">${escapeHtml(title)}</span>` : '';
    const legend = `<span class="states-legend">${states.length} state${states.length === 1 ? '' : 's'}${proposed ? ` · <span class="states-legend-new">${proposed} proposed</span>` : ''}</span>`;
    const list = states.map((s, i) =>
        `<li data-state="${i}"><span class="states-list-name">${escapeHtml(s.name)}</span> <span class="states-sentence">${escapeHtml(s.sentence)}</span>${movesHtml(parsed, i)}</li>`).join('');
    const frames = states.map((s) => (s.shows ? renderScreenFrameByName(s.shows) : null));
    const shown = frames[start] ? `<div class="states-shown">${frames[start]}</div>` : '';
    const stash = frames.some(Boolean)
        ? `<div class="states-screens" hidden>${frames.map((html, i) => (html ? `<div data-state="${i}">${html}</div>` : '')).join('')}</div>`
        : '';
    const note = context.note ? `<div class="states-note">${escapeHtml(context.note)}</div>` : '';
    const card = `<div class="states-card"><div class="states-top"><span class="states-badge">states</span>${titleHtml}${legend}</div>`
        + `<div class="states-hint">Pick a state to read what it means</div>${renderDiagram(parsed)}`
        + `<div class="states-caption" aria-live="polite"><strong>${escapeHtml(states[start].name)}</strong>: ${escapeHtml(states[start].sentence)}</div>${movesHtml(parsed, start)}${shown}${stash}`
        + `<ul class="states-list">${list}</ul>${note}<span class="line-content" hidden>${escapeHtml(body.trim())}</span></div>`;
    return context.wrapLine(card, context.firstLine);
}
