/**
 * @jest-environment jsdom
 *
 * Documents-only rail: action steps (Implement, Mark Complete, any custom
 * step without a document) never render as pipeline entries, the implement
 * percent lands on the last document tab, and a running hidden step locks
 * nothing.
 */

import { render } from 'preact';
import { NavigationBar } from '../NavigationBar';
import { navState, viewerState, viewerMode } from '../../signals';
import type { NavState, SpecDocument } from '../../types';

const postMessage = jest.fn();
(globalThis as { vscode?: { postMessage: (m: unknown) => void } }).vscode = { postMessage };

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

function actionDoc(type: string, label: string): SpecDocument {
    return {
        type,
        label,
        fileName: '',
        filePath: '',
        exists: false,
        isCore: false,
        category: 'action',
    };
}

function relatedDoc(type: string, parentStep: string, label: string): SpecDocument {
    return {
        type,
        label,
        fileName: `${type}.md`,
        filePath: `/x/${type}.md`,
        exists: true,
        isCore: false,
        category: 'related',
        parentStep,
    };
}

function baseNav(over: Partial<NavState> = {}): NavState {
    return {
        coreDocs: [
            doc('spec', true, 'Specification'),
            doc('plan', true, 'Plan'),
            doc('tasks', true, 'Tasks'),
            actionDoc('implement', 'Implement'),
            actionDoc('mark-complete', 'Mark Complete'),
        ],
        relatedDocs: [],
        currentDoc: 'spec',
        workflowPhase: 'tasks',
        taskCompletionPercent: 0,
        isViewingRelatedDoc: false,
        activityPanelEnabled: false,
        ...over,
    };
}

function renderBar(ns: NavState): HTMLDivElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    navState.value = ns;
    render(<NavigationBar />, container);
    return container;
}

function cleanup(container: HTMLDivElement) {
    render(null, container);
    container.remove();
}

afterEach(() => {
    navState.value = null;
    viewerState.value = null;
    viewerMode.value = null;
    postMessage.mockClear();
});

