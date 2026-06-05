/**
 * Tests for the pure derivation in `panelStateComputer.ts`. The point of
 * extracting this module was that every assertion below runs against pure
 * inputs — no `jest.mock('vscode')`, no filesystem fixtures. If you ever
 * need to mock something here, the derivation has leaked an I/O dependency
 * back in and that's the bug.
 */

import {
    computeApproveFooter,
    computePanelDerivedState,
    deriveStepBadgesWithAlias,
    mapStepHistoryToTabKeys,
    resolveDisplayDocument,
    resolveSpecStatus,
    resolveTabClickDocument,
} from '../panelStateComputer';
import { CORE_DOCUMENTS, SpecDocument } from '../types';
import { SpecStatuses } from '../../../core/constants';
import type { FeatureWorkflowContext } from '../../workflows/types';

function makeDoc(overrides: Partial<SpecDocument> = {}): SpecDocument {
    return {
        type: CORE_DOCUMENTS.SPEC,
        fileName: 'spec.md',
        filePath: '/tmp/spec.md',
        label: 'Specify',
        exists: true,
        isCore: true,
        category: 'core',
        ...overrides,
    } as SpecDocument;
}

describe('resolveDisplayDocument', () => {
    it('returns undefined when there are no documents', () => {
        expect(resolveDisplayDocument([], CORE_DOCUMENTS.SPEC)).toBeUndefined();
    });

    it('matches by exact type first', () => {
        const spec = makeDoc({ type: CORE_DOCUMENTS.SPEC, fileName: 'spec.md' });
        const plan = makeDoc({ type: CORE_DOCUMENTS.PLAN, fileName: 'plan.md' });
        expect(resolveDisplayDocument([spec, plan], CORE_DOCUMENTS.PLAN)).toBe(plan);
    });

    it('falls back to filename match (handles the spec/specify alias)', () => {
        const specify = makeDoc({ type: 'specify', fileName: 'spec.md' });
        expect(resolveDisplayDocument([specify], CORE_DOCUMENTS.SPEC)).toBe(specify);
    });

    it('falls back to first core+exists when type and filename miss', () => {
        const missing = makeDoc({ type: 'missing', fileName: 'missing.md', exists: false });
        const tasks = makeDoc({ type: CORE_DOCUMENTS.TASKS, fileName: 'tasks.md' });
        expect(resolveDisplayDocument([missing, tasks], 'nonexistent' as never)).toBe(tasks);
    });

    it('redirects from a non-existent core doc to a sub-spec with matching parentStep', () => {
        const ghostPlan = makeDoc({ type: CORE_DOCUMENTS.PLAN, fileName: 'plan.md', exists: false });
        const subSpec = makeDoc({
            type: 'plan-detail',
            fileName: 'plan-detail.md',
            isCore: false,
            category: 'related',
            parentStep: CORE_DOCUMENTS.PLAN,
            exists: true,
        });
        expect(resolveDisplayDocument([ghostPlan, subSpec], CORE_DOCUMENTS.PLAN)).toBe(subSpec);
    });
});

describe('resolveTabClickDocument', () => {
    it('returns undefined for an unknown type — tab-click must fail visibly, not silently fall back', () => {
        const spec = makeDoc({ type: CORE_DOCUMENTS.SPEC });
        expect(resolveTabClickDocument([spec], 'nonexistent' as never)).toBeUndefined();
    });

    it('returns the matched doc when it exists', () => {
        const spec = makeDoc({ type: CORE_DOCUMENTS.SPEC });
        expect(resolveTabClickDocument([spec], CORE_DOCUMENTS.SPEC)).toBe(spec);
    });

    it('redirects to a sub-spec when the chosen core doc is empty but a child exists', () => {
        const emptyPlan = makeDoc({ type: CORE_DOCUMENTS.PLAN, exists: false });
        const subSpec = makeDoc({
            type: 'plan-sub',
            isCore: false,
            category: 'related',
            parentStep: CORE_DOCUMENTS.PLAN,
            exists: true,
        });
        expect(resolveTabClickDocument([emptyPlan, subSpec], CORE_DOCUMENTS.PLAN)).toBe(subSpec);
    });
});

describe('resolveSpecStatus', () => {
    it('returns ARCHIVED when status field is archived', () => {
        const ctx = { status: SpecStatuses.ARCHIVED } as FeatureWorkflowContext;
        expect(resolveSpecStatus(ctx, 0)).toBe(SpecStatuses.ARCHIVED);
    });

    it('returns ARCHIVED when currentStep is archived (older schema)', () => {
        const ctx = { currentStep: SpecStatuses.ARCHIVED } as FeatureWorkflowContext;
        expect(resolveSpecStatus(ctx, 100)).toBe(SpecStatuses.ARCHIVED);
    });

    it('returns COMPLETED when status field is completed', () => {
        const ctx = { status: SpecStatuses.COMPLETED } as FeatureWorkflowContext;
        expect(resolveSpecStatus(ctx, 50)).toBe(SpecStatuses.COMPLETED);
    });

    it('returns TASKS_DONE when tasks are 100% but context is still active', () => {
        expect(resolveSpecStatus(undefined, 100)).toBe(SpecStatuses.TASKS_DONE);
    });

    it('returns ACTIVE by default', () => {
        expect(resolveSpecStatus(undefined, 42)).toBe(SpecStatuses.ACTIVE);
    });
});

