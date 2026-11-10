/**
 * Ledger data components for data-model.md: DataEntityCard (field/type/rule
 * lanes), TransitionList (state machines) and EntityRelations.
 */

import { escapeHtml, parseInline } from '../inline';
import { codicon, eyebrow, fileChip, slugForId } from './primitives';
import {
    colIndex, docKind, isTableLine, mapSections, parseTable, plain, renderBlocks,
    type SectionCtx, type Table,
} from './blocks';

const FIELD_HEAD = /^(field|attribute|property|column|name|key|variant|value)s?$/i;
const TYPE_HEAD = /^(type|payload|kind|data type)$/i;
const FROM_HEAD = /^(from|current state|source|state|before)$/i;
const EVENT_HEAD = /^(event|trigger|action|on|when|transition)$/i;
const TO_HEAD = /^(to|next state|new state|target|result|after)$/i;
const FILE_LINE = /^[ \t]*(?:File|Path|Location)s?:[ \t]*`([^`]+)`[ \t]*(.*)$/i;

interface FieldTable {
    name: number;
    type: number;
    table: Table;
}

function asFieldTable(t: Table): FieldTable | null {
    const type = colIndex(t.head, TYPE_HEAD);
    if (type < 0 || !FIELD_HEAD.test(plain(t.head[0]))) return null;
    return { name: 0, type, table: t };
}

function tableRuns(lines: string[]): Table[] {
    const found: Table[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (!isTableLine(lines[i])) continue;
        const run: string[] = [];
        while (i < lines.length && isTableLine(lines[i])) run.push(lines[i++]);
        const t = parseTable(run);
        if (t) found.push(t);
    }
    return found;
}

interface Named {
    name: string;
    qualifier: string;
}

function entityName(heading: string): Named {
    let t = heading.replace(/`/g, '').replace(/^\d+[.)]\s*/, '').replace(/^Entity:\s*/i, '').trim();
    let qualifier = '';
    const q = t.match(/^(.+?)[ \t]*(?:\(([^)]+)\)|[—–][ \t]*(.+))$/);
    if (q) { t = q[1].trim(); qualifier = (q[2] ?? q[3]).trim(); }
    return { name: t, qualifier };
}

const entitySlug = (name: string) => slugForId(name);

function linkType(raw: string, names: string[], self: string): string {
    const text = plain(raw);
    const hit = names.find((n) => n !== self && new RegExp(`(?<![A-Za-z0-9_])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`).test(text));
    if (!hit) return `<span class="lg-type">${escapeHtml(text)}</span>`;
    return `<a class="lg-type lg-type--link" href="#${entitySlug(hit)}">${escapeHtml(text)}${codicon('arrow-right')}</a>`;
}

function fieldLanes(ft: FieldTable, names: string[], self: string): string {
    const { table } = ft;
    const ruleCols = table.head.map((_, i) => i).filter((i) => i !== ft.name && i !== ft.type);
    const rows = table.rows.map((r) => {
        const rule = ruleCols.map((i) => r[i]).filter(Boolean).join(' · ');
        return `<div class="lg-flane" role="row"><span class="lg-f-name" role="cell">${escapeHtml(plain(r[ft.name]))}</span><span class="lg-f-type" role="cell">${linkType(r[ft.type], names, self)}</span><span class="lg-f-rule" role="cell">${parseInline(rule)}</span></div>`;
    }).join('');
    const ruleHead = ruleCols.length ? plain(table.head[ruleCols[0]]) : '';
    const head = `<div class="lg-flane lg-flane--head" role="row"><span>${escapeHtml(plain(table.head[0]))}</span><span>${escapeHtml(plain(table.head[ft.type]))}</span><span>${escapeHtml(ruleHead)}</span></div>`;
    return `<div class="lg-fields" role="table">${head}${rows}</div>`;
}

interface Transition {
    from: string;
    event: string;
    to: string;
    note: string;
}

function asTransitions(t: Table): Transition[] | null {
    const from = colIndex(t.head, FROM_HEAD);
    const event = colIndex(t.head, EVENT_HEAD);
    const to = colIndex(t.head, TO_HEAD);
    if (from < 0 || event < 0 || to < 0 || new Set([from, event, to]).size < 3) return null;
    const note = t.head.findIndex((_, i) => ![from, event, to].includes(i));
    return t.rows.map((r) => ({ from: r[from], event: r[event], to: r[to], note: note >= 0 ? r[note] : '' }));
}

export function transitionList(list: Transition[]): string {
    const states = new Set<string>();
    list.forEach((t) => { states.add(plain(t.from)); states.add(plain(t.to)); });
    const rows = list.map((t) =>
        `<div class="lg-trans__row"><div class="lg-trans__line"><span class="lg-trans__from">${parseInline(t.from)}</span>` +
        `<span class="lg-trans__arrow"><span class="lg-trans__event">${parseInline(t.event)}</span></span>` +
        `<span class="lg-trans__to">${parseInline(t.to)}</span></div>${t.note ? `<p class="lg-trans__note">${parseInline(t.note)}</p>` : ''}</div>`).join('');
    return `<div class="lg-trans lg-fam-data"><div class="lg-trans__head">${eyebrow('data', 'State transitions', `${list.length} · ${states.size} states`)}</div>${rows}</div>`;
}

const tableHook = (t: Table): string | null => {
    const tr = asTransitions(t);
    return tr ? transitionList(tr) : null;
};

