import * as fs from 'fs';
import * as path from 'path';
import { BUG_SET, readBugReport, staleReports, type BugReport } from '../bugs/bugReports';
import { IDEA_SET, readIdeaReport } from '../ideas/ideaReports';
import type { ReportFile, ReportSet } from '../reports/reportSet';
import { buildBugStory } from '../reports/bugStory';
import { buildIdeaDecision } from '../reports/ideaDecision';
import type { BugStory, IdeaDecision, LinkedSpec } from '../reports/reportPageModel';
import { resolveSpecDirectories } from '../../core/specDirectoryResolver';
import { readSpecContextSyncSafe } from '../specs/specContextReader';
import { featureSpecPath } from '../specs/featureSpecPath';
import { bugActions, ideaActions, type ReportAction } from '../processes/processActions';

export type ReportSetId = ReportSet<string>['id'];

export interface ReportPanelItem {
    slug: string;
    title: string;
    badge?: string;
    badgeTone?: 'review' | 'to-fix';
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
    /** Report documents written for an assessment that has since changed. */
    staleDocuments?: string[];
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

/** The header badge follows the bug's state, not its latest report. */
export function bugBadge(bug: Pick<BugReport, 'state' | 'outcome' | 'freshness'>): Pick<ReportPanelItem, 'badge' | 'badgeTone'> {
    if (bug.state === 'in-review') return { badge: 'waiting for your review', badgeTone: 'review' };
    if (bug.state === 'to-fix' && staleReports(bug).length > 0) return { badge: 'to fix', badgeTone: 'to-fix' };
    return { badge: bug.outcome };
}

const READERS: Record<ReportSetId, (directory: string) => ReportPanelItem | undefined> = {
    bugs: directory => {
        const bug = readBugReport(directory);
        if (!bug) return undefined;
        const actions = bugActions(bug);
        const page = buildBugStory(
            { assessment: textOf(bug.reports.assessment), fix: textOf(bug.reports.fix), test: textOf(bug.reports.test) },
            actions.find(action => action.primary)?.label,
            { engine: bug.engine, freshness: bug.freshness },
        );
        return {
            slug: bug.slug,
            title: bug.title,
            ...bugBadge(bug),
            folder: folderOf(BUG_SET.dir, bug.slug),
            actions,
            kind: 'bug',
            defaultDocument: page ? 'story' : bug.stages[0] ?? 'assessment',
            pageDocument: 'story',
            page,
            staleDocuments: staleReports(bug),
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

const normFolder = (p: string): string => p.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

/** Specs whose run record names `folder` (workspace-relative) as their source. */
export async function specsFromIdea(folder: string, root: string): Promise<LinkedSpec[]> {
    const want = normFolder(folder);
    const found: LinkedSpec[] = [];
    let specs: Awaited<ReturnType<typeof resolveSpecDirectories>>;
    try {
        specs = await resolveSpecDirectories(root);
    } catch {
        return found;
    }
    for (const spec of specs) {
        try {
            const dir = path.join(root, spec.path);
            const context = readSpecContextSyncSafe(dir);
            if (typeof context?.source !== 'string' || normFolder(context.source) !== want) continue;
            found.push({ name: context.specName || spec.name, path: featureSpecPath(dir) });
        } catch {
            continue;
        }
    }
    return found;
}
