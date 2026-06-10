import { deriveLastTransition, formatRelative } from '../lastTransition';
import { SpecContext, HistoryEntry } from '../../../core/types/specContext';

function ctxWithHistory(history: HistoryEntry[]): SpecContext {
    return {
        workflow: 'speckit',
        specName: 'Test',
        branch: 'main',
        currentStep: 'plan',
        status: 'planned',
        history,
    } as SpecContext;
}

function entry(partial: Partial<HistoryEntry>): HistoryEntry {
    return {
        step: 'plan',
        substep: null,
        kind: 'start',
        by: 'extension',
        at: '2026-06-07T10:00:00.000Z',
        ...partial,
    } as HistoryEntry;
}

describe('deriveLastTransition', () => {
    it('returns null when history is empty', () => {
        expect(deriveLastTransition(ctxWithHistory([]))).toBeNull();
    });

    it('returns null when context or history is missing', () => {
        expect(deriveLastTransition(undefined)).toBeNull();
        expect(deriveLastTransition({ specName: 'x' } as unknown as SpecContext)).toBeNull();
    });

    it('labels a step-start entry as "<Step> started"', () => {
        const now = Date.parse('2026-06-07T10:30:00.000Z');
        const result = deriveLastTransition(
            ctxWithHistory([entry({ step: 'plan', kind: 'start', substep: null })]),
            now
        );
        expect(result).not.toBeNull();
        expect(result!.label).toBe('Plan started');
        expect(result!.relative).toBe('30m ago');
        expect(result!.at).toBe('2026-06-07T10:00:00.000Z');
    });

    it('uses the LAST entry in history', () => {
        const result = deriveLastTransition(
            ctxWithHistory([
                entry({ step: 'specify', at: '2026-06-07T09:00:00.000Z' }),
                entry({ step: 'plan', at: '2026-06-07T10:00:00.000Z' }),
            ]),
            Date.parse('2026-06-07T10:00:30.000Z')
        );
        expect(result!.label).toBe('Plan started');
        expect(result!.relative).toBe('just now');
    });

    it('labels a substep (task) entry with the task id', () => {
        const result = deriveLastTransition(
            ctxWithHistory([entry({ step: 'implement', substep: 'T014' })]),
            Date.parse('2026-06-07T10:00:10.000Z')
        );
        expect(result!.label).toBe('Implement · T014');
    });

    it('exposes the active task id on a per-task implement finish', () => {
        const result = deriveLastTransition(
            ctxWithHistory([entry({ step: 'implement', substep: null, task: 'T004', kind: 'complete' })]),
            Date.parse('2026-06-07T10:00:10.000Z')
        );
        expect(result!.task).toBe('T004');
    });

    it('does NOT surface task for a non-implement entry that carries a task field', () => {
        const result = deriveLastTransition(
            ctxWithHistory([entry({ step: 'plan', substep: null, task: 'T004', kind: 'complete' })]),
            Date.parse('2026-06-07T10:00:10.000Z')
        );
        expect(result!.task).toBeUndefined();
    });

    it('does NOT surface task for a non-finish (start) implement entry that carries a task field', () => {
        const result = deriveLastTransition(
            ctxWithHistory([entry({ step: 'implement', substep: null, task: 'T004', kind: 'start' })]),
            Date.parse('2026-06-07T10:00:10.000Z')
        );
        expect(result!.task).toBeUndefined();
    });

    it('surfaces task for a legacy kind-less implement finish (no discriminator)', () => {
        const result = deriveLastTransition(
            ctxWithHistory([
                entry({ step: 'implement', substep: null, task: 'T004', kind: undefined }),
            ]),
            Date.parse('2026-06-07T10:00:10.000Z')
        );
        expect(result!.task).toBe('T004');
    });

    it('leaves task undefined for a step-boundary entry', () => {
        const result = deriveLastTransition(
            ctxWithHistory([entry({ step: 'plan', kind: 'start', substep: null })]),
            Date.parse('2026-06-07T10:00:10.000Z')
        );
        expect(result!.task).toBeUndefined();
    });

    it('labels a complete entry as "<Step> completed"', () => {
        const result = deriveLastTransition(
            ctxWithHistory([entry({ step: 'tasks', kind: 'complete', substep: null })]),
            Date.parse('2026-06-07T10:00:10.000Z')
        );
        expect(result!.label).toBe('Tasks completed');
    });
});

describe('formatRelative', () => {
    const base = Date.parse('2026-06-07T12:00:00.000Z');

    it('formats sub-minute as "just now"', () => {
        expect(formatRelative('2026-06-07T11:59:30.000Z', base)).toBe('just now');
    });

    it('formats minutes, hours, and days', () => {
        expect(formatRelative('2026-06-07T11:45:00.000Z', base)).toBe('15m ago');
        expect(formatRelative('2026-06-07T09:00:00.000Z', base)).toBe('3h ago');
        expect(formatRelative('2026-06-05T12:00:00.000Z', base)).toBe('2d ago');
    });

    it('returns empty string for an unparseable timestamp', () => {
        expect(formatRelative('not-a-date', base)).toBe('');
    });
});
