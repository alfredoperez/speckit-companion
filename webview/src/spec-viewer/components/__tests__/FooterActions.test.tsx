/**
 * @jest-environment jsdom
 *
 * FooterActions branch-dispatch test — the safety net for Phases 5b/5c/5d.
 *
 * The component has three render paths (Generating, Catalog, Legacy). Each
 * was a wholesale return statement inside one 288-LOC component; Phase 5a
 * lifted the first two into dedicated sub-components (`GeneratingFooter`,
 * `CatalogFooter`) and kept the legacy fallback inline. This test pins the
 * dispatch behaviour: given known signal states, the correct branch
 * renders. Subsequent webview migrations (modal, inline-editor wrappers,
 * markdown content) can land knowing this baseline catches regressions
 * here even when other components change.
 */

import { render } from 'preact';
import { FooterActions } from '../FooterActions';
import { navState, viewerState } from '../../signals';

// `<Toast>` uses a `vscode.postMessage` reference via the global declared
// at the module level. Stub it so the rendered tree doesn't reach for an
// undefined handle when components mount.
(globalThis as { vscode?: { postMessage: (m: unknown) => void } }).vscode = {
    postMessage: () => undefined,
};

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

describe('FooterActions branch dispatch', () => {
    afterEach(() => {
        navState.value = null;
        viewerState.value = null;
    });

    it('renders GeneratingFooter when a step has startedAt without completedAt and the artifact is not ready', () => {
        navState.value = {
            // The component only touches a handful of fields for the
            // generating-branch decision; the cast is intentional so the test
            // stays focused on the dispatch surface rather than fixture noise.
            activeStep: 'plan',
            stepHistory: { plan: { startedAt: new Date().toISOString(), completedAt: null } },
            runningStepArtifactReady: false,
            runningStepStartedAt: new Date().toISOString(),
            runningStepLabel: 'Plan',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        const container = renderInto();
        try {
            const chip = container.querySelector('.footer-generating-chip');
            expect(chip).not.toBeNull();
            expect(chip!.textContent).toContain('Generating');
            // CatalogFooter buttons MUST NOT be present in this branch.
            expect(container.querySelector('.actions-right button')).toBeNull();
        } finally {
            cleanup(container);
        }
    });

    it('renders CatalogFooter when viewerState.footer is populated and no step is generating', () => {
        navState.value = {
            activeStep: null,
            stepHistory: {},
            runningStepArtifactReady: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        viewerState.value = {
            status: 'active',
            footer: [
                { id: 'approve', label: 'Plan', scope: 'step', tooltip: 'Advance to plan' },
                { id: 'archive', label: 'Archive', scope: 'spec', tooltip: 'Archive this spec' },
            ],
            history: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        const container = renderInto();
        try {
            // Generating chip should NOT appear.
            expect(container.querySelector('.footer-generating-chip')).toBeNull();
            // Catalog actions render as <Button> with the action label.
            const buttonLabels = Array.from(container.querySelectorAll('button')).map((b) => b.textContent?.trim());
            expect(buttonLabels).toEqual(expect.arrayContaining(['Plan', 'Archive']));
        } finally {
            cleanup(container);
        }
    });

    it('renders the legacy fallback when no viewerState.footer is present and no step is generating', () => {
        navState.value = {
            activeStep: null,
            stepHistory: {},
            runningStepArtifactReady: false,
            footerState: {
                showApproveButton: true,
                approveText: 'Plan',
                enhancementButtons: [],
                specStatus: 'active',
            },
            enhancementButtons: [],
            specStatus: 'active',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        viewerState.value = null;

        const container = renderInto();
        try {
            // The legacy path renders Regenerate + Approve buttons when the
            // spec is active and showApproveButton is true.
            const buttonLabels = Array.from(container.querySelectorAll('button')).map((b) => b.textContent?.trim());
            expect(buttonLabels).toEqual(expect.arrayContaining(['Regenerate', 'Plan']));
            // And the generating chip must not be present.
            expect(container.querySelector('.footer-generating-chip')).toBeNull();
        } finally {
            cleanup(container);
        }
    });
});
