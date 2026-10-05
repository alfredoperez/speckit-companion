// Turns a `tmux capture-pane -e -p` capture into a grid of styled cells, and that grid into text or an HTML page.

const BASE = [
    [0x1e, 0x1e, 0x1e], [0xe0, 0x6c, 0x75], [0x8c, 0xc5, 0x70], [0xe5, 0xc0, 0x7b], [0x61, 0xaf, 0xef], [0xc6, 0x78, 0xdd], [0x56, 0xb6, 0xc2], [0xcc, 0xcc, 0xcc],
    [0x6b, 0x6b, 0x6b], [0xf4, 0x7c, 0x85], [0xa5, 0xd6, 0x8a], [0xf0, 0xd0, 0x8c], [0x7c, 0xc0, 0xf5], [0xd6, 0x92, 0xe8], [0x6c, 0xc8, 0xd4], [0xff, 0xff, 0xff],
];
export const BACKGROUND = [0x1a, 0x1b, 0x1e];
export const FOREGROUND = [0xd8, 0xd8, 0xd8];
const LEVELS = [0, 95, 135, 175, 215, 255];

function indexed(n) {
    if (n < 16) return BASE[n];
    if (n < 232) {
        const c = n - 16;
        return [LEVELS[Math.floor(c / 36)], LEVELS[Math.floor(c / 6) % 6], LEVELS[c % 6]];
    }
    const grey = 8 + (n - 232) * 10;
    return [grey, grey, grey];
}

/** How many columns a character takes: 0 for joiners and variation selectors, 2 for wide and emoji. */
export function cellWidth(ch) {
    const cp = ch.codePointAt(0);
    if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0x300 && cp <= 0x36f)) return 0;
    if (cp >= 0x1f300 && cp <= 0x1faff) return 2;
    if (cp >= 0x1100 && cp <= 0x115f) return 2;
    if (cp >= 0x2e80 && cp <= 0xa4cf) return 2;
    if (cp >= 0xac00 && cp <= 0xd7a3) return 2;
    if (cp >= 0xf900 && cp <= 0xfaff) return 2;
    if (cp >= 0xff00 && cp <= 0xff60) return 2;
    if ([0x231a, 0x231b, 0x23e9, 0x23ea, 0x23eb, 0x23ec, 0x23f0, 0x23f3, 0x26a1, 0x2705, 0x274c, 0x2728, 0x2b50].includes(cp)) return 2;
    return 1;
}

const plainStyle = () => ({ fg: null, bg: null, bold: false, dim: false, italic: false, underline: false, inverse: false, strike: false });

function applySgr(style, params) {
    const codes = params === '' ? [0] : params.split(/[;:]/).map(p => (p === '' ? 0 : Number(p)));
    for (let i = 0; i < codes.length; i++) {
        const c = codes[i];
        if (c === 0) Object.assign(style, plainStyle());
        else if (c === 1) style.bold = true;
        else if (c === 2) style.dim = true;
        else if (c === 3) style.italic = true;
        else if (c === 4) style.underline = true;
        else if (c === 7) style.inverse = true;
        else if (c === 9) style.strike = true;
        else if (c === 22) style.bold = style.dim = false;
        else if (c === 23) style.italic = false;
        else if (c === 24) style.underline = false;
        else if (c === 27) style.inverse = false;
        else if (c === 29) style.strike = false;
        else if (c >= 30 && c <= 37) style.fg = BASE[c - 30];
        else if (c === 39) style.fg = null;
        else if (c >= 40 && c <= 47) style.bg = BASE[c - 40];
        else if (c === 49) style.bg = null;
        else if (c >= 90 && c <= 97) style.fg = BASE[c - 82];
        else if (c >= 100 && c <= 107) style.bg = BASE[c - 92];
        else if (c === 38 || c === 48) {
            const key = c === 38 ? 'fg' : 'bg';
            if (codes[i + 1] === 5) {
                style[key] = indexed(codes[i + 2] ?? 0);
                i += 2;
            } else if (codes[i + 1] === 2) {
                // The colon form carries an empty colour-space slot before the three channels.
                const at = codes.length - i >= 6 && params.includes(':') ? i + 3 : i + 2;
                style[key] = [codes[at] ?? 0, codes[at + 1] ?? 0, codes[at + 2] ?? 0];
                i = at + 2;
            }
        }
    }
}

/** One array of cells per screen row; a cell is a character, its column and width, and its style. */
export function parseAnsi(capture) {
    const lines = capture.replace(/\n$/, '').split('\n');
    const style = plainStyle();
    return lines.map((line) => {
        const cells = [];
        let col = 0;
        for (let i = 0; i < line.length;) {
            if (line[i] === '\x1b') {
                if (line[i + 1] === '[') {
                    const end = line.slice(i + 2).search(/[@-~]/);
                    if (end < 0) break;
                    if (line[i + 2 + end] === 'm') applySgr(style, line.slice(i + 2, i + 2 + end));
                    i += end + 3;
                } else if (line[i + 1] === ']') {
                    const rest = line.slice(i);
                    const end = rest.search(/\x07|\x1b\\/);
                    if (end < 0) break;
                    i += end + (rest[end] === '\x07' ? 1 : 2);
                } else i += 2;
                continue;
            }
            const ch = String.fromCodePoint(line.codePointAt(i));
            i += ch.length;
            const w = cellWidth(ch);
            if (w === 0 && cells.length) {
                cells[cells.length - 1].ch += ch;
                continue;
            }
            cells.push({ ch, col, w: w || 1, ...style });
            col += w || 1;
        }
        // tmux drops the blank cells that end a row, so the style still set there is what they were painted with.
        cells.tail = cellCss({ ...style, ch: ' ' });
        return cells;
    });
}