function entityCard(s: SectionCtx, names: string[]): string | null {
    const tables = tableRuns(s.direct);
    const field = tables.map(asFieldTable).find((x): x is FieldTable => !!x);
    if (!field) return null;
    const { name, qualifier } = entityName(s.heading.text);

    // Prose before the first table is the description; a File line becomes a chip.
    let file = '';
    let fileNote = '';
    const before: string[] = [];
    const after: string[] = [];
    let start = -1;
    let len = 0;
    for (let i = 0; i < s.body.length && start < 0; i++) {
        if (!isTableLine(s.body[i])) continue;
        let n = 0;
        while (i + n < s.body.length && isTableLine(s.body[i + n])) n++;
        const t = parseTable(s.body.slice(i, i + n));
        if (t && asFieldTable(t)) { start = i; len = n; }
        i += n - 1;
    }
    s.body.forEach((l, i) => {
        if (i >= start && i < start + len) return;
        const f = l.match(FILE_LINE);
        if (f && i < start) { file = f[1]; fileNote = f[2].replace(/^[.(\s]+|[.)\s]+$/g, ''); return; }
        (i < start ? before : after).push(l);
    });

    const variants = /^variant/i.test(plain(field.table.head[0]));
    const count = field.table.rows.length;
    const unit = variants ? (count === 1 ? 'variant' : 'variants') : (count === 1 ? 'field' : 'fields');
    const meta = [qualifier || fileNote, `${count} ${unit}`].filter(Boolean).map(escapeHtml).join(' · ');
    const fileHtml = file ? `<span class="lg-entity__file">${fileChip(file)}</span>` : '';
    const lanes = fieldLanes(field, names, name);
    const grid = variants
        ? `<details class="lg-entity__variants"><summary>${codicon('chevron-right')}Show ${count} ${unit}</summary>${lanes}</details>`
        : lanes;
    const lead = renderBlocks(before);
    const tail = renderBlocks(after, { table: tableHook });
    return `<div class="lg-entity lg-fam-data" id="${entitySlug(name)}">` +
        `<div class="lg-entity__head"><span class="lg-entity__glyph">${codicon('table')}</span><span class="lg-entity__name">${escapeHtml(name)}</span><span class="lg-entity__meta">${meta}</span>${fileHtml}</div>` +
        `${lead ? `<div class="lg-entity__desc">${lead}</div>` : ''}${grid}${tail ? `<div class="lg-entity__tail">${tail}</div>` : ''}</div>`;
}

function relations(s: SectionCtx, names: string[]): string | null {
    if (!/relationships?/i.test(s.heading.text) || !names.length) return null;
    const rows: string[] = [];
    for (const l of s.direct) {
        const m = l.match(/^[ \t]*[-*+][ \t]+(.*)$/);
        if (!m) continue;
        const text = m[1].replace(/[`*]/g, '');
        const hits = names
            .map((n) => ({ n, at: text.search(new RegExp(`(?<![A-Za-z0-9_])${n}(?![A-Za-z0-9_])`)) }))
            .filter((h) => h.at >= 0)
            .sort((a, b) => a.at - b.at);
        if (hits.length < 2) continue;
        const [a, b] = [hits[0], hits[hits.length - 1]];
        const verb = text.slice(a.at + a.n.length, b.at).replace(/^[\s:—–→>-]+|[\s:—–→>-]+$/g, '');
        const chip = (n: string) => `<a class="lg-rel__ent" href="#${entitySlug(n)}">${codicon('table')}${escapeHtml(n)}</a>`;
        rows.push(`<div class="lg-rel__row">${chip(a.n)}<span class="lg-rel__verb">${escapeHtml(verb || 'relates to')}</span>${chip(b.n)}</div>`);
    }
    if (!rows.length) return null;
    return `${'#'.repeat(s.heading.level)} ${s.heading.text}\n<div class="lg-rel lg-fam-data"><div class="lg-trans__head">${eyebrow('data', 'Key relationships', `${rows.length} links`)}</div>${rows.join('')}</div>`;
}

function replaceLooseTransitions(markdown: string): string {
    const lines = markdown.split('\n');
    const out: string[] = [];
    let fence = false;
    for (let i = 0; i < lines.length; i++) {
        if (/^[ \t]*(```|~~~)/.test(lines[i])) fence = !fence;
        if (fence || !isTableLine(lines[i])) { out.push(lines[i]); continue; }
        const run: string[] = [];
        while (i < lines.length && isTableLine(lines[i])) run.push(lines[i++]);
        i--;
        const t = parseTable(run);
        const tr = t && asTransitions(t);
        if (tr) out.push(transitionList(tr));
        else out.push(...run);
    }
    return out.join('\n');
}

export function preprocessDataModel(markdown: string): string {
    if (docKind(markdown) !== 'data') return markdown;

    const names: string[] = [];
    mapSections(markdown, (s) => {
        if (tableRuns(s.direct).some(asFieldTable)) names.push(entityName(s.heading.text).name);
        return null;
    });

    const total = names.length;
    let first = true;
    const out = mapSections(markdown, (s) => {
        const card = entityCard(s, names);
        if (card) {
            if (!first) return card;
            first = false;
            return `<div class="lg-data-head lg-fam-data">${eyebrow('data', 'Data model', `${total} ${total === 1 ? 'entity' : 'entities'}`)}</div>\n${card}`;
        }
        return relations(s, names);
    });
    return replaceLooseTransitions(out);
}
