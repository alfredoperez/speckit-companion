/**
 * @jest-environment jsdom
 */

import { render } from 'preact';
import { RunStrip } from '../RunStrip';
import { navState, viewerState } from '../../signals';
import { mockNavState } from '../__stories__/mockData';
import { StepTab } from '../StepTab';
import { FooterActions } from '../FooterActions';
import type { ViewerState, ConvergeResult, SpecDocument } from '../../types';

(globalThis as { vscode?: { postMessage: (m: unknown) => void } }).vscode = {
    postMessage: () => undefined,
};

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

describe('the converge fact', () => {
    const withConverge = (converge: ConvergeResult | undefined): ViewerState =>
        ({ ...journaled([]), status: 'implemented', converge } as ViewerState);
    const result = (over: Partial<ConvergeResult>): ConvergeResult =>
        ({ outcome: 'gaps', passCount: 1, passes: [], addedTasks: [], openAdded: 3, ...over });
    const convergeFact = () => {
        const container = document.createElement('div');
        render(<RunStrip />, container);
        const el = container.querySelector('[data-fact="converge"]');
        const out = { text: el?.textContent ?? null, warning: el?.classList.contains('run-strip__fact--warning') ?? false };
        render(null, container);
        return out;
    };

    it('says how many tasks converge added, as a warning', () => {
        navState.value = mockNavState({});
        viewerState.value = withConverge(result({ openAdded: 3 }));
        expect(convergeFact()).toEqual({ text: '3 added by converge', warning: true });
    });

    it('says converge clean after a clean pass', () => {
        navState.value = mockNavState({});
        viewerState.value = withConverge(result({ outcome: 'clean', openAdded: 0 }));
        expect(convergeFact()).toEqual({ text: 'converge clean', warning: false });
    });

    it('says nothing when converge never ran', () => {
        navState.value = mockNavState({});
        viewerState.value = withConverge(undefined);
        expect(convergeFact().text).toBeNull();
    });

    it('shows the same count in the fact, the Tasks badge and the footer', () => {
        const converge = result({ openAdded: 3 });
        navState.value = mockNavState({});
        viewerState.value = {
            ...withConverge(converge),
            footer: [{ id: 'implement-gaps', label: 'Implement 3 new tasks', scope: 'spec', tooltip: 't' }],
        } as ViewerState;
        const tasksDoc: SpecDocument = {
            type: 'tasks', label: 'Tasks', fileName: 'tasks.md', filePath: '/x/tasks.md',
            exists: true, isCore: true, category: 'core',
        };
        const strip = document.createElement('div');
        const tab = document.createElement('div');
        const footer = document.createElement('div');
        render(<RunStrip />, strip);
        render(
            <StepTab
                doc={tasksDoc} index={2} currentDoc="tasks" taskCompletionPercent={0}
                isViewingRelatedDoc={false} parentPhaseForRelated="tasks"
                convergeAdded={viewerState.value?.converge?.openAdded} onClick={() => undefined}
            />,
            tab,
        );
        render(<FooterActions initialSpecStatus="implemented" />, footer);
        try {
            expect(strip.querySelector('[data-fact="converge"]')?.textContent).toBe('3 added by converge');
            expect(tab.querySelector('.step-tab__converge')?.textContent).toBe('+3');
            expect(footer.textContent).toContain('Implement 3 new tasks');
            expect(footer.querySelector('.footer-context')?.textContent).toBe('Converge added 3 tasks');
        } finally {
            render(null, strip);
            render(null, tab);
            render(null, footer);
        }
    });
});
