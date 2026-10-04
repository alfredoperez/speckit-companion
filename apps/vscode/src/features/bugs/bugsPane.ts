import * as vscode from 'vscode';
import { formatCommandForProvider } from '../../ai-providers/aiProvider';
import type { ProcessPaneConfig } from '../processes/processPaneProvider';
import { BUG_SET, BugReport, BugReportKind, BugState, readBugReports } from './bugReports';

const STATE_COLOURS: Record<BugState, string | undefined> = {
    'to-fix': 'charts.yellow',
    'to-test': 'charts.blue',
    verified: 'testing.iconPassed',
    closed: undefined,
};

function latestOutcome(bug: BugReport): string | undefined {
    if (bug.testResult) return bug.testResult === 'verified' ? 'verified' : `test ${bug.testResult}`;
    if (bug.stages.includes('test')) return 'test result unclear';
    if (bug.fixStatus) return `fix ${bug.fixStatus === 'not-applied' ? 'not applied' : bug.fixStatus}`;
    return bug.verdict;
}

export const bugsPaneConfig: ProcessPaneConfig<BugReportKind, BugReport> = {
    name: 'Bugs',
    set: BUG_SET,
    read: readBugReports,
    groups: [
        { id: 'to-fix', label: 'To fix', icon: 'wrench' },
        { id: 'to-test', label: 'To test', icon: 'beaker' },
        { id: 'verified', label: 'Verified', icon: 'pass' },
        { id: 'closed', label: 'Closed', icon: 'circle-slash' },
    ],
    groupOf: bug => bug.state,
    describe: bug => [bug.severity, latestOutcome(bug)].filter(Boolean).join(' · ') || undefined,
    icon: bug => {
        const colour = STATE_COLOURS[bug.state];
        return new vscode.ThemeIcon('bug', colour ? new vscode.ThemeColor(colour) : undefined);
    },
    extensionId: 'bug',
    installLabel: "Install Spec Kit's bug extension",
    emptyLabel: () => `No bugs yet. Start one with /${formatCommandForProvider('speckit.bug.assess')}.`,
};
