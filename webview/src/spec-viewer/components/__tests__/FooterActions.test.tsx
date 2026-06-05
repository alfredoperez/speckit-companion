/**
 * @jest-environment jsdom
 *
 * FooterActions single-source test.
 *
 * The footer is a pure function of one `viewerState` snapshot. There are
 * exactly two render shapes — `CatalogFooter` and `GeneratingFooter` — and
 * both derive from `viewerState`. A stale/partial `navState` can never hide a
 * still-valid lifecycle button. This test pins that contract: the generating
 * gate, the button catalog, and the generating→catalog revert all key off
 * `viewerState` alone.
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
        runningStepArtifactReady: false,
        runningStepStartedAt: null,
        runningStepLabel: null,
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

    it('renders GeneratingFooter when a step is in flight and the artifact is not ready', () => {
        viewerState.value = vs({
            status: 'planning',
            activeStep: 'plan',
            runningStepStartedAt: new Date().toISOString(),
            runningStepArtifactReady: false,
            runningStepLabel: 'Plan',
            footer: [{ id: 'approve', label: 'Tasks', scope: 'step', tooltip: 'continue' }],
        });

        const container = renderInto();
        try {
            const chip = container.querySelector('.footer-generating-chip');
            expect(chip).not.toBeNull();
            expect(chip!.textContent).toContain('Generating Plan');
            // CatalogFooter buttons MUST NOT be present in this branch.
            expect(container.querySelector('.actions-right button')).toBeNull();
        } finally {
            cleanup(container);
        }
    });

    it('renders CatalogFooter from viewerState.footer when no step is generating', () => {
        viewerState.value = vs({
            status: 'specified',
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
        // navState carries an in-flight `activeStep`/`stepHistory` from a prior
        // snapshot — under the old multi-source footer this could short-circuit
        // into GeneratingFooter and hide the forward action. With single-source
        // it is ignored entirely.
        navState.value = {
            activeStep: 'plan',
            stepHistory: { plan: { startedAt: new Date().toISOString(), completedAt: null } },
            enhancementButtons: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        viewerState.value = vs({
            status: 'specified',
            runningStepStartedAt: null, // truth: nothing is generating
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

    it('reverts from GeneratingFooter to CatalogFooter when the artifact becomes ready', () => {
        viewerState.value = vs({
            status: 'tasking',
            activeStep: 'tasks',
            runningStepStartedAt: new Date().toISOString(),
            runningStepArtifactReady: true, // artifact landed → no overlay
            runningStepLabel: 'Tasks',
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

    it('reverts to CatalogFooter when the recovery timeout has elapsed', () => {
        viewerState.value = vs({
            status: 'tasking',
            activeStep: 'tasks',
            runningStepStartedAt: '2026-01-01T00:00:00Z', // long past the 10-min window
            runningStepArtifactReady: false,
            runningStepLabel: 'Tasks',
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
