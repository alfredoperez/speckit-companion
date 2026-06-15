/**
 * @jest-environment jsdom
 *
 * FooterActions single-source test.
 *
 * The footer is a pure function of one `viewerState` snapshot. The in-flight
 * "Generating…" pill was removed (#277 Child 4) — the only render shape is now
 * `CatalogFooter`, and the single source of in-flight motion is the spinning
 * step tab. This test pins the remaining contract: the button catalog derives
 * from `viewerState.footer`, a stale/partial `navState` can never hide a valid
 * button, and while the current step is in flight the forward-motion lifecycle
 * button (Approve / next-step `start`) is suppressed (but Regenerate and
 * closure actions remain).
 */

import { render } from 'preact';
import { FooterActions } from '../FooterActions';
import { navState, viewerState } from '../../signals';
import type { ViewerState } from '../../types';

// `<Toast>` reaches for a `vscode.postMessage` global at mount.
(globalThis as { vscode?: { postMessage: (m: unknown) => void } }).vscode = {
    postMessage: () => undefined,
};

function vs(overrides: Partial<ViewerState>): ViewerState {
    return {
        status: 'specified',
        activeStep: 'specify',
        steps: {},
        pulse: null,
        highlights: [],
        activeSubstep: null,
        footer: [],
        history: [],
        stepHistory: {},
        ...overrides,
    };
}

function renderInto(): HTMLDivElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(<FooterActions initialSpecStatus="active" />, container);
    return container;
}

function cleanup(container: HTMLDivElement) {
    render(null, container);
    container.remove();
}

const labels = (c: HTMLElement) =>
    Array.from(c.querySelectorAll('button')).map((b) => b.textContent?.trim());

describe('FooterActions — single source (viewerState)', () => {
    afterEach(() => {
        navState.value = null;
        viewerState.value = null;
    });

    it('never renders a Generating footer pill (consolidated onto the step tab)', () => {
        viewerState.value = vs({
            status: 'planning',
            activeStep: 'plan',
            footer: [{ id: 'approve', label: 'Tasks', scope: 'step', tooltip: 'continue' }],
        });

        const container = renderInto();
        try {
            expect(container.querySelector('.footer-generating-chip')).toBeNull();
        } finally {
            cleanup(container);
        }
    });

    it('suppresses the forward-motion button while the current step is in flight', () => {
        viewerState.value = vs({
            status: 'planning', // step in flight
            activeStep: 'plan',
            footer: [
                { id: 'regenerate', label: 'Regenerate', scope: 'step', tooltip: 're-run' },
                { id: 'approve', label: 'Tasks', scope: 'step', tooltip: 'continue' },
            ],
        });

        const container = renderInto();
        try {
            // Regenerate stays; the forward-motion Approve/Tasks button is hidden.
            expect(labels(container)).toContain('Regenerate');
            expect(labels(container)).not.toContain('Tasks');
        } finally {
            cleanup(container);
        }
    });

    it('renders CatalogFooter from viewerState.footer for a settled step', () => {
        viewerState.value = vs({
            status: 'specified', // settled — forward motion allowed
            footer: [
                { id: 'regenerate', label: 'Regenerate', scope: 'step', tooltip: 're-run' },
                { id: 'approve', label: 'Plan', scope: 'step', tooltip: 'continue' },
            ],
        });

        const container = renderInto();
        try {
            expect(container.querySelector('.footer-generating-chip')).toBeNull();
            expect(labels(container)).toEqual(expect.arrayContaining(['Regenerate', 'Plan']));
        } finally {
            cleanup(container);
        }
    });

    it('a stale/partial navState cannot hide a still-valid viewerState button', () => {
        navState.value = {
            activeStep: 'plan',
            stepHistory: { plan: { startedAt: new Date().toISOString(), completedAt: null } },
            enhancementButtons: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        viewerState.value = vs({
            status: 'specified', // settled per viewerState (the source of truth)
            footer: [
                { id: 'regenerate', label: 'Regenerate', scope: 'step', tooltip: 're-run' },
                { id: 'approve', label: 'Plan', scope: 'step', tooltip: 'continue' },
            ],
        });

        const container = renderInto();
        try {
            expect(container.querySelector('.footer-generating-chip')).toBeNull();
            expect(labels(container)).toEqual(expect.arrayContaining(['Regenerate', 'Plan']));
        } finally {
            cleanup(container);
        }
    });

    it('shows the forward-motion button once the step settles (implementing → implemented offers closure)', () => {
        viewerState.value = vs({
            status: 'ready-to-implement', // settled tasks step
            activeStep: 'tasks',
            footer: [
                { id: 'regenerate', label: 'Regenerate', scope: 'step', tooltip: 're-run' },
                { id: 'approve', label: 'Implement', scope: 'step', tooltip: 'continue' },
            ],
        });

        const container = renderInto();
        try {
            expect(container.querySelector('.footer-generating-chip')).toBeNull();
            expect(labels(container)).toEqual(expect.arrayContaining(['Regenerate', 'Implement']));
        } finally {
            cleanup(container);
        }
    });

    it('renders nothing until viewerState arrives (no contradictory buttons)', () => {
        viewerState.value = null;
        navState.value = { enhancementButtons: [] } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

        const container = renderInto();
        try {
            expect(container.querySelector('footer')).toBeNull();
            expect(container.querySelector('button')).toBeNull();
        } finally {
            cleanup(container);
        }
    });
});
