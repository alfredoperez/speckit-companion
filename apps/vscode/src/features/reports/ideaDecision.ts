import { IDEA_RATINGS, IDEA_RATING_TONES, IDEA_STAGES, IDEA_VERDICTS } from '../ideas/ideaValues';
import type { IdeaStage, IdeaVerdict } from '../ideas/ideaValues';
import { findSection, parseFields, parseItems, parseReportDoc, parseTable, sectionProse } from './reportDoc';
import type { ReportDoc, ReportField } from './reportDoc';
import type { HandoffField, IdeaClosing, IdeaDecision, ScoreRow } from './reportPageModel';
import { knownValue, parseReportHeader } from './reportValues';

const BOLD_OPENING = /^\*\*([^*]+)\*\*([.!?]?)\s*/;
const ABBREVIATION = /(?:^|[^a-z])(?:e\.g|i\.e|vs|etc)$/i;
const SENTENCE_START = /^\s+["'(\[*_]*(?:[A-Z]|`)/;
const BLOCK_START = /^\s*(?:[-*+]\s|\d+[.)]\s|`{3,}|~{3,}|>|#{1,6}\s)/;
const MARKER = /\[NEEDS CLARIFICATION:\s*([^\]]*)\]/gi;
const PLACEHOLDER = /^\[[^\]]*\]$/;
const STAGE_NAMES = [...IDEA_STAGES, 'define', 'shape'] as const;
const STAGE_ALIASES: Record<string, IdeaStage> = { define: 'problem', shape: 'concept' };

function stripVerdictOpening(prose: string): string {
    const opening = BOLD_OPENING.exec(prose);
    if (!opening || !(opening[2] || /[.!?]$/.test(opening[1].trim()))) {
        return prose;
    }
    return prose.slice(opening[0].length);
}

function sentenceEnd(paragraph: string): number {
    let inCode = false;
    for (let i = 0; i < paragraph.length; i++) {
        const ch = paragraph[i];
        if (ch === '`') {
            inCode = !inCode;
        } else if (!inCode && (ch === '.' || ch === '!' || ch === '?')) {
            const abbreviated = ch === '.' && ABBREVIATION.test(paragraph.slice(0, i));
            if (!abbreviated && SENTENCE_START.test(paragraph.slice(i + 1))) {
                return i + 1;
            }
        }
    }
    return paragraph.length;
}

function splitRationale(prose: string): { lead?: string; rationale?: string } {
    const text = stripVerdictOpening(prose.trim()).trim();
    if (!text) {
        return {};
    }
    if (BLOCK_START.test(text)) {
        return { rationale: text };
    }
    const breakAt = text.search(/\n\s*\n/);
    const paragraph = breakAt < 0 ? text : text.slice(0, breakAt);
    const end = sentenceEnd(paragraph);
    const lead = paragraph.slice(0, end).replace(/\s+/g, ' ').trim();
    const rationale = text.slice(end).trim();
    return { lead: lead || undefined, rationale: rationale || undefined };
}

function scoreRows(doc: ReportDoc): ScoreRow[] {
    const section = findSection(doc, 'Scorecard');
    if (!section) {
        return [];
    }
    const rows: ScoreRow[] = [];
    for (const cells of parseTable(section.body)) {
        const criterion = (cells['criterion'] ?? '').trim();
        if (!criterion) {
            continue;
        }
        const row: ScoreRow = { criterion };
        const rating = knownValue(IDEA_RATINGS, cells['rating']);
        if (rating) {
            row.rating = rating;
            const tone = IDEA_RATING_TONES[rating];
            if (tone) {
                row.tone = tone;
            }
        }
        const reason = (cells['justification'] ?? '').trim();
        if (reason) {
            row.reason = reason;
        }
        rows.push(row);
    }
    return rows;
}

function filled(text: string): string {
    const trimmed = text.trim();
    return PLACEHOLDER.test(trimmed) && !/^\[NEEDS CLARIFICATION:/i.test(trimmed) ? '' : trimmed;
}

function field(fields: ReportField[], term: string): string {
    return fields.find((entry) => entry.term.toLowerCase().startsWith(term))?.text ?? '';
}

function blockingQuestions(text: string): string[] {
    const marked = [...text.matchAll(MARKER)].map((match) => match[1]);
    const listed = marked.length ? marked : parseItems(text);
    const questions = (listed.length ? listed : [filled(text)]).map((question) => question.trim()).filter(Boolean);
    return [...new Set(questions)];
}

function revisitStage(text: string): IdeaStage | undefined {
    const stage = knownValue(STAGE_NAMES, text);
    return stage ? STAGE_ALIASES[stage] ?? (stage as IdeaStage) : undefined;
}

function closingFor(doc: ReportDoc, verdict: IdeaVerdict): IdeaClosing | undefined {
    if (verdict === 'go') {
        const section = findSection(doc, 'If go');
        const fields: HandoffField[] = (section ? parseFields(section.body) : [])
            .map((entry) => ({ term: entry.term, text: filled(entry.text) }))
            .filter((entry) => entry.term && entry.text);
        return fields.length ? { verdict, fields } : undefined;
    }
    if (verdict === 'needs-clarification') {
        const section = findSection(doc, 'If needs-clarification') ?? findSection(doc, 'If needs clarification');
        const fields = section ? parseFields(section.body) : [];
        const questions = blockingQuestions(field(fields, 'blocking question'));
        const revisit = revisitStage(field(fields, 'revisit stage'));
        if (!questions.length && !revisit) {
            return undefined;
        }
        return revisit ? { verdict, questions, revisit } : { verdict, questions };
    }
    const section = findSection(doc, 'Revisit trigger');
    const trigger = section ? filled(sectionProse(section.body)) : '';
    return trigger ? { verdict, trigger } : undefined;
}

export function buildIdeaDecision(text: string): IdeaDecision | undefined {
    try {
        const source = String(text ?? '');
        const verdict = knownValue(IDEA_VERDICTS, parseReportHeader(source).fields.get('verdict'));
        if (!verdict) {
            return undefined;
        }
        const doc = parseReportDoc(source);
        const rationaleSection = findSection(doc, 'Verdict & Rationale');
        if (!rationaleSection && !findSection(doc, 'Scorecard')) {
            return undefined;
        }
        const decision: IdeaDecision = { verdict, scorecard: scoreRows(doc) };
        const { lead, rationale } = splitRationale(rationaleSection ? sectionProse(rationaleSection.body) : '');
        if (lead) {
            decision.lead = lead;
        }
        if (rationale) {
            decision.rationale = rationale;
        }
        const closing = closingFor(doc, verdict);
        if (closing) {
            decision.closing = closing;
        }
        return decision;
    } catch {
        return undefined;
    }
}
