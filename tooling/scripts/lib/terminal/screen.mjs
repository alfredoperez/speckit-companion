// Reads a Claude Code screen: where the mod's pane and band are, which control has the focus, and whether a dialog is up.
import { gridText, rowText } from './ansi.mjs';

/** The column of the pane's left border when the pane is docked beside the transcript, else null. */
export function paneColumn(grid) {
    const counts = new Map();
    for (const cells of grid) {
        // A permission dialog draws its own bar down the first columns.
        for (const cell of cells) if (cell.ch === '│' && cell.col >= 20) counts.set(cell.col, (counts.get(cell.col) ?? 0) + 1);
    }
    const [col, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
    return count >= Math.min(12, grid.length / 2) ? col : null;
}

/** The pane's own rows, top to bottom, without the border. */
export function paneRows(grid) {
    const col = paneColumn(grid);
    if (col === null) return null;
    const rows = grid.map((cells, row) => ({ row, bordered: cells.some(c => c.col === col && c.ch === '│') })).filter(r => r.bordered).map(r => r.row);
    return { col, top: rows[0], bottom: rows.at(-1) + 1, lines: rows.map(row => rowText(grid[row], col + 1)) };
}

export function paneText(grid) {
    return paneRows(grid)?.lines.join('\n').replace(/\n{2,}/g, '\n') ?? '';
}

/** The band: the row above the prompt that starts with a spec folder's name. */
export function bandRow(grid, names) {
    const col = paneColumn(grid) ?? Infinity;
    for (let row = grid.length - 1; row >= 0; row--) {
        const text = rowText(grid[row], 0, col).replace(/\s*\[[-+]\]\s*$/, '');
        const name = names.find(n => text === n || text.startsWith(n + ' · '));
        if (name) return { row, text, name };
    }
    return null;
}

/** The label of the control drawn in reverse video inside the pane, which is how the terminal marks the focus. */
export function focusedControl(grid) {
    const pane = paneRows(grid);
    if (!pane) return null;
    for (let row = pane.top; row < pane.bottom; row++) {
        const cells = grid[row].filter(c => c.col > pane.col && c.inverse);
        if (cells.length) return rowText(cells, cells[0].col).trim();
    }
    return null;
}

/** The prompt box: its row, and what is typed in it (a dim placeholder counts as empty). */
export function promptBox(grid) {
    for (let row = grid.length - 1; row > 0; row--) {
        const cells = grid[row];
        if (cells[0]?.ch !== '❯' || !/^─{20,}/.test(rowText(grid[row - 1]))) continue;
        const typed = cells.slice(1).filter(c => c.ch.trim() && !c.dim && !c.inverse);
        return { row, text: typed.length ? rowText(cells, 2) : '' };
    }
    return null;
}

/** True while a turn is running: the spinner line counts seconds, or says how to interrupt. */
export function isWorking(grid) {
    return /^\s*\S \S[^\n]*… \((?:\d+[hms] ?)+/m.test(gridText(grid)) || /esc to interrupt/i.test(gridText(grid));
}

/** A dialog that waits for an answer, with the option the cursor is on. `kind` is trust, permission or question. */
export function dialog(grid) {
    const lines = gridText(grid, 0, paneColumn(grid) ?? Infinity).split('\n');
    const option = (line, row) => {
        const hit = line.match(/^\s*(❯)?\s*(?:(\d+)\. )?(\S.*)$/);
        if (!hit || !(hit[2] || /^(Yes|No), /.test(hit[3])) || !(hit[1] || /^\s{2,}/.test(line))) return null;
        return { row, selected: Boolean(hit[1]), number: hit[2] ?? null, label: hit[3].trim() };
    };
    const at = lines.findLastIndex((line, row) => option(line, row)?.selected);
    if (at < 0) return null;
    // The options are the unbroken run of option lines around the one the cursor is on.
    let first = at;
    let last = at;
    while (first > 0 && option(lines[first - 1], first - 1)) first--;
    while (last < lines.length - 1 && option(lines[last + 1], last + 1)) last++;
    const options = lines.slice(first, last + 1).map((line, i) => option(line, first + i));
    if (options.some(o => o.label === 'Yes, I trust this folder')) return { kind: 'trust', options, asked: 'trust this folder' };
    const question = lines.findLast(line => /^\s*Do you want to .*\?/.test(line));
    if (question && options[0]?.label === 'Yes') {
        const rules = lines.map((line, row) => (/^\s*╌{20,}/.test(line) ? row : -1)).filter(row => row >= 0);
        // The dialog starts under the last full-width rule, and its first line names the tool.
        const top = lines.slice(0, options[0].row).findLastIndex(l => /^─{20,}/.test(l));
        const title = lines.slice(top + 1, options[0].row).find(l => l.trim())?.trim() ?? '';
        const clean = (from, to) => lines.slice(from, to).map(l => l.replace(/^\s*│?\s*/, '').trim()).filter(Boolean).join(' ');
        const body = rules.length ? clean((rules.length >= 2 ? rules.at(-2) : top) + 1, rules.at(-1)) : '';
        const why = rules.length ? clean(rules.at(-1) + 1, lines.indexOf(question)) : '';
        return { kind: 'permission', options, asked: body || question.trim(), title, why };
    }
    if (options.length >= 2 && options.every(o => o.number)) return { kind: 'question', options, asked: lines.slice(Math.max(0, options[0].row - 3), options[0].row).map(l => l.trim()).filter(Boolean).join(' ') };
    return null;
}

/** True while the pane has the keyboard: its border is drawn in the accent colour, and dim while the prompt has it. */
export function paneHasKeyboard(grid) {
    const col = paneColumn(grid);
    if (col === null) return false;
    const border = grid.flatMap(cells => cells.filter(c => c.col === col && c.ch === '│'));
    return border.length > 0 && border.every(c => !c.dim && c.fg !== null);
}
