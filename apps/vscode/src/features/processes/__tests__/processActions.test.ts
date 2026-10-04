import { bugActions, commandForAction, commandForDocument, ideaActions, repeatsFromFolder, ReportActionId } from '../processActions';

const labels = (actions: { label: string; primary: boolean }[]) =>
    actions.map(action => `${action.primary ? 'main' : 'secondary'}: ${action.label}`);

describe('the buttons on a bug page', () => {
    it.each([
        ['waiting for a fix', { state: 'to-fix', stages: ['assessment'] }, ['main: Fix bug']],
        ['a fix that was not applied', { state: 'to-fix', stages: ['assessment', 'fix'] }, ['main: Fix bug']],
        ['a test that did not pass', { state: 'to-fix', stages: ['assessment', 'fix', 'test'] }, ['main: Fix bug', 'secondary: Test again']],
        ['waiting for a test', { state: 'to-test', stages: ['assessment', 'fix'] }, ['main: Test fix', 'secondary: Fix again']],
        ['verified', { state: 'verified', stages: ['assessment', 'fix', 'test'] }, ['secondary: Test again']],
        ['closed', { state: 'closed', stages: ['assessment'] }, ['secondary: Assess again']],
    ])('for a bug %s', (_name, bug, expected) => {
        expect(labels(bugActions(bug as Parameters<typeof bugActions>[0]))).toEqual(expected);
    });

    it('never offers two main buttons', () => {
        for (const state of ['to-fix', 'to-test', 'verified', 'closed'] as const) {
            const actions = bugActions({ state, stages: ['assessment', 'fix', 'test'] });
            expect(actions.filter(action => action.primary).length).toBeLessThanOrEqual(1);
        }
    });
});

describe('the buttons on an idea page', () => {
    it.each([
        ['intake', 'main: Research', 'idea.research'],
        ['research', 'main: Define the problem', 'idea.define'],
        ['problem', 'main: Shape a concept', 'idea.shape'],
        ['concept', 'main: Decide', 'idea.decide'],
    ])('names the stage after %s while assessing', (latestStage, label, id) => {
        const actions = ideaActions({ state: 'assessing', latestStage, verdict: undefined } as Parameters<typeof ideaActions>[0]);
        expect(labels(actions)).toEqual([label]);
        expect(actions[0].id).toBe(id);
    });

    it.each([
        ['go', ['main: Create spec from this idea']],
        ['needs-clarification', ['main: Continue assessment']],
        ['kill', ['secondary: Reopen from intake']],
        [undefined, ['main: Decide']],
    ])('follows the verdict %p once decided', (verdict, expected) => {
        const actions = ideaActions({ state: 'decided', latestStage: 'decision', verdict } as Parameters<typeof ideaActions>[0]);
        expect(labels(actions)).toEqual(expected);
    });
});

describe('the command an action sends', () => {
    it.each([
        ['bug.assess', 'speckit.bug.assess'],
        ['bug.fix', 'speckit.bug.fix'],
        ['bug.test', 'speckit.bug.test'],
        ['idea.intake', 'speckit.assess.intake'],
        ['idea.research', 'speckit.assess.research'],
        ['idea.define', 'speckit.assess.define'],
        ['idea.shape', 'speckit.assess.shape'],
        ['idea.decide', 'speckit.assess.decide'],
    ])('%s sends %s', (id, command) => {
        expect(commandForAction(id as ReportActionId)).toBe(command);
    });

    it.each(['idea.createSpec', 'constructor', 'toString', '__proto__', 'bug.delete'])(
        'is nothing for %p',
        id => {
            expect(commandForAction(id as ReportActionId)).toBeUndefined();
        },
    );

    it('knows which actions start over from the existing folder', () => {
        expect(repeatsFromFolder('bug.assess')).toBe(true);
        expect(repeatsFromFolder('idea.intake')).toBe(true);
        expect(repeatsFromFolder('bug.fix')).toBe(false);
    });
});

describe('the command that wrote a report', () => {
    it.each([
        ['bug', 'assessment', 'speckit.bug.assess'],
        ['bug', 'fix', 'speckit.bug.fix'],
        ['bug', 'test', 'speckit.bug.test'],
        ['idea', 'intake', 'speckit.assess.intake'],
        ['idea', 'research', 'speckit.assess.research'],
        ['idea', 'problem', 'speckit.assess.define'],
        ['idea', 'concept', 'speckit.assess.shape'],
        ['idea', 'decision', 'speckit.assess.decide'],
    ] as const)('for a %s %s is %s', (kind, document, command) => {
        expect(commandForDocument(kind, document)).toBe(command);
    });

    it.each([
        ['bug', 'story'],
        ['bug', 'intake'],
        ['idea', 'assessment'],
        ['idea', 'constructor'],
    ] as const)('is none for a %s %s', (kind, document) => {
        expect(commandForDocument(kind, document)).toBeUndefined();
    });
});
