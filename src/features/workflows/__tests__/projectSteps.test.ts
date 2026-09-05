import * as path from 'path';
import { readProjectSteps } from '../projectSteps';

const FIXTURES = path.join(__dirname, '../../../../tests/fixtures');
const WITH_STEPS = path.join(FIXTURES, 'project-steps');
const EMPTY = path.join(FIXTURES, 'project-steps-empty');

describe('readProjectSteps', () => {
    it('returns nothing for a root with no step directory', () => {
        expect(readProjectSteps(EMPTY)).toEqual([]);
        expect(readProjectSteps(undefined)).toEqual([]);
        expect(readProjectSteps('/nope/does/not/exist')).toEqual([]);
    });

    it('orders the steps it finds by directory name', () => {
        expect(readProjectSteps(WITH_STEPS).map(s => s.name)).toEqual([
            'bench-run',
            'code-review',
            'garbled',
            'hand-run',
            'research-check',
        ]);
    });

    it('takes the label from the frame description', () => {
        const step = readProjectSteps(WITH_STEPS).find(s => s.name === 'code-review');
        expect(step?.label).toBe('Code Review');
    });

    it('falls back to the directory name made readable when no frame declares one', () => {
        const step = readProjectSteps(WITH_STEPS).find(s => s.name === 'hand-run');
        expect(step?.label).toBe('hand run');
    });

    it('reads the placement from the order file', () => {
        const steps = readProjectSteps(WITH_STEPS);
        expect(steps.find(s => s.name === 'code-review')?.after).toBe('implement');
        expect(steps.find(s => s.name === 'research-check')?.after).toBe('specify');
        expect(steps.find(s => s.name === 'hand-run')?.after).toBe('');
    });

    it('picks up the document a node declares it writes, and leaves it empty when none does', () => {
        const steps = readProjectSteps(WITH_STEPS);
        expect(steps.find(s => s.name === 'code-review')?.writes).toBe('review.md');
        expect(steps.find(s => s.name === 'research-check')?.writes).toBe('');
    });

    it('skips a name that collides with a shipped step', () => {
        expect(readProjectSteps(WITH_STEPS).some(s => s.name === 'plan')).toBe(false);
    });

    it('skips a name outside the allowed shape', () => {
        expect(readProjectSteps(WITH_STEPS).some(s => s.name === 'Bad_Name')).toBe(false);
    });

    it('reads a malformed order file as unplaced rather than throwing (FR-007)', () => {
        const step = readProjectSteps(WITH_STEPS).find(s => s.name === 'garbled');
        expect(step).toBeDefined();
        expect(step?.after).toBe('');
    });
});
