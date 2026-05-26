import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    readSpecContext,
    readSpecContextSync,
    updateSpecContext,
    updateStepProgress,
    setSpecStatus,
} from '../specContextManager';

function mkTmp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-ctx-mgr-'));
}

function readJson(specDir: string): Record<string, unknown> {
    const raw = fs.readFileSync(path.join(specDir, '.spec-context.json'), 'utf-8');
    return JSON.parse(raw);
}

describe('specContextManager (canonical-writer shim)', () => {
    describe('readSpecContext', () => {
        it('returns undefined when no file exists', async () => {
            const dir = mkTmp();
            const result = await readSpecContext(dir);
            expect(result).toBeUndefined();
        });

        it('reads .spec-context.json', async () => {
            const dir = mkTmp();
            const context = { workflow: 'default', selectedAt: '2026-01-01', status: 'active' };
            fs.writeFileSync(path.join(dir, '.spec-context.json'), JSON.stringify(context));

            const result = await readSpecContext(dir);
            expect(result).toMatchObject(context);
        });
    });

    describe('readSpecContextSync', () => {
        it('returns undefined when no file exists', () => {
            const dir = mkTmp();
            const result = readSpecContextSync(dir);
            expect(result).toBeUndefined();
        });

        it('reads .spec-context.json', () => {
            const dir = mkTmp();
            const context = { workflow: 'default', selectedAt: '2026-01-01' };
            fs.writeFileSync(path.join(dir, '.spec-context.json'), JSON.stringify(context));

            const result = readSpecContextSync(dir);
            expect(result).toMatchObject(context);
        });
    });

    describe('updateSpecContext', () => {
        it('merges partial update without overwriting existing fields', async () => {
            const dir = mkTmp();
            const existing = {
                workflow: 'speckit',
                specName: 'demo',
                branch: 'main',
                selectedAt: '2026-01-01',
                currentStep: 'specify',
                status: 'specifying',
                history: [
                    {
                        step: 'specify',
                        substep: null,
                        from: { step: null, substep: null },
                        by: 'extension',
                        at: '2026-01-01T00:00:00Z',
                    },
                ],
            };
            fs.writeFileSync(path.join(dir, '.spec-context.json'), JSON.stringify(existing));

            await updateSpecContext(dir, { status: 'completed' });

            const written = readJson(dir);
            expect(written.workflow).toBe('speckit');
            expect(written.selectedAt).toBe('2026-01-01');
            expect(written.currentStep).toBe('specify');
            expect(written.status).toBe('completed');
        });

        it('creates a file (via canonical writer) when none exists', async () => {
            const dir = mkTmp();
            await updateSpecContext(dir, { workflow: 'default', selectedAt: '2026-01-01' });

            const written = readJson(dir);
            expect(written.workflow).toBe('default');
        });
    });

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
            // The canonical writer never persists `stepHistory` or the legacy
            // `transitions` field — both must be absent.
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
            // Simulate a manual completion of specify (lifecycle writer would
            // already have appended a completion entry on advance, but here we
            // re-advance through updateStepProgress and verify no duplicate).
            await updateStepProgress(dir, 'plan', ['specify', 'plan', 'tasks']);
            const lengthAfterFirstAdvance = (readJson(dir).history as unknown[]).length;
            await updateStepProgress(dir, 'plan', ['specify', 'plan', 'tasks']);
            const lengthAfterSecondAdvance = (readJson(dir).history as unknown[]).length;
            // Re-advancing to the same step should not append another entry.
            expect(lengthAfterSecondAdvance).toBe(lengthAfterFirstAdvance);
        });
    });

    describe('setSpecStatus', () => {
        it('writes the status field', async () => {
            const dir = mkTmp();
            await setSpecStatus(dir, 'completed');

            const written = readJson(dir);
            expect(written.status).toBe('completed');
        });

        it('preserves existing fields when setting status', async () => {
            const dir = mkTmp();
            const existing = {
                workflow: 'speckit',
                specName: 'demo',
                branch: 'main',
                currentStep: 'plan',
                status: 'planning',
                history: [],
            };
            fs.writeFileSync(path.join(dir, '.spec-context.json'), JSON.stringify(existing));

            await setSpecStatus(dir, 'archived');

            const written = readJson(dir);
            expect(written.status).toBe('archived');
            expect(written.workflow).toBe('speckit');
            expect(written.currentStep).toBe('plan');
        });
    });
});
