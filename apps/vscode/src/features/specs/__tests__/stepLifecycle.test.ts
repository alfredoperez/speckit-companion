import {
    startStep,
    completeStep,
    startSubstep,
    completeSubstep,
    forceStatus,
    reactivate,
    setStatus,
} from '../stepLifecycle';

const SPEC_DIR = '/workspace/specs/061-extension-lifecycle-writes';

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockUpdateSpecContext: jest.Mock<any, any> = jest.fn();
const mockSetStepStarted: jest.Mock<any, any> = jest.fn();
const mockSetStepCompleted: jest.Mock<any, any> = jest.fn();
const mockSetSubstepStarted: jest.Mock<any, any> = jest.fn();
const mockSetSubstepCompleted: jest.Mock<any, any> = jest.fn();

jest.mock('../specContextWriter', () => ({
    appendTransition: jest.requireActual('../specContextWriter').appendTransition,
    updateSpecContext: (...args: unknown[]) => mockUpdateSpecContext(...args),
    setStepStarted: (...args: unknown[]) => mockSetStepStarted(...args),
    setStepCompleted: (...args: unknown[]) => mockSetStepCompleted(...args),
    setSubstepStarted: (...args: unknown[]) => mockSetSubstepStarted(...args),
    setSubstepCompleted: (...args: unknown[]) => mockSetSubstepCompleted(...args),
}));

describe('stepLifecycle', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        mockUpdateSpecContext.mockReset().mockResolvedValue(undefined);
        mockSetStepStarted.mockClear();
        mockSetStepCompleted.mockClear();
        mockSetSubstepStarted.mockClear();
        mockSetSubstepCompleted.mockClear();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('startStep', () => {
        it('delegates to writer with step + by', async () => {
            await startStep(SPEC_DIR, 'plan', 'extension');
            expect(mockUpdateSpecContext).toHaveBeenCalledTimes(1);
            const [dir, mutate] = mockUpdateSpecContext.mock.calls[0];
            expect(dir).toBe(SPEC_DIR);
            mutate({ stepHistory: {}, transitions: [] });
            expect(mockSetStepStarted).toHaveBeenCalledWith(
                expect.any(Object),
                'plan',
                'extension'
            );
        });

        it('logs and does not throw when writer rejects', async () => {
            mockUpdateSpecContext.mockRejectedValueOnce(new Error('disk full'));
            await expect(startStep(SPEC_DIR, 'plan', 'extension')).resolves.toBeUndefined();
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('completeStep', () => {
        it('delegates to writer with step + by', async () => {
            await completeStep(SPEC_DIR, 'tasks', 'extension');
            const [, mutate] = mockUpdateSpecContext.mock.calls[0];
            mutate({ stepHistory: {}, transitions: [] });
            expect(mockSetStepCompleted).toHaveBeenCalledWith(
                expect.any(Object),
                'tasks',
                'extension'
            );
        });
    });

    describe('forceStatus', () => {
        it('re-stamps a start with the dedup disabled for an in-flight status', async () => {
            await forceStatus(SPEC_DIR, 'planning', 'user');
            const [, mutate] = mockUpdateSpecContext.mock.calls[0];
            mutate({ currentStep: 'implement', status: 'implementing', history: [] });
            expect(mockSetStepStarted).toHaveBeenCalledWith(
                expect.any(Object),
                'plan',
                'user',
                undefined,
                false
            );
        });
    });

    describe('reactivate', () => {
        const mutated = async (currentStep: string, history: unknown[] = []) => {
            await reactivate(SPEC_DIR, 'user');
            const [, mutate] = mockUpdateSpecContext.mock.calls[0];
            return mutate({ currentStep, status: 'completed', history });
        };

        it('reopens a completed implement spec at implementing', async () => {
            const next = await mutated('implement');
            expect(next.currentStep).toBe('implement');
            expect(next.status).toBe('implementing');
        });

        it('reopens a completed spec on converge at implementing, back on implement', async () => {
            const convergeDone = { step: 'converge', substep: null, kind: 'complete', by: 'extension', at: '2026-07-21T10:08:00.000Z' };
            const next = await mutated('converge', [convergeDone]);
            expect(next.status).toBe('implementing');
            expect(next.currentStep).toBe('implement');
            const added = next.history.slice(1);
            expect(added).toHaveLength(1);
            expect(added[0].step).toBe('implement');
        });
    });

    describe('setStatus', () => {
        const mutated = async (currentStep: string) => {
            await setStatus(SPEC_DIR, 'completed', 'user');
            const [, mutate] = mockUpdateSpecContext.mock.calls[0];
            return mutate({ currentStep, status: 'implemented', history: [] });
        };

        it('closes the current step when it sets the status', async () => {
            const next = await mutated('implement');
            expect(next.status).toBe('completed');
            expect(next.history).toHaveLength(1);
            expect(next.history[0]).toMatchObject({ step: 'implement', kind: 'complete' });
        });

        it('never stamps a converge finish, so an unfinished converge is not billed the wait', async () => {
            const next = await mutated('converge');
            expect(next.status).toBe('completed');
            expect(next.history).toHaveLength(0);
        });
    });

    describe('substep variants', () => {
        it('startSubstep passes the canonical substep name through', async () => {
            await startSubstep(SPEC_DIR, 'plan', 'research', 'extension');
            const [, mutate] = mockUpdateSpecContext.mock.calls[0];
            mutate({ stepHistory: {}, transitions: [] });
            expect(mockSetSubstepStarted).toHaveBeenCalledWith(
                expect.any(Object),
                'plan',
                'research',
                'extension'
            );
        });

        it('completeSubstep passes the canonical substep name through', async () => {
            await completeSubstep(SPEC_DIR, 'plan', 'design', 'extension');
            const [, mutate] = mockUpdateSpecContext.mock.calls[0];
            mutate({ stepHistory: {}, transitions: [] });
            expect(mockSetSubstepCompleted).toHaveBeenCalledWith(
                expect.any(Object),
                'plan',
                'design',
                'extension'
            );
        });
    });
});
