/**
 * Reads a Spec Kit artifact's markdown into the few shapes the gallery
 * prototypes draw: a title, the leading `**Key**: value` facts, and sections
 * whose bodies can be read as a table, a field list, steps or check items.
 */

export interface MetaField {
    key: string;
    value: string;
}

export interface Section {
    heading: string;
    level: number;
    body: string;
    children: Section[];
}

export interface ArtifactDoc {
    title: string;
    meta: MetaField[];
    intro: string;
    sections: Section[];
}

export interface Table {
    headers: string[];
    rows: string[][];
    before: string;
    after: string;
}

export interface Field {
    label: string;
    value: string;
}

export interface CheckItem {
    checked: boolean;
    id: string;
    text: string;
    tags: string[];
}

export interface QaPair {
    question: string;
    answer: string;
}

const FENCE = /^\s*(```|~~~)/;
const META_LINE = /^(?:[-*]\s+)?\*\*([^*]+?)\*\*\s*:\s*(.*)$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

function stripLeadingComment(md: string): string {
    return md.replace(/^\s*<!--[\s\S]*?-->\s*/, '');
}

/** Lines paired with whether each sits inside a fenced block. */
function scan(md: string): Array<{ text: string; fenced: boolean }> {
    let open = false;
    return md.split(/\r?\n/).map((text) => {
        const isFence = FENCE.test(text);
        const fenced = open || isFence;
        if (isFence) open = !open;
        return { text, fenced };
    });
}

export function parseDoc(source: string): ArtifactDoc {
    const lines = scan(stripLeadingComment(source));
    const doc: ArtifactDoc = { title: '', meta: [], intro: '', sections: [] };
    let i = 0;

    while (i < lines.length && !lines[i].text.trim()) i++;
    const first = lines[i] && !lines[i].fenced ? HEADING.exec(lines[i].text) : null;
    if (first && first[1].length === 1) {
        doc.title = first[2];
        i++;
    }

    while (i < lines.length) {
        const text = lines[i].text;
        if (!text.trim()) {
            i++;
            continue;
        }
        if (lines[i].fenced) break;
        const parts = text.split(/\s+\|\s+(?=\*\*)/);
        const fields = parts.map((p) => META_LINE.exec(p.trim()));
        if (fields.some((f) => !f)) break;
        for (const f of fields) doc.meta.push({ key: f![1].trim(), value: f![2].trim() });
        i++;
    }

    const intro: string[] = [];
    let h2: Section | null = null;
    let current: Section | null = null;
    const bodies = new Map<Section, string[]>();

    for (; i < lines.length; i++) {
        const { text, fenced } = lines[i];
        const m = fenced ? null : HEADING.exec(text);
        if (m && (m[1].length === 2 || (m[1].length === 3 && h2))) {
            const section: Section = { heading: m[2], level: m[1].length, body: '', children: [] };
            bodies.set(section, []);
            if (section.level === 2) {
                doc.sections.push(section);
                h2 = section;
            } else {
                h2!.children.push(section);
            }
            current = section;
            continue;
        }
        (current ? bodies.get(current)! : intro).push(text);
    }

    for (const [section, body] of bodies) section.body = body.join('\n').trim();
    doc.intro = intro.join('\n').trim();
    return doc;
}

export function metaValue(doc: ArtifactDoc, key: string): string | undefined {
    const wanted = key.toLowerCase();
    return doc.meta.find((m) => m.key.toLowerCase() === wanted)?.value;
}

export function findSection(doc: ArtifactDoc, match: RegExp): Section | undefined {
    for (const s of doc.sections) {
        if (match.test(s.heading)) return s;
        const child = s.children.find((c) => match.test(c.heading));
        if (child) return child;
    }
    return undefined;
}

/** Splits a table row on pipes that are neither escaped nor inside a code span. */
export function splitCells(row: string): string[] {
    const cells: string[] = [];
    let cell = '';
    let inCode = false;
    const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (ch === '\\' && trimmed[i + 1] === '|') {
            cell += '|';
            i++;
        } else if (ch === '`') {
            inCode = !inCode;
            cell += ch;
        } else if (ch === '|' && !inCode) {
            cells.push(cell.trim());
            cell = '';
        } else {
            cell += ch;
        }
    }
    cells.push(cell.trim());
    return cells;
}

const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

export function parseTable(body: string): Table | null {
    const lines = scan(body);
    for (let i = 0; i + 1 < lines.length; i++) {
        if (lines[i].fenced || !lines[i].text.includes('|') || !TABLE_DIVIDER.test(lines[i + 1].text)) continue;
        const headers = splitCells(lines[i].text);
        const rows: string[][] = [];
        let j = i + 2;
        for (; j < lines.length && lines[j].text.trim().startsWith('|'); j++) {
            rows.push(splitCells(lines[j].text));
        }
        return {
            headers,
            rows,
            before: lines.slice(0, i).map((l) => l.text).join('\n').trim(),
            after: lines.slice(j).map((l) => l.text).join('\n').trim(),
        };
    }
    return null;
}

