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
        currentDoc: 'spec',
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

    it('stops spinning the moment the status settles, even with a MISSING completedAt (#255)', () => {
        // The AI skipped the self-close `complete` history entry, so the plan
        // step still has `activeStep === 'plan'` and no `completedAt`. The old
        // derivation kept it spinning forever; the status-driven one stops it
        // because `planned` is a settled status.
        viewerState.value = {
            status: 'planned', highlights: ['specify'], activeSubstep: null,
        } as any;
        const c = renderTab(baseProps({
            doc: doc('plan', false, 'Plan'),
            index: 1,
            activeStep: 'plan',
            currentStep: 'plan',
            stepHistory: { plan: { startedAt: '2026-05-20T20:05:00Z', completedAt: null } },
        }));
        try {
            // No spinner: the status settled even though completedAt is missing.
            expect(c.querySelector('.step-status__sync')).toBeNull();
            expect(c.querySelector('button')!.className).not.toContain('in-flight');
        } finally {
            cleanup(c);
        }
    });

    it('spins a genuinely-running step driven by an in-flight status (#255)', () => {
        // `planning` is the in-flight status for the plan step — it must spin
        // even before any history `completedAt` exists.
        viewerState.value = {
            status: 'planning', highlights: ['specify'], activeSubstep: null,
        } as any;
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
        } finally {
            cleanup(c);
        }
    });

    it('does not spin a non-active step while another step is in-flight (#255)', () => {
        // status `planning` drives ONLY the plan step — the spec step must not
        // spin from status even though it has no completedAt.
        viewerState.value = {
            status: 'planning', highlights: [], activeSubstep: null,
        } as any;
        const c = renderTab(baseProps({
            doc: doc('spec', false, 'Specify'),
            index: 0,
            activeStep: 'plan',
            currentStep: 'plan',
            stepHistory: {},
        }));
        try {
            expect(c.querySelector('.step-status__sync')).toBeNull();
            expect(c.querySelector('button')!.className).not.toContain('in-flight');
        } finally {
            cleanup(c);
        }
    });

    it('does not spin a history-active step while a DIFFERENT step is the in-flight status (#255 review)', () => {
        // The in-flight status (`planning` → plan) is authoritative. The specify
        // tab has activeStep === its own step + no completedAt (stale history),
        // but must NOT spin: only one step spins, the one the status points at.
        viewerState.value = {
            status: 'planning', highlights: [], activeSubstep: null,
        } as any;
        const c = renderTab(baseProps({
            doc: doc('spec', false, 'Specify'),
            index: 0,
            activeStep: 'specify',
            currentStep: 'specify',
            stepHistory: {},
        }));
        try {
            expect(c.querySelector('.step-status__sync')).toBeNull();
            expect(c.querySelector('button')!.className).not.toContain('in-flight');
        } finally {
            cleanup(c);
        }
    });

    it('renders the live percentage label AND the spinning sync glyph for the implement in-progress step', () => {
        viewerState.value = { highlights: ['specify', 'plan'], activeSubstep: null } as any;
        const c = renderTab(baseProps({
            doc: doc('tasks', true, 'Tasks'),
            index: 2,
            currentStep: 'implement',
            taskCompletionPercent: 60,
            currentDoc: 'tasks',
            stepHistory: {},
            // NavigationBar marks the implement entry (or the last tab, as
            // here — a rail without an implement entry) as the percent host.
            isPercentHost: true,
        }));
        try {
            expect(c.querySelector('button')!.className).toContain('in-flight');
            // #277 Child 4: the implement tab now has motion — the sync glyph
            // renders INSIDE the percent label, next to the live percentage.
            const pct = c.querySelector('.step-tab__percent');
            expect(pct).not.toBeNull();
            expect(pct!.textContent).toContain('60%');
            expect(pct!.querySelector('.step-status__sync')).not.toBeNull();
            // #256: the round badge is still suppressed (no empty circle) — the
            // glyph lives in the percent label, not the badge.
            expect(c.querySelector('.step-status')).toBeNull();
        } finally {
            cleanup(c);
        }
    });

    it('settles the implement tab on a completed spec even when the percent never reached 100', () => {
        viewerState.value = {
            status: 'completed', highlights: ['specify', 'plan', 'tasks'], activeSubstep: null,
        } as any;
        const c = renderTab(baseProps({
            doc: doc('tasks', true, 'Tasks'),
            index: 2,
            currentStep: 'implement',
            taskCompletionPercent: 95,
            currentDoc: 'tasks',
            isPercentHost: true,
        }));
        try {
            const btn = c.querySelector('button')!;
            expect(btn.className).not.toContain('in-flight');
            expect(btn.className).toContain('done');
            expect(c.querySelector('.step-status__sync')).toBeNull();
            expect(c.querySelector('.step-tab__percent')).toBeNull();
            expect(c.querySelector('.step-status')!.textContent).toBe('✓');
        } finally {
            cleanup(c);
        }
    });

    it('keeps spinning a genuinely-running implement and shows its live percent', () => {
        viewerState.value = {
            status: 'implementing', highlights: ['specify', 'plan', 'tasks'], activeSubstep: null,
        } as any;
        const c = renderTab(baseProps({
            doc: doc('tasks', true, 'Tasks'),
            index: 2,
            currentStep: 'implement',
            taskCompletionPercent: 40,
            currentDoc: 'tasks',
            isPercentHost: true,
        }));
        try {
            expect(c.querySelector('button')!.className).toContain('in-flight');
            const pct = c.querySelector('.step-tab__percent');
            expect(pct!.textContent).toContain('40%');
            expect(pct!.querySelector('.step-status__sync')).not.toBeNull();
        } finally {
            cleanup(c);
        }
    });

    it('ramps the percentage label color via the --impl-progress ratio', () => {
        viewerState.value = { highlights: ['specify', 'plan'], activeSubstep: null } as any;
        const c = renderTab(baseProps({
            doc: doc('tasks', true, 'Tasks'),
            index: 2,
            currentStep: 'implement',
            taskCompletionPercent: 95,
            currentDoc: 'tasks',
            stepHistory: {},
            isPercentHost: true,
        }));
        try {
            const pct = c.querySelector('.step-tab__percent') as HTMLElement;
            expect(pct).not.toBeNull();
            // 0→1 ratio drives the CSS color-mix ramp toward the success color.
            expect(pct.style.getPropertyValue('--impl-progress')).toBe('0.95');
        } finally {
            cleanup(c);
        }
    });
});