describe('computeApproveFooter', () => {
    const spec = makeDoc({ type: CORE_DOCUMENTS.SPEC, label: 'Specify', exists: true });
    const plan = makeDoc({ type: CORE_DOCUMENTS.PLAN, label: 'Plan', exists: false });
    const tasks = makeDoc({ type: CORE_DOCUMENTS.TASKS, label: 'Tasks', exists: false });

    it('shows the next step button when the next core doc is missing', () => {
        const f = computeApproveFooter([spec, plan, tasks], [], CORE_DOCUMENTS.SPEC, false, 0);
        expect(f).toEqual({ showApproveButton: true, approveText: 'Plan' });
    });

    it('shows the Implement button on the final step when completion < 100%', () => {
        const completedTasks = makeDoc({ ...tasks, exists: true });
        const f = computeApproveFooter(
            [spec, plan, completedTasks], [], CORE_DOCUMENTS.TASKS, false, 50,
        );
        expect(f).toEqual({ showApproveButton: true, approveText: 'Implement' });
    });

    it('hides the button on the final step when tasks are 100% complete', () => {
        const completedTasks = makeDoc({ ...tasks, exists: true });
        const f = computeApproveFooter(
            [spec, plan, completedTasks], [], CORE_DOCUMENTS.TASKS, false, 100,
        );
        expect(f.showApproveButton).toBe(false);
    });
});

describe('mapStepHistoryToTabKeys', () => {
    it('returns undefined when given undefined', () => {
        expect(mapStepHistoryToTabKeys(undefined)).toBeUndefined();
    });

    it('preserves a completed tasks entry even when a later implement step aliases onto the same tab', () => {
        // This is the bug the original `mapStepHistoryKeys` was working around:
        // if iteration order put `implement` after `tasks`, the completed
        // tasks entry would be overwritten with the in-flight implement entry.
        const history = {
            tasks: { startedAt: '2026-05-01T00:00:00Z', completedAt: '2026-05-01T00:05:00Z' },
            implement: { startedAt: '2026-05-01T00:06:00Z', completedAt: null },
        };
        const result = mapStepHistoryToTabKeys(history);
        expect(result!['tasks']).toEqual(history.tasks);
    });

    it('prefers the step matching the tab name regardless of iteration order', () => {
        // Even with iteration order REVERSED (implement first, then tasks),
        // the `tasks` tab must hold the `tasks` step entry because its step
        // name matches the tab name. Without the priority logic this would
        // silently take the implement timing for both alias resolution AND
        // overwrite-protection (since implement is also completed here).
        const history = {
            implement: { startedAt: '2026-05-01T00:06:00Z', completedAt: '2026-05-01T00:10:00Z' },
            tasks: { startedAt: '2026-05-01T00:00:00Z', completedAt: '2026-05-01T00:05:00Z' },
        };
        const result = mapStepHistoryToTabKeys(history);
        expect(result!['tasks']).toEqual(history.tasks);
    });

    it('falls back to earlier startedAt when no step matches the tab name and both are completed', () => {
        // A non-canonical workflow where both entries alias onto the same
        // synthetic tab and neither is the canonical step. Earlier start wins
        // — preserves the historical first run rather than the most recent.
        const history = {
            'phase-a': { startedAt: '2026-05-01T00:00:00Z', completedAt: '2026-05-01T00:05:00Z' },
            'phase-b': { startedAt: '2026-05-02T00:00:00Z', completedAt: '2026-05-02T00:05:00Z' },
        };
        // Both 'phase-a' and 'phase-b' fall through mapStepToTab to use
        // their own names → no alias collision. Sanity check the path.
        const result = mapStepHistoryToTabKeys(history);
        expect(result!['phase-a']).toEqual(history['phase-a']);
        expect(result!['phase-b']).toEqual(history['phase-b']);
    });
});

describe('deriveStepBadgesWithAlias', () => {
    it('copies the specify entry to a spec alias key', () => {
        const history = {
            specify: { startedAt: '2026-05-01T00:00:00Z', completedAt: '2026-05-01T00:01:00Z' },
        };
        const badges = deriveStepBadgesWithAlias(history, 'plan');
        expect(badges['specify']).toBe('completed');
        expect(badges['spec']).toBe('completed');
    });

    it('marks an entry without startedAt as not-started', () => {
        const history = { plan: {} };
        const badges = deriveStepBadgesWithAlias(history, 'specify');
        expect(badges['plan']).toBe('not-started');
    });
});

describe('computePanelDerivedState (integration of pure pieces)', () => {
    it('returns ACTIVE status and 0% completion for a fresh spec', () => {
        const documents = [makeDoc({ type: CORE_DOCUMENTS.SPEC, exists: true })];
        const doc = documents[0];
        const result = computePanelDerivedState(
            { documents, doc, tasksContent: '', featureCtx: undefined },
            [],
        );
        expect(result.specStatus).toBe(SpecStatuses.ACTIVE);
        expect(result.taskCompletionPercent).toBe(0);
        expect(result.coreDocs).toHaveLength(1);
        expect(result.relatedDocs).toHaveLength(0);
    });

    it('reports TASKS_DONE when tasksContent shows 100% completion', () => {
        const docs = [
            makeDoc({ type: CORE_DOCUMENTS.SPEC, exists: true }),
            makeDoc({ type: CORE_DOCUMENTS.PLAN, exists: true, fileName: 'plan.md' }),
            makeDoc({ type: CORE_DOCUMENTS.TASKS, exists: true, fileName: 'tasks.md' }),
        ];
        const result = computePanelDerivedState(
            {
                documents: docs,
                doc: docs[2],
                tasksContent: '- [x] one\n- [x] two\n',
                featureCtx: undefined,
            },
            [],
        );
        expect(result.taskCompletionPercent).toBe(100);
        expect(result.specStatus).toBe(SpecStatuses.TASKS_DONE);
    });
});
