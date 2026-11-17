import type { BugCheckResult, BugFixStatus, BugSeverity, BugVerdict } from '../bugs/bugValues';
import type { IdeaRating, IdeaStage, IdeaTone, IdeaVerdict } from '../ideas/ideaValues';

export type BugLead =
    | 'closed'
    | 'in-review'
    | 'stale'
    | 'verified'
    | 'fixed-untested'
    | 'test-failed'
    | 'test-partial'
    | 'test-unclear'
    | 'assessed';

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
    /** Written for an assessment that has since changed. */
    old?: boolean;
    when?: string;
    body?: string;
    files?: ChangedFile[];
    diffs?: DiffBlock[];
    checks?: CheckRow[];
}

export interface EngineStepView {
    label: string;
    detail: string;
    state: 'done' | 'waiting' | 'failed' | 'running';
}

/** What spec-kit's run log says about the bug, already worded for the page. */
export interface BugEngineView {
    runId: string;
    workflow: string;
    steps: EngineStepView[];
    /** `answerable`: the gate is spec-kit's own review gate, so the page can offer Approve and Reject. */
    paused?: { gate: string; resume?: string; answerable?: boolean };
}

export type BugReportName = 'fix' | 'test';

export interface BugStory {
    lead: BugLead;
    meta: BugMeta;
    steps: [BugStep, BugStep, BugStep];
    risks: string[];
    nextAction?: string;
    engine?: BugEngineView;
    /** Reports written for an earlier assessment. */
    stale?: BugReportName[];
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
    | { verdict: 'kill'; trigger: string; fromRationale?: boolean };

export interface IdeaDecision {
    verdict: IdeaVerdict;
    lead?: string;
    rationale?: string;
    scorecard: ScoreRow[];
    closing?: IdeaClosing;
}

/** A spec made from an idea: its name and the absolute path of its spec document. */
export interface LinkedSpec {
    name: string;
    path: string;
}

export interface ReportNav {
    kind: 'bug' | 'idea';
    /** Specs whose record names this idea's folder as their source. */
    specs?: LinkedSpec[];
    /** Colours the header badge when the bug is waiting for review or back in To fix. */
    badgeTone?: 'review' | 'to-fix';
    page?: BugStory | IdeaDecision;
}
