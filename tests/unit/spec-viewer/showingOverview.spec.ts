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

    it('lands on the Overview when the spec has durable context', () => {
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
});
