import type { BugStory } from './reportPageModel';

export interface BugReportTexts {
    assessment?: string;
    fix?: string;
    test?: string;
}

export function buildBugStory(_texts: BugReportTexts, _nextAction?: string): BugStory | undefined {
    return undefined;
}
