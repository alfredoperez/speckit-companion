/**
 * Ledger research components: DecisionCard (Decision, Question/Finding), the
 * DecisionsStrip at the top of research.md, follow-up rows, and the same card for
 * plan.md's "Key decisions". Decisions and questions share one list, in document order.
 */

import { parseInline } from '../inline';
import { codicon, eyebrow, idChip, slugForId, statusDot } from './primitives';
import type { Status } from './primitives';
import { docKind, idsIn, mapSections, renderBlocks, splitFields, type SectionCtx } from './blocks';

interface Alt {
    name: string;
    why: string;
}

interface Decision {
    id: string;
    kind: 'decision' | 'question';
    title: string;
    intro: string[];
    question: string[];
    finding: string[];
    decision: string[];
    why: string[];
    alts: Alt[];
}

const KNOWN = /^(Question|Finding|Decision|Rationale|Why|Alternatives(?: considered)?|Alternative|Rejected)$/i;
const NUMBERED = /^(?:Decision\s+(\d+)|([RD])(\d+))\s*[:—–-]\s*(.+)$/;
const BULLET = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(.*)$/;

const isBlank = (l: string) => !l.trim();
const trimLines = (lines: string[]): string[] => {
    let a = 0;
    let b = lines.length;
    while (a < b && isBlank(lines[a])) a++;
    while (b > a && isBlank(lines[b - 1])) b--;
    return lines.slice(a, b);
};

function splitAlt(text: string): Alt {
    const t = text.trim();
    let m = t.match(/^\*\*(.+?)\*\*[:.]?[ \t]*(?:[—–:-][ \t]*)?(.*)$/);
    if (!m) m = t.match(/^(.+?)[ \t]+[—–][ \t]+(.*)$/);
    if (!m) m = t.match(/^(.+?):[ \t]+(.*)$/);
    if (!m) m = t.match(/^(.+?)[ \t]*\((.+)\)[.]?$/);
    const why = (m ? m[2] : '').replace(/^Rejected(?: because)?:?[ \t]*/i, '');
    return { name: (m ? m[1] : t).replace(/[:.]$/, ''), why };
}

function parseAlts(lines: string[]): Alt[] {
    const rows = trimLines(lines);
    if (!rows.length) return [];
    const items: string[] = [];
    for (const l of rows) {
        const m = l.match(BULLET);
        if (m) items.push(m[1]);
        else if (items.length && /^[ \t]+\S/.test(l)) items[items.length - 1] += ' ' + l.trim();
        else if (l.trim()) {
            if (items.length && !BULLET.test(rows[0])) items[items.length - 1] += ' ' + l.trim();
            else items.push(l.trim());
        }
    }
    return items.map(splitAlt);
}

