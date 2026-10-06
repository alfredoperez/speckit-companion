/**
 * @jest-environment jsdom
 */

import { render } from 'preact';
import { RunStrip } from '../RunStrip';
import { navState, viewerState } from '../../signals';
import { mockNavState } from '../__stories__/mockData';
import type { ViewerState } from '../../types';

function tasksFact(): string | undefined {
    const container = document.createElement('div');
    render(<RunStrip />, container);
    const text = container.querySelector('[data-fact="tasks"]')?.textContent ?? undefined;
    render(null, container);
    return text;
}

const journaled = (ids: string[]): ViewerState => ({
    status: 'implementing',
    activeStep: 'implement',
    steps: [],
    pulse: null,
    highlights: [],
    activeSubstep: null,
    footer: [],
    history: [],
    stepHistory: {},
    taskSummaries: Object.fromEntries(ids.map(id => [id, { status: 'DONE', did: 'x', files: [] }])),
} as unknown as ViewerState);

describe('the header task count', () => {
    it('counts ticked boxes out of every task, not out of the tasks journaled so far', () => {
        navState.value = mockNavState({ taskCompletionPercent: 50, taskCounts: { checked: 3, total: 6 } });
        viewerState.value = journaled(['T001', 'T002', 'T003']);

        expect(tasksFact()).toBe('3/6 tasks');
    });

    it('falls back to the percentage the rail shows when no counts were sent', () => {
        navState.value = mockNavState({ taskCompletionPercent: 50 });
        viewerState.value = journaled(['T001', 'T002', 'T003']);

        expect(tasksFact()).toBe('50% tasks');
    });

    it('says nothing about tasks before any exist', () => {
        navState.value = mockNavState({ taskCompletionPercent: 0, taskCounts: { checked: 0, total: 0 } });
        viewerState.value = journaled([]);

        expect(tasksFact()).toBeUndefined();
    });
});
