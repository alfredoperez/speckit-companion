import * as path from 'path';
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

export const IDEA_SET: ReportSet<IdeaStage> = {
    id: 'ideas',
    dir: IDEAS_DIR,
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

/** Every idea under `<workspaceRoot>/.specify/assessments/`, ordered by slug. Empty when the folder is absent. */
export function readIdeaReports(workspaceRoot: string): IdeaReport[] {
    return readReportFolders(IDEA_SET, workspaceRoot).map(toIdeaReport);
}

export function ideaDirectoryOf(filePath: string): string | undefined {
    return reportDirectoryOf(IDEA_SET, filePath);
}
