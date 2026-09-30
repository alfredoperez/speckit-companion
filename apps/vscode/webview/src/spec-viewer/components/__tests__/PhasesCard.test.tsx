/** @jest-environment jsdom */
import { h, render } from 'preact';
import { PhasesCard } from '../cards/PhasesCard';
import type { ViewerState } from '../../types';

const trusted = (startedAt: string, completedAt: string) => ({ startedAt, completedAt, durationTrusted: true });

const state = (overrides: Partial<ViewerState>): ViewerState => ({
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

describe('PhasesCard overall stats', () => {
    it('labels the summed phase time as active, so a wait between phases does not read as a mismatch', () => {
        const host = document.createElement('div');
        render(h(PhasesCard, {
            state: state({
                stepHistory: {
                    specify: trusted('2026-07-02T10:00:00Z', '2026-07-02T10:05:00Z'),
                    plan: trusted('2026-07-02T11:05:00Z', '2026-07-02T11:12:00Z'),
                    tasks: trusted('2026-07-02T11:12:00Z', '2026-07-02T11:15:00Z'),
                    implement: trusted('2026-07-02T11:15:00Z', '2026-07-02T11:24:00Z'),
                },
                timing: {
                    measuredPhases: 4,
                    expectedPhases: 4,
                    complete: true,
                    startedAt: '2026-07-02T10:00:00Z',
                    endedAt: '2026-07-02T11:24:00Z',
                    elapsedMs: 24 * 60_000,
                },
            }),
        }), host);

        const stats = Array.from(host.querySelectorAll('.phases-overall__stat')).map(stat => [
            stat.querySelector('.phases-overall__label')?.textContent,
            stat.querySelector('.phases-overall__value')?.textContent,
        ]);
        expect(stats.map(([label]) => label)).toEqual(['Started', 'Active', 'Ended']);
        expect(stats[1][1]).toBe('24m');
        expect(host.textContent).not.toContain('Elapsed');
    });
});
