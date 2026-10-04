/**
 * One reading of the three fixture documents, shared by every styling direction
 * so the pages can be compared like for like.
 */

import { toneFor, type Tone } from '../artifact-gallery/components';
import { findSection, metaValue, parseDoc, parseFields, parseItems, parseTable, type ArtifactDoc } from '../artifact-gallery/parse';

export type { Tone };

function clean(value: string | undefined): string {
    return (value ?? '').replace(/[*`]/g, '').trim();
}

function body(doc: ArtifactDoc, heading: RegExp): string {
    return findSection(doc, heading)?.body ?? '';
}

export function formatDate(iso: string | undefined): string {
    if (!iso) return '';
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A note reads as a sentence: capitalised, and a bare list of counts joined into one line. */
function sentence(md: string): string {
    const lines = md.split('\n');
    const joined = lines.every((l) => /^- /.test(l)) ? `${lines.map((l) => l.slice(2)).join(', ')}.` : md;
    return joined.replace(/^./, (c) => c.toUpperCase());
}

function firstSentence(md: string): string {
    return md.split(/(?<=\.)\s+/)[0] ?? md;
}

export interface BugStory {
    title: string;
    slug: string;
    path: string;
    created: string;
    fixed: string;
    source: string;
    verdict: string;
    severity: string;
    fixStatus: string;
    report: string;
    symptom: string;
    rootCause: string;
    confidence: string;
    confidenceWhy: string;
    where: string;
    fixSummary: string;
    fixLead: string;
    changes: Array<{ file: string; change: string; note: string }>;
    diff: string;
    verification: string[];
    risks: string[];
    questions: string[];
    testCommand: string;
    fixCommand: string;
}

export function readBug(assessmentMd: string, fixMd: string): BugStory {
    const assessment = parseDoc(assessmentMd);
    const fix = parseDoc(fixMd);
    const slug = clean(metaValue(assessment, 'Slug'));
    const cause = body(assessment, /^Root Cause/i);
    const confidence = /Confidence:\s*\*\*(\w+)\*\*\s*\(([^)]*)\)\.?/.exec(cause);
    const summary = body(fix, /^Summary/i);

    return {
        title: assessment.title.replace(/^Bug Assessment:\s*/, ''),
        slug,
        path: `.specify/bugs/${slug}`,
        created: formatDate(metaValue(assessment, 'Created')),
        fixed: formatDate(metaValue(fix, 'Fixed')),
        source: clean(metaValue(assessment, 'Source')),
        verdict: clean(metaValue(assessment, 'Verdict')),
        severity: clean(metaValue(assessment, 'Severity')),
        fixStatus: clean(metaValue(fix, 'Status')),
        report: body(assessment, /^Report/i).replace(/^>\s*/gm, ''),
        symptom: body(assessment, /^Symptom/i),
        rootCause: cause.replace(/\s*Confidence:[\s\S]*$/, ''),
        confidence: confidence?.[1] ?? '',
        confidenceWhy: confidence?.[2] ?? '',
        where: parseItems(body(assessment, /^Suspected Code Paths/i)).items[0]?.split(':').slice(0, 2).join(':') ?? '',
        fixSummary: summary,
        fixLead: firstSentence(summary),
        changes: (parseTable(body(fix, /^Changes/i))?.rows ?? []).map(([file, change, note]) => ({ file, change, note })),
        diff: body(fix, /^Diff Highlights/i),
        verification: parseItems(body(fix, /^Local Verification/i)).items,
        risks: parseItems(body(assessment, /^Risks/i)).items,
        questions: parseItems(body(assessment, /^Open Questions/i)).items.map((q) => q.replace(/^\[NEEDS CLARIFICATION:\s*/, '').replace(/\]$/, '')),
        testCommand: `/speckit-bug-test slug=${slug}`,
        fixCommand: `/speckit-bug-fix slug=${slug}`,
    };
}

export interface Finding {
    id: string;
    category: string;
    severity: string;
    location: string;
    summary: string;
    recommendation: string;
}

export interface AnalysisNote {
    label: string;
    md: string;
}

export interface AnalysisReport {
    heading: string;
    headline: string;
    lead: string;
    findings: Finding[];
    groups: Array<{ severity: string; tone: Tone; rows: Finding[] }>;
    notes: AnalysisNote[];
    next: string;
    covered: number;
    total: number;
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
const SEVERITY_TONE: Record<string, Tone> = { critical: 'error', high: 'error', medium: 'warning', low: 'neutral' };

export function readAnalysis(md: string): AnalysisReport {
    const doc = parseDoc(md);
    const section = doc.sections[0];
    const table = parseTable(section.body);
    const findings = (table?.rows ?? []).map(([id, category, severity, location, summary, recommendation]) => ({
        id,
        category,
        severity: severity.toLowerCase(),
        location,
        summary,
        recommendation,
    }));
    const groups = SEVERITY_ORDER.map((severity) => ({
        severity,
        tone: SEVERITY_TONE[severity],
        rows: findings.filter((f) => f.severity === severity),
    })).filter((g) => g.rows.length > 0);

    const notes: AnalysisNote[] = [];
    let next = '';
    for (const block of (table?.after ?? '').split(/\n\s*\n/)) {
        const m = /^\*\*([^*]+?):\*\*\s*([\s\S]*)$/.exec(block.trim());
        if (m && /^next$/i.test(m[1])) next = m[2].trim();
        else if (m) notes.push({ label: m[1], md: sentence(m[2].trim()) });
        else if (/^I read/.test(block.trim())) notes.push({ label: 'Not read', md: block.trim() });
    }
    const coverage = /(\d+) of (\d+)/.exec(notes.find((n) => n.label === 'Coverage')?.md ?? '');
    const lead = table?.before ?? '';
    const split = /^(.*?\.)\s+([\s\S]*)$/.exec(lead);

    return {
        heading: section.heading,
        headline: split?.[1] ?? lead,
        lead: split?.[2] ?? '',
        findings,
        groups,
        notes,
        next: sentence(next),
        covered: Number(coverage?.[1] ?? 0),
        total: Number(coverage?.[2] ?? 0),
    };
}

export interface IdeaDecision {
    title: string;
    slug: string;
    path: string;
    decided: string;
    verdict: string;
    artifacts: string[];
    scorecard: Array<{ criterion: string; rating: string; tone: Tone; why: string }>;
    rationale: string;
    handoff: Array<{ label: string; value: string }>;
    tally: Array<{ rating: string; count: number; tone: Tone }>;
}

const RATING_TONE: Record<string, Tone> = { strong: 'success', adequate: 'neutral', weak: 'error' };

export function readIdea(md: string): IdeaDecision {
    const doc = parseDoc(md);
    const slug = clean(metaValue(doc, 'Slug'));
    const scorecard = (parseTable(body(doc, /^Scorecard/i))?.rows ?? []).map(([criterion, rating, why]) => ({
        criterion,
        rating,
        tone: RATING_TONE[rating] ?? toneFor(rating),
        why,
    }));
    const tally = ['strong', 'adequate', 'weak']
        .map((rating) => ({ rating, count: scorecard.filter((s) => s.rating === rating).length, tone: RATING_TONE[rating] }))
        .filter((t) => t.count > 0);

    return {
        title: doc.title.replace(/^Decision:\s*/, ''),
        slug,
        path: `.specify/assessments/${slug}`,
        decided: formatDate(metaValue(doc, 'Decided')),
        verdict: clean(metaValue(doc, 'Verdict')),
        artifacts: clean(metaValue(doc, 'Artifacts reviewed')).split(/,\s*/),
        scorecard,
        rationale: body(doc, /^Verdict/i).replace(/^\*\*Go\.\*\*\s*/, ''),
        handoff: parseFields(body(doc, /^If go/i)).fields,
        tally,
    };
}
