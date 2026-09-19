import * as vscode from 'vscode';
import { waitForShellReady, executeCommandInHiddenTerminal, ExecuteInHiddenTerminalOptions } from '../terminalUtils';

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

describe('executeCommandInHiddenTerminal', () => {
    let mockOutputChannel: vscode.OutputChannel;
    let baseOptions: ExecuteInHiddenTerminalOptions;

    beforeEach(() => {
        jest.useFakeTimers();
        mockOutputChannel = {
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn(),
        } as unknown as vscode.OutputChannel;

        baseOptions = {
            commandLine: 'echo hello',
            cwd: '/workspace',
            terminalName: 'Test Background',
            outputChannel: mockOutputChannel,
            logPrefix: 'Test',
        };

        // Default: no shell integration available, event API exists
        (vscode.window as any).onDidChangeTerminalShellIntegration = jest.fn(() => ({ dispose: jest.fn() }));
        (vscode.window as any).onDidEndTerminalShellExecution = jest.fn(() => ({ dispose: jest.fn() }));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('creates a hidden terminal with the correct options', async () => {
        const mockTerminal = {
            shellIntegration: undefined,
            sendText: jest.fn(),
            dispose: jest.fn(),
        };
        (vscode.window.createTerminal as jest.Mock).mockReturnValue(mockTerminal);

        // Make waitForShellReady timeout resolve, then the fallback timeout
        const promise = executeCommandInHiddenTerminal(baseOptions);
        jest.advanceTimersByTime(5000); // waitForShellReady timeout
        await Promise.resolve();
        jest.advanceTimersByTime(5000); // fallback timeout
        await promise;

        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: 'Test Background',
            cwd: '/workspace',
            hideFromUser: true,
        });
    });

    it('uses sendText fallback when shell integration is not available', async () => {
        const mockTerminal = {
            shellIntegration: undefined,
            sendText: jest.fn(),
            dispose: jest.fn(),
        };
        (vscode.window.createTerminal as jest.Mock).mockReturnValue(mockTerminal);

        const promise = executeCommandInHiddenTerminal(baseOptions);
        jest.advanceTimersByTime(5000); // waitForShellReady timeout
        await Promise.resolve();
        jest.advanceTimersByTime(5000); // fallback setTimeout
        const result = await promise;

        expect(mockTerminal.sendText).toHaveBeenCalledWith('echo hello');
        expect(result.exitCode).toBeUndefined();
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
            '[Test] Shell integration not available, using fallback mode'
        );
    });

    it('uses shell integration executeCommand when available', async () => {
        const mockExecution = {};
        const mockTerminal = {
            shellIntegration: {
                executeCommand: jest.fn().mockReturnValue(mockExecution),
            },
            dispose: jest.fn(),
        };
        (vscode.window.createTerminal as jest.Mock).mockReturnValue(mockTerminal);

        let endCallback: (event: any) => void;
        (vscode.window as any).onDidEndTerminalShellExecution = jest.fn(
            (cb: (event: any) => void) => {
                endCallback = cb;
                return { dispose: jest.fn() };
            }
        );

        const promise = executeCommandInHiddenTerminal(baseOptions);

        // Need to let the awaited waitForShellReady resolve first
        await Promise.resolve();

        endCallback!({
            terminal: mockTerminal,
            execution: mockExecution,
            exitCode: 0,
        });

        const result = await promise;

        expect(mockTerminal.shellIntegration.executeCommand).toHaveBeenCalledWith('echo hello');
        expect(result.exitCode).toBe(0);
    });

    it('logs command on failure when logCommandOnFailure is true', async () => {
        const mockExecution = {};
        const mockTerminal = {
            shellIntegration: {
                executeCommand: jest.fn().mockReturnValue(mockExecution),
            },
            dispose: jest.fn(),
        };
        (vscode.window.createTerminal as jest.Mock).mockReturnValue(mockTerminal);

        let endCallback: (event: any) => void;
        (vscode.window as any).onDidEndTerminalShellExecution = jest.fn(
            (cb: (event: any) => void) => {
                endCallback = cb;
                return { dispose: jest.fn() };
            }
        );

        const promise = executeCommandInHiddenTerminal({
            ...baseOptions,
            logCommandOnFailure: true,
        });

        await Promise.resolve();

        endCallback!({
            terminal: mockTerminal,
            execution: mockExecution,
            exitCode: 1,
        });

        await promise;

        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
            '[Test] Command failed with exit code: 1'
        );
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
            '[Test] Command was: echo hello'
        );
    });

    it('does not log command on failure when logCommandOnFailure is false', async () => {
        const mockExecution = {};
        const mockTerminal = {
            shellIntegration: {
                executeCommand: jest.fn().mockReturnValue(mockExecution),
            },
            dispose: jest.fn(),
        };
        (vscode.window.createTerminal as jest.Mock).mockReturnValue(mockTerminal);

        let endCallback: (event: any) => void;
        (vscode.window as any).onDidEndTerminalShellExecution = jest.fn(
            (cb: (event: any) => void) => {
                endCallback = cb;
                return { dispose: jest.fn() };
            }
        );

        const promise = executeCommandInHiddenTerminal({
            ...baseOptions,
            logCommandOnFailure: false,
        });

        await Promise.resolve();

        endCallback!({
            terminal: mockTerminal,
            execution: mockExecution,
            exitCode: 1,
        });

        await promise;

        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
            '[Test] Command failed with exit code: 1'
        );
        expect(mockOutputChannel.appendLine).not.toHaveBeenCalledWith(
            expect.stringContaining('Command was:')
        );
    });
});
