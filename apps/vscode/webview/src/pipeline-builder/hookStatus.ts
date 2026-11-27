/**
 * Whether a hook ran, read only from what is on record: the hook's own problem,
 * then the last run's entry for it. The card and the popover both read this, so
 * the word on a row and the sentence beside it never disagree.
 */
import { formatRelativeTime } from 'speckit-viewer/core/relativeTime';
import { HookRunsAnswer, PipelineHook } from '../../../src/protocol/pipeline';

export type HookTone = 'problem' | 'ran' | 'skipped' | 'unseen';

export interface HookStatus {
    word: string;
    tone: HookTone;
    /** The whole of it, for the popover. */
    reason: string;
}

const NOT_SEEN = 'No trace of it in the run record.';
const CHANGED = 'Changed since the last run, so that run says nothing about it.';
const NO_RUN = 'No run on record has reached it yet.';

/** The problem sentence as the two or three words a row has room for. */
export function problemWord(problem: string): string {
    if (/turned off/i.test(problem)) { return 'plugin off'; }
    if (/disable-model-invocation|cannot call/i.test(problem)) { return "can't call"; }
    if (/could not be checked/i.test(problem)) { return 'unchecked'; }
    return 'not installed';
}

export function hookKey(step: string, hook: Pick<PipelineHook, 'when' | 'anchor' | 'index'>): string {
    return `${step}/${hook.when}/${hook.anchor}/${hook.index}`;
}

export function hookStatus(
    step: string, hook: PipelineHook, runs: HookRunsAnswer | null | undefined,
): HookStatus | null {
    const problem = hook.problem?.trim();
    if (problem) { return { word: problemWord(problem), tone: 'problem', reason: problem }; }
    // Unanswered is not the same as answered with nothing: only the first says nothing.
    if (!runs) { return null; }
    if (!runs.spec || !runs.runs.some(r => r.step === step)) {
        return { word: 'not seen', tone: 'unseen', reason: NO_RUN };
    }
    const key = hookKey(step, hook);
    const run = runs.runs.find(r => r.key === key);
    if (!run) { return { word: 'not seen', tone: 'unseen', reason: NOT_SEEN }; }
    const named = hook.type === 'skill' || hook.type === 'node';
    if (run.type !== hook.type || (named && run.ref && run.ref !== hook.summary)) {
        return { word: 'not seen', tone: 'unseen', reason: CHANGED };
    }
    if (run.outcome === 'ran') {
        return { word: 'ran', tone: 'ran', reason: run.reason ?? 'It ran in the last run.' };
    }
    return {
        word: 'skipped', tone: 'skipped',
        reason: run.reason ?? 'The last run reached it and did not run it.',
    };
}

/** Which run the statuses come from, said once: the spec and how long ago. */
export function runSource(runs: HookRunsAnswer | null | undefined, now = new Date()): string {
    if (!runs?.spec) { return ''; }
    const when = runs.runAt ? formatRelativeTime(runs.runAt, now) : '';
    return `Last run: ${runs.spec.name}${when && when !== 'unknown' ? `, ${when}` : ''}`;
}