describe('NavigationBar — documents-only rail', () => {
    it('never renders action steps as rail entries', () => {
        const c = renderBar(baseNav());
        try {
            const tabs = Array.from(c.querySelectorAll('.step-tab'));
            expect(tabs.map(t => t.getAttribute('data-phase'))).toEqual(['spec', 'plan', 'tasks']);
            expect(c.querySelector('[data-phase="implement"]')).toBeNull();
            expect(c.querySelector('[data-phase="mark-complete"]')).toBeNull();
        } finally {
            cleanup(c);
        }
    });

    it('hides custom action-only steps while keeping the workflow\'s document steps', () => {
        const c = renderBar(baseNav({
            coreDocs: [
                actionDoc('discuss', 'Discuss'),
                doc('plan', true, 'Plan Phase'),
                actionDoc('execute', 'Execute'),
                doc('verify-report', false, 'Verify Report'),
            ],
            currentDoc: 'plan',
        }));
        try {
            const tabs = Array.from(c.querySelectorAll('.step-tab'));
            expect(tabs.map(t => t.getAttribute('data-phase'))).toEqual(['plan', 'verify-report']);
        } finally {
            cleanup(c);
        }
    });

    it('every rail entry opens a document on click', () => {
        const c = renderBar(baseNav());
        try {
            for (const tab of Array.from(c.querySelectorAll<HTMLButtonElement>('.step-tab'))) {
                expect(tab.disabled).toBe(false);
                tab.click();
                expect(postMessage).toHaveBeenLastCalledWith({
                    type: 'stepperClick',
                    phase: tab.getAttribute('data-phase'),
                });
            }
        } finally {
            cleanup(c);
        }
    });

    it('shows the live implement percent on the last document tab', () => {
        viewerState.value = {
            status: 'implementing', highlights: ['specify', 'plan', 'tasks'], activeSubstep: null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        const c = renderBar(baseNav({
            currentDoc: 'tasks',
            currentStep: 'implement',
            taskCompletionPercent: 45,
        }));
        try {
            const tasksTab = c.querySelector('[data-phase="tasks"]')!;
            const pct = tasksTab.querySelector('.step-tab__percent');
            expect(pct).not.toBeNull();
            expect(pct!.textContent).toContain('45%');
            // The percent lives on the Tasks tab only — no other tab hosts it.
            expect(c.querySelectorAll('.step-tab__percent').length).toBe(1);
        } finally {
            cleanup(c);
        }
    });

    it('locks no document tab while a hidden action step is running', () => {
        const c = renderBar(baseNav({
            coreDocs: [
                doc('plan', true, 'Plan'),
                actionDoc('execute', 'Execute'),
                doc('verify-report', false, 'Verify Report'),
            ],
            currentDoc: 'plan',
            currentStep: 'execute',
            stepHistory: { execute: { startedAt: '2026-07-21T10:00:00Z', completedAt: null } },
        }));
        try {
            for (const tab of Array.from(c.querySelectorAll('.step-tab'))) {
                expect(tab.className).not.toContain('locked');
            }
        } finally {
            cleanup(c);
        }
    });

    it('keeps a hidden-parent artifact in a fallback group, labeled by that step', () => {
        const c = renderBar(baseNav({
            relatedDocs: [relatedDoc('impl-notes', 'implement', 'impl-notes.md')],
        }));
        try {
            const labels = Array.from(c.querySelectorAll('.rail-label')).map(l => l.textContent);
            expect(labels).toContain('Implement files');
            expect(c.querySelector('[data-doc="impl-notes"]')).not.toBeNull();
        } finally {
            cleanup(c);
        }
    });
});

describe('NavigationBar — artifacts nested under their step', () => {
    it('renders a step\'s artifact docs nested under that step, not in separate groups', () => {
        const c = renderBar(baseNav({
            coreDocs: [
                doc('spec', true, 'Specification'),
                doc('plan', true, 'Plan'),
                doc('tasks', true, 'Tasks'),
            ],
            relatedDocs: [
                relatedDoc('requirements', 'spec', 'Requirements'),
                relatedDoc('data-model', 'plan', 'Data Model'),
                relatedDoc('living-components', 'plan', 'Living Components'),
                relatedDoc('research', 'plan', 'Research'),
            ],
            currentDoc: 'plan',
        }));
        try {
            // No separate "<Step> files" group renders for a visible parent.
            const labels = Array.from(c.querySelectorAll('.rail-label')).map(l => l.textContent);
            expect(labels).toEqual(['Pipeline']);

            // Plan's three artifacts nest in the Plan step's own group.
            const planGroup = c.querySelector('[data-phase="plan"]')!.closest('.step-tab-group')!;
            const planChildren = Array.from(planGroup.querySelectorAll('.step-substeps .step-child'))
                .map(b => b.getAttribute('data-doc'));
            expect(planChildren).toEqual(['data-model', 'living-components', 'research']);

            // Specification's Requirements nests under the spec step.
            const specGroup = c.querySelector('[data-phase="spec"]')!.closest('.step-tab-group')!;
            const specChildren = Array.from(specGroup.querySelectorAll('.step-substeps .step-child'))
                .map(b => b.getAttribute('data-doc'));
            expect(specChildren).toEqual(['requirements']);
        } finally {
            cleanup(c);
        }
    });

    it('nests artifacts as a list (ul/li) for assistive tech', () => {
        const c = renderBar(baseNav({
            coreDocs: [doc('plan', true, 'Plan')],
            relatedDocs: [relatedDoc('data-model', 'plan', 'Data Model')],
            currentDoc: 'plan',
        }));
        try {
            const list = c.querySelector('.step-tab-group ul.step-substeps');
            expect(list).not.toBeNull();
            expect(list!.getAttribute('aria-label')).toBe('Plan files');
            expect(list!.querySelector('li > .step-child')).not.toBeNull();
        } finally {
            cleanup(c);
        }
    });

    it('keeps the Overview entry at the top, above the Pipeline group', () => {
        viewerState.value = {
            status: 'implementing', highlights: ['specify'], activeSubstep: null,
            intent: 'Ship the nested rail.',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        const c = renderBar(baseNav({
            activityPanelEnabled: true,
            relatedDocs: [relatedDoc('data-model', 'plan', 'Data Model')],
        }));
        try {
            const groups = Array.from(c.querySelectorAll('.rail-group'));
            // Overview group is first; its rail-overview button lives there.
            expect(groups[0].querySelector('.rail-overview')).not.toBeNull();
            expect(groups[1].querySelector('.rail-label')!.textContent).toBe('Pipeline');
        } finally {
            cleanup(c);
        }
    });

    it('opens the artifact document when a nested sub-item is clicked', () => {
        const c = renderBar(baseNav({
            coreDocs: [doc('plan', true, 'Plan')],
            relatedDocs: [relatedDoc('data-model', 'plan', 'Data Model')],
            currentDoc: 'plan',
        }));
        try {
            const child = c.querySelector<HTMLButtonElement>('.step-substeps [data-doc="data-model"]')!;
            child.click();
            expect(postMessage).toHaveBeenLastCalledWith({
                type: 'switchDocument',
                documentType: 'data-model',
            });
        } finally {
            cleanup(c);
        }
    });

    it('marks the nested sub-item active when it is the current document', () => {
        const c = renderBar(baseNav({
            coreDocs: [doc('plan', true, 'Plan')],
            relatedDocs: [relatedDoc('data-model', 'plan', 'Data Model')],
            currentDoc: 'data-model',
            isViewingRelatedDoc: true,
        }));
        try {
            const child = c.querySelector('.step-substeps [data-doc="data-model"]')!;
            expect(child.className).toContain('active');
            expect(child.getAttribute('aria-current')).toBe('page');
        } finally {
            cleanup(c);
        }
    });

    it('keeps the step tab opening its own document even with nested children', () => {
        const c = renderBar(baseNav({
            coreDocs: [doc('plan', true, 'Plan')],
            relatedDocs: [relatedDoc('data-model', 'plan', 'Data Model')],
            currentDoc: 'plan',
        }));
        try {
            c.querySelector<HTMLButtonElement>('[data-phase="plan"]')!.click();
            expect(postMessage).toHaveBeenLastCalledWith({ type: 'stepperClick', phase: 'plan' });
        } finally {
            cleanup(c);
        }
    });
});
