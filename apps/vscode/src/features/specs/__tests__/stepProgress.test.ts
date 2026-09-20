import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { updateStepProgress } from '../stepProgress';

function mkTmp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'step-progress-'));
}

function readJson(specDir: string): Record<string, unknown> {
    const raw = fs.readFileSync(path.join(specDir, '.spec-context.json'), 'utf-8');
    return JSON.parse(raw);
}

describe('updateStepProgress', () => {
    it('sets currentStep and appends a history start-entry', async () => {
        const dir = mkTmp();
        await updateStepProgress(dir, 'specify', ['specify', 'plan', 'tasks']);

        const written = readJson(dir);
        expect(written.currentStep).toBe('specify');
        expect(Array.isArray(written.history)).toBe(true);
        const history = written.history as Array<Record<string, unknown>>;
        expect(history.length).toBeGreaterThanOrEqual(1);
        expect(history[history.length - 1].step).toBe('specify');
        // The canonical writer never persists `stepHistory` or the legacy keys.
        expect(written.stepHistory).toBeUndefined();
        expect(written.transitions).toBeUndefined();
    });

    it('completes previous step and starts new step on advance', async () => {
        const dir = mkTmp();
        await updateStepProgress(dir, 'specify', ['specify', 'plan', 'tasks']);
        await updateStepProgress(dir, 'plan', ['specify', 'plan', 'tasks']);

        const written = readJson(dir);
        expect(written.currentStep).toBe('plan');
        const history = written.history as Array<Record<string, unknown>>;
        // expect at least: specify-start, specify-complete, plan-start
        expect(history.length).toBeGreaterThanOrEqual(3);
        const last = history[history.length - 1];
        expect(last.step).toBe('plan');
    });

    it('does not emit a redundant completion if previous step is already complete', async () => {
        const dir = mkTmp();
        await updateStepProgress(dir, 'specify', ['specify', 'plan', 'tasks']);
        // A manual specify completion, as the lifecycle writer would record it.
        await updateStepProgress(dir, 'plan', ['specify', 'plan', 'tasks']);
        const lengthAfterFirstAdvance = (readJson(dir).history as unknown[]).length;
        await updateStepProgress(dir, 'plan', ['specify', 'plan', 'tasks']);
        const lengthAfterSecondAdvance = (readJson(dir).history as unknown[]).length;
        // Re-advancing to the same step should not append another entry.
        expect(lengthAfterSecondAdvance).toBe(lengthAfterFirstAdvance);
    });
});
