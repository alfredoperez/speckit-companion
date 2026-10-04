import type { BugCheckResult, BugFixStatus, BugSeverity, BugVerdict } from '../bugs/bugValues';
import type { IdeaRating, IdeaStage, IdeaTone, IdeaVerdict } from '../ideas/ideaValues';

export type BugLead = 'closed' | 'verified' | 'fixed-untested' | 'test-failed' | 'test-unclear' | 'assessed';

export interface BugMeta {
    reported?: string;
    source?: string;
    verdict?: BugVerdict;
    severity?: BugSeverity;
    fixStatus?: BugFixStatus;
}

export interface ChangedFile {
    path: string;
    change?: string;
    note?: string;
}

export interface DiffBlock {
    language?: string;
    code: string;
}

export interface CheckRow {
    name: string;
    result?: BugCheckResult;
    note?: string;
}

export type BugStepId = 'wrong' | 'changed' | 'verified';

export interface BugStep {
    id: BugStepId;
    state: 'done' | 'next';
    when?: string;
    body?: string;
    files?: ChangedFile[];
    diffs?: DiffBlock[];
    checks?: CheckRow[];
}

export interface BugStory {
    lead: BugLead;
    meta: BugMeta;
    steps: [BugStep, BugStep, BugStep];
    risks: string[];
    nextAction?: string;
}

export interface ScoreRow {
    criterion: string;
    rating?: IdeaRating;
    tone?: IdeaTone;
    reason?: string;
}

export interface HandoffField {
    term: string;
    text: string;
}

export type IdeaClosing =
    | { verdict: 'go'; fields: HandoffField[] }
    | { verdict: 'needs-clarification'; questions: string[]; revisit?: IdeaStage }
    | { verdict: 'kill'; trigger: string };

export interface IdeaDecision {
    verdict: IdeaVerdict;
    lead?: string;
    rationale?: string;
    scorecard: ScoreRow[];
    closing?: IdeaClosing;
}

export interface ReportNav {
    kind: 'bug' | 'idea';
    page?: BugStory | IdeaDecision;
}
