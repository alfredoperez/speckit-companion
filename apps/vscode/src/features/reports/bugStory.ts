import { formatReportDate } from './reportMeta';
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
import { EngineRun, formatSeconds, gateLabel } from '../bugs/engineRuns';
import type { Freshness } from '../bugs/bugFreshness';
import type { BugEngineView, BugLead, BugMeta, BugReportName, BugStep, BugStory, ChangedFile, CheckRow, DiffBlock, EngineStepView } from './reportPageModel';
import { knownValue, parseReportHeader } from './reportValues';

export interface BugReportTexts {
    assessment?: string;
    fix?: string;
    test?: string;
}

export interface BugStoryExtras {
    engine?: EngineRun;
    freshness?: Partial<Record<BugReportName, Freshness>>;
}

interface Report {
    fields: Map<string, string>;
    doc: ReportDoc;
}

const PLACEHOLDER = '[NEEDS CLARIFICATION';
const CLARIFICATION = /^\[NEEDS CLARIFICATION:?\s*([\s\S]*?)\]\s*$/i;
const NOTHING = /^[*_\s]*(?:none|n\/a)(?![\w-])(?!\s+of\b)/i;

function read(text: string | undefined): Report | undefined {
    return typeof text === 'string' ? { fields: parseReportHeader(text).fields, doc: parseReportDoc(text) } : undefined;
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

const RUN_ID = /^[\w.-]+$/;

function capitalised(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function engineView(run: EngineRun): BugEngineView {
    const steps: EngineStepView[] = run.steps.map(step => {
        if (step.state === 'paused') return { label: capitalised(gateLabel(step.id)), detail: 'Waiting for you', state: 'waiting' };
        const took = step.seconds === undefined ? '' : formatSeconds(step.seconds);
        const label = capitalised(step.gate ? gateLabel(step.id) : step.id);
        if (step.state === 'failed') return { label, detail: took ? `Failed after ${took}` : 'Failed', state: 'failed' };
        if (step.state === 'running') return { label, detail: 'Running', state: 'running' };
        return { label, detail: step.gate ? 'Approved' : took, state: 'done' };
    });
    const view: BugEngineView = { runId: run.runId, workflow: run.workflowId, steps };
    if (run.pausedAt) {
        view.paused = { gate: gateLabel(run.pausedAt) };
        if (RUN_ID.test(run.runId)) view.paused.resume = `specify workflow resume ${run.runId}`;
    }
    return view;
}

function leadOf(
    verdict: BugVerdict | undefined,
    fixStatus: BugFixStatus | undefined,
    testResult: BugTestResult | undefined,
    hasFix: boolean,
    hasTest: boolean,
    paused: boolean,
    stale: boolean
): BugLead {
    if (verdict === 'invalid') return 'closed';
    if (paused) return 'in-review';
    if (stale) return 'stale';
    if (hasTest) {
        if (testResult === 'verified') return 'verified';
        return testResult ? 'test-failed' : 'test-unclear';
    }
    if (hasFix) return fixStatus === 'not-applied' ? 'assessed' : 'fixed-untested';
    return 'assessed';
}

function build(texts: BugReportTexts, nextAction?: string, extras?: BugStoryExtras): BugStory | undefined {
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
    const reported = formatReportDate(assessment.fields.get('created'));
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
        const when = formatReportDate(raw);
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
    const named = (value: Freshness) => (['fix', 'test'] as const).filter(kind => extras?.freshness?.[kind] === value);
    const stale = named('stale');
    const unknown = named('unknown');
    for (const kind of stale) {
        const step = kind === 'fix' ? changed : verified;
        step.state = 'next';
        step.old = true;
    }
    const story: BugStory = {
        lead: leadOf(verdict, fixStatus, testResult, !!fix, !!test, !!extras?.engine?.pausedAt, stale.length > 0),
        meta,
        steps: [wrong, changed, verified],
        risks: residual.length > 0 ? residual : riskItems([
            [assessment, 'Risks & Considerations'],
            [assessment, 'Open Questions'],
        ]),
    };
    const action = typeof nextAction === 'string' ? nextAction.trim() : '';
    if (action) story.nextAction = action;
    if (extras?.engine && (extras.engine.steps.length > 0 || extras.engine.pausedAt)) story.engine = engineView(extras.engine);
    if (stale.length > 0) story.stale = stale;
    if (stale.length === 0 && unknown.length > 0) story.unknownFreshness = unknown;
    return story;
}

export function buildBugStory(texts: BugReportTexts, nextAction?: string, extras?: BugStoryExtras): BugStory | undefined {
    try {
        return build(texts, nextAction, extras);
    } catch {
        return undefined;
    }
}