/** Every table in a body, in order, with the prose that sits between them dropped. */
export function parseTables(body: string): Table[] {
    const out: Table[] = [];
    let rest = body;
    for (let t = parseTable(rest); t; t = parseTable(rest)) {
        out.push(t);
        rest = t.after;
    }
    return out;
}

interface ListItem {
    text: string;
    ordered: boolean;
}

/** Top-level list items; indented lines and nested bullets stay with their parent. */
function topLevelItems(body: string): { items: ListItem[]; before: string; after: string } {
    const lines = scan(body);
    const raw: Array<{ parts: string[]; ordered: boolean }> = [];
    const before: string[] = [];
    const after: string[] = [];
    let ended = false;

    for (const { text, fenced } of lines) {
        const m = fenced ? null : /^(?:([-*])|(\d+)[.)])\s+(.*)$/.exec(text);
        const current = raw[raw.length - 1];
        if (m && !ended) {
            raw.push({ parts: [m[3]], ordered: !!m[2] });
            continue;
        }
        if (current && !ended && (fenced || /^\s+\S/.test(text) || !text.trim())) {
            current.parts.push(text.replace(/^ {2,4}/, ''));
            continue;
        }
        if (current) ended = true;
        (ended ? after : before).push(text);
    }

    const items = raw.map((r) => ({ text: r.parts.join('\n').trim(), ordered: r.ordered }));
    return { items, before: before.join('\n').trim(), after: after.join('\n').trim() };
}

export function parseItems(body: string): { items: string[]; ordered: boolean; before: string; after: string } {
    const { items, before, after } = topLevelItems(body);
    return {
        items: items.map((i) => i.text),
        ordered: items.length > 0 && items.every((i) => i.ordered),
        before,
        after,
    };
}

/** `- **Label**: value` items; anything else in the body comes back as `rest`. */
export function parseFields(body: string): { fields: Field[]; rest: string } {
    const { items, before, after } = topLevelItems(body);
    const fields: Field[] = [];
    const loose: string[] = [];
    for (const item of items) {
        const m = /^\*\*([^*]+?)\*\*\s*:?\s*([\s\S]*)$/.exec(item.text);
        if (m) fields.push({ label: m[1].replace(/:$/, '').trim(), value: m[2].trim() });
        else loose.push(`- ${item.text.replace(/\n/g, '\n  ')}`);
    }
    return { fields, rest: [before, loose.join('\n'), after].filter(Boolean).join('\n\n') };
}

const CHECK_LINE = /^\s*[-*]\s+\[([ xX])\]\s+(?:([A-Z]+\d+)\b[\s:.-]*)?(.*)$/;

export function parseChecks(body: string): CheckItem[] {
    const out: CheckItem[] = [];
    for (const { text, fenced } of scan(body)) {
        const m = fenced ? null : CHECK_LINE.exec(text);
        if (!m) continue;
        const tags: string[] = [];
        const label = m[3]
            .replace(/\[([^\]]+)\]\s*$/g, (_all, inner: string) => {
                tags.push(...inner.split(',').map((t) => t.trim()).filter(Boolean));
                return '';
            })
            .trim();
        out.push({ checked: m[1] !== ' ', id: m[2] ?? '', text: label, tags });
    }
    return out;
}

/** The `- Q: … → A: …` lines the clarify command records under a session heading. */
export function parseQa(body: string): QaPair[] {
    const out: QaPair[] = [];
    for (const item of topLevelItems(body).items) {
        const m = /^Q:\s*([\s\S]*?)\s*(?:→|->)\s*A:\s*([\s\S]*)$/.exec(item.text);
        if (m) out.push({ question: m[1].trim(), answer: m[2].trim() });
    }
    return out;
}

/** Joins hard-wrapped paragraph lines so a paragraph reads as one block. */
export function unwrap(md: string): string {
    const out: string[] = [];
    let joinable = false;
    for (const { text, fenced } of scan(md)) {
        const plain = !fenced && !!text.trim() && !/^\s*([-*+>|#]|\d+[.)]\s|<)/.test(text) && !/\s{2}$/.test(text);
        if (plain && joinable) out[out.length - 1] += ` ${text.trim()}`;
        else out.push(text);
        joinable = plain;
    }
    return out.join('\n');
}

/** Splits a leading identifier (`FR-001`, `T012`, `CHK003`, `A1`) off a cell. */
export function splitId(text: string): { id: string; rest: string } {
    const m = /^\**([A-Z]{1,5}-?\d{1,4})\**[\s:.-]*([\s\S]*)$/.exec(text.trim());
    return m ? { id: m[1], rest: m[2] } : { id: '', rest: text.trim() };
}
