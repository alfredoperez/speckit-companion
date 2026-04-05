import * as path from 'path';
import {
    readSpecContext,
    readSpecContextSync,
    updateSpecContext,
    updateStepProgress,
    setSpecStatus,
} from '../specContextManager';

const SPEC_DIR = '/workspace/specs/my-feature';
const CONTEXT_FILE = path.join(SPEC_DIR, '.spec-context.json');

// Mock fs.promises directly before module load
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReadFile: jest.Mock<any, any> = jest.fn().mockRejectedValue(new Error('ENOENT'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWriteFile: jest.Mock<any, any> = jest.fn().mockResolvedValue(undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReadFileSync: jest.Mock<any, any> = jest.fn(() => { throw new Error('ENOENT'); });

jest.mock('fs', () => ({
    promises: {
        readFile: (...args: unknown[]) => mockReadFile(...args),
        writeFile: (...args: unknown[]) => mockWriteFile(...args),
    },
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

describe('specContextManager', () => {
    beforeEach(() => {
        mockReadFile.mockReset().mockRejectedValue(new Error('ENOENT'));
        mockWriteFile.mockReset().mockResolvedValue(undefined);
        mockReadFileSync.mockReset().mockImplementation(() => { throw new Error('ENOENT'); });
    });

    describe('readSpecContext', () => {
        it('should return undefined when no file exists', async () => {
            const result = await readSpecContext(SPEC_DIR);
            expect(result).toBeUndefined();
        });

        it('should read .spec-context.json', async () => {
            const context = { workflow: 'default', selectedAt: '2026-01-01', status: 'active' as const };
            mockReadFile.mockResolvedValue(JSON.stringify(context));

            const result = await readSpecContext(SPEC_DIR);
            expect(result).toEqual(context);
            expect(mockReadFile).toHaveBeenCalledWith(CONTEXT_FILE, 'utf-8');
        });

    });

    describe('readSpecContextSync', () => {
        it('should return undefined when no file exists', () => {
            mockReadFileSync.mockImplementation(() => {
                throw new Error('ENOENT');
            });

            const result = readSpecContextSync(SPEC_DIR);
            expect(result).toBeUndefined();
        });

        it('should read .spec-context.json', () => {
            const context = { workflow: 'default', selectedAt: '2026-01-01' };
            mockReadFileSync.mockReturnValue(JSON.stringify(context));

            const result = readSpecContextSync(SPEC_DIR);
            expect(result).toEqual(context);
            expect(mockReadFileSync).toHaveBeenCalledWith(CONTEXT_FILE, 'utf-8');
        });

    });

    describe('updateSpecContext', () => {
        it('should merge partial update without overwriting existing fields', async () => {
            const existing = { workflow: 'default', selectedAt: '2026-01-01', currentStep: 'specify' };
            mockReadFile.mockResolvedValue(JSON.stringify(existing));

            await updateSpecContext(SPEC_DIR, { status: 'completed' });

            expect(mockWriteFile).toHaveBeenCalledTimes(1);
            const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
            expect(written.workflow).toBe('default');
            expect(written.selectedAt).toBe('2026-01-01');
            expect(written.currentStep).toBe('specify');
            expect(written.status).toBe('completed');
        });

        it('should create file when it does not exist', async () => {
            await updateSpecContext(SPEC_DIR, { workflow: 'default', selectedAt: '2026-01-01' });

            expect(mockWriteFile).toHaveBeenCalledWith(
                CONTEXT_FILE,
                expect.any(String),
                'utf-8'
            );
            const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
            expect(written.workflow).toBe('default');
        });

    });

    describe('updateStepProgress', () => {
        it('should set currentStep and create stepHistory entry', async () => {
            await updateStepProgress(SPEC_DIR, 'specify', ['specify', 'plan', 'tasks']);

            expect(mockWriteFile).toHaveBeenCalledTimes(1);
            const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
            expect(written.currentStep).toBe('specify');
            expect(written.stepHistory.specify).toBeDefined();
            expect(written.stepHistory.specify.startedAt).toBeDefined();
            expect(written.stepHistory.specify.completedAt).toBeNull();
            expect(written.status).toBe('active');
        });

        it('should complete previous step when moving to a new step', async () => {
            const existing = {
                workflow: 'default',
                selectedAt: '2026-01-01',
                currentStep: 'specify',
                stepHistory: {
                    specify: { startedAt: '2026-01-01T00:00:00.000Z', completedAt: null },
                },
            };

            mockReadFile.mockImplementation((filePath: string) => {
                if (filePath === CONTEXT_FILE) {
                    return Promise.resolve(JSON.stringify(existing));
                }
                return Promise.reject(new Error('ENOENT'));
            });

            await updateStepProgress(SPEC_DIR, 'plan', ['specify', 'plan', 'tasks']);

            const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
            expect(written.currentStep).toBe('plan');
            expect(written.stepHistory.specify.completedAt).not.toBeNull();
            expect(written.stepHistory.plan.startedAt).toBeDefined();
            expect(written.stepHistory.plan.completedAt).toBeNull();
        });

        it('should not complete previous step if already completed', async () => {
            const completedAt = '2026-01-01T12:00:00.000Z';
            const existing = {
                workflow: 'default',
                selectedAt: '2026-01-01',
                currentStep: 'specify',
                stepHistory: {
                    specify: { startedAt: '2026-01-01T00:00:00.000Z', completedAt },
                },
            };

            mockReadFile.mockResolvedValue(JSON.stringify(existing));

            await updateStepProgress(SPEC_DIR, 'plan', ['specify', 'plan', 'tasks']);

            const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
            expect(written.stepHistory.specify.completedAt).toBe(completedAt);
        });
    });

    describe('setSpecStatus', () => {
        it('should write the status field', async () => {
            await setSpecStatus(SPEC_DIR, 'completed');

            const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
            expect(written.status).toBe('completed');
        });

        it('should preserve existing fields when setting status', async () => {
            const existing = { workflow: 'default', selectedAt: '2026-01-01', currentStep: 'plan' };
            mockReadFile.mockResolvedValue(JSON.stringify(existing));

            await setSpecStatus(SPEC_DIR, 'archived');

            const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
            expect(written.status).toBe('archived');
            expect(written.workflow).toBe('default');
            expect(written.currentStep).toBe('plan');
        });
    });
});
