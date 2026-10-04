import * as fs from 'fs';
import * as path from 'path';
import { BUG_SET, readBugReport } from '../bugs/bugReports';
import { IDEA_SET, readIdeaReport } from '../ideas/ideaReports';
import type { ReportFile, ReportSet } from '../reports/reportSet';
import { buildBugStory } from '../reports/bugStory';
import { buildIdeaDecision } from '../reports/ideaDecision';
import type { BugStory, IdeaDecision } from '../reports/reportPageModel';
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
    kind: 'bug' | 'idea';
    /** The document an item row opens. */
    defaultDocument: string;
    /** The document `page` stands for, and the page itself when it could be built. */
    pageDocument: string;
    page?: BugStory | IdeaDecision;
}

export const REPORT_SETS: Record<ReportSetId, ReportSet<string>> = { bugs: BUG_SET, ideas: IDEA_SET };

const folderOf = (setDir: string, slug: string): string => [...setDir.split(path.sep), slug, ''].join('/');

/** A report larger than this is still shown as written; it is just not read into a page. */
const MAX_PAGE_SOURCE_BYTES = 512 * 1024;

function textOf(report: ReportFile<string>): string | undefined {
    if (!report.exists) return undefined;
    try {
        if (fs.statSync(report.path).size > MAX_PAGE_SOURCE_BYTES) return undefined;
        return fs.readFileSync(report.path, 'utf-8');
    } catch {
        return undefined;
    }
}

const READERS: Record<ReportSetId, (directory: string) => ReportPanelItem | undefined> = {
    bugs: directory => {
        const bug = readBugReport(directory);
        if (!bug) return undefined;
        const actions = bugActions(bug);
        const page = buildBugStory(
            { assessment: textOf(bug.reports.assessment), fix: textOf(bug.reports.fix), test: textOf(bug.reports.test) },
            actions.find(action => action.primary)?.label,
        );
        return {
            slug: bug.slug,
            title: bug.title,
            badge: bug.outcome,
            folder: folderOf(BUG_SET.dir, bug.slug),
            actions,
            kind: 'bug',
            defaultDocument: page ? 'story' : bug.stages[0] ?? 'assessment',
            pageDocument: 'story',
            page,
        };
    },
    ideas: directory => {
        const idea = readIdeaReport(directory);
        const decision = idea && textOf(idea.reports.decision);
        return idea && {
            kind: 'idea',
            defaultDocument: idea.latestStage,
            pageDocument: 'decision',
            page: decision ? buildIdeaDecision(decision) : undefined,
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
