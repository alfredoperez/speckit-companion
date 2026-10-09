import type { BlockContext } from './blockFences';
import type { FenceInfo } from './fenceInfo';
import { escapeHtml } from './inline';

export interface StateItem {
    name: string;
    sentence: string;
    start: boolean;
    final: boolean;
    proposed: boolean;
    /** The screen this state names. Kept for the screen block; nothing draws it yet. */
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
    if (placed.size !== states.length) return { ok: false, error: 'a state is missing from the grid' };

    const starts = states.map((s, i) => (s.start ? i : -1)).filter((i) => i >= 0);
    if (starts.length > 1) return { ok: false, error: 'more than one start state' };
    return { ok: true, states, arrows, grid, start: starts[0] ?? 0 };
}

const CELL_W = 128;
const CELL_H = 54;
const GAP_X = 104;
const GAP_Y = 64;
const PAD_X = 24;
const PAD_Y = 36;
const LANE = 10;

interface Point { x: number; y: number }

function layout(grid: number[][]): { width: number; height: number; centres: Map<number, Point> } {
    const columns = grid[0].length;
    const width = PAD_X * 2 + columns * CELL_W + (columns - 1) * GAP_X;
    const height = PAD_Y * 2 + grid.length * CELL_H + (grid.length - 1) * GAP_Y;
    const centres = new Map<number, Point>();
    grid.forEach((row, r) => row.forEach((at, c) => {
        if (at >= 0) centres.set(at, { x: PAD_X + c * (CELL_W + GAP_X) + CELL_W / 2, y: PAD_Y + r * (CELL_H + GAP_Y) + CELL_H / 2 });
    }));
    return { width, height, centres };
}

const round = (n: number): number => Math.round(n * 10) / 10;

/** Where a ray from a box's centre toward `to` leaves the box. */
function edge(from: Point, to: Point): Point {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const scale = Math.min(dx ? CELL_W / 2 / Math.abs(dx) : Infinity, dy ? CELL_H / 2 / Math.abs(dy) : Infinity);
    return { x: from.x + dx * scale, y: from.y + dy * scale };
}

function renderArrow(arrow: StateArrow, centres: Map<number, Point>, paired: boolean): string {
    const a = centres.get(arrow.from) as Point;
    const b = centres.get(arrow.to) as Point;
    const cls = `states-arrow${arrow.proposed ? ' states-arrow--proposed' : ''}`;
    const marker = arrow.proposed ? 'states-head-proposed' : 'states-head';
    if (arrow.from === arrow.to) {
        const x = a.x;
        const top = a.y - CELL_H / 2;
        const d = `M ${round(x - 18)} ${round(top)} C ${round(x - 18)} ${round(top - 30)}, ${round(x + 18)} ${round(top - 30)}, ${round(x + 18)} ${round(top)}`;
        const label = arrow.label ? `<text class="states-label" x="${round(x)}" y="${round(top - 32)}" text-anchor="middle">${escapeHtml(arrow.label)}</text>` : '';
        return `<g><path class="${cls}" d="${d}" marker-end="url(#${marker})"/>${label}</g>`;
    }
    const nx = b.y - a.y;
    const ny = a.x - b.x;
    const length = Math.hypot(nx, ny) || 1;
    const ux = nx / length;
    const uy = ny / length;
    const shift = paired ? LANE : 0;
    const ox = ux * shift;
    const oy = uy * shift;
    const p = edge({ x: a.x + ox, y: a.y + oy }, { x: b.x + ox, y: b.y + oy });
    const q = edge({ x: b.x + ox, y: b.y + oy }, { x: a.x + ox, y: a.y + oy });
    const reach = shift + 9;
    const lx = (p.x + q.x) / 2 + ux * reach;
    const ly = (p.y + q.y) / 2 + uy * reach;
    const anchor = ux > 0.35 ? 'start' : ux < -0.35 ? 'end' : 'middle';
    const label = arrow.label
        ? `<text class="states-label" x="${round(lx)}" y="${round(ly)}" text-anchor="${anchor}" dominant-baseline="central">${escapeHtml(arrow.label)}</text>`
        : '';
    return `<g><path class="${cls}" d="M ${round(p.x)} ${round(p.y)} L ${round(q.x)} ${round(q.y)}" marker-end="url(#${marker})"/>${label}</g>`;
}

function renderDiagram(parsed: ParsedStates): string {
    const { width, height, centres } = layout(parsed.grid);
    const pairs = new Set(parsed.arrows.map((arrow) => `${arrow.from}>${arrow.to}`));
    const arrows = parsed.arrows.map((arrow) =>
        renderArrow(arrow, centres, arrow.from !== arrow.to && pairs.has(`${arrow.to}>${arrow.from}`))).join('');
    const head = (id: string, cls: string): string =>
        `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="${cls}" d="M 0 0 L 10 5 L 0 10 z"/></marker>`;
    const defs = `<defs>${head('states-head', 'states-tip')}${head('states-head-proposed', 'states-tip states-tip--proposed')}</defs>`;
    const svg = `<svg class="states-svg" viewBox="0 0 ${width} ${height}" role="presentation" focusable="false">${defs}${arrows}</svg>`;
    const percent = (n: number, of: number): number => Math.round((n / of) * 10000) / 100;
    const buttons = parsed.states.map((state, i) => {
        const tag = [i === parsed.start ? 'start' : '', state.final ? 'final' : ''].filter(Boolean).join(' · ');
        const tagHtml = tag ? `<span class="states-tag">${tag}</span>` : '';
        const at = centres.get(i) as Point;
        const cls = ['states-state', i === parsed.start ? 'is-selected' : '', state.proposed ? 'states-state--proposed' : '', state.final ? 'states-state--final' : '']
            .filter(Boolean).join(' ');
        const style = `left:${percent(at.x - CELL_W / 2, width)}%;top:${percent(at.y - CELL_H / 2, height)}%;width:${percent(CELL_W, width)}%;height:${percent(CELL_H, height)}%`;
        return `<button type="button" class="${cls}" data-state="${i}" aria-pressed="${i === parsed.start}" style="${style}"><span class="states-name">${escapeHtml(state.name)}</span>${tagHtml}</button>`;
    }).join('');
    return `<div class="states-stage" style="max-width:${width}px;aspect-ratio:${width} / ${height}">${svg}${buttons}</div>`;
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
        `<li data-state="${i}"><span class="states-list-name">${escapeHtml(s.name)}</span> <span class="states-sentence">${escapeHtml(s.sentence)}</span></li>`).join('');
    const note = context.note ? `<div class="states-note">${escapeHtml(context.note)}</div>` : '';
    const card = `<div class="states-card"><div class="states-top"><span class="states-badge">states</span>${titleHtml}${legend}</div>`
        + `<div class="states-hint">Pick a state to read what it means</div>${renderDiagram(parsed)}`
        + `<div class="states-caption" aria-live="polite"><strong>${escapeHtml(states[start].name)}</strong>: ${escapeHtml(states[start].sentence)}</div>`
        + `<ul class="states-list">${list}</ul>${note}<span class="line-content" hidden>${escapeHtml(body.trim())}</span></div>`;
    return context.wrapLine(card, context.firstLine);
}
