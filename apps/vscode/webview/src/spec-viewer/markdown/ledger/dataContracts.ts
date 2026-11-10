/**
 * Ledger ContractCard: a command, function or endpoint as a signature on code
 * ground, its inputs as a lane list and each promise as a marked row. Built from
 * contracts/*.md sections that carry a signature fence and a table or a promise.
 */

import { escapeHtml, parseInline } from '../inline';
import { codicon, eyebrow, slugForId } from './primitives';
import {
    codeBlock, colIndex, docKind, genericTable, isTableLine, mapSections, parseTable, plain, renderBlocks,
    type SectionCtx, type Table,
} from './blocks';

const HTTP = /^(GET|POST|PUT|PATCH|DELETE|HEAD)[ \t]+(\S.*)$/;
const PARAM_HEAD = /^(flag|option|param(?:eter)?|argument|arg|input|field|header|query|body)s?$/i;
const ERROR_HEAD = /^(status|code|error)s?$/i;
const GROUP = /^[ \t]*\*\*(Promises?|Guarantees?|Errors?|Returns?|Outputs?|Response|Exit codes?)\*\*:?[ \t]*(.*)$/i;
const BOLD_LINE = /^[ \t]*\*\*(.+?)\*\*[.]?[ \t]*$/;
const SIG_LANG = /^(bash|sh|shell|console|zsh|python|python3|text|txt|http)?$/i;

interface Signature {
    lang: string;
    text: string;
    at: number;
    len: number;
}

function findSignature(lines: string[]): Signature | null {
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^[ \t]*(```|~~~)[ \t]*([\w+-]*)/);
        if (!m) continue;
        let j = i + 1;
        const body: string[] = [];
        while (j < lines.length && !lines[j].trim().startsWith(m[1])) body.push(lines[j++]);
        return { lang: m[2], text: body.join('\n'), at: i, len: j - i + 1 };
    }
    return null;
}

function methodOf(verb: string | undefined, sig: Signature | null): string {
    if (verb) return verb;
    if (sig && SIG_LANG.test(sig.lang) && !sig.text.includes('(')) return 'CMD';
    if (sig && sig.text.includes('(')) return 'FN';
    return 'API';
}

function lanes(t: Table): string {
    const rows = t.rows.map((r) =>
        `<div class="lg-plane"><span class="lg-plane__name">${escapeHtml(plain(r[0]))}</span><span class="lg-plane__text">${parseInline(r.slice(1).filter(Boolean).join(' · '))}</span></div>`).join('');
    return `<div class="lg-planes">${rows}</div>`;
}

function group(label: string, rows: string[], error: boolean): string {
    const mark = error ? codicon('warning') : codicon('check');
    const body = rows.map((r) => `<div class="lg-promise${error ? ' lg-promise--err' : ''}"><span class="lg-promise__mark">${mark}</span><span>${parseInline(r)}</span></div>`).join('');
    return `<div class="lg-pgroup"><span class="lg-pgroup__label">${escapeHtml(label)}</span><div class="lg-pgroup__rows">${body}</div></div>`;
}

function contractCard(s: SectionCtx): string | null {
    const heading = s.heading.text.replace(/`/g, '');
    const http = heading.match(HTTP);
    const lines = s.direct;
    const sig = findSignature(lines);
    if (sig && sig.text.split('\n').length > 8) return null;
    if (!http && !sig) return null;

    const lead: string[] = [];
    const inputs: Table[] = [];
    const errorTables: Table[] = [];
    const rest: string[] = [];
    const groups: string[] = [];
    let current: { label: string; rows: string[] } | null = null;
    const flush = () => {
        if (current && current.rows.length) groups.push(group(current.label, current.rows, /error/i.test(current.label)));
        current = null;
    };

    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (sig && i >= sig.at && i < sig.at + sig.len) { i = sig.at + sig.len - 1; continue; }
        if (!l.trim()) continue;
        if (isTableLine(l)) {
            const run: string[] = [];
            while (i < lines.length && isTableLine(lines[i])) run.push(lines[i++]);
            i--;
            const t = parseTable(run);
            if (t && PARAM_HEAD.test(plain(t.head[0])) && t.head.length <= 4 && colIndex(t.head, /^type$/i) < 0) inputs.push(t);
            else if (t && ERROR_HEAD.test(plain(t.head[0]))) errorTables.push(t);
            else rest.push(...run);
            continue;
        }
        const g = l.match(GROUP);
        if (g) {
            flush();
            current = { label: g[1][0].toUpperCase() + g[1].slice(1), rows: [] };
            if (g[2].trim()) current.rows.push(g[2].trim());
            continue;
        }
        const bullet = l.match(/^[ \t]*[-*+][ \t]+(.*)$/);
        if (current && bullet) { current.rows.push(bullet[1]); continue; }
        const bold = l.match(BOLD_LINE);
        if (bold) { flush(); groups.push(group('Promises', [bold[1]], false)); continue; }
        flush();
        (!sig || i < sig.at ? lead : rest).push(l);
    }
    flush();
    if (!http && !inputs.length && !errorTables.length && !groups.length) return null;

    const title = http ? http[2] : heading.replace(/^(?:Command|Endpoint|Function|Script):[ \t]*/i, '');
    const method = methodOf(http?.[1], sig);
    const count = inputs.reduce((n, t) => n + t.rows.length, 0);
    const meta = count ? `${count} ${count === 1 ? 'input' : 'inputs'}` : '';
    const errs = errorTables.map((t) => group('Errors', t.rows.map((r) => r.filter(Boolean).join(' — ')), true)).join('');
    return `<div class="lg-contract lg-fam-data" id="${slugForId(title)}">` +
        `<div class="lg-contract__head"><span class="lg-method">${escapeHtml(method)}</span><span class="lg-contract__name">${escapeHtml(title)}</span>${meta ? `<span class="lg-contract__meta">${meta}</span>` : ''}</div>` +
        `${lead.length ? `<div class="lg-contract__desc">${renderBlocks(lead)}</div>` : ''}` +
        `${sig ? codeBlock(sig.text.replace(/^\n+|\n+$/g, '')).replace('lg-code', 'lg-code lg-code--sig') : ''}` +
        `${inputs.map(lanes).join('')}${groups.join('')}${errs}` +
        `${rest.length ? `<div class="lg-contract__rest">${renderBlocks(rest, { table: genericTable })}</div>` : ''}</div>`;
}

export function preprocessContracts(markdown: string): string {
    if (docKind(markdown) !== 'contract') return markdown;
    const out = mapSections(markdown, (s) => contractCard(s)).split('\n');
    const idx = out.map((l, i) => (l.startsWith('<div class="lg-contract ') ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return markdown;
    out.splice(idx[0], 0, `<div class="lg-data-head lg-fam-data">${eyebrow('data', 'Contracts', `${idx.length} ${idx.length === 1 ? 'contract' : 'contracts'}`)}</div>`);
    return out.join('\n');
}