/** The text of one row between two columns, with every cell at its own column. */
export function rowText(cells, from = 0, to = Infinity) {
    let out = '';
    let col = from;
    for (const cell of cells) {
        if (cell.col < from || cell.col >= to) continue;
        out += ' '.repeat(Math.max(0, cell.col - col)) + cell.ch;
        col = cell.col + cell.w;
    }
    return out.replace(/\s+$/, '');
}

export function gridText(grid, from = 0, to = Infinity) {
    return grid.map(cells => rowText(cells, from, to)).join('\n');
}

const css = ([r, g, b]) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cellCss(cell) {
    if (cell.ch === ' ' && !cell.inverse && !cell.underline) return cell.bg ? `background:${css(cell.bg)}` : '';
    let fg = cell.fg ?? FOREGROUND;
    let bg = cell.bg ?? BACKGROUND;
    if (cell.inverse) [fg, bg] = [bg, fg];
    if (cell.dim) fg = mix(fg, bg, 0.45);
    const rules = [];
    if (css(fg) !== css(FOREGROUND)) rules.push(`color:${css(fg)}`);
    if (css(bg) !== css(BACKGROUND)) rules.push(`background:${css(bg)}`);
    if (cell.bold) rules.push('font-weight:700');
    if (cell.italic) rules.push('font-style:italic');
    const lines = [cell.underline && 'underline', cell.strike && 'line-through'].filter(Boolean);
    if (lines.length) rules.push(`text-decoration:${lines.join(' ')}`);
    return rules.join(';');
}

// Rules are painted, not typed: a font's box-drawing glyphs leave gaps between rows.
const RULES = { '│': 'v', '─': 'h', '╌': 'd' };

/** A page that draws the grid (or a window of it) in a dark terminal palette, one fixed-width cell per column. */
export function gridHtml(grid, { from = 0, to, rowFrom = 0, rowTo = grid.length } = {}) {
    const last = to ?? Math.max(1, ...grid.map(cells => (cells.length ? cells.at(-1).col + cells.at(-1).w : 0)));
    const rows = grid.slice(rowFrom, rowTo).map((cells) => {
        let html = '';
        let col = from;
        let run = null;
        const flush = () => {
            if (!run) return;
            html += `<span${run.css ? ` style="${run.css}"` : ''}>${escapeHtml(run.text)}</span>`;
            run = null;
        };
        const pad = (until, style) => {
            if (until <= col) return;
            if (run && run.css === style) run.text += ' '.repeat(until - col);
            else {
                flush();
                run = { css: style, text: ' '.repeat(until - col) };
            }
            col = until;
        };
        for (const cell of cells) {
            if (cell.col < from || cell.col >= last) continue;
            pad(cell.col, '');
            const style = cellCss(cell);
            const ascii = cell.ch.length === 1 && cell.ch.charCodeAt(0) < 0x7f;
            if (ascii) {
                if (run && run.css === style) run.text += cell.ch;
                else {
                    flush();
                    run = { css: style, text: cell.ch };
                }
            } else {
                flush();
                const rule = RULES[cell.ch];
                const width = cell.w === 2 ? ';width:2ch' : '';
                html += rule
                    ? `<span class="c ${rule}" style="${style}"> </span>`
                    : `<span class="c" style="${style}${width}">${escapeHtml(cell.ch)}</span>`;
            }
            col = cell.col + cell.w;
        }
        pad(last, cells.tail ?? '');
        flush();
        return `<div class="r">${html}</div>`;
    });
    return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:${css(BACKGROUND)}}
#screen{display:inline-block;padding:10px 12px;background:${css(BACKGROUND)};color:${css(FOREGROUND)};font:14px/18px "SF Mono",Menlo,Monaco,"DejaVu Sans Mono",Consolas,"Liberation Mono",monospace;font-variant-ligatures:none}
.r{height:18px;white-space:pre;width:${last - from}ch}
.r span{display:inline-block;height:18px;vertical-align:top}
.c{width:1ch;text-align:center;overflow:visible}
.v{background-image:linear-gradient(currentColor,currentColor);background-size:1px 100%;background-position:center;background-repeat:no-repeat}
.h{background-image:linear-gradient(currentColor,currentColor);background-size:100% 1px;background-position:center;background-repeat:no-repeat}
.d{background-image:linear-gradient(90deg,currentColor 60%,transparent 60%);background-size:100% 1px;background-position:center;background-repeat:no-repeat}
</style></head><body><div id="screen">${rows.join('')}</div></body></html>`;
}
