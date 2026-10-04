import { BUG_FIX_STATUSES, BUG_SEVERITIES, BUG_TEST_RESULTS, BUG_VERDICTS } from '../bugs/bugValues';
import { IDEA_VERDICTS } from '../ideas/ideaValues';
import { knownValue, parseReportHeader } from './reportValues';

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})(?![\d])/;
const PLACEHOLDER = '[NEEDS CLARIFICATION';
const HEADER_FIELD = /^\s*[-*]\s+\*\*[^*]+\*\*\s*:/;
const FIX_WORDS = { applied: 'fix applied', partial: 'fix partly applied', 'not-applied': 'fix not applied' } as const;

/** "Oct 1, 2026" for anything that parses as a date, at noon UTC so the day never shifts. */
export function formatReportDate(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    const value = raw.trim();
    // `new Date` reads "3" and "Option 2" as dates. A date names its year.
    if (!/\b\d{4}\b/.test(value)) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    const iso = ISO_DAY.exec(value);
    const noon = iso
        ? Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12)
        : Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(noon);
}

type Fields = Map<string, string>;

function dated(word: string, fields: Fields, label: string): string | undefined {
    const date = formatReportDate(fields.get(label));
    return date && `${word} ${date}`;
}

const FACTS: Record<string, (fields: Fields) => Array<string | undefined>> = {
    assessment: fields => {
        const source = fields.get('source')?.trim();
        const from = source && !source.includes(PLACEHOLDER) ? source : undefined;
        const reported = dated('Reported', fields, 'created');
        const severity = knownValue(BUG_SEVERITIES, fields.get('severity'));
        return [
            reported && from ? `${reported} from ${from}` : reported ?? (from && `Reported from ${from}`),
            knownValue(BUG_VERDICTS, fields.get('verdict')),
            severity && `${severity} severity`,
        ];
    },
    fix: fields => {
        const status = knownValue(BUG_FIX_STATUSES, fields.get('status'));
        return [dated('Fixed', fields, 'fixed'), status && FIX_WORDS[status]];
    },
    test: fields => [dated('Tested', fields, 'tested'), knownValue(BUG_TEST_RESULTS, fields.get('result'))],
    decision: fields => [dated('Decided', fields, 'decided'), knownValue(IDEA_VERDICTS, fields.get('verdict'))],
};

/** Any other report: every field but the slug, a date read as a date. */
function everyField(fields: Fields): Array<string | undefined> {
    return [...fields].map(([label, value]) => {
        if (label === 'slug' || value.includes(PLACEHOLDER)) return undefined;
        const name = `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
        const date = formatReportDate(value);
        return date ? `${name} ${date}` : `${name}: ${value}`;
    });
}

/** The facts a report's header bullets state, as the short phrases of one line. Unrecognised values are left out. */
export function reportHeaderFacts(kind: string, markdown: string): string[] {
    const { fields } = parseReportHeader(markdown);
    const facts = (FACTS[kind] ?? everyField)(fields);
    return facts.filter((fact): fact is string => !!fact);
}

const escapeText = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The report with its header bullets replaced by one line of facts. Unchanged when the bullets state nothing recognisable. */
export function withHeaderLine(kind: string, markdown: string): string {
    const facts = reportHeaderFacts(kind, markdown);
    if (facts.length === 0) return markdown;
    const lines = markdown.split(/\r?\n/);
    const title = lines.findIndex(line => /^#\s+/.test(line.trim()));
    let start = title + 1;
    while (start < lines.length && lines[start].trim() === '') start++;
    let end = start;
    while (end < lines.length && HEADER_FIELD.test(lines[end])) end++;
    if (end === start) return markdown;
    const line = `<p class="rp-meta">${facts.map(escapeText).join(' · ')}</p>`;
    // A field still waiting on an answer stays as written, so its question keeps its place and its button.
    const open = lines.slice(start, end).filter(field => field.includes(PLACEHOLDER));
    return [...lines.slice(0, title + 1), '', line, ...(open.length ? ['', ...open] : []), ...lines.slice(end)].join('\n');
}
