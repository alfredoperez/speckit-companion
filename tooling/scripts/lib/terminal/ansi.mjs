// Turns a `tmux capture-pane -e -p` capture into a grid of styled cells, and that grid into text or an HTML page.

const BASE = [
    [0x1e, 0x1e, 0x1e], [0xe0, 0x6c, 0x75], [0x8c, 0xc5, 0x70], [0xe5, 0xc0, 0x7b], [0x61, 0xaf, 0xef], [0xc6, 0x78, 0xdd], [0x56, 0xb6, 0xc2], [0xcc, 0xcc, 0xcc],
    [0x6b, 0x6b, 0x6b], [0xf4, 0x7c, 0x85], [0xa5, 0xd6, 0x8a], [0xf0, 0xd0, 0x8c], [0x7c, 0xc0, 0xf5], [0xd6, 0x92, 0xe8], [0x6c, 0xc8, 0xd4], [0xff, 0xff, 0xff],
];
const hex = value => [1, 3, 5].map(at => parseInt(value.slice(at, at + 2), 16));
// The pane docked beside the transcript is painted in this grey, which is how a look finds it.
const PANE_GREY = [0x26, 0x26, 0x26];
// `plain` is what the check has always drawn. `site` is for pictures on the site and in the docs: the ground, panel, border and
// text colours of apps/website/src/styles/tokens.css, with the pane one step lighter than the panel so it reads as a card.
// `claude` is for videos and pictures that should read as Claude Code itself, read off the reference drawing: a warm near-black
// ground, a terracotta edge and accent, grey window dots, and no coloured glow behind the window.
export const LOOKS = {
    plain: { background: [0x1a, 0x1b, 0x1e], foreground: [0xd8, 0xd8, 0xd8], size: 14, row: 18 },
    site: {
        background: hex('#0d0b1a'), foreground: hex('#edeaf6'), size: 15, row: 21,
        ground: hex('#0a0913'), card: hex('#15122a'), border: hex('#2a2545'), rule: hex('#1d1930'), dot: hex('#3a3357'), label: hex('#6f6994'),
        accent: hex('#a78bfa'), dim: hex('#9d97bd'), green: hex('#7cc98a'),
        radius: 14, tint: [0.97, 0.93, 1.14], glow: 'rgb(139 92 246 / 0.12)',
    },
    claude: {
        background: hex('#1a1a17'), foreground: hex('#fafaf8'), size: 16, row: 27,
        ground: hex('#141411'), card: hex('#2a2a27'), border: hex('#cc785c'), rule: hex('#211f1c'), dot: hex('#5c5c57'), label: hex('#84847f'),
        accent: hex('#de886a'), dim: hex('#84847f'), green: hex('#879b7a'),
        radius: 14, tint: [1.05, 0.99, 0.94],
    },
};
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
        cells.tail = { ...style, ch: ' ' };
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
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const luminance = rgb => rgb.map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
/** The WCAG contrast ratio of two colours, 1 to 21. */
export function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

const MIN_CONTRAST = 4.5;
// A terminal's greys are neutral; on a tinted ground they take its hue so they do not read as a different material.
const tint = (rgb, by) => (by && Math.max(...rgb) - Math.min(...rgb) <= 8 ? rgb.map((v, i) => Math.round(Math.min(255, v * by[i]))) : rgb);

/** A cell's colours in a look: the pane's grey becomes the card, greys take the look's hue, and words keep a readable contrast. */
function cellColours(cell, look, under) {
    let fg = cell.fg ?? look.foreground;
    let bg = cell.bg ?? under;
    if (look.card) {
        if (cell.bg) bg = same(cell.bg, PANE_GREY) ? look.card : tint(cell.bg, look.tint);
        if (cell.fg) fg = tint(cell.fg, look.tint);
    }
    if (cell.inverse) [fg, bg] = [bg, fg];
    if (cell.dim) fg = mix(fg, bg, 0.45);
    // Only letters and digits are held to the ratio; a rule or an empty bar cell is drawing and may stay faint.
    if (look.card && /[\p{L}\p{N}]/u.test(cell.ch)) for (let i = 0; i < 12 && contrast(fg, bg) < MIN_CONTRAST; i++) fg = mix(fg, look.foreground, 0.15);
    return { fg, bg };
}

