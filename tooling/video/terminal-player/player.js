// A Claude Code terminal for video: draws captured screens (cell grids from capture-run.mjs or terminal-check --grids) and animates a
// "terminal script" of beats on top. Every pixel is a function of the time passed to seek(), so a frame renderer can ask for any frame.
(function (root) {
    'use strict';

    const RULES = { '│': 'v', '─': 'h', '╌': 'd' };
    const SPINNER = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
    const esc = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
    const easeOut = p => 1 - (1 - p) ** 3;

    /** A small seeded generator, so "human" typing is the same on every render. */
    function seeded(text) {
        let a = 2166136261;
        for (let i = 0; i < text.length; i++) a = Math.imul(a ^ text.charCodeAt(i), 16777619);
        return () => {
            a |= 0;
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /** One row of cells ({ ch, col, w, css }) as HTML, one fixed-width cell per column. */
    function rowHtml(cells, cols, tail) {
        let html = '';
        let col = 0;
        let run = null;
        const flush = () => {
            if (!run) return;
            html += `<span${run.css ? ` style="${run.css}"` : ''}>${esc(run.text)}</span>`;
            run = null;
        };
        const pad = (until, css) => {
            if (until <= col) return;
            if (run && run.css === css) run.text += ' '.repeat(until - col);
            else {
                flush();
                run = { css, text: ' '.repeat(until - col) };
            }
            col = until;
        };
        for (const cell of cells) {
            if (cell.col >= cols || cell.col < col) continue;
            pad(cell.col, '');
            if (cell.ch.length === 1 && cell.ch.charCodeAt(0) < 0x7f) {
                if (run && run.css === cell.css) run.text += cell.ch;
                else {
                    flush();
                    run = { css: cell.css, text: cell.ch };
                }
            } else {
                flush();
                const rule = RULES[cell.ch];
                html += rule ? `<span class="c ${rule}" style="${cell.css}"> </span>` : `<span class="c" style="${cell.css}${cell.w === 2 ? ';width:2ch' : ''}">${esc(cell.ch)}</span>`;
            }
            col = cell.col + cell.w;
        }
        if (tail) {
            pad(Math.max(col, tail.from), '');
            pad(cols, tail.css);
        }
        flush();
        return html;
    }

    /** Text as cells starting at a column; `parts` is [text, css] pairs. */
    function textCells(parts, from = 0) {
        const cells = [];
        let col = from;
        for (const [text, css = ''] of parts) for (const ch of text) cells.push({ ch, col: col++, w: 1, css });
        return cells;
    }

    function loadFrame(data) {
        const pane = data.pane;
        const rows = data.grid.map((row, index) => {
            const cells = row.cells
                // The card's own edge stands in for the pane's border column.
                .filter(([ch, col]) => !(pane && index >= pane.top && index < pane.bottom && col === pane.col && ch === '│'))
                .map(([ch, col, w, style]) => ({ ch, col, w, css: data.styles[style] }));
            return { cells, html: rowHtml(cells, data.cols, row.tail && { from: row.tail[0], css: data.styles[row.tail[1]] }) };
        });
        return { ...data, rows };
    }

    /** Seconds from the start at which each character of `text` lands, typed at about `cps` characters a second. */
    function typingTimes(text, cps) {
        const random = seeded(text);
        const times = [];
        let at = 0;
        for (let i = 0; i < text.length; i++) {
            const before = text[i - 1];
            let step = (1 / cps) * (0.55 + random() * 0.9);
            if (before === ' ') step *= 1.5;
            if (before && /[.,:;!?]/.test(before)) step *= 2.2;
            at += step;
            times.push(at);
        }
        return times;
    }

    /** The first and last column at which two rows differ. */
    function changedSpan(a, b) {
        const at = cells => new Map(cells.map(c => [c.col, c.ch + '|' + c.css]));
        const [left, right] = [at(a), at(b)];
        let from = Infinity;
        let to = -1;
        for (const col of new Set([...left.keys(), ...right.keys()])) {
            if (left.get(col) === right.get(col)) continue;
            from = Math.min(from, col);
            to = Math.max(to, col + 1);
        }
        return to < 0 ? null : { from, to };
    }

    const clock = seconds => (seconds >= 60 ? `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s` : `${Math.floor(seconds)}s`);

    /**
     * Mounts a player in `host`. `frames` maps a name to a loaded grid JSON; `script` is the terminal script.
     * Returns { duration, marks, seek(t), rect(what), size }.
     */
    function create(host, { script, frames: raw, fontSize = 20, rowHeight = Math.round(fontSize * 1.4), title = 'claude — speckit-tracker' }) {
        const frames = Object.fromEntries(Object.entries(raw).map(([name, data]) => [name, loadFrame(data)]));
        const first = frames[script.start];
        if (!first) throw new Error(`[terminal-player] Missing start frame "${script.start}"`);
        const { cols } = first;
        const count = first.rows.length;
        const look = first.colours;
        const transcriptTop = script.transcript?.top ?? 5;

        // ---- compile the beats into things that are true over a span of time
        const changes = [];   // frame swaps
        const prompts = [];   // what the prompt holds
        const lines = [];     // transcript lines, each with the time it appears and (optionally) disappears
        const keys = [];      // key caps
        const marks = {};
        let now = 0;
        let current = script.start;
        let typed = '';
        for (const beat of script.beats) {
            if (beat.at !== undefined) now = beat.at;
            now += beat.gap ?? 0;
            const start = now;
            let length = 0;
            if (beat.do === 'type') {
                const times = typingTimes(beat.text, beat.cps ?? 24);
                prompts.push({ from: start, text: beat.text, times });
                typed = beat.text;
                length = times.at(-1) + (beat.after ?? 0.25);
            } else if (beat.do === 'submit') {
                prompts.push({ from: start, text: '', times: [] });
                if (beat.echo !== false && typed) lines.push({ from: start, kind: 'echo', text: typed });
                typed = '';
                length = beat.for ?? 0.12;
            } else if (beat.do === 'spinner') {
                length = beat.for ?? 1;
                lines.push({ from: start, to: start + length, kind: 'spinner', text: beat.text, clock: beat.clock });
            } else if (beat.do === 'print') {
                const stagger = beat.stagger ?? 0.1;
                beat.lines.forEach((line, i) => lines.push({ from: start + i * stagger, kind: 'out', ...(typeof line === 'string' ? { text: line } : line) }));
                length = beat.lines.length * stagger;
            } else if (beat.do === 'clear') {
                for (const line of lines) line.to = Math.min(line.to ?? Infinity, start);
            } else if (beat.do === 'frame') {
                const to = frames[beat.to];
                if (!to) throw new Error(`[terminal-player] Missing frame "${beat.to}"`);
                const from = frames[current];
                const diff = [];
                const spans = {};
                for (let row = 0; row < count; row++) {
                    if (from.rows[row].html === to.rows[row].html) continue;
                    diff.push(row);
                    spans[row] = changedSpan(from.rows[row].cells, to.rows[row].cells);
                }
                const how = beat.how ?? 'rows';
                const duration = how === 'cut' ? 0 : beat.dur ?? 0.4;
                const rowDur = how === 'rows' ? Math.min(duration, beat.rowDur ?? 0.16) : duration;
                const stagger = how === 'rows' && diff.length > 1 ? (duration - rowDur) / (diff.length - 1) : 0;
                changes.push({ at: start, from: current, to: beat.to, diff, spans, duration, rowDur, stagger, flash: beat.flash ?? how === 'rows' });
                current = beat.to;
                length = duration;
            } else if (beat.do === 'key') {
                length = beat.for ?? 0.8;
                keys.push({ from: start, to: start + length, key: beat.key, label: beat.label ?? '', on: beat.on ?? 'pane' });
            } else if (beat.do === 'hold') {
                length = beat.for ?? 0.5;
            } else {
                throw new Error(`[terminal-player] Unknown beat "${beat.do}"`);
            }
            if (beat.id) marks[beat.id] = { start, end: start + length };
            if (beat.wait !== false) now = start + length;
        }
        const duration = now;

        // ---- the DOM, built once
        host.classList.add('tp');
        host.style.setProperty('--tp-size', fontSize + 'px');
        host.style.setProperty('--tp-row', rowHeight + 'px');
        for (const [name, value] of Object.entries(look)) host.style.setProperty(`--tp-${name}`, value);
        host.innerHTML = `<div class="tp-win"><div class="tp-bar"><i></i><i></i><i></i><b>${esc(title)}</b></div><div class="tp-body" style="width:${cols}ch;height:${count * rowHeight}px"><div class="tp-card"></div><div class="tp-rows"></div><div class="tp-over"></div><div class="tp-key"><kbd></kbd><span></span></div></div></div>`;
        const body = host.querySelector('.tp-body');
        const card = host.querySelector('.tp-card');
        const over = host.querySelector('.tp-over');
        const keycap = host.querySelector('.tp-key');
        const rowEls = [];
        for (let row = 0; row < count; row++) {
            const el = document.createElement('div');
            el.className = 'tp-r';
            el.innerHTML = '<div class="tp-l" data-layout-allow-overlap data-layout-allow-occlusion></div><div class="tp-l tp-top" data-layout-allow-overlap data-layout-allow-occlusion></div><div class="tp-flash"></div>';
            host.querySelector('.tp-rows').appendChild(el);
            rowEls.push({ under: el.children[0], top: el.children[1], flash: el.children[2], a: null, b: null });
        }
        const overEls = [];
        const overlay = (index) => {
            while (overEls.length <= index) {
                const el = document.createElement('div');
                el.className = 'tp-r tp-o';
                // An overlay is drawn over the captured row on purpose; these tell a layout audit so.
                el.setAttribute('data-layout-allow-overlap', '');
                el.setAttribute('data-layout-allow-occlusion', '');
                over.appendChild(el);
                overEls.push({ el, html: null });
            }
            return overEls[index];
        };
        const put = (slot, key, html) => {
            if (slot[key] === html) return;
            slot[key] = html;
            (key === 'a' ? slot.under : slot.top).innerHTML = html;
        };
        let cellWidth = null;
        const cell = () => {
            if (cellWidth) return cellWidth;
            const pen = document.createElement('canvas').getContext('2d');
            pen.font = `${fontSize}px "JetBrains Mono"`;
            cellWidth = pen.measureText('0').width;
            return cellWidth;
        };

        const promptRow = frame => frame.prompt?.row ?? count - 4;
        const transcriptEnd = frame => (frame.band > 0 ? frame.band : promptRow(frame) - 1) - 1;

        function seek(t) {
            // -- which captured screen, and how far into a swap
            let change = null;
            for (const c of changes) if (c.at <= t) change = c;
            const to = change ? frames[change.to] : first;
            const from = change ? frames[change.from] : first;
            const whole = change && change.duration ? clamp((t - change.at) / change.duration) : 1;
            for (let row = 0; row < count; row++) {
                const slot = rowEls[row];
                const k = change && whole < 1 ? change.diff.indexOf(row) : -1;
                const local = k < 0 ? 1 : clamp((t - change.at - k * change.stagger) / change.rowDur);
                if (local >= 1) {
                    put(slot, 'a', to.rows[row].html);
                    put(slot, 'b', '');
                    slot.flash.style.opacity = 0;
                } else if (local <= 0) {
                    put(slot, 'a', from.rows[row].html);
                    put(slot, 'b', '');
                    slot.flash.style.opacity = 0;
                } else {
                    put(slot, 'a', from.rows[row].html);
                    put(slot, 'b', to.rows[row].html);
                    // The old row leaves before the new one lands, so two lines of text are never read through each other.
                    slot.under.style.opacity = 1 - clamp(local / 0.35);
                    slot.top.style.opacity = easeOut(clamp((local - 0.3) / 0.7));
                    const span = change.flash && change.spans[row];
                    if (span) {
                        slot.flash.style.left = span.from + 'ch';
                        slot.flash.style.width = span.to - span.from + 'ch';
                        slot.flash.style.opacity = Math.sin(Math.PI * local) * 0.28;
                    } else slot.flash.style.opacity = 0;
                    continue;
                }
                slot.under.style.opacity = 1;
            }
            // -- the pane's card
            const pane = to.pane ?? from.pane;
            if (pane) {
                card.style.cssText = `left:calc(${pane.col + 1}ch - 14px);top:${pane.top * rowHeight - 6}px;width:calc(${cols - pane.col - 1}ch + 28px);height:${(pane.bottom - pane.top) * rowHeight + 12}px;opacity:${to.pane && from.pane ? 1 : to.pane ? easeOut(whole) : 1 - whole}`;
            } else card.style.opacity = 0;

            // -- overlays: the prompt, then the transcript lines
            let used = 0;
            const draw = (row, html, cls = '') => {
                const slot = overlay(used++);
                const key = row + '|' + cls + '|' + html;
                if (slot.html === key) return;
                slot.html = key;
                slot.el.className = 'tp-r tp-o ' + cls;
                slot.el.style.top = row * rowHeight + 'px';
                slot.el.style.display = '';
                slot.el.innerHTML = html;
            };
            let prompt = null;
            for (const p of prompts) if (p.from <= t) prompt = p;
            if (prompt) {
                const shown = prompt.times.filter(at => prompt.from + at <= t).length;
                const typing = shown < prompt.text.length || t - prompt.from - (prompt.times.at(-1) ?? 0) < 0.3;
                const caretOn = typing || Math.floor((t - prompt.from) * 1.9) % 2 === 0;
                const mark = to.rows[promptRow(to)].cells.filter(c => c.col < 2);
                const cells = [...mark, ...textCells([[prompt.text.slice(0, shown)], [' ', caretOn ? 'background:var(--tp-foreground)' : '']], 2)];
                if (prompt.text) draw(promptRow(to), rowHtml(cells, cols), 'tp-prompt');
            }
            const width = (to.pane ?? (whole < 1 ? from.pane : null))?.col ?? cols;
            const live = lines.filter(line => line.from <= t && (line.to === undefined || t < line.to));
            const room = transcriptEnd(to) - transcriptTop;
            let row = transcriptTop;
            const placed = [];
            for (const line of live) {
                if (line.kind === 'echo' && placed.length) row += 1;
                placed.push({ line, row });
                row += line.kind === 'echo' ? 2 : 1;
            }
            const scroll = Math.max(0, (placed.at(-1)?.row ?? 0) - (transcriptTop + room));
            for (const { line, row: at } of placed) {
                const y = at - scroll;
                if (y < transcriptTop) continue;
                const age = t - line.from;
                if (line.kind === 'echo') {
                    draw(y, rowHtml(textCells([['❯ ', 'color:var(--tp-dim)'], [line.text.slice(0, width - 4)]], 0), width - 1, { from: 0, css: '' }), 'tp-echo');
                } else if (line.kind === 'spinner') {
                    const glyph = SPINNER[Math.floor(age * 9) % SPINNER.length];
                    const span = line.to - line.from;
                    const time = line.clock ? ` (${clock(line.clock[0] + (line.clock[1] - line.clock[0]) * clamp(age / span))} · esc to interrupt)` : '';
                    draw(y, rowHtml([{ ch: glyph, col: 0, w: 1, css: 'color:var(--tp-accent)' }, ...textCells([[line.text + '…', 'color:var(--tp-accent)'], [time, 'color:var(--tp-dim)']], 2)], width), 'tp-line');
                } else {
                    const glyph = line.glyph ?? '⏺';
                    const css = { ok: 'color:var(--tp-green)', dim: 'color:var(--tp-dim)', accent: 'color:var(--tp-accent)' }[line.tone] ?? '';
                    const html = rowHtml([{ ch: glyph, col: line.indent ?? 0, w: 1, css: line.glyphCss ?? 'color:var(--tp-green)' }, ...textCells([[line.text.slice(0, width - 4), css]], (line.indent ?? 0) + 2)], width);
                    draw(y, `<div style="opacity:${easeOut(clamp(age / 0.15)).toFixed(3)}">${html}</div>`, 'tp-line');
                }
            }
            for (let i = used; i < overEls.length; i++) {
                if (overEls[i].html === null) continue;
                overEls[i].html = null;
                overEls[i].el.style.display = 'none';
            }

            // -- a key cap for a key press
            const key = keys.find(k => k.from <= t && t < k.to);
            if (key) {
                const p = clamp((t - key.from) / 0.14);
                const out = clamp((key.to - t) / 0.18);
                const press = clamp((t - key.from - 0.14) / 0.12);
                keycap.style.opacity = Math.min(easeOut(p), out);
                keycap.style.transform = `translate(-50%,0) scale(${(0.9 + 0.1 * easeOut(p) - 0.06 * Math.sin(Math.PI * press)).toFixed(4)})`;
                keycap.firstChild.textContent = key.key;
                keycap.lastChild.textContent = key.label;
                const box = rect(key.on, to);
                keycap.style.left = box.x - bodyOffset().x + box.w / 2 + 'px';
                keycap.style.top = box.y - bodyOffset().y + box.h - rowHeight * 5 + 'px';
            } else keycap.style.opacity = 0;
        }

        const bodyOffset = () => ({ x: body.offsetLeft, y: body.offsetTop });
        /** Where a part of the screen sits inside the host, in the host's own pixels: window, pane, prompt, band, transcript or steps. */
        function rect(what, which = current) {
            const frame = typeof which === 'string' ? frames[which] : which;
            const ch = cell();
            const { x, y } = bodyOffset();
            const pane = frame.pane ?? Object.values(frames).find(f => f.pane)?.pane;
            const band = frame.band > 0 ? frame.band : promptRow(frame) - 2;
            const box = (col, row, w, h) => ({ x: x + col * ch, y: y + row * rowHeight, w: w * ch, h: h * rowHeight });
            if (what === 'pane' && pane) return box(pane.col + 1, pane.top, cols - pane.col - 1, pane.bottom - pane.top);
            if (what === 'prompt') return box(0, promptRow(frame) - 1, cols, 3);
            if (what === 'band') return box(0, band, pane ? pane.col : cols, 1);
            if (what === 'transcript') return box(0, 0, pane ? pane.col : cols, band);
            return { x: 0, y: 0, w: host.offsetWidth, h: host.offsetHeight };
        }

        seek(0);
        return { duration, marks, seek, rect, frames, size: () => ({ w: host.offsetWidth, h: host.offsetHeight }) };
    }

    root.TerminalPlayer = { create };
})(window);
