import {
    BUG_CHECK_RESULTS,
    BUG_FIX_STATUSES,
    BUG_SEVERITIES,
    BUG_TEST_RESULTS,
    BUG_VERDICTS,
    BugFixStatus,
    BugTestResult,
    BugVerdict,
} from '../bugs/bugValues';
import { ReportDoc, fencedBlocks, findSection, parseItems, parseReportDoc, parseTable, sectionProse } from './reportDoc';
import type { BugLead, BugMeta, BugStep, BugStory, ChangedFile, CheckRow, DiffBlock } from './reportPageModel';
import { knownValue, parseReportHeader } from './reportValues';

export interface BugReportTexts {
    assessment?: string;
    fix?: string;
    test?: string;
}

interface Report {
    fields: Map<string, string>;
    doc: ReportDoc;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})(?![\d])/;
const PLACEHOLDER = '[NEEDS CLARIFICATION';
const CLARIFICATION = /^\[NEEDS CLARIFICATION:?\s*([\s\S]*?)\]\s*$/i;
const NOTHING = /^[*_\s]*(?:none|n\/a)(?![\w-])(?!\s+of\b)/i;

function read(text: string | undefined): Report | undefined {
    return typeof text === 'string' ? { fields: parseReportHeader(text).fields, doc: parseReportDoc(text) } : undefined;
}

function formatDate(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    const value = raw.trim();
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    const iso = ISO_DAY.exec(value);
    const noon = iso
        ? Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12)
        : Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(noon);
}

function prose(report: Report | undefined, heading: string): string | undefined {
    const section = report && findSection(report.doc, heading);
    return (section && sectionProse(section.body)) || undefined;
}

function sectionBody(report: Report | undefined, heading: string): string {
    return (report && findSection(report.doc, heading)?.body) || '';
}

function text(value: string | undefined): string | undefined {
    return value?.trim() || undefined;
}

function changedFiles(fix: Report | undefined): ChangedFile[] {
    const files: ChangedFile[] = [];
    for (const row of parseTable(sectionBody(fix, 'Changes'))) {
        const path = text(row.file);
        if (!path) continue;
        const file: ChangedFile = { path };
        const change = text(row.change);
        const note = text(row.notes);
        if (change) file.change = change;
        if (note) file.note = note;
        files.push(file);
    }
    return files;
}

function diffBlocks(fix: Report | undefined): DiffBlock[] {
    const diffs: DiffBlock[] = [];
    for (const block of fencedBlocks(sectionBody(fix, 'Diff Highlights'))) {
        if (!block.code.trim()) continue;
        diffs.push(block.language ? { language: block.language, code: block.code } : { code: block.code });
    }
    return diffs;
}

function checkRows(test: Report | undefined): CheckRow[] {
    const checks: CheckRow[] = [];
    for (const row of parseTable(sectionBody(test, 'Checks Performed'))) {
        const name = text(row.check);
        if (!name) continue;
        const check: CheckRow = { name };
        const result = knownValue(BUG_CHECK_RESULTS, row.result);
        const note = text(row.notes);
        if (result) check.result = result;
        if (note) check.note = note;
        checks.push(check);
    }
    return checks;
}

function riskItems(sources: [Report | undefined, string][]): string[] {
    const seen = new Set<string>();
    const risks: string[] = [];
    for (const [report, heading] of sources) {
        for (const raw of parseItems(sectionBody(report, heading))) {
            const wrapped = CLARIFICATION.exec(raw.trim());
            const item = (wrapped ? wrapped[1] : raw).trim();
            const key = item.toLowerCase();
            if (!item || NOTHING.test(item) || seen.has(key)) continue;
            seen.add(key);
            risks.push(item);
        }
    }
    return risks;
}

function leadOf(
    verdict: BugVerdict | undefined,
    fixStatus: BugFixStatus | undefined,
    testResult: BugTestResult | undefined,
    hasFix: boolean,
    hasTest: boolean
): BugLead {
    if (verdict === 'invalid') return 'closed';
    if (hasTest) {
        if (testResult === 'verified') return 'verified';
        return testResult ? 'test-failed' : 'test-unclear';
    }
    if (hasFix) return fixStatus === 'not-applied' ? 'assessed' : 'fixed-untested';
    return 'assessed';
}

function build(texts: BugReportTexts, nextAction?: string): BugStory | undefined {
    const assessment = read(texts?.assessment);
    if (!assessment) return undefined;
    const fix = read(texts.fix);
    const test = read(texts.test);

    const wrongBody = [prose(assessment, 'Symptom'), prose(assessment, 'Root Cause Hypothesis')].filter(Boolean).join('\n\n');
    if (!wrongBody) return undefined;

    const verdict = knownValue(BUG_VERDICTS, assessment.fields.get('verdict'));
    const severity = knownValue(BUG_SEVERITIES, assessment.fields.get('severity'));
    const fixStatus = knownValue(BUG_FIX_STATUSES, fix?.fields.get('status'));
    const testResult = knownValue(BUG_TEST_RESULTS, test?.fields.get('result'));

    const meta: BugMeta = {};
    const reported = formatDate(assessment.fields.get('created'));
    const source = text(assessment.fields.get('source'));
    if (reported) meta.reported = reported;
    if (source && !source.includes(PLACEHOLDER)) meta.source = source;
    if (verdict && (testResult || fixStatus)) meta.verdict = verdict;
    if (severity) meta.severity = severity;
    if (fixStatus && testResult) meta.fixStatus = fixStatus;

    const wrong: BugStep = { id: 'wrong', state: 'done', body: wrongBody };
    const changed: BugStep = { id: 'changed', state: fix && fixStatus !== 'not-applied' ? 'done' : 'next' };
    const verified: BugStep = { id: 'verified', state: testResult === 'verified' ? 'done' : 'next' };

    const whens: [BugStep, string | undefined][] = [
        [wrong, assessment.fields.get('created')],
        [changed, fix?.fields.get('fixed')],
        [verified, test?.fields.get('tested')],
    ];
    for (const [step, raw] of whens) {
        const when = formatDate(raw);
        if (when) step.when = when;
    }

    const changedBody = prose(fix, 'Summary');
    const files = changedFiles(fix);
    const diffs = diffBlocks(fix);
    if (changedBody) changed.body = changedBody;
    if (files.length) changed.files = files;
    if (diffs.length) changed.diffs = diffs;

    const verifiedBody = prose(test, 'Summary');
    const checks = checkRows(test);
    if (verifiedBody) verified.body = verifiedBody;
    if (checks.length) verified.checks = checks;

    // What is left after testing replaces what was feared before it, which the test report restates.
    const residual = riskItems([[test, 'Residual Risks']]);
    const story: BugStory = {
        lead: leadOf(verdict, fixStatus, testResult, !!fix, !!test),
        meta,
        steps: [wrong, changed, verified],
        risks: residual.length > 0 ? residual : riskItems([
            [assessment, 'Risks & Considerations'],
            [assessment, 'Open Questions'],
        ]),
    };
    const action = typeof nextAction === 'string' ? nextAction.trim() : '';
    if (action) story.nextAction = action;
    return story;
}

export function buildBugStory(texts: BugReportTexts, nextAction?: string): BugStory | undefined {
    try {
        return build(texts, nextAction);
    } catch {
        return undefined;
    }
}