function cellCss(cell, look, under) {
    if (cell.ch === ' ' && !cell.inverse && !cell.underline) {
        const bg = cell.bg ? cellColours(cell, look, under).bg : null;
        return bg && !same(bg, under) ? `background:${css(bg)}` : '';
    }
    const { fg, bg } = cellColours(cell, look, under);
    const rules = [];
    if (!same(fg, look.foreground)) rules.push(`color:${css(fg)}`);
    if (!same(bg, under)) rules.push(`background:${css(bg)}`);
    if (cell.bold) rules.push('font-weight:700');
    if (cell.italic) rules.push('font-style:italic');
    const lines = [cell.underline && 'underline', cell.strike && 'line-through'].filter(Boolean);
    if (lines.length) rules.push(`text-decoration:${lines.join(' ')}`);
    return rules.join(';');
}

// A look holds more than colour; these keys are the rest of it, and only the colours become a `--tp-*` variable.
const NOT_A_COLOUR = new Set(['size', 'row', 'radius', 'tint', 'glow']);

/** A look's colours as CSS values, plus the chrome the player cannot read off a cell: the corner radius and the glow behind the window. */
export function lookCss(look) {
    const colours = Object.entries(look).filter(([key, value]) => Array.isArray(value) && !NOT_A_COLOUR.has(key)).map(([key, value]) => [key, css(value)]);
    if (look.radius) colours.push(['radius', `${look.radius}px`]);
    if (look.glow) colours.push(['glow', look.glow]);
    return Object.fromEntries(colours);
}

/**
 * The grid as plain data for a player to draw: one array of cells per row, each cell [character, column, width, style index],
 * with the colours already resolved in a look. `pane` ({ col, top, bottom }) marks the cells that sit on the pane's card.
 */
export function gridJson(grid, { look: name = 'claude', pane = null, cols = null } = {}) {
    const look = LOOKS[name] ?? LOOKS.plain;
    const styles = [];
    const index = new Map();
    const styleOf = (cell, under) => {
        const key = cellCss(cell, look, under);
        if (!index.has(key)) index.set(key, styles.push(key) - 1);
        return index.get(key);
    };
    const rows = grid.map((cells, row) => {
        const under = col => (look.card && pane && row >= pane.top && row < pane.bottom && col > pane.col ? look.card : look.background);
        const out = cells.filter(cell => cell.ch !== ' ' || cell.bg || cell.inverse || cell.underline).map(cell => [cell.ch, cell.col, cell.w, styleOf(cell, under(cell.col))]);
        const end = cells.length ? cells.at(-1).col + cells.at(-1).w : 0;
        const tail = cells.tail && cells.tail.bg ? styleOf({ ...cells.tail, col: end }, under(end)) : -1;
        return tail >= 0 ? { cells: out, tail: [end, tail] } : { cells: out };
    });
    return {
        look: name, cols: cols ?? Math.max(1, ...grid.map(cells => (cells.length ? cells.at(-1).col + cells.at(-1).w : 0))), rows: grid.length, size: look.size, rowHeight: look.row,
        colours: lookCss(look), pane, styles, grid: rows,
    };
}

// Rules are painted, not typed: a font's box-drawing glyphs leave gaps between rows.
const RULES = { '│': 'v', '─': 'h', '╌': 'd' };

/**
 * A page that draws the grid (or a window of it), one fixed-width cell per column.
 * `look` is a key of LOOKS. In the site look, `frame` is 'window' (a title bar over the screen) or 'card' (a crop on the card
 * colour), `title` is the bar's label, and `pane` ({ col, top, bottom }) is drawn as a rounded card instead of a grey block.
 */
