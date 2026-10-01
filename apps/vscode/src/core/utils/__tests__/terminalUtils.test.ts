import * as vscode from 'vscode';
import { Timing } from '../../constants';
import {
    executeCommandInHiddenTerminal,
    ExecuteInHiddenTerminalOptions,
    RUN_ANYWAY,
    runInTerminal,
    shellIntegrationExpected,
    shellRunIn,
    waitForShellIntegration,
    WAITING_FOR_ANSWER_NOTICE,
} from '../terminalUtils';

const mock = vscode as unknown as {
    createMockTerminal: (o?: { name?: string; shellIntegration?: boolean; autoExitCode?: number }) => any;
    __fireShellExecutionEnd: (terminal: unknown, execution: unknown, exitCode: number | undefined) => void;
    __fireCloseTerminal: (terminal: unknown) => void;
    env: { shell: string };
};

const getConfiguration = vscode.workspace.getConfiguration as jest.Mock;
const showInformationMessage = vscode.window.showInformationMessage as jest.Mock;

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => { resolve = r; });
    return { promise, resolve };
}
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
        showInformationMessage.mockReset();
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

        it('never types on its own, however long the shell keeps it waiting', async () => {
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const settled = jest.fn();
            void runInTerminal(terminal, 'claude "/speckit-plan specs/012"').then(settled);

            await jest.advanceTimersByTimeAsync(10 * 60_000);

            expect(terminal.__typed()).toEqual([]);
            expect(settled).not.toHaveBeenCalled();
            terminal.__activateShellIntegration();
        });

        it('runs the command the moment integration activates, even after the notice is up', async () => {
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude');
            await jest.advanceTimersByTimeAsync(90_000);
            expect(showInformationMessage).toHaveBeenCalled();

            terminal.__activateShellIntegration();
            const run = await pending;
            expect(terminal.__typed()).toEqual([{ via: 'executeCommand', text: 'claude', enter: true }]);
            expect(run.via).toBe('shell-integration');
        });

        it('shows no notice when the shell is ready quickly', async () => {
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude');
            await jest.advanceTimersByTimeAsync(500);
            terminal.__activateShellIntegration();
            await pending;
            await jest.advanceTimersByTimeAsync(Timing.shellWaitNoticeMs * 2);
            expect(showInformationMessage).not.toHaveBeenCalled();
        });

        it('fails without typing when the terminal is closed before its shell is ready', async () => {
            const terminal = mock.createMockTerminal({ name: 'SpecKit - Plan', shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude');
            const failed = expect(pending).rejects.toThrow('"SpecKit - Plan" terminal was closed before its command ran');
            await jest.advanceTimersByTimeAsync(30_000);
            mock.__fireCloseTerminal(terminal);
            await failed;
            expect(terminal.__typed()).toEqual([]);
        });
    });

    describe('the notice while the shell keeps a command waiting', () => {
        it('appears after the short delay as one short sentence with a Run button', async () => {
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            void runInTerminal(terminal, 'claude');

            await jest.advanceTimersByTimeAsync(Timing.shellWaitNoticeMs - 1);
            expect(showInformationMessage).not.toHaveBeenCalled();
            await jest.advanceTimersByTimeAsync(1);

            expect(showInformationMessage).toHaveBeenCalledTimes(1);
            expect(showInformationMessage).toHaveBeenCalledWith(
                'The SpecKit terminal is waiting for an answer. Answer it there, or click Run.',
                'Run',
            );
            expect(WAITING_FOR_ANSWER_NOTICE.length).toBeLessThanOrEqual(80);
            expect(vscode.window.withProgress).not.toHaveBeenCalled();
            terminal.__activateShellIntegration();
        });

        it('sends the command when the user clicks Run', async () => {
            const click = deferred<string | undefined>();
            showInformationMessage.mockReturnValueOnce(click.promise);
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude "$(cat /tmp/prompt.md)"');

            await jest.advanceTimersByTimeAsync(120_000);
            expect(terminal.__typed()).toEqual([]);

            click.resolve(RUN_ANYWAY);
            const run = await pending;
            expect(terminal.sendText).toHaveBeenCalledWith('claude "$(cat /tmp/prompt.md)"', true);
            expect(terminal.__typed()).toHaveLength(1);
            expect(run.via).toBe('send-text');
        });

        it('keeps a typed-but-not-entered command unentered when Run is clicked', async () => {
            showInformationMessage.mockResolvedValueOnce(RUN_ANYWAY);
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude "/speckit-plan"', { autoExecute: false });
            await jest.advanceTimersByTimeAsync(Timing.shellWaitNoticeMs);
            await pending;
            expect(terminal.sendText).toHaveBeenCalledWith('claude "/speckit-plan"', false);
        });

        it('does nothing when Run is clicked after integration already ran the command', async () => {
            const click = deferred<string | undefined>();
            showInformationMessage.mockReturnValueOnce(click.promise);
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude');
            await jest.advanceTimersByTimeAsync(Timing.shellWaitNoticeMs);

            terminal.__activateShellIntegration();
            await pending;
            click.resolve(RUN_ANYWAY);
            await flush();

            expect(terminal.__typed()).toEqual([{ via: 'executeCommand', text: 'claude', enter: true }]);
        });

        it('does nothing when the notice is dismissed, and keeps waiting', async () => {
            showInformationMessage.mockResolvedValueOnce(undefined);
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude');
            await jest.advanceTimersByTimeAsync(60_000);
            expect(terminal.__typed()).toEqual([]);

            terminal.__activateShellIntegration();
            await pending;
            expect(terminal.__commands()).toEqual(['claude']);
        });

        it('keeps a Run item in the status bar after the toast is dismissed, which sends the command when clicked', async () => {
            showInformationMessage.mockResolvedValueOnce(undefined);
            const registerCommand = vscode.commands.registerCommand as jest.Mock;
            const createStatusBarItem = vscode.window.createStatusBarItem as jest.Mock;
            const terminal = mock.createMockTerminal({ name: 'SpecKit - Constitution', shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude');
            await jest.advanceTimersByTimeAsync(Timing.shellWaitNoticeMs + 60_000);

            const item = createStatusBarItem.mock.results[createStatusBarItem.mock.results.length - 1].value;
            expect(item.show).toHaveBeenCalled();
            expect(item.tooltip).toContain('"SpecKit - Constitution" terminal');
            const [, onRun] = registerCommand.mock.calls.find(([id]) => id === item.command)!;
            expect(terminal.__typed()).toEqual([]);

            onRun();
            await pending;
            expect(terminal.sendText).toHaveBeenCalledWith('claude', true);
            expect(item.dispose).toHaveBeenCalled();
        });

        it('removes the status bar Run item once the shell reports ready', async () => {
            const createStatusBarItem = vscode.window.createStatusBarItem as jest.Mock;
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude');
            await jest.advanceTimersByTimeAsync(Timing.shellWaitNoticeMs);
            const item = createStatusBarItem.mock.results[createStatusBarItem.mock.results.length - 1].value;
            expect(item.dispose).not.toHaveBeenCalled();

            terminal.__activateShellIntegration();
            await pending;
            expect(item.dispose).toHaveBeenCalled();
        });

        it('shows a hidden terminal so its question can be answered, and still types nothing', async () => {
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude', { hidden: true });
            await jest.advanceTimersByTimeAsync(Timing.shellWaitNoticeMs);

            expect(terminal.show).toHaveBeenCalledWith(true);
            expect(showInformationMessage).toHaveBeenCalledWith(WAITING_FOR_ANSWER_NOTICE, RUN_ANYWAY);
            await jest.advanceTimersByTimeAsync(5 * 60_000);
            expect(terminal.__typed()).toEqual([]);

            terminal.__activateShellIntegration();
            await pending;
            expect(terminal.__commands()).toEqual(['claude']);
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

        it('shows no notice while waiting on a shell that cannot report', async () => {
            setShellIntegrationSetting(false);
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude');
            await jest.advanceTimersByTimeAsync(Timing.shellStartFallbackMs);
            await pending;
            expect(showInformationMessage).not.toHaveBeenCalled();
        });

        it('types the command after the short wait in a shell that never reports, with no Run notice', async () => {
            mock.env.shell = '/bin/sh';
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const pending = runInTerminal(terminal, 'claude');
            await jest.advanceTimersByTimeAsync(Timing.shellStartFallbackMs);
            const run = await pending;
            expect(terminal.sendText).toHaveBeenCalledWith('claude', true);
            expect(run.via).toBe('send-text');
            expect(showInformationMessage).not.toHaveBeenCalled();
        });

        it.each(['/bin/sh', '/usr/local/bin/nu', '/bin/tcsh'])('expects no integration from %s', shell => {
            mock.env.shell = shell;
            expect(shellIntegrationExpected()).toBe(false);
        });

        it.each(['/bin/zsh', '/bin/bash', '/opt/homebrew/bin/fish', 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'])('expects integration from %s', shell => {
            mock.env.shell = shell;
            expect(shellIntegrationExpected()).toBe(true);
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

    it('types the command and reports no exit code in a shell that cannot report readiness', async () => {
        mock.env.shell = '/bin/sh';
        const terminal = mock.createMockTerminal({ shellIntegration: false });
        createTerminal.mockImplementation(() => terminal);
        const pending = executeCommandInHiddenTerminal(baseOptions);
        await jest.advanceTimersByTimeAsync(Timing.shellStartFallbackMs * 2);
        const result = await pending;
        expect(terminal.sendText).toHaveBeenCalledWith('echo hello', true);
        expect(result.exitCode).toBeUndefined();
        expect(outputChannel.appendLine).toHaveBeenCalledWith('[Test] Shell integration not available, using fallback mode');
        mock.env.shell = '';
    });
});
