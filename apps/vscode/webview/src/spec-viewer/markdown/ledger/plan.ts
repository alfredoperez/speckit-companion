/**
 * Ledger components for plan.md: SummaryLede, TechnicalContext, ConstitutionCheck,
 * ComplexityTracking and ProjectTree. Each preprocessor turns one section into a
 * single line of component HTML (the renderer passes it through) and leaves a
 * section it cannot read exactly as written.
 */

import { escapeHtml, parseInline } from '../inline';
import { codicon, eyebrow, fileChip, statusDot } from './primitives';

const H2 = /^##[ \t]+(.+?)[ \t]*$/;
const ANY_HEADING = /^#{1,6}[ \t]/;

type Verdict = 'pass' | 'fail' | 'justified' | 'na' | 'pending';

const VERDICT_WORD: Record<Verdict, string> = {
    pass: 'Pass',
    fail: 'Fails',
    justified: 'Justified',
    na: 'N/A',
    pending: 'Pending',
};

function verdictMark(v: Verdict, label?: string): string {
    const dot = v === 'pass' ? statusDot('done') : v === 'fail' ? statusDot('fail') : statusDot('todo');
    return `<span class="pl-verdict pl-verdict--${v}">${dot}${escapeHtml(label ?? VERDICT_WORD[v])}</span>`;
}

function card(cls: string, id: string | null, head: string, body: string): string {
    const idAttr = id ? ` id="${id}"` : '';
    return `<div class="pl-card ${cls}"${idAttr}><div class="pl-head">${head}</div>${body}</div>`;
}

/** The section body under `## <title>` up to the next heading, as line indexes. */
function sectionRange(lines: string[], title: RegExp, from = 0): { start: number; end: number } | null {
    for (let i = from; i < lines.length; i++) {
        const m = lines[i].match(H2);
        if (!m || !title.test(m[1])) continue;
        let end = i + 1;
        while (end < lines.length && !ANY_HEADING.test(lines[end])) end++;
        return { start: i, end };
    }
    return null;
}

function splitRow(line: string): string[] {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

const isTableLine = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isSeparator = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l) && l.includes('-');

/** Header cells plus body rows of the first table in the lines, or null. */
function readTable(lines: string[]): { head: string[]; rows: string[][] } | null {
    const at = lines.findIndex(isTableLine);
    if (at < 0 || !lines[at + 1] || !isSeparator(lines[at + 1])) return null;
    const rows: string[][] = [];
    for (let i = at + 2; i < lines.length && isTableLine(lines[i]); i++) rows.push(splitRow(lines[i]));
    return { head: splitRow(lines[at]), rows };
}

// ── Technical Context ───────────────────────────────────────────

const OPEN_VALUE = /NEEDS[ \t]+CLARIFICATION/i;

