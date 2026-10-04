export interface ReportSection {
    heading: string;
    body: string;
}

export interface ReportDoc {
    sections: ReportSection[];
}

export interface ReportField {
    term: string;
    text: string;
}

export interface FencedBlock {
    language: string;
    code: string;
}

export type TableRow = Record<string, string>;

type LineKind = 'text' | 'open' | 'code' | 'close';

interface Line {
    text: string;
    kind: LineKind;
    language: string;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const LIST_ITEM = /^(?:[-*+]|\d+[.)])\s+(.*)$/;
const FIELD = /^\*\*([^*]+?)\*\*\s*:?\s*([\s\S]*)$/;

function scan(source: string): Line[] {
    let marker = '';
    return String(source ?? '')
        .split(/\r?\n/)
        .map((text) => {
            const fence = FENCE.exec(text);
            if (!marker) {
                if (!fence) {
                    return { text, kind: 'text' as const, language: '' };
                }
                marker = fence[1];
                return { text, kind: 'open' as const, language: fence[2] };
            }
            const closes =
                !!fence && fence[1][0] === marker[0] && fence[1].length >= marker.length && !text.trim().slice(fence[1].length).trim();
            if (closes) {
                marker = '';
                return { text, kind: 'close' as const, language: '' };
            }
            return { text, kind: 'code' as const, language: '' };
        });
}

function isTableStart(lines: Line[], i: number): boolean {
    const next = lines[i + 1];
    return lines[i].kind === 'text' && lines[i].text.includes('|') && !!next && next.kind === 'text' && TABLE_DIVIDER.test(next.text);
}

function isTableRow(line: Line | undefined): boolean {
    return !!line && line.kind === 'text' && line.text.trim().startsWith('|');
}

function splitCells(row: string): string[] {
    const cells: string[] = [];
    const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
    let cell = '';
    let inCode = false;
    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (ch === '\\' && trimmed[i + 1] === '|') {
            cell += '|';
            i++;
        } else if (ch === '|' && !inCode) {
            cells.push(cell.trim());
            cell = '';
        } else {
            if (ch === '`') {
                inCode = !inCode;
            }
            cell += ch;
        }
    }
    cells.push(cell.trim());
    return cells;
}

export function parseReportDoc(source: string): ReportDoc {
    const sections: ReportSection[] = [];
    let body: string[] | undefined;
    const close = () => {
        if (body) {
            sections[sections.length - 1].body = body.join('\n').trim();
        }
    };
    for (const line of scan(source)) {
        const heading = line.kind === 'text' ? HEADING.exec(line.text) : null;
        if (heading && heading[1].length === 2) {
            close();
            sections.push({ heading: heading[2], body: '' });
            body = [];
        } else if (body) {
            body.push(line.text);
        }
    }
    close();
    return { sections };
}

export function findSection(doc: ReportDoc, prefix: string): ReportSection | undefined {
    const wanted = String(prefix ?? '').trim().toLowerCase();
    if (!wanted) {
        return undefined;
    }
    return doc?.sections?.find((section) => section.heading.toLowerCase().startsWith(wanted));
}

export function parseTable(body: string): TableRow[] {
    const lines = scan(body);
    for (let i = 0; i < lines.length; i++) {
        if (!isTableStart(lines, i)) {
            continue;
        }
        const headers = splitCells(lines[i].text).map((header) => header.toLowerCase());
        const rows: TableRow[] = [];
        for (let j = i + 2; isTableRow(lines[j]); j++) {
            const cells = splitCells(lines[j].text);
            const row: TableRow = {};
            headers.forEach((header, column) => {
                if (header) {
                    row[header] = cells[column] ?? '';
                }
            });
            rows.push(row);
        }
        return rows;
    }
    return [];
}

export function parseItems(body: string): string[] {
    const items: string[][] = [];
    let current: string[] | undefined;
    for (const line of scan(body)) {
        const item = line.kind === 'text' ? LIST_ITEM.exec(line.text) : null;
        if (item) {
            current = [item[1]];
            items.push(current);
        } else if (current && (line.kind !== 'text' || !line.text.trim() || /^\s+\S/.test(line.text))) {
            current.push(line.text.replace(/^ {2,4}/, ''));
        } else {
            current = undefined;
        }
    }
    return items.map((parts) => parts.join('\n').trim());
}

export function parseFields(body: string): ReportField[] {
    const fields: ReportField[] = [];
    for (const item of parseItems(body)) {
        const field = FIELD.exec(item);
        if (field) {
            fields.push({ term: field[1].replace(/:$/, '').trim(), text: field[2].trim() });
        }
    }
    return fields;
}

export function fencedBlocks(body: string): FencedBlock[] {
    const blocks: FencedBlock[] = [];
    let code: string[] = [];
    for (const line of scan(body)) {
        if (line.kind === 'open') {
            code = [];
            blocks.push({ language: line.language, code: '' });
        } else if (line.kind === 'code') {
            code.push(line.text);
            blocks[blocks.length - 1].code = code.join('\n');
        }
    }
    return blocks;
}

export function sectionProse(body: string): string {
    const lines = scan(body);
    const kept: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].kind !== 'text') {
            continue;
        }
        if (isTableStart(lines, i)) {
            i++;
            while (isTableRow(lines[i + 1])) {
                i++;
            }
            continue;
        }
        kept.push(lines[i].text);
    }
    return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
