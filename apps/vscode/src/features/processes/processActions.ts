import type { BugReport } from '../bugs/bugReports';
import type { IdeaReport, IdeaStage } from '../ideas/ideaReports';

export type ReportActionId =
    | 'bug.assess'
    | 'bug.fix'
    | 'bug.test'
    | 'idea.intake'
    | 'idea.research'
    | 'idea.define'
    | 'idea.shape'
    | 'idea.decide'
    | 'idea.createSpec';

export interface ReportAction {
    id: ReportActionId;
    label: string;
    primary: boolean;
}

/** The Spec Kit command each action sends. `idea.createSpec` opens Create Spec and sends none. */
const COMMANDS = new Map<ReportActionId, string>([
    ['bug.assess', 'speckit.bug.assess'],
    ['bug.fix', 'speckit.bug.fix'],
    ['bug.test', 'speckit.bug.test'],
    ['idea.intake', 'speckit.assess.intake'],
    ['idea.research', 'speckit.assess.research'],
    ['idea.define', 'speckit.assess.define'],
    ['idea.shape', 'speckit.assess.shape'],
    ['idea.decide', 'speckit.assess.decide'],
]);

export function commandForAction(id: ReportActionId): string | undefined {
    return COMMANDS.get(id);
}

/** Actions that start over from the folder's existing reports, so the prompt has to point at them. */
const REPEATS_FROM_FOLDER: ReadonlySet<ReportActionId> = new Set(['bug.assess', 'idea.intake']);

export function repeatsFromFolder(id: ReportActionId): boolean {
    return REPEATS_FROM_FOLDER.has(id);
}

const main = (id: ReportActionId, label: string): ReportAction => ({ id, label, primary: true });
const secondary = (id: ReportActionId, label: string): ReportAction => ({ id, label, primary: false });

export function bugActions(bug: Pick<BugReport, 'state' | 'stages'>): ReportAction[] {
    switch (bug.state) {
        case 'closed':
            return [secondary('bug.assess', 'Assess again')];
        case 'verified':
            return [secondary('bug.test', 'Test again')];
        case 'to-test':
            return [main('bug.test', 'Test fix'), secondary('bug.fix', 'Fix again')];
        default:
            return bug.stages.includes('test')
                ? [main('bug.fix', 'Fix bug'), secondary('bug.test', 'Test again')]
                : [main('bug.fix', 'Fix bug')];
    }
}

const NEXT_STAGE: Record<Exclude<IdeaStage, 'decision'>, ReportAction> = {
    intake: main('idea.research', 'Research'),
    research: main('idea.define', 'Define the problem'),
    problem: main('idea.shape', 'Shape a concept'),
    concept: main('idea.decide', 'Decide'),
};

export function ideaActions(idea: Pick<IdeaReport, 'state' | 'latestStage' | 'verdict'>): ReportAction[] {
    if (idea.state === 'assessing') {
        return idea.latestStage === 'decision' ? [main('idea.decide', 'Decide')] : [NEXT_STAGE[idea.latestStage]];
    }
    switch (idea.verdict) {
        case 'go':
            return [main('idea.createSpec', 'Create spec from this idea')];
        case 'needs-clarification':
            return [main('idea.research', 'Continue assessment')];
        case 'kill':
            return [secondary('idea.intake', 'Reopen from intake')];
        default:
            return [main('idea.decide', 'Decide')];
    }
}
