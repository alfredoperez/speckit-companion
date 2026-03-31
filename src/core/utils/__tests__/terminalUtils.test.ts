import * as vscode from 'vscode';
import { waitForShellReady } from '../terminalUtils';

describe('waitForShellReady', () => {
    let mockTerminal: vscode.Terminal;

    beforeEach(() => {
        jest.useFakeTimers();
        mockTerminal = {
            shellIntegration: undefined,
            show: jest.fn(),
            sendText: jest.fn(),
            name: 'test',
        } as unknown as vscode.Terminal;

        // Default: event API exists
        (vscode.window as any).onDidChangeTerminalShellIntegration = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('resolves immediately when shellIntegration is already set', async () => {
        (mockTerminal as any).shellIntegration = { executeCommand: jest.fn() };

        const promise = waitForShellReady(mockTerminal);
        await promise;
        // Should not register any listener
        expect(vscode.window.onDidChangeTerminalShellIntegration).not.toHaveBeenCalled();
    });

    it('resolves when onDidChangeTerminalShellIntegration fires for the terminal', async () => {
        let capturedCallback: (e: { terminal: vscode.Terminal }) => void;
        const mockDisposable = { dispose: jest.fn() };

        (vscode.window as any).onDidChangeTerminalShellIntegration = jest.fn(
            (cb: (e: { terminal: vscode.Terminal }) => void) => {
                capturedCallback = cb;
                return mockDisposable;
            }
        );

        const promise = waitForShellReady(mockTerminal);

        // Simulate shell integration becoming available
        capturedCallback!({ terminal: mockTerminal });

        await promise;
        expect(mockDisposable.dispose).toHaveBeenCalled();
    });

    it('ignores events from other terminals', async () => {
        let capturedCallback: (e: { terminal: vscode.Terminal }) => void;
        const mockDisposable = { dispose: jest.fn() };
        const otherTerminal = { name: 'other' } as unknown as vscode.Terminal;

        (vscode.window as any).onDidChangeTerminalShellIntegration = jest.fn(
            (cb: (e: { terminal: vscode.Terminal }) => void) => {
                capturedCallback = cb;
                return mockDisposable;
            }
        );

        const promise = waitForShellReady(mockTerminal);

        // Fire event for a different terminal — should not resolve
        capturedCallback!({ terminal: otherTerminal });
        expect(mockDisposable.dispose).not.toHaveBeenCalled();

        // Now fire for the right terminal
        capturedCallback!({ terminal: mockTerminal });
        await promise;
        expect(mockDisposable.dispose).toHaveBeenCalled();
    });

    it('resolves on timeout when event never fires', async () => {
        const mockDisposable = { dispose: jest.fn() };
        (vscode.window as any).onDidChangeTerminalShellIntegration = jest.fn(() => mockDisposable);

        const promise = waitForShellReady(mockTerminal, 1000);

        jest.advanceTimersByTime(1000);

        await promise;
        expect(mockDisposable.dispose).toHaveBeenCalled();
    });

    it('falls back to timeout when event API does not exist', async () => {
        (vscode.window as any).onDidChangeTerminalShellIntegration = undefined;

        const promise = waitForShellReady(mockTerminal, 500);

        jest.advanceTimersByTime(500);

        await promise;
    });

    it('does not double-resolve if event fires after timeout', async () => {
        let capturedCallback: (e: { terminal: vscode.Terminal }) => void;
        const mockDisposable = { dispose: jest.fn() };

        (vscode.window as any).onDidChangeTerminalShellIntegration = jest.fn(
            (cb: (e: { terminal: vscode.Terminal }) => void) => {
                capturedCallback = cb;
                return mockDisposable;
            }
        );

        const resolveSpy = jest.fn();
        const promise = waitForShellReady(mockTerminal, 500).then(resolveSpy);

        // Timeout fires first
        jest.advanceTimersByTime(500);
        await promise;
        expect(resolveSpy).toHaveBeenCalledTimes(1);
        expect(mockDisposable.dispose).toHaveBeenCalledTimes(1);

        // Event fires after — should be ignored
        capturedCallback!({ terminal: mockTerminal });
        // dispose should not be called again
        expect(mockDisposable.dispose).toHaveBeenCalledTimes(1);
    });
});
