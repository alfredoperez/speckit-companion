import { activityTabs, defaultActivityTab } from '../activityTabsModel';
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

describe('activityTabs', () => {
    it('renders only non-empty tabs, in canonical order', () => {
        const tabs = activityTabs(base({
            decisions: [{ decision: 'a' }],
            taskSummaries: { T001: { status: 'DONE' }, T002: { status: 'DONE' } },
            verified: [{ what: 'jest' }],
            coverage: [{ req: 'FR-001', tasks: [], tests: [] }],
            concerns: [{ note: 'x' }],
        }));
        expect(tabs.map(t => t.id)).toEqual(['decisions', 'work', 'proof', 'notes']);
        expect(tabs[0].count).toBe(1);
        expect(tabs[1].count).toBe(2);
    });

    it('badges Proof with the uncovered count as a warning', () => {
        const tabs = activityTabs(base({
            verified: [{ what: 'jest' }],
            coverage: [
                { req: 'FR-001', tasks: [], tests: [] },
                { req: 'FR-002', tasks: [], tests: [] },
                { req: 'FR-003', tasks: [], tests: ['a.test.ts'] },
            ],
        }));
        const proof = tabs.find(t => t.id === 'proof')!;
        expect(proof.count).toBe(2);
        expect(proof.warning).toBe(true);
    });

    it('renders Proof without a badge when everything is covered', () => {
        const tabs = activityTabs(base({
            verified: [{ what: 'jest' }],
            coverage: [{ req: 'FR-001', tasks: [], tests: ['a.test.ts'] }],
        }));
        const proof = tabs.find(t => t.id === 'proof')!;
        expect(proof.count).toBeUndefined();
        expect(proof.warning).toBeUndefined();
    });

    it('badges Notes only for open concerns, not comments', () => {
        const comment = {
            id: 'c1',
            doc: 'spec' as const,
            anchor: { heading: null, blockText: 'b', line: 1 },
            comment: 'c',
            status: 'pending' as const,
            createdAt: '2026-07-03T10:00:00Z',
        };
        const withConcern = activityTabs(base({ concerns: [{ note: 'x' }], reviewComments: [comment] }));
        const notes = withConcern.find(t => t.id === 'notes')!;
        expect(notes.count).toBe(1);
        expect(notes.warning).toBe(true);

        const commentsOnly = activityTabs(base({ reviewComments: [comment] }));
        const calmNotes = commentsOnly.find(t => t.id === 'notes')!;
        expect(calmNotes.count).toBeUndefined();
        expect(calmNotes.warning).toBeUndefined();
    });

    it('yields no tabs for an empty state', () => {
        expect(activityTabs(base())).toEqual([]);
    });
});

describe('defaultActivityTab', () => {
    it('opens Proof when a requirement is uncovered', () => {
        const state = base({
            decisions: [{ decision: 'a' }],
            coverage: [{ req: 'FR-001', tasks: ['T001'], tests: [] }],
        });
        expect(defaultActivityTab(state)).toBe('proof');
    });

    it('opens Proof when concerns exist (and proof tab is present)', () => {
        const state = base({
            decisions: [{ decision: 'a' }],
            verified: [{ what: 'jest' }],
            concerns: [{ note: 'friction' }],
        });
        expect(defaultActivityTab(state)).toBe('proof');
    });

    it('falls back to Decisions when everything is covered and calm', () => {
        const state = base({
            decisions: [{ decision: 'a' }],
            coverage: [{ req: 'FR-001', tasks: ['T001'], tests: ['a.test.ts'] }],
        });
        expect(defaultActivityTab(state)).toBe('decisions');
    });

    it('falls back to the first tab when no decisions', () => {
        const state = base({ taskSummaries: { T001: { status: 'DONE' } } });
        expect(defaultActivityTab(state)).toBe('work');
    });

    it('returns null when no tabs exist', () => {
        expect(defaultActivityTab(base())).toBeNull();
    });
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
        expect(stats.tasksDone).toBe(1);
        expect(stats.tasksTotal).toBe(2);
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

    it('counts legacy COMPLETED statuses as done', () => {
        const stats = heroStats(base({
            taskSummaries: {
                RT1: { status: 'COMPLETED' },
                RT2: { status: 'COMPLETED' },
                T001: { status: 'REVERTED' },
            },
        }));
        expect(stats.tasksDone).toBe(2);
        expect(stats.tasksTotal).toBe(3);
    });

    it('formats active time compactly', () => {
        expect(formatActiveTime(42 * 60000)).toBe('42m');
        expect(formatActiveTime(72 * 60000)).toBe('1h 12m');
        expect(formatActiveTime(38000)).toBe('38s');
    });
});
