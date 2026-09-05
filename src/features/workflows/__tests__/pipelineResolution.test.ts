import * as path from 'path';
import { COMPANION_WORKFLOW, DEFAULT_WORKFLOW } from '../workflowManager';
import { resolveCompanionSteps, resolveSpecPipeline, shouldRecordStepStart } from '../pipelineResolution';

const FIXTURES = path.join(__dirname, '../../../../tests/fixtures');
const WITH_STEPS = path.join(FIXTURES, 'project-steps');
const EMPTY = path.join(FIXTURES, 'project-steps-empty');

describe('resolveCompanionSteps', () => {
    it('returns the shipped pipeline unchanged when the project added nothing (SC-003)', () => {
        expect(resolveCompanionSteps(EMPTY)).toEqual(COMPANION_WORKFLOW.steps);
        expect(resolveCompanionSteps(undefined)).toEqual(COMPANION_WORKFLOW.steps);
    });

    it('never mutates COMPANION_WORKFLOW', () => {
        const before = JSON.stringify(COMPANION_WORKFLOW);
        resolveCompanionSteps(WITH_STEPS);
        resolveCompanionSteps(EMPTY);
        expect(JSON.stringify(COMPANION_WORKFLOW)).toBe(before);
    });

    it('places a step after the step it names, with mark-complete still last', () => {
        expect(resolveCompanionSteps(WITH_STEPS).map(s => s.name)).toEqual([
            'specify',
            'research-check',
            'plan',
            'tasks',
            'implement',
            'bench-run',
            'code-review',
            'mark-complete',
        ]);
    });

    it('orders two steps naming the same after by directory name, stably (edge case)', () => {
        const once = resolveCompanionSteps(WITH_STEPS).map(s => s.name);
        const twice = resolveCompanionSteps(WITH_STEPS).map(s => s.name);
        expect(once).toEqual(twice);
        expect(once.indexOf('bench-run')).toBeLessThan(once.indexOf('code-review'));
    });

    it('omits an unplaced step and one naming a step outside the shipped four (FR-003)', () => {
        const names = resolveCompanionSteps(WITH_STEPS).map(s => s.name);
        expect(names).not.toContain('hand-run');
        expect(names).not.toContain('garbled');
    });

    it('gives an added step its own command, and a document when it declares one (FR-004)', () => {
        const steps = resolveCompanionSteps(WITH_STEPS);
        const review = steps.find(s => s.name === 'code-review');
        expect(review).toMatchObject({
            label: 'Code Review',
            command: 'speckit.companion.code-review',
            file: 'review.md',
        });
        expect(review?.actionOnly).toBeUndefined();
        expect(review?.untimed).toBeUndefined();

        const check = steps.find(s => s.name === 'research-check');
        expect(check).toMatchObject({ command: 'speckit.companion.research-check', actionOnly: true });
        expect(check?.file).toBeUndefined();
    });

    it('writes nothing to the settings key this feature must not touch (SC-005)', () => {
        const vscode = require('vscode');
        const update = jest.fn();
        const original = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = jest.fn(() => ({ get: () => undefined, update }));
        try {
            resolveCompanionSteps(WITH_STEPS);
        } finally {
            vscode.workspace.getConfiguration = original;
        }
        expect(update).not.toHaveBeenCalled();
    });
});

describe('shouldRecordStepStart', () => {
    const companion = resolveCompanionSteps(WITH_STEPS);

    it('records a start for a shipped step and for the project\'s added step', () => {
        expect(shouldRecordStepStart(companion, 'plan')).toBe(true);
        expect(shouldRecordStepStart(companion, 'code-review')).toBe(true);
    });

    it('refuses a start for the untimed mark-complete step', () => {
        expect(shouldRecordStepStart(companion, 'mark-complete')).toBe(false);
    });

    it('refuses a start for a user-workflow step and for a step outside the pipeline', () => {
        const userSteps = [{ name: 'discuss', command: 'gsd.discuss' }];
        expect(shouldRecordStepStart(userSteps, 'discuss')).toBe(false);
        expect(shouldRecordStepStart(companion, 'nowhere')).toBe(false);
        expect(shouldRecordStepStart(companion, undefined)).toBe(false);
    });

    it('still records the side commands that never appear in a pipeline', () => {
        expect(shouldRecordStepStart(companion, 'clarify')).toBe(true);
        expect(shouldRecordStepStart(companion, 'analyze')).toBe(true);
    });
});

describe('resolveSpecPipeline', () => {
    const fs = require('fs');
    const os = require('os');
    let tmp: string;

    function specWith(workflow: string): string {
        const dir = path.join(tmp, workflow);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, '.spec-context.json'),
            JSON.stringify({ workflow, selectedAt: '2026-01-01T00:00:00Z' }),
        );
        return dir;
    }

    beforeAll(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-resolution-'));
        const vscode = require('vscode');
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: WITH_STEPS } }];
    });

    afterAll(() => {
        const vscode = require('vscode');
        vscode.workspace.workspaceFolders = undefined;
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('splices the project steps into a Companion spec', async () => {
        const steps = await resolveSpecPipeline(specWith('companion'));
        expect(steps.map(s => s.name)).toContain('code-review');
    });

    it('leaves a stock SpecKit spec untouched (FR-008)', async () => {
        const steps = await resolveSpecPipeline(specWith('speckit'));
        expect(steps).toEqual(DEFAULT_WORKFLOW.steps);
    });

    it('falls back to the shipped default rather than an empty list', async () => {
        const steps = await resolveSpecPipeline(undefined);
        expect(steps).toEqual(DEFAULT_WORKFLOW.steps);
    });
});