function fromSection(s: SectionCtx, index: number, strict: boolean): Decision | null {
    const text = s.heading.text.replace(/`/g, '');
    const num = text.match(NUMBERED);
    const { lead, fields } = splitFields(s.direct, KNOWN);
    const get = (re: RegExp) => fields.filter((f) => re.test(f.label)).flatMap((f) => f.lines);
    const has = (re: RegExp) => fields.some((f) => re.test(f.label));
    const numberedDecision = num && /^Decision/i.test(text);
    const labelled = has(/^(decision|question)$/);
    if (strict && !numberedDecision) return null;
    if (!numberedDecision && !(num && fields.length) && !labelled) return null;

    const prefix = num ? (num[2] ?? 'D') : 'D';
    const n = num ? Number(num[1] ?? num[3]) : index + 1;
    const rest = s.body.slice(s.direct.length);
    const decision = get(/^decision$/);
    const question = get(/^question$/);
    const finding = get(/^finding$/);
    const hasLabels = fields.length > 0;
    return {
        id: `${prefix}${n}`,
        kind: question.length || finding.length ? 'question' : 'decision',
        title: num ? num[4] : text,
        intro: trimLines([...(hasLabels ? lead : []), ...rest]),
        question,
        finding,
        decision: hasLabels && decision.length ? decision : hasLabels ? [] : lead,
        why: get(/^(rationale|why)$/),
        alts: parseAlts(get(/^(alternatives|alternative|rejected)/)),
    };
}

function statusOf(d: Decision): { status: Status; label: string } {
    if (d.kind === 'question') return d.decision.length ? { status: 'done', label: 'Answered' } : { status: 'warn', label: 'Open' };
    if (!d.why.length && !d.alts.length) return { status: 'warn', label: 'No rationale' };
    return { status: 'done', label: 'Decided' };
}

const blocks = (lines: string[]) => renderBlocks(trimLines(lines));
const joined = (lines: string[]) => trimLines(lines).join(' ');

function fieldRow(label: string, html: string): string {
    return `<div class="lg-frow"><span class="lg-frow__label">${label}</span><div class="lg-frow__body">${html}</div></div>`;
}

export function decisionCard(d: Decision): string {
    const st = statusOf(d);
    const leans = idsIn([...d.decision, ...d.why, ...d.finding].join(' '))
        .filter((id) => id !== d.id)
        .map((id) => idChip(id))
        .join(' ');
    const turned = d.alts.length;
    const alts = turned
        ? `<details class="lg-turned"><summary><span class="lg-turned__chev">${codicon('chevron-right')}</span>${turned} turned down${leans ? ` <span class="lg-turned__leans">leans on ${leans}</span>` : ''}</summary>` +
          `<ul class="lg-turned__list">${d.alts.map((a) => `<li><span class="lg-turned__x">${codicon('close')}</span><span class="lg-turned__name">${parseInline(a.name)}</span>${a.why ? `<span class="lg-turned__why">${parseInline(a.why)}</span>` : ''}</li>`).join('')}</ul></details>`
        : leans ? `<div class="lg-leans">leans on ${leans}</div>` : '';

    let body: string;
    if (d.kind === 'question') {
        const finding = trimLines(d.finding);
        const evidence = finding.length > 3;
        const paras = finding.join('\n').split(/\n[ \t]*\n/);
        const head = renderBlocks(paras[0].split('\n'));
        const tail = paras.slice(1).join('\n\n');
        const findingHtml = evidence
            ? `${head}<details class="lg-evidence"><summary>Read the evidence · ${finding.length} lines</summary>${renderBlocks(tail.split('\n'))}</details>`
            : renderBlocks(finding);
        body =
            (d.question.length ? fieldRow('Question', blocks(d.question)) : '') +
            (finding.length ? fieldRow('Finding', findingHtml) : '') +
            (d.decision.length ? `<div class="lg-pick">${fieldRow('Decision', blocks(d.decision))}</div>` : '');
    } else {
        body =
            (d.decision.length ? `<div class="lg-decision__text">${blocks(d.decision)}</div>` : '') +
            (d.why.length ? `<div class="lg-why"><span class="lg-why__label">Why</span>${blocks(d.why)}</div>` : '');
    }
    const intro = d.intro.length ? `<div class="lg-decision__intro">${blocks(d.intro)}</div>` : '';
    const empty = !d.why.length && !turned && d.kind === 'decision' ? '<p class="lg-muted">No alternatives recorded. Nothing to unfold.</p>' : '';

    return `<div class="lg-decision lg-fam-decision" id="${slugForId(d.id)}" data-kind="${d.kind}">` +
        `<div class="lg-decision__lane"><span class="lg-chip">${d.id}</span></div>` +
        `<div class="lg-decision__main"><div class="lg-decision__head"><span class="lg-decision__title">${parseInline(d.title)}</span><span class="lg-status">${statusDot(st.status)}${st.label}</span></div>` +
        `${body}${intro}${empty}${alts}</div></div>`;
}

export function decisionsStrip(list: Decision[]): string {
    const turned = list.reduce((n, d) => n + d.alts.length, 0);
    const count = `${list.length} · ${turned} turned down`;
    const rows = list.map((d) => {
        const note = d.alts.length ? `${d.alts.length} turned down` : '';
        return `<a class="lg-strip__row" href="#${slugForId(d.id)}"><span class="lg-chip">${d.id}</span><span class="lg-strip__title">${parseInline(d.title)}</span><span class="lg-strip__meta">${note}</span></a>`;
    }).join('');
    return `<div class="lg-strip lg-fam-decision"><div class="lg-strip__head">${eyebrow('decision', 'Decisions at a glance', count)}</div>${rows}</div>`;
}

function followUps(s: SectionCtx): string | null {
    if (!/^follow[- ]?ups?\b|^follow-up work/i.test(s.heading.text)) return null;
    const items = s.direct.map((l) => l.match(BULLET)?.[1]).filter((t): t is string => !!t);
    if (!items.length) return null;
    const rows = items.map((t, i) =>
        `<div class="lg-follow"><span class="lg-chip">F${i + 1}</span><span class="lg-follow__text">${parseInline(t)}</span><span class="lg-status">${statusDot('todo')}Deferred</span></div>`).join('');
    const head = `<div class="lg-strip__head lg-fam-decision">${eyebrow('decision', 'Follow-ups', `${items.length} · none started`)}</div>`;
    return `<div class="lg-followups">${head}${rows}</div>`;
}

/** plan.md "Key decisions": bold-led bullets become decision cards. */
function keyDecisions(s: SectionCtx): string | null {
    if (!/^(?:phase 0\s*[—–-]\s*)?(?:key|design)\s+decisions\b/i.test(s.heading.text)) return null;
    const items: string[] = [];
    for (const l of s.direct) {
        if (isBlank(l)) continue;
        const m = l.match(BULLET);
        if (m) items.push(m[1]);
        else if (/^[ \t]+\S/.test(l) && items.length) items[items.length - 1] += ' ' + l.trim();
        else return null;
    }
    if (!items.length || !items.every((t) => /^\*\*.+?\*\*/.test(t))) return null;
    const cards = items.map((t, i) => {
        const m = t.match(/^\*\*(.+?)\*\*[:.]?[ \t]*(.*)$/)!;
        let why = m[2];
        let alts: Alt[] = [];
        const a = why.match(/\b(?:Alternatives?(?: considered)?|Rejected)\b:?[ \t]*(.+)$/i);
        if (a) {
            why = why.slice(0, a.index).trim();
            alts = [splitAlt(a[1])];
        }
        return decisionCard({
            id: `D${i + 1}`, kind: 'decision', title: m[1].replace(/[.:]$/, ''),
            intro: [], question: [], finding: [], decision: [], why: why ? [why] : [], alts,
        });
    });
    return `${'#'.repeat(s.heading.level)} ${s.heading.text}\n${cards.join('\n')}`;
}

export function preprocessResearch(markdown: string): string {
    const kind = docKind(markdown);
    if (kind !== 'research' && kind !== 'plan' && kind !== 'other') return markdown;
    if (!/\*\*(?:Decision|Question)\b|^#{2,3}[ \t]+(?:Decision\b|[RD]\d+\b|(?:Phase 0\s*[—–-]\s*)?(?:Key|Design) Decisions|Follow)/im.test(markdown)) return markdown;

    const cards: Decision[] = [];
    const out = mapSections(markdown, (s, i) => {
        if (kind !== 'plan') {
            const d = fromSection(s, i, kind === 'other');
            if (d) { cards.push(d); return decisionCard(d); }
            const f = followUps(s);
            if (f) return f;
        }
        return keyDecisions(s);
    });
    if (kind !== 'research' || cards.length < 2) return out;

    const lines = out.split('\n');
    const at = lines.findIndex((l) => /^##[ \t]/.test(l) || l.startsWith('<div class="lg-decision '));
    lines.splice(at < 0 ? lines.length : at, 0, decisionsStrip(cards));
    return lines.join('\n');
}
