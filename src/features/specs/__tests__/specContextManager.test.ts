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
const LEGACY_FILE = path.join(SPEC_DIR, '.speckit.json');

// Mock fs.promises directly before module load
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReadFile: jest.Mock<any, any> = jest.fn().mockRejectedValue(new Error('ENOENT'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWriteFile: jest.Mock<any, any> = jest.fn().mockResolvedValue(undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReadFileSync: jest.Mock<any, any> = jest.fn(() => { throw new Error('ENOENT'); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUnlink: jest.Mock<any, any> = jest.fn().mockResolvedValue(undefined);

jest.mock('fs', () => ({
    promises: {
        readFile: (...args: unknown[]) => mockReadFile(...args),
        writeFile: (...args: unknown[]) => mockWriteFile(...args),
        unlink: (...args: unknown[]) => mockUnlink(...args),
    },
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

describe('specContextManager', () => {
    beforeEach(() => {
        mockReadFile.mockReset().mockRejectedValue(new Error('ENOENT'));
        mockWriteFile.mockReset().mockResolvedValue(undefined);
        mockUnlink.mockReset().mockResolvedValue(undefined);
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

        it('should fall back to .speckit.json when .spec-context.json is missing', async () => {
            const legacyContext = { workflow: 'legacy', selectedAt: '2025-01-01' };
            mockReadFile.mockImplementation((filePath: string) => {
                if (filePath === CONTEXT_FILE) {
                    return Promise.reject(new Error('ENOENT'));
                }
                return Promise.resolve(JSON.stringify(legacyContext));
            });

            const result = await readSpecContext(SPEC_DIR);
            expect(result).toEqual(legacyContext);
            expect(mockReadFile).toHaveBeenCalledWith(LEGACY_FILE, 'utf-8');
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

        it('should fall back to .speckit.json when .spec-context.json is missing', () => {
            mockReadFileSync.mockImplementation((filePath: string) => {
                if (filePath === CONTEXT_FILE) {
                    throw new Error('ENOENT');
                }
                return JSON.stringify({ workflow: 'legacy', selectedAt: '2025-01-01' });
            });

            const result = readSpecContextSync(SPEC_DIR);
            expect(result).toEqual({ workflow: 'legacy', selectedAt: '2025-01-01' });
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

        it('should auto-migrate from .speckit.json and delete legacy file', async () => {
            const legacyContent = { workflow: 'custom', selectedAt: '2025-06-01' };
            mockReadFile.mockImplementation((filePath: string) => {
                if (filePath === CONTEXT_FILE) {
                    return Promise.reject(new Error('ENOENT'));
                }
                if (filePath === LEGACY_FILE) {
                    return Promise.resolve(JSON.stringify(legacyContent));
                }
                return Promise.reject(new Error('ENOENT'));
            });

            await updateSpecContext(SPEC_DIR, { status: 'active' });

            // Should write to .spec-context.json with merged content
            const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
            expect(written.workflow).toBe('custom');
            expect(written.status).toBe('active');
            expect(mockWriteFile).toHaveBeenCalledWith(CONTEXT_FILE, expect.any(String), 'utf-8');

            // Should delete legacy file
            expect(mockUnlink).toHaveBeenCalledWith(LEGACY_FILE);
        });

        it('should not delete legacy file when reading from .spec-context.json', async () => {
            const existing = { workflow: 'default', selectedAt: '2026-01-01' };
            mockReadFile.mockResolvedValue(JSON.stringify(existing));

            await updateSpecContext(SPEC_DIR, { status: 'completed' });

            expect(mockUnlink).not.toHaveBeenCalled();
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

    describe('SDD state inference', () => {
        const STATE_FILE = path.join(SPEC_DIR, 'state.json');

        it('should use explicit status field when present in SDD state', async () => {
            const state = { step: 'implement', substep: 'commit-review', status: 'completed', updated: '2026-03-26' };
            mockReadFile.mockImplementation((filePath: string) => {
                if (filePath === path.join(SPEC_DIR, 'state.json')) {
                    return Promise.resolve(JSON.stringify(state));
                }
                return Promise.reject(new Error('ENOENT'));
            });

            const result = await readSpecContext(SPEC_DIR);
            expect(result?.status).toBe('completed');
        });

        it('should use explicit status in .spec-context.json with SDD format', async () => {
            const state = { step: 'implement', substep: 'commit-review', status: 'completed', updated: '2026-03-26' };
            mockReadFile.mockImplementation((filePath: string) => {
                if (filePath === CONTEXT_FILE) {
                    return Promise.resolve(JSON.stringify(state));
                }
                return Promise.reject(new Error('ENOENT'));
            });

            const result = await readSpecContext(SPEC_DIR);
            expect(result?.status).toBe('completed');
        });

        it('should infer status via heuristics when no explicit status field', async () => {
            const state = { step: 'implement', substep: 'commit', updated: '2026-03-26' };
            mockReadFile.mockImplementation((filePath: string) => {
                if (filePath === CONTEXT_FILE) {
                    return Promise.resolve(JSON.stringify(state));
                }
                return Promise.reject(new Error('ENOENT'));
            });

            const result = await readSpecContext(SPEC_DIR);
            expect(result?.status).toBe('completed');
        });

        it('should default to active when no explicit status and heuristics do not match', async () => {
            const state = { step: 'plan', substep: null, updated: '2026-03-26' };
            mockReadFile.mockImplementation((filePath: string) => {
                if (filePath === CONTEXT_FILE) {
                    return Promise.resolve(JSON.stringify(state));
                }
                return Promise.reject(new Error('ENOENT'));
            });

            const result = await readSpecContext(SPEC_DIR);
            expect(result?.status).toBe('active');
        });

        it('should sync use explicit status field (readSpecContextSync)', () => {
            const state = { step: 'implement', substep: 'commit-review', status: 'completed', updated: '2026-03-26' };
            mockReadFileSync.mockImplementation((filePath: string) => {
                if (filePath === CONTEXT_FILE) {
                    return JSON.stringify(state);
                }
                throw new Error('ENOENT');
            });

            const result = readSpecContextSync(SPEC_DIR);
            expect(result?.status).toBe('completed');
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
