// The Overview dossier as HTML: the viewer's own section components rendered to a string, then the board's run log.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { escapeHtml } from './vendor/viewer-markdown.mjs';
import { deriveViewerState, markMissingTests } from './vendor/viewer-core.mjs';
import { renderDossier } from './vendor/viewer-overview.mjs';
import { phaseTimings } from './spec-rules.mjs';

export { stepTiming } from './spec-rules.mjs';


const e = escapeHtml;
const text = v => (typeof v === 'string' ? v.trim() : '');
const list = v => (Array.isArray(v) ? v : []);

/** What a time means on a record the board kept, said where the times are shown. */
export const BOARD_TIMED_NOTE = 'Timed by the board: from the moment it sent a step to the end of that chat turn. A step run any other way has no time.';
export const BOARD_UNTIMED_NOTE = 'No step has a time. The board times a step it sends, from the send to the end of that chat turn.';

/** The board's note under the dossier's timing card, said once where the times are shown. */
function withBoardNote(html, ctx) {
    const note = phaseTimings(ctx).measuredPhases > 0 ? BOARD_TIMED_NOTE : BOARD_UNTIMED_NOTE;
    return html.replace(/(<section class="dossier-timing"[\s\S]*?)(<\/section>)/, `$1<p class="dossier-timing__note">${e(note)}</p>$2`);
}

/** The viewer's derived rows, or null for a record too malformed to derive (the board then reads it as written). */
function derived(ctx) {
    try {
        return deriveViewerState(ctx);
    } catch {
        return null;
    }
}

/** Coverage rows from the viewer's derivation, with named test files checked against the workspace. */
export function coverageRows(ctx, root) {
    const rows = derived(ctx ?? {})?.coverage ?? [];
    const checked = root ? markMissingTests(rows, p => existsSync(join(root, p))) : rows;
    return [...checked].sort((a, b) => a.req.localeCompare(b.req, undefined, { numeric: true }));
}

function runLog(ctx) {
    const lastAction = text(ctx.last_action);
    const concerns = list(ctx.concerns).map(c => (typeof c === 'string' ? c : c?.note)).filter(c => typeof c === 'string');
    const files = list(ctx.files_modified).filter(f => typeof f === 'string');
    if (!lastAction && !concerns.length && !files.length) return '';
    return '<details class="dossier-log"><summary>Run log</summary><div class="dossier-log__body">'
        + (lastAction ? `<p class="dossier-log__last-action">${e(lastAction)}</p>` : '')
        + (concerns.length ? `<h3>Concerns</h3><ul>${concerns.map(c => `<li>${e(c)}</li>`).join('')}</ul>` : '')
        + (files.length ? `<h3>Files touched</h3><ul>${files.slice(0, 40).map(f => `<li><code>${e(f)}</code></li>`).join('')}</ul>` : '')
        + '</div></details>';
}

/** The whole dossier, or an empty string when the record carries nothing worth a page. */
export function renderOverview(ctx, root, options = {}) {
    if (!ctx || typeof ctx !== 'object') return '';
    const vs = derived(ctx);
    let sections = '';
    if (vs) {
        const coverage = coverageRows(ctx, root);
        // A record that stopped at a step's start still reads as running; the files may know the step finished.
        const stepHistory = Object.fromEntries(Object.entries(vs.stepHistory ?? {}).map(([step, entry]) => [
            step,
            entry && entry.completedAt === null && options.steps?.[step] === 'completed' ? { ...entry, completedAt: entry.startedAt, durationTrusted: false } : entry,
        ]));
        sections = renderDossier({ ...vs, stepHistory, coverage });
        if (options.boardTimed) sections = withBoardNote(sections, ctx);
    } else if (text(ctx.intent)) {
        sections = `<section class="dossier-intent" aria-label="Intent"><p class="dossier-kicker">Intent</p><p class="dossier-intent__statement">${e(text(ctx.intent))}</p></section>`;
    }
    const body = sections + runLog(ctx);
    return body ? `<div class="dossier">${body}</div>` : '';
}
