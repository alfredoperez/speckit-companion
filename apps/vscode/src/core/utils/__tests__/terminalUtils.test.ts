import * as vscode from 'vscode';
import { Timing } from '../../constants';
import {
    executeCommandInHiddenTerminal,
    ExecuteInHiddenTerminalOptions,
    runInTerminal,
    shellIntegrationExpected,
    shellRunIn,
    waitForShellIntegration,
} from '../terminalUtils';

const mock = vscode as unknown as {
    createMockTerminal: (o?: { name?: string; shellIntegration?: boolean; autoExitCode?: number }) => any;
    __fireShellExecutionEnd: (terminal: unknown, execution: unknown, exitCode: number | undefined) => void;
    __fireCloseTerminal: (terminal: unknown) => void;
    env: { shell: string };
};

const getConfiguration = vscode.workspace.getConfiguration as jest.Mock;
const defaultGetConfiguration = getConfiguration.getMockImplementation();

function setShellIntegrationSetting(value: unknown): void {
    getConfiguration.mockImplementation((section?: string) =>
        section === 'terminal.integrated'
            ? { get: (key: string) => (key === 'shellIntegration.enabled' ? value : undefined) }
            : { get: jest.fn().mockReturnValue(['specs']), inspect: jest.fn() });
}

async function flush(): Promise<void> {
    for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('runInTerminal', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mock.env.shell = '/bin/zsh';
        setShellIntegrationSetting(true);
        (vscode.window.withProgress as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
        getConfiguration.mockImplementation(defaultGetConfiguration);
        mock.env.shell = '';
    });

    describe('when the shell is still starting', () => {
        it('types nothing until shell integration activates, then executes the command through it', async () => {
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude "/speckit-plan specs/012"');

            await jest.advanceTimersByTimeAsync(30_000);
            expect(terminal.__typed()).toEqual([]);

            terminal.__activateShellIntegration();
            const run = await pending;

            expect(terminal.shellIntegration.executeCommand).toHaveBeenCalledWith('claude "/speckit-plan specs/012"');
            expect(terminal.sendText).not.toHaveBeenCalled();
            expect(run.via).toBe('shell-integration');
            expect(run.ended).toBeDefined();
        });

        it('falls back to typing the command once the wait runs out and integration never came', async () => {
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude "/speckit-plan specs/012"');

            await jest.advanceTimersByTimeAsync(Timing.shellIntegrationTimeoutMs - 1);
            expect(terminal.sendText).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1);
            const run = await pending;

            expect(terminal.sendText).toHaveBeenCalledWith('claude "/speckit-plan specs/012"', true);
            expect(run.via).toBe('send-text');
            expect(run.ended).toBeUndefined();
        });

        it('waits long enough for a person to answer a question the shell asks at startup', () => {
            expect(Timing.shellIntegrationTimeoutMs).toBeGreaterThanOrEqual(60_000);
        });

        it('shows a notice explaining the wait once it drags on', async () => {
            const terminal = mock.createMockTerminal({ name: 'SpecKit - Claude Code', shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude');

            await jest.advanceTimersByTimeAsync(Timing.shellWaitNoticeMs - 1);
            expect(vscode.window.withProgress).not.toHaveBeenCalled();
            await jest.advanceTimersByTimeAsync(1);
            expect(vscode.window.withProgress).toHaveBeenCalledWith(
                expect.objectContaining({ title: expect.stringContaining('"SpecKit - Claude Code" terminal') }),
                expect.any(Function),
            );

            terminal.__activateShellIntegration();
            await pending;
        });

        it('shows no notice when the shell is ready quickly', async () => {
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude');
            await jest.advanceTimersByTimeAsync(500);
            terminal.__activateShellIntegration();
            await pending;
            await jest.advanceTimersByTimeAsync(Timing.shellWaitNoticeMs * 2);
            expect(vscode.window.withProgress).not.toHaveBeenCalled();
        });

        it('shows no notice for a hidden terminal', async () => {
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude', { hidden: true });
            await jest.advanceTimersByTimeAsync(Timing.shellWaitNoticeMs * 2);
            terminal.__activateShellIntegration();
            await pending;
            expect(vscode.window.withProgress).not.toHaveBeenCalled();
        });
    });

    describe('when shell integration cannot report readiness', () => {
        it('types the command after the short fallback wait when integration is turned off', async () => {
            setShellIntegrationSetting(false);
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'specify init .');

            await jest.advanceTimersByTimeAsync(Timing.shellStartFallbackMs - 1);
            expect(terminal.sendText).not.toHaveBeenCalled();
            await jest.advanceTimersByTimeAsync(1);
            await pending;

            expect(terminal.sendText).toHaveBeenCalledWith('specify init .', true);
        });

        it('treats cmd.exe as a shell without integration', () => {
            mock.env.shell = 'cmd.exe';
            expect(shellIntegrationExpected()).toBe(false);
        });

        it('treats an editor without the shell integration API as unable to report', async () => {
            const original = vscode.window.onDidChangeTerminalShellIntegration;
            (vscode.window as any).onDidChangeTerminalShellIntegration = undefined;
            try {
                expect(shellIntegrationExpected()).toBe(false);
                const terminal = mock.createMockTerminal({ shellIntegration: false });
                const pending = runInTerminal(terminal, 'claude');
                await jest.advanceTimersByTimeAsync(Timing.shellStartFallbackMs);
                await pending;
                expect(terminal.sendText).toHaveBeenCalledWith('claude', true);
            } finally {
                (vscode.window as any).onDidChangeTerminalShellIntegration = original;
            }
        });
    });

    describe('when the shell is ready', () => {
        it('executes immediately through shell integration', async () => {
            const terminal = mock.createMockTerminal();
            await runInTerminal(terminal, 'claude');
            expect(terminal.shellIntegration.executeCommand).toHaveBeenCalledWith('claude');
        });

        it('types without Enter when the caller leaves running it to the user', async () => {
            const terminal = mock.createMockTerminal();
            await runInTerminal(terminal, 'claude "/speckit-plan"', { autoExecute: false });
            expect(terminal.shellIntegration.executeCommand).not.toHaveBeenCalled();
            expect(terminal.sendText).toHaveBeenCalledWith('claude "/speckit-plan"', false);
        });

        it('types the command when shell integration refuses to execute it', async () => {
            const terminal = mock.createMockTerminal();
            terminal.shellIntegration.executeCommand.mockImplementation(() => { throw new Error('unsupported'); });
            const run = await runInTerminal(terminal, 'claude');
            expect(terminal.sendText).toHaveBeenCalledWith('claude', true);
            expect(run.via).toBe('send-text');
        });
    });

    describe('exit codes', () => {
        it('reports the exit code of the command it executed', async () => {
            const terminal = mock.createMockTerminal();
            const run = await runInTerminal(terminal, 'laude');
            mock.__fireShellExecutionEnd(terminal, terminal.executions[0], 127);
            await expect(run.ended).resolves.toBe(127);
        });

        it('ignores the end of a different execution', async () => {
            const terminal = mock.createMockTerminal();
            const run = await runInTerminal(terminal, 'claude');
            const seen = jest.fn();
            void run.ended!.then(seen);
            mock.__fireShellExecutionEnd(terminal, { other: true }, 1);
            await flush();
            expect(seen).not.toHaveBeenCalled();
        });

        it('resolves without a code when the terminal closes first', async () => {
            const terminal = mock.createMockTerminal();
            const run = await runInTerminal(terminal, 'claude');
            mock.__fireCloseTerminal(terminal);
            await expect(run.ended).resolves.toBeUndefined();
        });
    });

    describe('a second command in the same terminal', () => {
        it('waits for the first to end before executing', async () => {
            const terminal = mock.createMockTerminal();
            await runInTerminal(terminal, 'echo first');
            const second = runInTerminal(terminal, 'second');
            await flush();
            expect(terminal.__commands()).toEqual(['echo first']);

            mock.__fireShellExecutionEnd(terminal, terminal.executions[0], 0);
            await second;
            expect(terminal.__commands()).toEqual(['echo first', 'second']);
        });

        it('stops waiting after a bound when the first never ends', async () => {
            const terminal = mock.createMockTerminal();
            await runInTerminal(terminal, 'echo first');
            const second = runInTerminal(terminal, 'second');
            await jest.advanceTimersByTimeAsync(Timing.previousCommandWaitMs);
            await second;
            expect(terminal.__commands()).toEqual(['echo first', 'second']);
        });
    });

    describe('shellRunIn', () => {
        it('returns the run handed over at or after the given time, and nothing older', async () => {
            const terminal = mock.createMockTerminal();
            const run = await runInTerminal(terminal, 'claude');
            expect(shellRunIn(terminal, run.startedAt)).toBe(run);
            expect(shellRunIn(terminal, run.startedAt + 1)).toBeUndefined();
            expect(shellRunIn(mock.createMockTerminal())).toBeUndefined();
        });
    });
});