export function preprocessTechnicalContext(markdown: string): string {
    const lines = markdown.split('\n');
    const out: string[] = [];
    let inSection = false;
    let facts: Array<{ key: string; val: string }> = [];
    let lastIsOpen = false;

    const cell = (f: { key: string; val: string }) => {
        const open = OPEN_VALUE.test(f.val);
        const val = open
            ? `<span class="pl-open">${statusDot('todo')}Needs clarification</span>`
            : parseInline(f.val);
        return `<div class="tech-cell"><span class="tech-key">${parseInline(f.key)}</span><span class="tech-val">${val}</span></div>`;
    };
    const flush = () => {
        lastIsOpen = false;
        if (!facts.length) return;
        const open = facts.filter((f) => OPEN_VALUE.test(f.val)).length;
        const shown = facts.slice(0, 6).map(cell).join('');
        const rest = facts.slice(6);
        const more = rest.length
            ? `<details class="pl-more"><summary>${rest.length} more facts · ${escapeHtml(rest.map((f) => f.key.replace(/[*`]/g, '')).join(', '))}</summary><div class="tech-grid">${rest.map(cell).join('')}</div></details>`
            : '';
        const count = `${facts.length} facts${open ? ` · ${open} open` : ''}`;
        out.push(card('lg-fam-data', null, eyebrow('data', 'Technical context', count), `<div class="tech-grid">${shown}</div>${more}`));
        facts = [];
    };

    for (const line of lines) {
        if (/^##[ \t]+Technical Context\b/i.test(line)) { flush(); inSection = true; continue; }
        if (inSection && /^#{1,6}[ \t]/.test(line)) { inSection = false; flush(); out.push(line); continue; }
        if (inSection) {
            const m = line.match(/^\*\*(.+?)\*\*:[ \t]*(.+)$/);
            if (m) { facts.push({ key: m[1], val: m[2].trim() }); lastIsOpen = true; continue; }
            if (!line.trim()) { lastIsOpen = false; continue; }
            if (facts.length && lastIsOpen && !/^\s*([-*+]\s|\d+\.\s|\||<|>|[-*_]{3,}\s*$)/.test(line)) {
                facts[facts.length - 1].val += ' ' + line.trim();
                continue;
            }
            flush();
        }
        out.push(line);
    }
    flush();
    return out.join('\n');
}

// ── Constitution Check ──────────────────────────────────────────

interface GateRow { numeral: string; name: string; verdict: Verdict; note: string }

function classify(text: string): Verdict | null {
    const t = text.replace(/^[\s✅❌⚠️✔✓☑✗✘-]+/u, '').toLowerCase();
    const raw = text.toLowerCase();
    if (/justif|exception|deviat|⚠/.test(raw)) return 'justified';
    if (/^(fail|violat)|❌|✗|✘/.test(raw.trim()) || /^(fail|violat)/.test(t)) return 'fail';
    if (/^(pass|ok\b|compliant|yes|met\b|complies)/.test(t) || /^[✅✔✓☑]/u.test(raw.trim())) return 'pass';
    if (/^(n\/a|na\b|not applicable|skip)/.test(t)) return 'na';
    if (/^(pending|tbd|todo|\[ \])/.test(t)) return 'pending';
    return null;
}

function stripVerdictWord(text: string): string {
    return text.replace(/^[\s✅❌⚠️✔✓☑✗✘]*(pass(?:ed)?|fail(?:s|ed)?|violation|justified|n\/a|ok|compliant)\b[\s:—–-]*/iu, '').trim();
}

function splitPrinciple(raw: string): { numeral: string; name: string } {
    const text = raw.replace(/\*\*/g, '').trim();
    const m = text.match(/^(?:Principle[ \t]+)?([IVXLC]+|\d+)[.:)\s—–-]+[ \t]*(.+)$/);
    return m ? { numeral: m[1], name: m[2] } : { numeral: '', name: text };
}

function readGateRows(body: string[]): GateRow[] {
    const rows: GateRow[] = [];
    const table = readTable(body);
    if (table) {
        const col = (re: RegExp, fallback: number) => {
            const i = table.head.findIndex((h) => re.test(h));
            return i >= 0 ? i : fallback;
        };
        const statusAt = col(/status|result|verdict|assessment|check|pass/i, 1);
        const notesAt = col(/note|detail|rationale|comment|reason/i, table.head.length > 2 ? 2 : -1);
        for (const r of table.rows) {
            const cellStatus = r[statusAt] ?? '';
            const verdict = classify(cellStatus);
            if (!verdict || !r[0]) continue;
            const p = splitPrinciple(r[0]);
            const note = notesAt >= 0 && notesAt !== statusAt ? (r[notesAt] ?? '') : stripVerdictWord(cellStatus);
            rows.push({ ...p, verdict, note });
        }
        return rows;
    }
    for (const line of body) {
        let m = line.match(/^-[ \t]+\*\*(.+?)\*\*:?[ \t]*(?:[✅❌⚠️]\s*)?(PASS|FAIL|JUSTIFIED|N\/A)\b[ \t]*[—–:-]?[ \t]*(.*)$/iu);
        let name: string, verdict: string, note: string;
        if (m) { [, name, verdict, note] = m; }
        else if ((m = line.match(/^-[ \t]+\*\*(.+?)\*\*[ \t]*[—–:-]?[ \t]*(.*?)[ \t]*(?:[✅❌]\s*)?(PASS|FAIL)\b\.?[ \t]*$/iu))) {
            [, name, note, verdict] = m;
        } else continue;
        rows.push({ ...splitPrinciple(name), verdict: classify(verdict) ?? 'pass', note: note.trim() });
    }
    return rows;
}

function gateOf(rows: GateRow[]): { word: string; verdict: Verdict; fails: number } {
    const fails = rows.filter((r) => r.verdict === 'fail').length;
    return fails
        ? { word: 'Gate blocked', verdict: 'fail', fails }
        : { word: 'Gate passed', verdict: 'pass', fails };
}

function gateRowHtml(r: GateRow): string {
    const num = r.numeral ? `<span class="pl-gate-num">${escapeHtml(r.numeral)}</span>` : '<span class="pl-gate-num"></span>';
    const note = r.note ? `<span class="pl-gate-note${r.verdict === 'justified' ? ' pl-gate-note--why' : ''}">${parseInline(r.note)}</span>` : '';
    return `<div class="pl-gate-row pl-gate-row--${r.verdict}">${num}<span class="pl-gate-body"><span class="pl-gate-name">${parseInline(r.name)}</span>${note}</span>${verdictMark(r.verdict)}</div>`;
}

export function preprocessConstitution(markdown: string): string {
    const lines = markdown.split('\n');
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
        const m = lines[i].match(H2);
        if (!m || !/^Constitution Check\b/i.test(m[1])) { out.push(lines[i++]); continue; }
        let end = i + 1;
        while (end < lines.length && !ANY_HEADING.test(lines[end])) end++;
        const body = lines.slice(i + 1, end);
        const rows = readGateRows(body);
        if (!rows.length) { out.push(...lines.slice(i, end)); i = end; continue; }
        const gate = gateOf(rows);
        const justified = rows.filter((r) => r.verdict === 'justified').length;
        const count = `${rows.length} principles${gate.fails ? ` · ${gate.fails} fails` : ''}${justified ? ` · ${justified} justified` : ''}`;
        out.push(card('lg-fam-guard', 'plan-gate', eyebrow('guard', 'Constitution check', count) + verdictMark(gate.verdict, gate.word), rows.map(gateRowHtml).join('')));
        // Prose that is not the gate banner, a table or a verdict bullet stays below the component.
        const keep = body.filter((l) => l.trim() && !isTableLine(l) && !/^-[ \t]+\*\*/.test(l) && !/^\*?GATE\b/i.test(l.replace(/^\*+/, '')));
        if (keep.length) out.push('', ...keep, '');
        i = end;
    }
    return out.join('\n');
}

// ── Complexity Tracking ─────────────────────────────────────────

export function preprocessComplexity(markdown: string): string {
    const lines = markdown.split('\n');
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
        const m = lines[i].match(H2);
        if (!m || !/^Complexity Tracking\b/i.test(m[1])) { out.push(lines[i++]); continue; }
        let end = i + 1;
        while (end < lines.length && !ANY_HEADING.test(lines[end])) end++;
        const body = lines.slice(i + 1, end);
        const table = readTable(body);
        const real = table ? table.rows.filter((r) => r[0] && !/^[[<{]/.test(r[0])) : [];
        const empty = body.find((l) => /\bno\b.*\b(violations?|deviations?)\b/i.test(l));
        const head = (count: string) => eyebrow('guard', 'Complexity tracking', count);
        if (table && real.length) {
            const cx = real.map((r) => {
                const why = (r[1] ?? '').trim();
                const alt = (r[2] ?? '').trim();
                const v: Verdict = why ? 'justified' : 'pending';
                const whyHtml = why ? `<span class="pl-cx-v pl-cx-why">${parseInline(why)}</span>` : '<span class="pl-cx-v pl-cx-missing">Why needed: missing</span>';
                const altHtml = alt ? `<span class="pl-cx-v">${parseInline(alt)}</span>` : '<span class="pl-cx-v pl-cx-missing">Simpler alternative: missing</span>';
                return `<div class="pl-cx-row"><div class="pl-cx-cell"><span class="pl-cx-k">${escapeHtml(table.head[0] || 'Violation')}</span><span class="pl-cx-v pl-cx-name">${parseInline(r[0])}</span></div><div class="pl-cx-cell"><span class="pl-cx-k">${escapeHtml(table.head[1] || 'Why needed')}</span>${whyHtml}</div><div class="pl-cx-cell"><span class="pl-cx-k">${escapeHtml(table.head[2] || 'Simpler alternative')}</span>${altHtml}</div>${verdictMark(v, v === 'pending' ? 'Needs justification' : 'Justified')}</div>`;
            });
            const justified = real.filter((r) => (r[1] ?? '').trim()).length;
            out.push(card('lg-fam-guard', 'plan-complexity', head(`${justified} justified`), cx.join('')));
        } else if (empty) {
            const clear = `<span class="pl-verdict pl-verdict--pass">${codicon('check')}Clear</span>`;
            out.push(card('lg-fam-guard', 'plan-complexity', head('0'), `<div class="pl-empty"><span>${parseInline(empty.trim())}</span>${clear}</div>`));
        } else { out.push(...lines.slice(i, end)); }
        i = end;
    }
    return out.join('\n');
}

// ── Project Structure ───────────────────────────────────────────

type Change = 'new' | 'modified' | '';
interface TreeEntry { depth: number; name: string; dir: boolean; path: string; change: Change; note: string }

const NEW_WORD = /^(?:already\s+)?(?:NEW|ADD(?:ED)?|CREATE[D]?)\b[\s:—–-]*/i;
const MOD_WORD = /^(?:already\s+)?(?:MODIFY|MODIFIED|UPDATE[D]?|CHANGE[D]?|EDIT(?:ED)?|EXTEND(?:ED)?)\b[\s:—–-]*/i;

export function parseTree(codeLines: string[]): TreeEntry[] | null {
    const entries: TreeEntry[] = [];
    const indents: number[] = [];
    const parents: string[] = [];
    let marks = 0;
    for (const raw of codeLines) {
        if (!raw.trim()) continue;
        const pre = raw.match(/^(?:[\s│|]|[├└┬┼+\\`]|[─-]{2,})*/)![0];
        const rest = raw.slice(pre.length);
        if (!rest.trim()) continue;
        if (/[├└│]|^\s*[|+\\]--/.test(raw)) marks++;
        const hash = rest.search(/\s+#(?:\s|$)/);
        const name = (hash >= 0 ? rest.slice(0, hash) : rest).trim();
        const comment = hash >= 0 ? rest.slice(hash).replace(/^\s*#\s*/, '').trim() : '';
        if (!name) continue;
        while (indents.length && indents[indents.length - 1] >= pre.length) indents.pop();
        const depth = indents.length;
        indents.push(pre.length);
        parents.length = depth;
        const dir = name.endsWith('/');
        const path = parents.join('') + name;
        if (dir) parents[depth] = name;
        let change: Change = '';
        let note = comment;
        if (NEW_WORD.test(comment)) { change = 'new'; note = comment.replace(NEW_WORD, ''); }
        else if (MOD_WORD.test(comment)) { change = 'modified'; note = comment.replace(MOD_WORD, ''); }
        entries.push({ depth, name, dir, path, change, note });
    }
    const looksLikeTree = entries.length >= 2 && (marks > 0 || entries.some((e) => e.dir) || entries.some((e) => e.depth > 0));
    return looksLikeTree ? entries : null;
}

