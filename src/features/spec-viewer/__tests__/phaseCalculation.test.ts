/**
 * Tests for the pure helpers in `phaseCalculation.ts`.
 *
 * Same shape as `panelStateComputer.test.ts`: every function is already
 * pure (no `vscode` import, no I/O), so the tests run against literal
 * inputs without any mocking. Adding coverage here applies the canonical
 * pure-derivation pattern that the rest of the refactor consolidated
 * elsewhere — these were the last meaningful viewer helpers without
 * Jest tests.
 */

import {
    calculateTaskCompletion,
    calculateWorkflowPhase,
    canonicalStatusLabel,
    computeBadgeText,
    computeCreatedDate,
    computeLastUpdatedDate,
    getDocTypeLabel,
    getPhaseNumber,
    mapSddStepToTab,
} from '../phaseCalculation';
import { CORE_DOCUMENTS, SpecDocument } from '../types';
import { WorkflowSteps } from '../../../core/constants';

function doc(overrides: Partial<SpecDocument> = {}): SpecDocument {
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

describe('getPhaseNumber', () => {
    it('returns 1 for spec, 2 for plan, 3 for tasks when no stepNames given', () => {
        expect(getPhaseNumber(CORE_DOCUMENTS.SPEC)).toBe(1);
        expect(getPhaseNumber(CORE_DOCUMENTS.PLAN)).toBe(2);
        expect(getPhaseNumber(CORE_DOCUMENTS.TASKS)).toBe(3);
    });

    it('falls back to 1 for unknown types', () => {
        expect(getPhaseNumber('unknown' as never)).toBe(1);
    });

    it('uses the dynamic stepNames index when provided', () => {
        const steps = ['research', 'design', 'build', 'verify'];
        expect(getPhaseNumber('design', steps)).toBe(2);
        expect(getPhaseNumber('build', steps)).toBe(3);
    });
});

describe('calculateTaskCompletion', () => {
    it('returns 0 when the doc type is not tasks', () => {
        expect(calculateTaskCompletion('- [x] done\n- [x] done', CORE_DOCUMENTS.SPEC)).toBe(0);
    });

    it('returns 0 when content is empty', () => {
        expect(calculateTaskCompletion('', CORE_DOCUMENTS.TASKS)).toBe(0);
    });

    it('returns 0 when no checkboxes are found', () => {
        expect(calculateTaskCompletion('# Just headings\nNo checkboxes here.', CORE_DOCUMENTS.TASKS)).toBe(0);
    });

    it('counts uppercase X as completed', () => {
        expect(calculateTaskCompletion('- [X] one\n- [ ] two', CORE_DOCUMENTS.TASKS)).toBe(50);
    });

    it('rounds the percentage', () => {
        // 1/3 = 33.33… → rounds to 33
        expect(calculateTaskCompletion('- [x] a\n- [ ] b\n- [ ] c', CORE_DOCUMENTS.TASKS)).toBe(33);
    });

    it('returns 100 when all checkboxes are complete', () => {
        expect(calculateTaskCompletion('- [x] a\n- [x] b\n- [x] c', CORE_DOCUMENTS.TASKS)).toBe(100);
    });
});

describe('calculateWorkflowPhase', () => {
    it('returns the type of the last existing core doc', () => {
        const docs = [
            doc({ type: CORE_DOCUMENTS.SPEC, exists: true }),
            doc({ type: CORE_DOCUMENTS.PLAN, exists: true, fileName: 'plan.md' }),
            doc({ type: CORE_DOCUMENTS.TASKS, exists: false, fileName: 'tasks.md' }),
        ];
        expect(calculateWorkflowPhase(docs)).toBe(CORE_DOCUMENTS.PLAN);
    });

    it('falls back to the first doc type when none exist', () => {
        const docs = [
            doc({ type: CORE_DOCUMENTS.SPEC, exists: false }),
            doc({ type: CORE_DOCUMENTS.PLAN, exists: false, fileName: 'plan.md' }),
        ];
        expect(calculateWorkflowPhase(docs)).toBe(CORE_DOCUMENTS.SPEC);
    });

    it('returns CORE_DOCUMENTS.SPEC for an empty list', () => {
        expect(calculateWorkflowPhase([])).toBe(CORE_DOCUMENTS.SPEC);
    });
});

describe('mapSddStepToTab', () => {
    it('collapses tasks and implement onto the tasks tab', () => {
        // Single-tab-for-two-steps aliasing — the same invariant that
        // mapStepHistoryToTabKeys relies on. Pin it here.
        expect(mapSddStepToTab(WorkflowSteps.TASKS)).toBe(CORE_DOCUMENTS.TASKS);
        expect(mapSddStepToTab(WorkflowSteps.IMPLEMENT)).toBe(CORE_DOCUMENTS.TASKS);
    });

    it('returns null for nullish / unknown steps', () => {
        expect(mapSddStepToTab(null)).toBeNull();
        expect(mapSddStepToTab(undefined)).toBeNull();
        expect(mapSddStepToTab('unknown')).toBeNull();
    });
});

describe('computeCreatedDate', () => {
    it('returns null when stepHistory is missing', () => {
        expect(computeCreatedDate(null)).toBeNull();
        expect(computeCreatedDate(undefined)).toBeNull();
    });

    it('prefers specify.startedAt when present', () => {
        const history = {
            specify: { startedAt: '2026-04-01T12:00:00Z' },
            plan: { startedAt: '2026-04-02T12:00:00Z' },
        };
        expect(computeCreatedDate(history)).toBe('Apr 1, 2026');
    });

    it('falls back to earliest startedAt across all steps', () => {
        const history = {
            plan: { startedAt: '2026-04-05T12:00:00Z' },
            tasks: { startedAt: '2026-04-03T12:00:00Z' },
        };
        expect(computeCreatedDate(history)).toBe('Apr 3, 2026');
    });

    it('returns null when no startedAt is present anywhere', () => {
        expect(computeCreatedDate({ plan: {} })).toBeNull();
    });
});

describe('computeLastUpdatedDate', () => {
    it('returns null when stepHistory has 0–1 timestamps (same as created or nothing)', () => {
        expect(computeLastUpdatedDate(undefined)).toBeNull();
        expect(computeLastUpdatedDate({ specify: { startedAt: '2026-04-01T12:00:00Z' } })).toBeNull();
    });

    it('returns the latest timestamp across both startedAt and completedAt', () => {
        const history = {
            specify: { startedAt: '2026-04-01T12:00:00Z', completedAt: '2026-04-02T09:00:00Z' },
            plan: { startedAt: '2026-04-03T12:00:00Z' },
        };
        expect(computeLastUpdatedDate(history)).toBe('Apr 3, 2026');
    });
});

describe('getDocTypeLabel', () => {
    it('maps the canonical steps to human-readable labels', () => {
        expect(getDocTypeLabel(WorkflowSteps.SPECIFY)).toBe('Spec');
        expect(getDocTypeLabel(WorkflowSteps.PLAN)).toBe('Plan');
        expect(getDocTypeLabel(WorkflowSteps.TASKS)).toBe('Tasks');
        expect(getDocTypeLabel(WorkflowSteps.IMPLEMENT)).toBe('Implementation');
    });

    it('title-cases unknown steps', () => {
        expect(getDocTypeLabel('research')).toBe('Research');
    });

    it('returns "Spec" for nullish input', () => {
        expect(getDocTypeLabel(null)).toBe('Spec');
        expect(getDocTypeLabel(undefined)).toBe('Spec');
    });
});

describe('canonicalStatusLabel', () => {
    it('maps known statuses to their badge text', () => {
        expect(canonicalStatusLabel('draft')).toBe('DRAFT');
        expect(canonicalStatusLabel('completed')).toBe('COMPLETED');
        expect(canonicalStatusLabel('ready-to-implement')).toBe('READY TO IMPLEMENT');
    });

    it('returns null for unknown / missing statuses', () => {
        expect(canonicalStatusLabel('mystery')).toBeNull();
        expect(canonicalStatusLabel(null)).toBeNull();
    });
});

describe('computeBadgeText (integration with derived inputs)', () => {
    it('returns null when ctx is null', () => {
        expect(computeBadgeText(null)).toBeNull();
    });

    it('emits the canonical status label when status is set', () => {
        expect(computeBadgeText({ status: 'completed' })).toBe('COMPLETED');
    });
});
