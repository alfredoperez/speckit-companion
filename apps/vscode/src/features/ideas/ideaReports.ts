import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigKeys } from '../../core/constants';
import { getProjectRoot } from '../../core/projectRoot';
import {
    ReportFile,
    ReportFolder,
    ReportSet,
    knownValue,
    readReportFolder,
    readReportFolders,
    reportDirectoryOf,
} from '../reports/reportSet';
import { IDEA_STAGES, IDEA_VERDICTS, IdeaStage, IdeaVerdict } from './ideaValues';

export { IDEA_RATINGS, IDEA_RATING_TONES, IDEA_STAGES, IDEA_VERDICTS } from './ideaValues';
export type { IdeaRating, IdeaStage, IdeaTone, IdeaVerdict } from './ideaValues';

export const IDEAS_DIR = path.join('.specify', 'assessments');

/** The configured assessments folder relative to `root`, or the default when it is empty, not text, or leaves the project. */
export function resolveIdeasDir(root: string | undefined, configured: unknown): string {
    if (typeof configured !== 'string' || configured.trim() === '') return IDEAS_DIR;
    const value = configured.trim();
    let relative = value;
    if (path.isAbsolute(value)) {
        if (!root) return IDEAS_DIR;
        relative = path.relative(root, value);
    }
    const normal = path.normalize(relative).replace(/[\\/]+$/, '');
    if (normal === '' || normal === '.' || path.isAbsolute(normal) || path.win32.isAbsolute(normal)) return IDEAS_DIR;
    if (normal.split(/[\\/]/).includes('..')) return IDEAS_DIR;
    return normal;
}

/** The folder the Ideas pane reads, relative to the project root. */
export function ideasDir(root: string | undefined = getProjectRoot()): string {
    const configured = vscode.workspace.getConfiguration().get<unknown>(ConfigKeys.assessmentsDirectory);
    return resolveIdeasDir(root, configured);
}

export const IDEA_SET: ReportSet<IdeaStage> = {
    id: 'ideas',
    get dir() {
        return ideasDir();
    },
    kinds: IDEA_STAGES,
    labels: { intake: 'Intake', research: 'Research', problem: 'Problem', concept: 'Concept', decision: 'Decision' },
    titlePrefixes: {
        intake: 'Idea Intake:',
        research: 'Idea Research:',
        problem: 'Problem Definition:',
        concept: 'Concept:',
        decision: 'Decision:',
    },
    panelPrefix: 'Idea',
    fallbackBadge: 'IDEA',
};

export type IdeaState = 'assessing' | 'decided';

export type IdeaReportFile = ReportFile<IdeaStage>;

export interface IdeaReport {
    slug: string;
    directory: string;
    title: string;
    reports: Record<IdeaStage, IdeaReportFile>;
    stages: IdeaStage[];
    /** The furthest stage written so far. */
    latestStage: IdeaStage;
    verdict?: IdeaVerdict;
    state: IdeaState;
}

function toIdeaReport(folder: ReportFolder<IdeaStage>): IdeaReport {
    const { slug, directory, title, reports, stages } = folder;
    return {
        slug,
        directory,
        title,
        reports,
        stages,
        latestStage: stages[stages.length - 1],
        verdict: knownValue(IDEA_VERDICTS, folder.fields.decision.get('verdict')),
        state: stages.includes('decision') ? 'decided' : 'assessing',
    };
}

export function readIdeaReport(directory: string): IdeaReport | undefined {
    const folder = readReportFolder(IDEA_SET, directory);
    return folder ? toIdeaReport(folder) : undefined;
}

/** Every idea under the configured assessments folder of `workspaceRoot`, ordered by slug. Empty when the folder is absent. */
export function readIdeaReports(workspaceRoot: string): IdeaReport[] {
    return readReportFolders({ ...IDEA_SET, dir: ideasDir(workspaceRoot) }, workspaceRoot).map(toIdeaReport);
}

export function ideaDirectoryOf(filePath: string): string | undefined {
    return reportDirectoryOf(IDEA_SET, filePath);
}
