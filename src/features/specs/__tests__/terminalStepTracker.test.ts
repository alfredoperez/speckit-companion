import * as vscode from 'vscode';
import { track, register, _resetForTests } from '../terminalStepTracker';

const mockCompleteStep = jest.fn().mockResolvedValue(undefined);

jest.mock('../stepLifecycle', () => ({
    completeStep: (...args: unknown[]) => mockCompleteStep(...args),
}));

describe('terminalStepTracker', () => {
    let listener: ((t: vscode.Terminal) => void | Promise<void>) | undefined;

    beforeEach(() => {
        _resetForTests();
        mockCompleteStep.mockClear();
        listener = undefined;
        (vscode.window.onDidCloseTerminal as jest.Mock).mockReset().mockImplementation(
            (cb: (t: vscode.Terminal) => void) => {
                listener = cb;
                return { dispose: jest.fn() };
            }
        );
        register({} as vscode.ExtensionContext);
    });

    it('fires completeStep once when a tracked terminal closes', async () => {
        const term = {} as vscode.Terminal;
        track(term, '/specs/foo', 'plan');
        await listener!(term);
        expect(mockCompleteStep).toHaveBeenCalledTimes(1);
        expect(mockCompleteStep).toHaveBeenCalledWith('/specs/foo', 'plan', 'extension');
    });

    it('is a no-op when an untracked terminal closes', async () => {
        const term = {} as vscode.Terminal;
        await listener!(term);
        expect(mockCompleteStep).not.toHaveBeenCalled();
    });

    it('does not double-fire on a second close of the same terminal', async () => {
        const term = {} as vscode.Terminal;
        track(term, '/specs/foo', 'tasks');
        await listener!(term);
        await listener!(term);
        expect(mockCompleteStep).toHaveBeenCalledTimes(1);
    });

    it('does nothing when track() is called with undefined terminal', async () => {
        track(undefined, '/specs/foo', 'plan');
        const other = {} as vscode.Terminal;
        await listener!(other);
        expect(mockCompleteStep).not.toHaveBeenCalled();
    });
});
