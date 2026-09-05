import {
    navState,
    viewerMode,
    viewerState,
    showingOverview,
} from '../../../webview/src/spec-viewer/signals';

const WITH_DURABLE_CONTEXT = {
    intent: 'Make the spec name open its Overview',
    decisions: [{ decision: 'Reuse the landing rule', why: 'One owner' }],
} as any;

const WORK_LOG_ONLY = {
    history: [{ step: 'specify', kind: 'complete' }],
} as any;

const NO_RECORDED_RUN = {} as any;

describe('showingOverview — the viewer owns the landing decision', () => {
    beforeEach(() => {
        navState.value = { activityPanelEnabled: true } as any;
        viewerMode.value = null;
    });

    afterEach(() => {
        navState.value = null;
        viewerState.value = null;
        viewerMode.value = null;
    });

    it('lands on the document by default, even when the spec has been run', () => {
        // The old default resolved to the Overview for any spec with recorded
        // activity, which is why every document row in the tree opened it.
        viewerState.value = WITH_DURABLE_CONTEXT;

        expect(showingOverview.value).toBe(false);
    });

    it('lands on the Overview only when the spec itself was opened', () => {
        navState.value = { activityPanelEnabled: true, landing: 'overview' } as any;
        viewerState.value = WITH_DURABLE_CONTEXT;

        expect(showingOverview.value).toBe(true);
    });

    it('lands on the document when the spec only has a work log', () => {
        viewerState.value = WORK_LOG_ONLY;

        expect(showingOverview.value).toBe(false);
    });

    it('lands on the document when the spec has no recorded run', () => {
        viewerState.value = NO_RECORDED_RUN;

        expect(showingOverview.value).toBe(false);
    });

    it('honors an explicit reader choice over the landing default', () => {
        viewerState.value = WITH_DURABLE_CONTEXT;
        viewerMode.value = 'document';

        expect(showingOverview.value).toBe(false);
    });

    describe('a tree click on a document asks for that document', () => {
        it('opens the document even on a spec that has been run', () => {
            // The bug: every document row in the tree landed on the Overview,
            // because a run spec resolves to the Overview by default and nothing
            // on the extension-to-webview path could say otherwise.
            navState.value = { activityPanelEnabled: true, landing: 'document' } as any;
            viewerState.value = WITH_DURABLE_CONTEXT;

            expect(showingOverview.value).toBe(false);
        });

        it('the spec row asks for the Overview explicitly', () => {
            navState.value = { activityPanelEnabled: true, landing: 'overview' } as any;
            viewerState.value = WITH_DURABLE_CONTEXT;

            expect(showingOverview.value).toBe(true);
        });

        it('still lets the reader get back to the Overview from inside', () => {
            navState.value = { activityPanelEnabled: true, landing: 'document' } as any;
            viewerState.value = WITH_DURABLE_CONTEXT;
            viewerMode.value = 'overview';

            expect(showingOverview.value).toBe(true);
        });
    });
});
