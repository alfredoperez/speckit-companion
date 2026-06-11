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

describe('StepTab — #229 in-flight sync glyph', () => {
    afterEach(() => {
        viewerState.value = null;
    });

    it('renders a spinning sync codicon (not a checkmark) while the step is in flight', () => {
        viewerState.value = { highlights: ['specify'], activeSubstep: null } as any;
        const c = renderTab(baseProps({
            doc: doc('plan', false, 'Plan'),
            index: 1,
            activeStep: 'plan',
            currentStep: 'plan',
            stepHistory: { plan: { startedAt: '2026-05-20T20:05:00Z', completedAt: null } },
        }));
        try {
            expect(c.querySelector('button')!.className).toContain('in-flight');
            expect(c.querySelector('.step-status__sync')).not.toBeNull();
            expect(c.querySelector('.step-status__sync')!.classList.contains('codicon-sync')).toBe(true);
            // No checkmark while running.
            expect(c.querySelector('.step-status')!.textContent).not.toContain('✓');
            // The live elapsed timer is mounted while running.
            expect(c.querySelector('.step-tab__elapsed')).not.toBeNull();
        } finally {
            cleanup(c);
        }
    });

    it('drops the sync glyph and shows the checkmark + stops the timer when the step completes', () => {
        // Before: plan running, glyph + timer present.
        viewerState.value = { highlights: ['specify'], activeSubstep: null } as any;
        const c = renderTab(baseProps({
            doc: doc('plan', false, 'Plan'),
            index: 1,
            activeStep: 'plan',
            currentStep: 'plan',
            stepHistory: { plan: { startedAt: '2026-05-20T20:05:00Z', completedAt: null } },
        }));
        try {
            expect(c.querySelector('.step-status__sync')).not.toBeNull();
            expect(c.querySelector('.step-tab__elapsed')).not.toBeNull();

            // After: AI completion lands — doc now exists, completedAt set,
            // activeStep moved off plan. The tab flips to done.
            viewerState.value = { highlights: ['specify', 'plan'], activeSubstep: null } as any;
            rerender(c, baseProps({
                doc: doc('plan', true, 'Plan'),
                index: 1,
                activeStep: null,
                currentStep: 'tasks',
                stepHistory: { plan: { startedAt: '2026-05-20T20:05:00Z', completedAt: '2026-05-20T20:10:00Z' } },
            }));

            expect(c.querySelector('button')!.className).toContain('done');
            expect(c.querySelector('.step-status')!.textContent).toContain('✓');
            // Glyph gone, timer unmounted.
            expect(c.querySelector('.step-status__sync')).toBeNull();
            expect(c.querySelector('.step-tab__elapsed')).toBeNull();
        } finally {
            cleanup(c);
        }
    });

    it('renders the percentage pill (not the sync glyph) for the implement in-progress step', () => {
        viewerState.value = { highlights: ['specify', 'plan'], activeSubstep: null } as any;
        const c = renderTab(baseProps({
            doc: doc('tasks', true, 'Tasks'),
            index: 2,
            totalSteps: 3,
            currentStep: 'implement',
            taskCompletionPercent: 60,
            currentDoc: 'tasks',
            stepHistory: {},
        }));
        try {
            expect(c.querySelector('button')!.className).toContain('in-flight');
            expect(c.querySelector('.step-status__sync')).toBeNull();
            expect(c.querySelector('.step-status')!.textContent).toContain('60%');
        } finally {
            cleanup(c);
        }
    });
});
