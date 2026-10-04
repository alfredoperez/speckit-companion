import * as path from 'path';
import { BUG_SET, readBugReport } from '../bugs/bugReports';
import { IDEA_SET, readIdeaReport } from '../ideas/ideaReports';
import type { ReportSet } from '../reports/reportSet';
import { bugActions, ideaActions, type ReportAction } from '../processes/processActions';

export type ReportSetId = ReportSet<string>['id'];

export interface ReportPanelItem {
    slug: string;
    title: string;
    badge?: string;
    /** Workspace-relative folder, always with forward slashes. */
    folder: string;
    actions: ReportAction[];
    decisionPath?: string;
}

export const REPORT_SETS: Record<ReportSetId, ReportSet<string>> = { bugs: BUG_SET, ideas: IDEA_SET };

const folderOf = (setDir: string, slug: string): string => [...setDir.split(path.sep), slug, ''].join('/');

const READERS: Record<ReportSetId, (directory: string) => ReportPanelItem | undefined> = {
    bugs: directory => {
        const bug = readBugReport(directory);
        return bug && {
            slug: bug.slug,
            title: bug.title,
            badge: bug.outcome,
            folder: folderOf(BUG_SET.dir, bug.slug),
            actions: bugActions(bug),
        };
    },
    ideas: directory => {
        const idea = readIdeaReport(directory);
        return idea && {
            slug: idea.slug,
            title: idea.title,
            badge: idea.verdict,
            folder: folderOf(IDEA_SET.dir, idea.slug),
            actions: ideaActions(idea),
            decisionPath: idea.reports.decision.exists ? idea.reports.decision.path : undefined,
        };
    },
};

export function readReportPanel(set: ReportSetId, directory: string): ReportPanelItem | undefined {
    return READERS[set](directory);
}
