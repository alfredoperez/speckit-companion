/**
 * Mock data factories for Storybook stories.
 */

import type { SpecDocument, NavState, StalenessMap } from '../../types';

export function mockDoc(type: string, exists: boolean, label?: string): SpecDocument {
    return {
        type,
        label: label ?? type.charAt(0).toUpperCase() + type.slice(1),
        fileName: `${type}.md`,
        filePath: `/workspace/specs/my-feature/${type}.md`,
        exists,
        isCore: true,
        category: 'core',
    };
}

export function mockRelatedDoc(type: string, parentStep: string, label?: string): SpecDocument {
    return {
        type,
        label: label ?? type.charAt(0).toUpperCase() + type.slice(1),
        fileName: `${type}.md`,
        filePath: `/workspace/specs/my-feature/${type}.md`,
        exists: true,
        isCore: false,
        category: 'related',
        parentStep,
    };
}

export function mockNavState(overrides: Partial<NavState> = {}): NavState {
    return {
        coreDocs: [
            mockDoc('spec', true, 'Specification'),
            mockDoc('plan', true, 'Plan'),
            mockDoc('tasks', true, 'Tasks'),
        ],
        relatedDocs: [],
        currentDoc: 'spec',
        workflowPhase: 'spec',
        taskCompletionPercent: 0,
        isViewingRelatedDoc: false,
        footerState: {
            showApproveButton: false,
            approveText: '',
            enhancementButtons: [],
            specStatus: 'active',
        },
        specStatus: 'active',
        activeStep: null,
        stepHistory: undefined,
        badgeText: 'ACTIVE',
        createdDate: 'Apr 4, 2026',
        lastUpdatedDate: null,
        specContextName: 'My Feature',
        branch: 'main',
        filePath: '/workspace/specs/my-feature/spec.md',
        docTypeLabel: 'Spec',
        ...overrides,
    };
}

export const stalePlan: StalenessMap = {
    plan: { isStale: true, staleReason: 'Plan is outdated — spec.md was modified after plan.md', newerUpstream: 'spec' },
};
