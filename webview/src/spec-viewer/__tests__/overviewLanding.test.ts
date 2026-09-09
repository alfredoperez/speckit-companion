/**
 * @jest-environment jsdom
 */
import { applyNavState, applyViewerState } from '../messageHandlers';
import { navState, viewerState, viewerMode, showingOverview } from '../signals';
import type { NavState, ViewerState } from '../types';

function nav(overrides: Partial<NavState> = {}): NavState {
    return {
        coreDocs: [],
        relatedDocs: [],
        currentDoc: 'spec',
        workflowPhase: 'specify',
        taskCompletionPercent: 0,
        isViewingRelatedDoc: false,
        ...overrides,
    } as NavState;
}

/** A spec with recorded activity, which is what gives it an Overview to land on. */
function ranOnce(): ViewerState {
    return {
        status: 'specified',
        activeStep: 'specify',
        steps: { specify: { status: 'complete' } },
        pulse: null,
        highlights: [],
        activeSubstep: null,
        footer: [],
        history: [{ step: 'specify', kind: 'complete', at: '2026-09-09T10:00:00Z' }],
        stepHistory: {},
    } as unknown as ViewerState;
}

describe('what the viewer lands on', () => {
    beforeEach(() => {
        navState.value = null;
        viewerState.value = null;
        viewerMode.value = null;
    });

    it('opens the Overview when the spec itself was opened', () => {
        applyViewerState(ranOnce());
        applyNavState(nav({ landing: 'overview' }));

        expect(showingOverview.value).toBe(true);
    });

    it('opens the document when a document row was clicked', () => {
        applyViewerState(ranOnce());
        applyNavState(nav({ landing: 'document' }));

        expect(showingOverview.value).toBe(false);
    });

    it('opens the Overview after the panel has already been used to read a document', () => {
        // The reported bug. A panel that had shown a document answered with that document
        // for the rest of its life, because the reader's echo outranked every later entry
        // point. Opening the spec fresh passes either way, so it proves nothing on its own.
        applyViewerState(ranOnce());
        applyNavState(nav({ landing: 'document' }));
        viewerMode.value = 'document';

        applyNavState(nav({ landing: 'overview' }));

        expect(showingOverview.value).toBe(true);
    });

    it('keeps a living spec on its Overview when no landing was asked for', () => {
        applyViewerState(ranOnce());
        applyNavState(nav({ livingMode: true }));

        expect(showingOverview.value).toBe(true);
    });

    it('sends a living spec to the document when one was asked for', () => {
        applyViewerState(ranOnce());
        applyNavState(nav({ livingMode: true, landing: 'document' }));

        expect(showingOverview.value).toBe(false);
    });
});