describe('waitForShellIntegration', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('resolves true at once when integration is already active', async () => {
        await expect(waitForShellIntegration(mock.createMockTerminal(), 10)).resolves.toBe(true);
    });

    it('ignores activation of another terminal', async () => {
        const terminal = mock.createMockTerminal({ shellIntegration: false });
        const result = jest.fn();
        void waitForShellIntegration(terminal, 1000).then(result);
        mock.createMockTerminal({ shellIntegration: false }).__activateShellIntegration();
        await flush();
        expect(result).not.toHaveBeenCalled();
        terminal.__activateShellIntegration();
        await flush();
        expect(result).toHaveBeenCalledWith(true);
    });

    it('resolves false when the timeout passes first', async () => {
        const terminal = mock.createMockTerminal({ shellIntegration: false });
        const pending = waitForShellIntegration(terminal, 1000);
        await jest.advanceTimersByTimeAsync(1000);
        await expect(pending).resolves.toBe(false);
    });
});

describe('executeCommandInHiddenTerminal', () => {
    let outputChannel: vscode.OutputChannel;
    let baseOptions: ExecuteInHiddenTerminalOptions;
    const createTerminal = vscode.window.createTerminal as jest.Mock;
    const defaultCreateTerminal = createTerminal.getMockImplementation();

    beforeEach(() => {
        jest.useFakeTimers();
        outputChannel = { appendLine: jest.fn(), show: jest.fn(), dispose: jest.fn() } as unknown as vscode.OutputChannel;
        baseOptions = {
            commandLine: 'echo hello',
            cwd: '/workspace',
            terminalName: 'Test Background',
            outputChannel,
            logPrefix: 'Test',
        };
    });

    afterEach(() => {
        jest.useRealTimers();
        createTerminal.mockImplementation(defaultCreateTerminal);
    });

    it('creates a hidden terminal with the given name and folder', async () => {
        createTerminal.mockImplementation(() => mock.createMockTerminal({ autoExitCode: 0 }));
        await executeCommandInHiddenTerminal(baseOptions);
        expect(createTerminal).toHaveBeenCalledWith({ name: 'Test Background', cwd: '/workspace', hideFromUser: true });
    });

    it('returns the exit code of the command it executed through shell integration', async () => {
        const terminal = mock.createMockTerminal({ autoExitCode: 0 });
        createTerminal.mockImplementation(() => terminal);
        const result = await executeCommandInHiddenTerminal(baseOptions);
        expect(terminal.shellIntegration.executeCommand).toHaveBeenCalledWith('echo hello');
        expect(result.exitCode).toBe(0);
    });

    it('logs a failure, and the command when asked to', async () => {
        createTerminal.mockImplementation(() => mock.createMockTerminal({ autoExitCode: 1 }));
        await executeCommandInHiddenTerminal({ ...baseOptions, logCommandOnFailure: true });
        expect(outputChannel.appendLine).toHaveBeenCalledWith('[Test] Command failed with exit code: 1');
        expect(outputChannel.appendLine).toHaveBeenCalledWith('[Test] Command was: echo hello');
    });

    it('logs a failure without the command by default', async () => {
        createTerminal.mockImplementation(() => mock.createMockTerminal({ autoExitCode: 1 }));
        await executeCommandInHiddenTerminal(baseOptions);
        expect(outputChannel.appendLine).toHaveBeenCalledWith('[Test] Command failed with exit code: 1');
        expect(outputChannel.appendLine).not.toHaveBeenCalledWith(expect.stringContaining('Command was:'));
    });

    it('types the command and reports no exit code when integration never arrives', async () => {
        const terminal = mock.createMockTerminal({ shellIntegration: false });
        createTerminal.mockImplementation(() => terminal);
        const pending = executeCommandInHiddenTerminal(baseOptions);
        await jest.advanceTimersByTimeAsync(Timing.shellIntegrationTimeoutMs + Timing.shellStartFallbackMs);
        const result = await pending;
        expect(terminal.sendText).toHaveBeenCalledWith('echo hello', true);
        expect(result.exitCode).toBeUndefined();
        expect(outputChannel.appendLine).toHaveBeenCalledWith('[Test] Shell integration not available, using fallback mode');
    });
});
