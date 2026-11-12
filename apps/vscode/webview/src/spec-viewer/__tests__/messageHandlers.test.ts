/**
 * @jest-environment jsdom
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildHandlers } from '../messageHandlers';
import { navState, viewerState, historyEntries, specMoved } from '../signals';
import type { ExtensionToViewerMessage, NavState, ViewerState } from '../types';

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

function viewer(overrides: Partial<ViewerState> = {}): ViewerState {
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
    } as ViewerState;
}

describe('the webview routes every message the extension can send', () => {
    beforeEach(() => {
        navState.value = null;
        viewerState.value = null;
        historyEntries.value = [];
    });

    it('has a handler for each variant the protocol declares', () => {
        // The map's type already makes a missing handler a build error. This
        // reads the protocol as text as well, so that a variant added there is
        // visibly accounted for here even to someone skimming.
        const protocol = fs.readFileSync(
            path.join(__dirname, '..', '..', '..', '..', '..', '..', 'packages', 'viewer', 'src', 'contract', 'viewer.ts'),
            'utf8',
        );
        const union = protocol.slice(protocol.indexOf('export type ExtensionToViewerMessage'));
        const declared = new Set(
            [...union.slice(0, union.indexOf('export type ViewerToExtensionMessage')).matchAll(/type:\s*'([^']+)'/g)]
                .map(m => m[1]),
        );

        const handled = new Set(Object.keys(buildHandlers(() => undefined)));
        expect(handled).toEqual(declared);
    });

    it('applies navState and viewerState together on a content update', () => {
        const updates: string[] = [];
        const handlers = buildHandlers(content => updates.push(content));

        handlers.contentUpdated({
            type: 'contentUpdated',
            content: 'body',
            documentType: 'spec',
            specName: 'demo',
            navState: nav({ currentTask: 'T003' }),
            viewerState: viewer({ history: [{ step: 'specify' } as never] }),
        } as Extract<ExtensionToViewerMessage, { type: 'contentUpdated' }>);

        expect(navState.value?.currentTask).toBe('T003');
        expect(historyEntries.value).toHaveLength(1);
        expect(updates).toEqual(['body']);
    });

    it('replaces the whole navState on a state update, rather than merging', () => {
        const handlers = buildHandlers(() => undefined);
        navState.value = nav({ badgeText: 'stale' });

        handlers.viewerStateUpdated({
            type: 'viewerStateUpdated',
            viewerState: viewer(),
            navState: nav({ workflowPhase: 'plan' }),
        } as Extract<ExtensionToViewerMessage, { type: 'viewerStateUpdated' }>);

        expect(navState.value?.workflowPhase).toBe('plan');
        expect(navState.value?.badgeText).toBeUndefined();
    });

    it('renders the deleted-file notice as text, never as markup', () => {
        document.body.innerHTML = '<div id="content-area"></div>';
        const handlers = buildHandlers(() => undefined);

        handlers.fileDeleted({ type: 'fileDeleted', filePath: 'x' } as never);

        const area = document.getElementById('content-area');
        expect(area?.querySelector('.empty-state')?.textContent).toBe('The file has been deleted.');
    });

    it('marks the panel moved when its folder is gone, and clears it on the next content', () => {
        const handlers = buildHandlers(() => undefined);

        handlers.specMoved({ type: 'specMoved', specDirectory: '/repo/specs/x' } as never);
        expect(specMoved.value).toBe(true);

        handlers.contentUpdated({ type: 'contentUpdated', content: '', documentType: 'spec', specName: 'x' } as never);
        expect(specMoved.value).toBe(false);
    });
});

describe('the spec page gets the sibling tasks.md from the navState', () => {
    const SPEC_MD = '# Feature Specification: X\n\n**Feature Branch**: `001-x`\n\n**Created**: 2026-10-09\n\n**Status**: Draft\n\n## User Scenarios & Testing\n\n### User Story 1 - Do it (Priority: P1)\n\nAs a user I do it.\n\n**Acceptance Scenarios**:\n\n1. **Given** a, **When** b, **Then** c\n';
    const render = (tasks: string | undefined) => {
        const { applyNavState } = require('../messageHandlers');
        applyNavState(nav({ tasksMarkdown: tasks }));
        return require('speckit-viewer/core/markdown/index').renderMarkdown(SPEC_MD) as string;
    };

    it('shows story progress when tasksMarkdown is set', () => {
        expect(render('- [x] T001 [US1] a\n- [ ] T002 [US1] b')).toContain('1/2');
    });
    it('drops the progress when tasksMarkdown is empty', () => {
        render('- [x] T001 [US1] a');
        expect(render('')).not.toContain('Built by T001');
    });
});
