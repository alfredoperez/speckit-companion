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
};

export const BUG_VERDICTS = ['valid', 'likely valid, needs reproduction', 'invalid'] as const;
export const BUG_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export const BUG_FIX_STATUSES = ['applied', 'partial', 'not-applied'] as const;
export const BUG_TEST_RESULTS = ['verified', 'partial', 'failed'] as const;

export type BugVerdict = typeof BUG_VERDICTS[number];
export type BugSeverity = typeof BUG_SEVERITIES[number];
export type BugFixStatus = typeof BUG_FIX_STATUSES[number];
export type BugTestResult = typeof BUG_TEST_RESULTS[number];

export type BugState = 'to-fix' | 'to-test' | 'verified' | 'closed';

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
}

export function bugState(bug: Pick<BugReport, 'stages' | 'verdict' | 'fixStatus' | 'testResult'>): BugState {
    if (bug.verdict === 'invalid') return 'closed';
    if (bug.stages.includes('test')) return bug.testResult === 'verified' ? 'verified' : 'to-fix';
    if (bug.stages.includes('fix')) return bug.fixStatus === 'not-applied' ? 'to-fix' : 'to-test';
    return 'to-fix';
}

function toBugReport(folder: ReportFolder<BugReportKind>): BugReport {
    const verdict = knownValue(BUG_VERDICTS, folder.fields.assessment.get('verdict'));
    const severity = knownValue(BUG_SEVERITIES, folder.fields.assessment.get('severity'));
    const fixStatus = knownValue(BUG_FIX_STATUSES, folder.fields.fix.get('status'));
    const testResult = knownValue(BUG_TEST_RESULTS, folder.fields.test.get('result'));
    const { slug, directory, title, reports, stages } = folder;
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
        state: bugState({ stages, verdict, fixStatus, testResult }),
    };
}

export function bugReportFile(directory: string, kind: BugReportKind): BugReportFile {
    return reportFile(BUG_SET, directory, kind);
}

export function readBugReport(directory: string): BugReport | undefined {
    const folder = readReportFolder(BUG_SET, directory);
    return folder ? toBugReport(folder) : undefined;
}

/** Every bug report under `<workspaceRoot>/.specify/bugs/`, ordered by slug. Empty when the folder is absent. */
export function readBugReports(workspaceRoot: string): BugReport[] {
    return readReportFolders(BUG_SET, workspaceRoot).map(toBugReport);
}

/** True for any path at or under a `.specify/bugs` folder, which no spec path ever is. */
export function isBugsPath(filePath: string): boolean {
    return isReportPath(BUG_SET, filePath);
}

/** The bug folder a report path belongs to, or undefined when it is not `.specify/bugs/<slug>/<kind>.md`. */
export function bugDirectoryOf(filePath: string): string | undefined {
    return reportDirectoryOf(BUG_SET, filePath);
}

export function bugReportKindOf(filePath: string): BugReportKind | undefined {
    return BUG_REPORT_KINDS.find(kind => path.basename(filePath) === `${kind}.md`);
}

/** The bug's three reports as viewer documents, in assessment, fix, test order. */
export function bugReportDocuments(directory: string): SpecDocument[] {
    return reportDocuments(BUG_SET, directory);
}
