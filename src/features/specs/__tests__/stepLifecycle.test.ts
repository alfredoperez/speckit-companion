import {
    startStep,
    completeStep,
    startSubstep,
    completeSubstep,
} from '../stepLifecycle';

const SPEC_DIR = '/workspace/specs/061-extension-lifecycle-writes';

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockUpdateSpecContext: jest.Mock<any, any> = jest.fn();
const mockSetStepStarted: jest.Mock<any, any> = jest.fn();
const mockSetStepCompleted: jest.Mock<any, any> = jest.fn();
const mockSetSubstepStarted: jest.Mock<any, any> = jest.fn();
const mockSetSubstepCompleted: jest.Mock<any, any> = jest.fn();

jest.mock('../specContextWriter', () => ({
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
