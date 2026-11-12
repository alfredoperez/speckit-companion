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

describe('FooterActions — bug and idea report pages', () => {
    const host = globalThis as unknown as { vscode: { postMessage: (m: unknown) => void } };
    const original = host.vscode.postMessage;
    const report = (reportActions: { id: string; label: string; primary: boolean }[]) =>
        ({ enhancementButtons: [], reportActions }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    afterEach(() => {
        host.vscode.postMessage = original;
        navState.value = null;
        viewerState.value = null;
    });

    it('puts the secondary button first and the main button last, and names the next step', () => {
        navState.value = report([
            { id: 'bug.test', label: 'Test fix', primary: true },
            { id: 'bug.fix', label: 'Fix again', primary: false },
        ]);

        const container = renderInto();
        try {
            expect(labels(container)).toEqual(['Fix again', 'Test fix']);
            expect(Array.from(container.querySelectorAll('button')).map((b) => b.className)).toEqual(['secondary', 'primary']);
            expect(container.querySelector('.footer-context')?.textContent).toBe('Next: Test fix');
        } finally {
            cleanup(container);
        }
    });

    it('shows no next step line when the page offers only a secondary action', () => {
        navState.value = report([{ id: 'bug.test', label: 'Test again', primary: false }]);

        const container = renderInto();
        try {
            expect(labels(container)).toEqual(['Test again']);
            expect(container.querySelector('.footer-context')).toBeNull();
        } finally {
            cleanup(container);
        }
    });

    it('posts only the id of the button clicked', () => {
        const posted: unknown[] = [];
        host.vscode.postMessage = (m) => posted.push(m);
        navState.value = report([{ id: 'bug.fix', label: 'Fix bug', primary: true }]);

        const container = renderInto();
        try {
            container.querySelector('button')!.click();
            expect(posted).toEqual([{ type: 'reportAction', id: 'bug.fix' }]);
        } finally {
            cleanup(container);
        }
    });

    it('renders a label as text, never as markup', () => {
        navState.value = report([{ id: 'bug.fix', label: '<img src=x>', primary: true }]);

        const container = renderInto();
        try {
            expect(container.querySelector('img')).toBeNull();
            expect(labels(container)).toEqual(['<img src=x>']);
        } finally {
            cleanup(container);
        }
    });

    it('renders no footer for an empty list', () => {
        navState.value = report([]);

        const container = renderInto();
        try {
            expect(container.querySelector('footer')).toBeNull();
        } finally {
            cleanup(container);
        }
    });

    it('leaves a spec with its own footer when it carries no report actions', () => {
        viewerState.value = vs({ footer: [{ id: 'approve', label: 'Plan', scope: 'step', tooltip: 'continue' }] });
        navState.value = { enhancementButtons: [] } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

        const container = renderInto();
        try {
            expect(labels(container)).toEqual(['Plan']);
        } finally {
            cleanup(container);
        }
    });
});
