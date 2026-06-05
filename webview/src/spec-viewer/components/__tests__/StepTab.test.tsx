/**
 * @jest-environment jsdom
 *
 * Step-tab sync: a tab's enabled / ✓ / active indicators reflect the spec's
 * true per-step state (per-step completion + on-disk document presence), and a
 * tab updates to match the new true state after a workflow-advancing action
 * without a reopen.
 *
 * (The plan referenced a `navigation.ts`; step-tab class derivation actually
 * lives in `StepTab.tsx`, so the sync tests live alongside it.)
 */

import { render } from 'preact';
import { StepTab, type StepTabProps } from '../StepTab';
import { viewerState } from '../../signals';
import type { SpecDocument } from '../../types';

(globalThis as { vscode?: { postMessage: (m: unknown) => void } }).vscode = {
    postMessage: () => undefined,
};

function doc(type: string, exists: boolean, label?: string): SpecDocument {
    return {
        type,
        label: label ?? type,
        fileName: `${type}.md`,
        filePath: `/x/${type}.md`,
        exists,
        isCore: true,
        category: 'core',
    };
}

function baseProps(over: Partial<StepTabProps> = {}): StepTabProps {
    return {
        doc: doc('plan', true, 'Plan'),
        index: 1,
        totalSteps: 3,
        currentDoc: 'spec',
        workflowPhase: 'spec',
        taskCompletionPercent: 0,
        isViewingRelatedDoc: false,
        parentPhaseForRelated: 'spec',
        activeStep: null,
        currentStep: 'tasks',
        stepHistory: {},
        onClick: () => undefined,
        ...over,
    };
}

function renderTab(props: StepTabProps): HTMLDivElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(<StepTab {...props} />, container);
    return container;
}

function rerender(container: HTMLDivElement, props: StepTabProps): void {
    render(<StepTab {...props} />, container);
}

function cleanup(container: HTMLDivElement) {
    render(null, container);
    container.remove();
}

describe('StepTab — reflects true per-step state', () => {
    afterEach(() => {
        viewerState.value = null;
    });

    it('shows ✓ and stays enabled when the step document exists and the step is completed', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viewerState.value = { highlights: ['specify', 'plan'], activeSubstep: null } as any;
        const c = renderTab(baseProps({ doc: doc('plan', true, 'Plan'), index: 1, currentStep: 'tasks' }));
        try {
            const btn = c.querySelector('button')!;
            expect(btn.disabled).toBe(false);
            expect(c.querySelector('.step-status')?.textContent).toBe('✓');
            expect(btn.className).toContain('done');
        } finally {
            cleanup(c);
        }
    });

    it('shows no ✓ and disables the tab when the step document is not yet created', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viewerState.value = { highlights: ['specify', 'plan'], activeSubstep: null } as any;
        const c = renderTab(baseProps({ doc: doc('tasks', false, 'Tasks'), index: 2, currentStep: 'plan' }));
        try {
            const btn = c.querySelector('button')!;
            expect(c.querySelector('.step-status')?.textContent).toBe('');
            expect(btn.className).not.toContain('done');
            expect(btn.disabled).toBe(true);
        } finally {
            cleanup(c);
        }
    });

    it('updates the tab indicator after the workflow advances, without a reopen', () => {
        // Before: plan not created — disabled, no ✓.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viewerState.value = { highlights: ['specify'], activeSubstep: null } as any;
        const before = baseProps({ doc: doc('plan', false, 'Plan'), index: 1, currentStep: 'specify' });
        const c = renderTab(before);
        try {
            expect(c.querySelector('.step-status')?.textContent).toBe('');
            expect(c.querySelector('button')!.className).not.toContain('done');

            // The advancing action lands a fresh snapshot: plan.md now exists
            // and the step is completed. Re-render into the SAME container.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            viewerState.value = { highlights: ['specify', 'plan'], activeSubstep: null } as any;
            rerender(c, baseProps({ doc: doc('plan', true, 'Plan'), index: 1, currentStep: 'tasks' }));

            expect(c.querySelector('.step-status')?.textContent).toBe('✓');
            expect(c.querySelector('button')!.className).toContain('done');
        } finally {
            cleanup(c);
        }
    });
});
