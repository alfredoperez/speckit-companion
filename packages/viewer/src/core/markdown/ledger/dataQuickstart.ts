/**
 * Ledger QuickstartSteps: numbered steps with the action, the commands to run
 * and the expected result. Reads `### Step N: Title` sections and top-level
 * numbered lists in quickstart.md.
 */

import { parseInline } from '../inline';
import { eyebrow, codicon } from './primitives';
import { docKind, mapSections, renderBlocks } from './blocks';

const STEP_HEADING = /^(?:Step[ \t]+)?(\d+)[.:)]?[ \t]*[—–:-]?[ \t]*(.+)$/i;
const STARTS_STEP = /^(?:Step[ \t]+\d|\d+[.)][ \t])/i;
const EXPECT = /(?:^|[.!?][ \t]+)(Expect(?:ed)?(?:[ \t]+result)?:?|You should see:?|Result:?)[ \t]+(.+)$/i;
const FENCE = /^[ \t]*(```|~~~)/;

interface Step {
    n: number;
    title: string;
    body: string[];
}

function stepHtml(s: Step): string {
    let expect = '';
    const body = s.body.map((l) => l);
    // An expect sentence ends the paragraph that holds it.
    for (let i = 0; i < body.length; i++) {
        if (FENCE.test(body[i])) { i++; while (i < body.length && !FENCE.test(body[i])) i++; continue; }
        const m = body[i].match(EXPECT);
        if (m && m.index !== undefined) {
            expect = m[2].trim();
            body[i] = body[i].slice(0, m.index + (m[0].startsWith(m[1]) ? 0 : 1)).trim();
            break;
        }
    }
    const doHtml = renderBlocks(body.filter((l, i) => l.trim() || body[i - 1] !== undefined));
    const exp = expect
        ? `<div class="lg-expect"><span class="lg-expect__label">Expect</span>${codicon('check')}<span>${parseInline(expect)}</span></div>`
        : '';
    return `<div class="lg-step lg-fam-data"><span class="lg-step__num">${s.n}</span>` +
        `<div class="lg-step__main"><div class="lg-step__title">${parseInline(s.title)}</div>${doHtml}${exp}</div></div>`;
}

/** A numbered list run at column 0 becomes steps; indented lines and fences belong to their item. */
function listSteps(markdown: string): string {
    const lines = markdown.split('\n');
    const out: string[] = [];
    let fence = false;
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (FENCE.test(l)) fence = !fence;
        if (fence || !/^\d+[.)][ \t]+\S/.test(l)) { out.push(l); continue; }
        const items: Step[] = [];
        let j = i;
        let inFence = false;
        while (j < lines.length) {
            const m = lines[j].match(/^(\d+)[.)][ \t]+(.*)$/);
            if (m && !inFence) {
                const t = m[2].match(/^\*\*(.+?)\*\*[:.]?[ \t]*(.*)$/);
                items.push(t ? { n: Number(m[1]), title: t[1], body: t[2] ? [t[2]] : [] } : { n: Number(m[1]), title: '', body: [m[2]] });
                j++;
                continue;
            }
            if (!items.length) break;
            if (FENCE.test(lines[j])) { inFence = !inFence; items[items.length - 1].body.push(lines[j++]); continue; }
            if (inFence || /^[ \t]+\S/.test(lines[j])) { items[items.length - 1].body.push(lines[j++]); continue; }
            if (!lines[j].trim() && /^[ \t]+\S/.test(lines[j + 1] ?? '')) { items[items.length - 1].body.push(lines[j++]); continue; }
            break;
        }
        if (items.length < 2) { out.push(l); continue; }
        for (const it of items) {
            if (!it.title) {
                const first = it.body[0] ?? '';
                const cut = first.match(/^(.{8,80}?)[.:][ \t]+(.*)$/);
                if (cut) { it.title = cut[1]; it.body[0] = cut[2]; }
                else { it.title = first; it.body.shift(); }
            }
            out.push(stepHtml(it));
        }
        i = j - 1;
    }
    return out.join('\n');
}

export function preprocessQuickstart(markdown: string): string {
    if (docKind(markdown) !== 'quickstart') return markdown;
    const viaHeadings = mapSections(markdown, (s) => {
        if (!STARTS_STEP.test(s.heading.text)) return null;
        const m = s.heading.text.match(STEP_HEADING);
        if (!m) return null;
        return stepHtml({ n: Number(m[1]), title: m[2], body: s.body });
    });
    const out = listSteps(viaHeadings).split('\n');
    const idx = out.map((l, i) => (l.startsWith('<div class="lg-step ') ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return markdown;
    out.splice(idx[0], 0, `<div class="lg-data-head lg-fam-data">${eyebrow('data', 'Quickstart', `${idx.length} ${idx.length === 1 ? 'step' : 'steps'}`)}</div>`);
    return out.join('\n');
}