export function gridHtml(grid, { from = 0, to, rowFrom = 0, rowTo = grid.length, look: name = 'plain', frame = 'window', title = '', pane = null } = {}) {
    const look = LOOKS[name] ?? LOOKS.plain;
    const site = Boolean(look.card);
    const glow = look.glow ? `,0 0 50px ${look.glow}` : '';
    const last = to ?? Math.max(1, ...grid.map(cells => (cells.length ? cells.at(-1).col + cells.at(-1).w : 0)));
    const ground = site && frame === 'card' ? look.card : look.background;
    const carded = site && frame === 'window' && pane;
    const rows = grid.slice(rowFrom, rowTo).map((cells, index) => {
        const row = rowFrom + index;
        const inPane = col => carded && row >= pane.top && row < pane.bottom && col > pane.col;
        const style = cell => cellCss(cell, look, inPane(cell.col) ? look.card : ground);
        let html = '';
        let col = from;
        let run = null;
        const flush = () => {
            if (!run) return;
            html += `<span${run.css ? ` style="${run.css}"` : ''}>${escapeHtml(run.text)}</span>`;
            run = null;
        };
        const pad = (until, padCss) => {
            if (until <= col) return;
            if (run && run.css === padCss) run.text += ' '.repeat(until - col);
            else {
                flush();
                run = { css: padCss, text: ' '.repeat(until - col) };
            }
            col = until;
        };
        for (const cell of cells) {
            if (cell.col < from || cell.col >= last) continue;
            pad(cell.col, '');
            // The card's own edge stands in for the pane's border column.
            const shown = carded && cell.col === pane.col && cell.ch === '│' ? { ...cell, ch: ' ', fg: null, bg: null, inverse: false, underline: false } : cell;
            const cellStyle = style(shown);
            const ascii = shown.ch.length === 1 && shown.ch.charCodeAt(0) < 0x7f;
            if (ascii) {
                if (run && run.css === cellStyle) run.text += shown.ch;
                else {
                    flush();
                    run = { css: cellStyle, text: shown.ch };
                }
            } else {
                flush();
                const rule = RULES[shown.ch];
                const width = shown.w === 2 ? ';width:2ch' : '';
                html += rule
                    ? `<span class="c ${rule}" style="${cellStyle}"> </span>`
                    : `<span class="c" style="${cellStyle}${width}">${escapeHtml(shown.ch)}</span>`;
            }
            col = cell.col + cell.w;
        }
        pad(last, cells.tail ? style({ ...cells.tail, col }) : '');
        flush();
        return `<div class="r">${html}</div>`;
    });
    const h = look.row;
    const mono = '"JetBrains Mono","SF Mono",Menlo,Monaco,"DejaVu Sans Mono",Consolas,"Liberation Mono",monospace';
    const cellRules = `
.r{position:relative;height:${h}px;white-space:pre;width:${last - from}ch}
.r span{display:inline-block;height:${h}px;vertical-align:top}
.c{width:1ch;text-align:center;overflow:visible}
.v{background-image:linear-gradient(currentColor,currentColor);background-size:1px 100%;background-position:center;background-repeat:no-repeat}
.h{background-image:linear-gradient(currentColor,currentColor);background-size:100% 1px;background-position:center;background-repeat:no-repeat}
.d{background-image:linear-gradient(90deg,currentColor 60%,transparent 60%);background-size:100% 1px;background-position:center;background-repeat:no-repeat}`;
    const page = (styles, body) => `<!doctype html><html><head><meta charset="utf-8"><style>${styles}${cellRules}
</style></head><body>${body}</body></html>`;
    if (!site) {
        return page(`
html,body{margin:0;background:${css(look.background)}}
#screen{display:inline-block;padding:10px 12px;background:${css(look.background)};color:${css(look.foreground)};font:${look.size}px/${h}px ${mono.replace('"JetBrains Mono",', '')};font-variant-ligatures:none}`, `<div id="screen">${rows.join('')}</div>`);
    }
    const type = `color:${css(look.foreground)};font:${look.size}px/${h}px ${mono};font-variant-ligatures:none`;
    const edge = `border:1px solid ${css(look.border)};border-radius:${look.radius ?? 14}px`;
    if (frame === 'card') {
        const padding = rows.length === 1 ? '13px 20px' : '22px 26px';
        return page(`
html,body{margin:0;background:transparent}
#screen{display:inline-block;padding:28px 36px 44px}
.card{display:inline-block;padding:${padding};background:${css(look.card)};${edge};box-shadow:0 18px 40px rgb(0 0 0 / 0.45);${type}}`, `<div id="screen"><div class="card">${rows.join('')}</div></div>`);
    }
    const card = carded
        ? `<div class="pane" style="left:calc(${pane.col + 1 - from}ch - 14px);top:${(pane.top - rowFrom) * h - 6}px;width:calc(${last - pane.col - 1}ch + 28px);height:${(Math.min(pane.bottom, rowTo) - pane.top) * h + 12}px"></div>`
        : '';
    return page(`
html,body{margin:0;background:transparent}
#screen{display:inline-block;padding:44px 64px 84px}
.win{display:inline-block;overflow:hidden;background:${css(look.background)};${edge};box-shadow:0 30px 70px rgb(0 0 0 / 0.55)${glow};${type}}
.bar{position:relative;display:flex;align-items:center;gap:8px;height:40px;padding:0 16px;background:${css(look.ground)};border-bottom:1px solid ${css(look.rule)}}
.bar i{width:11px;height:11px;border-radius:50%;background:${css(look.dot)}}
.bar b{position:absolute;left:0;right:0;text-align:center;font:500 12.5px/40px ${mono};color:${css(look.label)}}
.body{position:relative;padding:24px 30px}
.pane{position:absolute;margin:24px 30px;box-sizing:border-box;background:${css(look.card)};border:1px solid ${css(look.border)};border-radius:12px}`, `<div id="screen"><div class="win"><div class="bar"><i></i><i></i><i></i><b>${escapeHtml(title)}</b></div><div class="body">${card}${rows.join('')}</div></div></div>`);
}
