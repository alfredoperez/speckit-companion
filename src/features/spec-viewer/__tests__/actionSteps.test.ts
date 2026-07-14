import {
    computePanelDerivedState,
    resolveDisplayDocument,
    resolveTabClickDocument,
} from '../panelStateComputer';
import { customCommandButtons } from '../optionalCommands';
import { isStalenessRelevant } from '../staleness';
import { commandMatchesStep, normalizeCustomCommand } from '../customCommands';
import type { SpecDocument } from '../types';

function doc(overrides: Partial<SpecDocument> & Pick<SpecDocument, 'type'>): SpecDocument {
    return {
        label: overrides.type,
        fileName: `${overrides.type}.md`,
        filePath: `/spec/${overrides.type}.md`,
        exists: true,
        isCore: true,
        category: 'core',
        ...overrides,
    };
}

function actionDoc(type: string, label = type): SpecDocument {
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

// GSD shape: discuss(action) → plan(doc) → execute(action) → verify(action)
const gsdDocs: SpecDocument[] = [
    actionDoc('discuss', 'Discuss'),
    doc({ type: 'plan', label: 'Plan Phase' }),
    actionDoc('execute', 'Execute (Superpowers)'),
    actionDoc('verify', 'Verify'),
    doc({ type: 'phase-plan', label: '01 01 Plan', isCore: false, category: 'related', parentStep: 'plan' }),
];

describe('pipeline partition with action steps', () => {
    it('pipelineDocs keeps workflow order; related docs stay out of it', () => {
        const derived = computePanelDerivedState(
            { documents: gsdDocs, doc: gsdDocs[1], tasksContent: '', featureCtx: undefined },
            [],
        );
        expect(derived.pipelineDocs.map(d => d.type)).toEqual(['discuss', 'plan', 'execute', 'verify']);
        expect(derived.relatedDocs.map(d => d.type)).toEqual(['phase-plan']);
    });

    it('footer derivation is unchanged by the presence of action entries', () => {
        const withActions = computePanelDerivedState(
            { documents: gsdDocs, doc: gsdDocs[1], tasksContent: '', featureCtx: undefined },
            [],
        );
        const withoutActions = computePanelDerivedState(
            {
                documents: gsdDocs.filter(d => d.category !== 'action'),
                doc: gsdDocs[1],
                tasksContent: '',
                featureCtx: undefined,
            },
            [],
        );
        expect(withActions.footer).toEqual(withoutActions.footer);
        expect(withActions.workflowPhase).toEqual(withoutActions.workflowPhase);
    });
});

describe('display resolution never lands on an action entry', () => {
    it('resolveDisplayDocument skips actions in every cascade branch', () => {
        expect(resolveDisplayDocument(gsdDocs, 'discuss')?.type).toBe('plan');
        expect(resolveDisplayDocument(gsdDocs, 'plan')?.type).toBe('plan');
        const onlyActions = [actionDoc('discuss'), actionDoc('verify')];
        expect(resolveDisplayDocument(onlyActions, 'discuss')).toBeUndefined();
        // documents[0] fallback must pick the first openable doc, not the action
        const noMatch = [actionDoc('discuss'), doc({ type: 'notes', isCore: false, category: 'related' })];
        expect(resolveDisplayDocument(noMatch, 'nonexistent')?.type).toBe('notes');
    });

    it('resolveTabClickDocument returns undefined for an action type', () => {
        expect(resolveTabClickDocument(gsdDocs, 'execute')).toBeUndefined();
        expect(resolveTabClickDocument(gsdDocs, 'plan')?.type).toBe('plan');
    });
});

describe('customCommandButtons — action-step scoping', () => {
    // Mirrors examples/todo-gsd-superpowers customCommands
    const rawCommands = [
        { name: 'new-project', title: 'GSD New Project', command: '/gsd-new-project', step: 'discuss' },
        { name: 'gap-check', title: 'Plan Gaps', command: '/gsd-plan-phase --gaps', step: 'verify' },
        { name: 'always', title: 'Always', command: '/always-on', step: 'all' },
    ];

    it('surfaces a command scoped to an action-only step while the workflow sits at it', () => {
        const atDiscuss = customCommandButtons(rawCommands, 'plan', new Set(), 'discuss');
        expect(atDiscuss.map(b => b.command)).toEqual(['/gsd-new-project', '/always-on']);

        const atVerify = customCommandButtons(rawCommands, 'plan', new Set(), 'verify');
        expect(atVerify.map(b => b.command)).toEqual(['/gsd-plan-phase --gaps', '/always-on']);
    });

    it('keeps document-scoped and all-scoped matching intact without a currentStep', () => {
        const buttons = customCommandButtons(rawCommands, 'verify', new Set());
        expect(buttons.map(b => b.command)).toEqual(['/gsd-plan-phase --gaps', '/always-on']);
    });
});

describe('staleness relevance', () => {
    it('goes quiet once the spec settles — a finished spec cannot be stale', () => {
        expect(isStalenessRelevant('completed')).toBe(false);
        expect(isStalenessRelevant('archived')).toBe(false);
    });

    it('still flags a live spec whose plan trails its spec', () => {
        expect(isStalenessRelevant('planned')).toBe(true);
        expect(isStalenessRelevant('implementing')).toBe(true);
        expect(isStalenessRelevant(undefined)).toBe(true);
    });
});

describe('commandMatchesStep — the render and dispatch paths agree', () => {
    it('matches an action-only step by currentStep, since it has no document', () => {
        // The bug this closes: the button rendered (render path matched
        // currentStep) but an implicit dispatch could not resolve it (dispatch
        // path matched only docType), so the two paths disagreed.
        expect(commandMatchesStep('discuss', 'plan', 'discuss')).toBe(true);
        expect(commandMatchesStep('discuss', 'plan', 'plan')).toBe(false);
    });

    it('keeps document scoping and the all-wildcard intact', () => {
        expect(commandMatchesStep('plan', 'plan')).toBe(true);
        expect(commandMatchesStep('all', 'anything')).toBe(true);
        expect(commandMatchesStep(undefined, 'anything')).toBe(true);
        expect(commandMatchesStep('spec', 'plan')).toBe(false);
    });
});

describe('normalizeCustomCommand', () => {
    it('derives the command from a bare name and drops entries with neither', () => {
        expect(normalizeCustomCommand({ name: 'clarify' })?.command).toBe('/speckit.clarify');
        expect(normalizeCustomCommand({ command: '/custom', name: 'x' })?.command).toBe('/custom');
        expect(normalizeCustomCommand({} as never)).toBeUndefined();
        expect(normalizeCustomCommand('legacy-string-entry')).toBeUndefined();
    });
});