const CHANGE_LABEL: Record<'new' | 'modified', { icon: string; word: string }> = {
    new: { icon: 'diff-added', word: 'New' },
    modified: { icon: 'diff-modified', word: 'Modified' },
};

function treeHtml(entries: TreeEntry[], withId: boolean): string {
    const files = entries.filter((e) => !e.dir);
    const added = files.filter((e) => e.change === 'new').length;
    const changed = files.filter((e) => e.change === 'modified').length;
    const count = [`${files.length} files`, added ? `${added} new` : '', changed ? `${changed} modified` : ''].filter(Boolean).join(' · ');
    const rows = entries.map((e) => {
        const name = e.dir
            ? `<span class="pl-tree-dir">${codicon('folder')}${escapeHtml(e.name)}</span>`
            : /^[\w.@\-/*{}]+$/.test(e.name) ? fileChip(e.path) : `<span class="pl-tree-dir">${escapeHtml(e.name)}</span>`;
        const note = e.note ? `<span class="pl-tree-note">${parseInline(e.note)}</span>` : '';
        const stat = e.change ? `<span class="pl-tree-stat pl-tree-stat--${e.change}">${codicon(CHANGE_LABEL[e.change].icon)}${CHANGE_LABEL[e.change].word}</span>` : '';
        return `<div class="pl-tree-row" style="--d:${e.depth}"><span class="pl-tree-main">${name}${note}</span>${stat}</div>`;
    }).join('');
    return card('lg-fam-task', withId ? 'plan-structure' : null, eyebrow('task', 'Project structure', count), rows);
}

const STRUCTURE_SECTION = /^(Project Structure|Source Code|Structure)\b/i;

export function preprocessProjectTree(markdown: string): string {
    const lines = markdown.split('\n');
    const out: string[] = [];
    let inStructure = false;
    let idUsed = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const h = line.match(/^(#{2,3})[ \t]+(.+?)[ \t]*$/);
        if (h) { inStructure = h[1] === '##' ? STRUCTURE_SECTION.test(h[2]) : inStructure; out.push(line); continue; }
        const fence = line.match(/^```[ \t]*([\w-]*)[ \t]*$/);
        if (!inStructure || !fence || !/^(|text|plaintext|tree|txt)$/i.test(fence[1])) { out.push(line); continue; }
        let end = i + 1;
        while (end < lines.length && !/^```/.test(lines[end])) end++;
        const entries = end < lines.length ? parseTree(lines.slice(i + 1, end)) : null;
        if (!entries) { out.push(line); continue; }
        out.push(treeHtml(entries, !idUsed));
        idUsed = true;
        i = end;
    }
    return out.join('\n');
}

// ── Summary ─────────────────────────────────────────────────────

function treeStats(lines: string[]): { files: number; added: number } | null {
    let best: { files: number; added: number } | null = null;
    let inStructure = false;
    for (let i = 0; i < lines.length; i++) {
        const h = lines[i].match(/^(#{2,3})[ \t]+(.+?)[ \t]*$/);
        if (h) { if (h[1] === '##') inStructure = STRUCTURE_SECTION.test(h[2]); continue; }
        if (!inStructure || !/^```[ \t]*(|text|plaintext|tree|txt)[ \t]*$/i.test(lines[i])) continue;
        let end = i + 1;
        while (end < lines.length && !/^```/.test(lines[end])) end++;
        const entries = parseTree(lines.slice(i + 1, end));
        i = end;
        if (!entries) continue;
        const files = entries.filter((e) => !e.dir);
        if (!best || files.length > best.files) best = { files: files.length, added: files.filter((e) => e.change === 'new').length };
    }
    return best;
}

const SUMMARY_SIGNALS = /^##[ \t]+(Technical Context|Constitution Check|Project Structure)\b/im;

/** A plan opens with its lede: the first sentence in weight, the rest quieter, and a strip of what can be counted. */
export function preprocessPlanSummary(markdown: string): string {
    if (!SUMMARY_SIGNALS.test(markdown)) return markdown;
    const lines = markdown.split('\n');
    const range = sectionRange(lines, /^Summary$/i);
    if (!range) return markdown;
    const body = lines.slice(range.start + 1, range.end);
    const prose = body.filter((l) => l.trim());
    if (!prose.length || prose.some((l) => /^\s*([-*+]\s|\d+\.\s|\||```|<|>|\[)/.test(l))) return markdown;
    const text = prose.join(' ').replace(/\s+/g, ' ').trim();
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z`*])/);
    const first = `<strong>${parseInline(sentences[0])}</strong>`;
    const rest = sentences.slice(1);
    let restHtml = '';
    if (rest.length > 2) {
        restHtml = `<details class="pl-more"><summary>Read the rest · ${rest.length} more sentences</summary><span class="pl-lede-rest">${parseInline(rest.join(' '))}</span></details>`;
    } else if (rest.length) {
        restHtml = ` ${parseInline(rest.join(' '))}`;
    }

    const stats: string[] = [];
    const cellOf = (k: string, v: string) => `<div class="pl-stat"><span class="pl-stat-k">${k}</span><span class="pl-stat-v">${v}</span></div>`;
    const tree = treeStats(lines);
    if (tree && tree.files) {
        const sub = tree.added ? ` <span class="pl-stat-sub">· ${tree.added} new</span>` : '';
        stats.push(cellOf('Files', `<a href="#plan-structure">${tree.files}</a>${sub}`));
    }
    const gateRange = sectionRange(lines, /^Constitution Check\b/i);
    const gateRows = gateRange ? readGateRows(lines.slice(gateRange.start + 1, gateRange.end)) : [];
    if (gateRows.length) {
        const g = gateOf(gateRows);
        const word = g.fails ? 'Blocked' : 'Passed';
        const sub = g.fails ? ` <span class="pl-stat-sub">· ${g.fails} fails</span>` : '';
        stats.push(cellOf('Gate', `<a href="#plan-gate">${verdictMark(g.verdict, word)}</a>${sub}`));
    }
    const strip = stats.length ? `<div class="pl-stats">${stats.join('')}</div>` : '';
    const head = `<span class="lg-eyebrow">${codicon('dash')}Summary</span>`;
    const html = `<div class="pl-card pl-summary"><div class="pl-head">${head}</div><div class="pl-lede">${first}${restHtml}</div>${strip}</div>`;
    return [...lines.slice(0, range.start), html, ...lines.slice(range.end)].join('\n');
}

/** The whole plan pipeline, in the order that lets the summary read the sections before they turn into components. */
export function preprocessPlan(markdown: string): string {
    let md = preprocessPlanSummary(markdown);
    md = preprocessTechnicalContext(md);
    md = preprocessConstitution(md);
    md = preprocessComplexity(md);
    md = preprocessProjectTree(md);
    return md;
}
