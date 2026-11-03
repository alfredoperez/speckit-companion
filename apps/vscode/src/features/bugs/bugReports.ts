import * as fs from 'fs';
import * as path from 'path';
import type { SpecDocument } from '../spec-viewer/types';
import {
    ReportFile,
    ReportFolder,
    ReportSet,
    isReportPath,
    knownValue,
    readReportFolder,
    readReportFolders,
    reportDirectoryOf,
    reportDocuments,
    reportFile,
} from '../reports/reportSet';

import {
    BUG_FIX_STATUSES,
    BUG_SEVERITIES,
    BUG_TEST_RESULTS,
    BUG_VERDICTS,
    BugFixStatus,
    BugSeverity,
    BugTestResult,
    BugVerdict,
} from './bugValues';
import { EngineRun, readEngineRuns } from './engineRuns';
import { Freshness, referenceFreshness, worstFreshness } from './bugFreshness';

export { parseReportHeader } from '../reports/reportSet';

export const BUGS_DIR = path.join('.specify', 'bugs');

export type BugReportKind = 'assessment' | 'fix' | 'test';

export const BUG_REPORT_KINDS: readonly BugReportKind[] = ['assessment', 'fix', 'test'];

export const BUG_SET: ReportSet<BugReportKind> = {
    id: 'bugs',
    dir: BUGS_DIR,
    kinds: BUG_REPORT_KINDS,
    labels: { assessment: 'Assessment', fix: 'Fix', test: 'Test' },
    titlePrefixes: { assessment: 'Bug Assessment:', fix: 'Bug Fix:', test: 'Bug Verification:' },
    panelPrefix: 'Bug',
    fallbackBadge: 'BUG',
    overview: { type: 'story', label: 'Story' },
};

export {
    BUG_VERDICTS,
    BUG_SEVERITIES,
    BUG_FIX_STATUSES,
    BUG_TEST_RESULTS,
    BUG_CHECK_RESULTS,
} from './bugValues';
export type { BugVerdict, BugSeverity, BugFixStatus, BugTestResult, BugCheckResult } from './bugValues';

export type BugState = 'in-review' | 'to-fix' | 'to-test' | 'verified' | 'closed';

export type BugReportFile = ReportFile<BugReportKind>;

export interface BugReport {
    slug: string;
    directory: string;
    title: string;
    reports: Record<BugReportKind, BugReportFile>;
    stages: BugReportKind[];
    verdict?: BugVerdict;
    severity?: BugSeverity;
    fixStatus?: BugFixStatus;
    testResult?: BugTestResult;
    outcome?: string;
    state: BugState;
    /** How each existing fix or test report relates to the assessment as it stands. */
    freshness: Partial<Record<'fix' | 'test', Freshness>>;
    /** The newest spec-kit workflow run for this bug, when one exists. */
    engine?: EngineRun;
}

export function bugState(
    bug: Pick<BugReport, 'stages' | 'verdict' | 'fixStatus' | 'testResult'> & { stale?: boolean; paused?: boolean },
): BugState {
    if (bug.verdict === 'invalid') return 'closed';
    if (bug.paused) return 'in-review';
    if (bug.stale) return 'to-fix';
    if (bug.stages.includes('test')) return bug.testResult === 'verified' ? 'verified' : 'to-fix';
    if (bug.stages.includes('fix')) return bug.fixStatus === 'not-applied' ? 'to-fix' : 'to-test';
    return 'to-fix';
}

function readText(filePath: string): string | undefined {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch {
        return undefined;
    }
}

export function bugFreshness(folder: ReportFolder<BugReportKind>): BugReport['freshness'] {
    const assessmentText = readText(folder.reports.assessment.path);
    const created = folder.fields.assessment.get('created');
    const own = (kind: 'fix' | 'test'): Freshness | undefined =>
        folder.stages.includes(kind)
            ? referenceFreshness(folder.fields[kind].get('assessment'), assessmentText, created)
            : undefined;
    const fix = own('fix');
    const test = own('test');
    return {
        ...(fix && { fix }),
        ...(test && { test: worstFreshness(test, fix ?? 'current') }),
    };
}

function toBugReport(folder: ReportFolder<BugReportKind>, engine?: EngineRun): BugReport {
    const verdict = knownValue(BUG_VERDICTS, folder.fields.assessment.get('verdict'));
    const severity = knownValue(BUG_SEVERITIES, folder.fields.assessment.get('severity'));
    const fixStatus = knownValue(BUG_FIX_STATUSES, folder.fields.fix.get('status'));
    const testResult = knownValue(BUG_TEST_RESULTS, folder.fields.test.get('result'));
    const { slug, directory, title, reports, stages } = folder;
    const freshness = bugFreshness(folder);
    const stale = Object.values(freshness).includes('stale');
    return {
        slug,
        directory,
        title,
        reports,
        stages,
        verdict,
        severity,
        fixStatus,
        testResult,
        outcome: testResult ?? fixStatus ?? verdict,
        state: bugState({ stages, verdict, fixStatus, testResult, stale, paused: !!engine?.pausedAt }),
        freshness,
        ...(engine && { engine }),
    };
}

export function bugReportFile(directory: string, kind: BugReportKind): BugReportFile {
    return reportFile(BUG_SET, directory, kind);
}

export function readBugReport(directory: string): BugReport | undefined {
    const folder = readReportFolder(BUG_SET, directory);
    if (!folder) return undefined;
    const root = path.resolve(directory, '..', '..', '..');
    return toBugReport(folder, readEngineRuns(root).get(folder.slug));
}

/** Every bug report under `<workspaceRoot>/.specify/bugs/`, ordered by slug. Empty when the folder is absent. */
export function readBugReports(workspaceRoot: string): BugReport[] {
    const runs = readEngineRuns(workspaceRoot);
    return readReportFolders(BUG_SET, workspaceRoot).map(folder => toBugReport(folder, runs.get(folder.slug)));
}

/** True for any path at or under a `.specify/bugs` folder, which no spec path ever is. */
export function isBugsPath(filePath: string): boolean {
    return isReportPath(BUG_SET, filePath);
}

/** The bug folder a report path belongs to, or undefined when it is not `.specify/bugs/<slug>/<kind>.md`. */
export function bugDirectoryOf(filePath: string): string | undefined {
    return reportDirectoryOf(BUG_SET, filePath);
}

/** The reports whose stored assessment key no longer matches the assessment. */
export function staleReports(bug: Pick<BugReport, 'freshness'>): Array<'fix' | 'test'> {
    return (['fix', 'test'] as const).filter(kind => bug.freshness[kind] === 'stale');
}

export function bugReportKindOf(filePath: string): BugReportKind | undefined {
    return BUG_REPORT_KINDS.find(kind => path.basename(filePath) === `${kind}.md`);
}

/** The bug's three reports as viewer documents, in assessment, fix, test order. */
export function bugReportDocuments(directory: string): SpecDocument[] {
    return reportDocuments(BUG_SET, directory);
}
