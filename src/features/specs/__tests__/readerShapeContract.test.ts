import { deriveStepHistory } from '../stepHistoryDerivation';
import { lastEntryIsCompletionFor } from '../historyHelpers';
import { deriveLastTransition } from '../lastTransition';
import type { HistoryEntry, SpecContext } from '../../../core/types/specContext';

/**
 * Golden-history shape contract. One canonical `history[]` in the post-#233
 * shape — step-level entries (`substep:null`, no `task`), substeps (`substep`
 * set), and per-task implement finishes (`substep:null` + `task`) — exercised by
 * EVERY reader. It deliberately includes the case that regressed step-completion
 * detection three times: a backstop task finish appended AFTER the step-level
 * implement complete. If a reader confuses a per-task finish with the step
 * boundary, one of these assertions fails.
 */
const h = (e: Partial<HistoryEntry>): HistoryEntry => ({
    step: 'specify', substep: null, kind: 'start', by: 'extension',
    at: '2026-06-10T00:00:00Z', ...e,
});

const GOLDEN: HistoryEntry[] = [
    h({ step: 'specify', kind: 'start', at: '2026-06-10T00:00:00Z' }),
    h({ step: 'specify', kind: 'complete', by: 'extension', at: '2026-06-10T00:01:00Z' }),
    h({ step: 'plan', kind: 'start', at: '2026-06-10T00:01:05Z' }),
    h({ step: 'plan', substep: 'research', kind: 'complete', by: 'ai', at: '2026-06-10T00:02:00Z' }),
    h({ step: 'plan', substep: 'design', kind: 'complete', by: 'ai', at: '2026-06-10T00:03:00Z' }),
    h({ step: 'plan', kind: 'complete', by: 'ai', at: '2026-06-10T00:03:10Z' }),
    h({ step: 'tasks', kind: 'start', at: '2026-06-10T00:03:15Z' }),
    h({ step: 'tasks', kind: 'complete', by: 'ai', at: '2026-06-10T00:04:00Z' }),
    h({ step: 'implement', kind: 'start', at: '2026-06-10T00:04:05Z' }),
    h({ step: 'implement', substep: null, task: 'T001', kind: 'complete', by: 'ai', at: '2026-06-10T00:05:00Z' }),
    h({ step: 'implement', substep: null, task: 'T002', kind: 'complete', by: 'ai', at: '2026-06-10T00:06:00Z' }),
    // The real step-level implement completion.
    h({ step: 'implement', kind: 'complete', by: 'extension', at: '2026-06-10T00:07:00Z' }),
    // BACKSTOP: a per-task finish appended AFTER the step-level complete — `sync_tasks`
    // journals even once the status is `implemented`. The bug class lived here.
    h({ step: 'implement', substep: null, task: 'T003', kind: 'complete', by: 'ai', at: '2026-06-10T00:07:30Z' }),
];

describe('reader shape contract (post-#233: task finishes are substep:null + task)', () => {
    it('deriveStepHistory honors the step-level complete, not a trailing backstop task finish', () => {
        const sh = deriveStepHistory(GOLDEN, 'implement', 'implemented');
        // completedAt is the step-level complete (00:07:00), NOT the trailing T003 finish (00:07:30).
        expect(sh.implement.completedAt).toBe('2026-06-10T00:07:00Z');
    });

    it('lastEntryIsCompletionFor skips the trailing task finish to find the step boundary', () => {
        expect(lastEntryIsCompletionFor(GOLDEN, 'implement')).toBe(true);
    });

    it('deriveLastTransition labels a per-task finish by task, not "Implement completed"', () => {
        const lt = deriveLastTransition({ history: GOLDEN } as SpecContext, Date.parse('2026-06-10T00:08:00Z'));
        expect(lt?.label).toBe('Implement · T003');
    });

    it('a step with only a task finish (no step-level complete) reads as in-flight', () => {
        const midImplement = GOLDEN.slice(0, 10); // implement start + T001 finish, no step complete
        expect(lastEntryIsCompletionFor(midImplement, 'implement')).toBe(false);
        const sh = deriveStepHistory(midImplement, 'implement', 'implementing');
        expect(sh.implement.completedAt).toBeNull();
    });
});
