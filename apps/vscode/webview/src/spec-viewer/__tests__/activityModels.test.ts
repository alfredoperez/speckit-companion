import { heroStats, formatActiveTime } from '../activityHeroModel';
import type { ViewerState } from '../types';

const base = (overrides: Partial<ViewerState> = {}): ViewerState => ({
    status: 'completed',
    activeStep: 'implement',
    steps: {},
    pulse: null,
    highlights: [],
    activeSubstep: null,
    footer: [],
    history: [],
    stepHistory: {},
    ...overrides,
});

describe('heroStats', () => {
    it('derives counts and omits absent sources (no fabricated zeros)', () => {
        const stats = heroStats(base({
            taskSummaries: { T001: { status: 'DONE' }, T002: { status: 'IN_PROGRESS' } },
            coverage: [
                { req: 'FR-001', tasks: [], tests: ['a.test.ts'] },
                { req: 'FR-002', tasks: [], tests: [] },
            ],
            verified: [{ what: 'jest' }, { what: 'tsc' }],
        }));
        expect(stats.covered).toBe(1);
        expect(stats.coverageTotal).toBe(2);
        expect(stats.checks).toBe(2);
        expect(stats.concerns).toBeUndefined();
    });

    it('sums only trusted, completed spans into active time', () => {
        const stats = heroStats(base({
            stepHistory: {
                specify: { startedAt: '2026-07-02T10:00:00Z', completedAt: '2026-07-02T10:05:00Z', durationTrusted: true },
                plan: { startedAt: '2026-07-02T10:05:00Z', completedAt: '2026-07-02T10:06:00Z', durationTrusted: false },
                tasks: { startedAt: '2026-07-02T10:06:00Z', completedAt: null, durationTrusted: true },
            },
        }));
        expect(stats.trustedActiveMs).toBe(5 * 60000);
    });

    it('formats active time compactly', () => {
        expect(formatActiveTime(42 * 60000)).toBe('42m');
        expect(formatActiveTime(72 * 60000)).toBe('1h 12m');
        expect(formatActiveTime(38000)).toBe('38s');
    });
});
