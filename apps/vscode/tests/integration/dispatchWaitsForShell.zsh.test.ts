// A real zsh asks a one-key question at startup; a precmd hook stands in for VS Code's OSC 633 integration, loaded after the user's rc as VS Code loads it.
import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ClaudeCodeProvider } from '../../src/ai-providers/claudeCodeProvider';
import { RUN_ANYWAY, runInTerminal, WAITING_FOR_ANSWER_NOTICE } from '../../src/core/utils/terminalUtils';
import { registerSpecKitCommands } from '../../src/features/specs/specCommands';

let provider: ClaudeCodeProvider;
jest.mock('../../src/extension', () => ({ getAIProvider: () => provider }));

const mock = vscode as unknown as {
    createMockTerminal: (o: { name?: string; shellIntegration?: boolean; write?: (d: string) => void }) => any;
    __fireShellExecutionEnd: (terminal: unknown, execution: unknown, exitCode: number) => void;
    env: { shell: string };
};
const showInformationMessage = vscode.window.showInformationMessage as jest.Mock;
const getConfiguration = vscode.workspace.getConfiguration as jest.Mock;
const createTerminal = vscode.window.createTerminal as jest.Mock;
const registerCommand = vscode.commands.registerCommand as jest.Mock;

const available = process.platform !== 'win32'
    && ['zsh', 'python3'].every(bin => spawnSync('which', [bin]).status === 0);
const describeWithZsh = available ? describe : describe.skip;

const realSetTimeout = setTimeout;
const realNow = Date.now.bind(Date);
const delay = (ms: number) => new Promise(resolve => realSetTimeout(resolve, ms));

const USER_ZSHRC = 'read -k 1 "REPLY?[oh-my-zsh] Would you like to update? [Y/n] "\necho\n';
const INTEGRATION_HOOKS = [
    '__sim_ran=0',
    'preexec() { __sim_ran=1 }',
    "precmd() { local s=$?; if (( __sim_ran )); then printf '\\e]633;D;%s\\a' $s; __sim_ran=0; fi; printf '\\e]633;A\\a' }",
];
const PTY_BRIDGE = "import pty, sys\nsys.exit(pty.spawn(['zsh', '-i']) >> 8)";

interface Shell {
    terminal: any;
    output(): string;
    press(key: string): void;
    waitFor(pattern: RegExp, timeoutMs?: number): Promise<void>;
    close(): void;
}

function startShell(options: { name?: string; integration?: boolean } = {}): Shell {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-zsh-'));
    const userDir = path.join(root, 'user');
    const injectDir = path.join(root, 'inject');
    fs.mkdirSync(userDir);
    fs.mkdirSync(injectDir);
    fs.writeFileSync(path.join(userDir, '.zshrc'), USER_ZSHRC);
    fs.writeFileSync(path.join(injectDir, '.zshrc'), [
        '. "$USER_ZDOTDIR/.zshrc"',
        'claude() { print -r -- "CLAUDE-PROMPT:${@[-1]}" }',
        ...(options.integration === false ? [] : INTEGRATION_HOOKS),
        "PS1='%% '",
        '',
    ].join('\n'));

    const child: ChildProcessWithoutNullStreams = spawn('python3', ['-c', PTY_BRIDGE], {
        env: { ...process.env, ZDOTDIR: injectDir, USER_ZDOTDIR: userDir, TERM: 'xterm', HISTFILE: path.join(root, 'history') },
    });
    let out = '';
    let integrated = false;
    let endsSeen = 0;
    const terminal = mock.createMockTerminal({
        name: options.name ?? 'SpecKit - Claude Code',
        shellIntegration: false,
        write: data => child.stdin.write(data),
    });
    child.stdout.on('data', (chunk: Buffer) => {
        out += chunk.toString();
        if (!integrated && out.includes('\x1b]633;A')) {
            integrated = true;
            terminal.__activateShellIntegration();
        }
        const ends = [...out.matchAll(/\x1b\]633;D;(\d+)\x07/g)];
        for (; endsSeen < ends.length; endsSeen++) {
            mock.__fireShellExecutionEnd(terminal, terminal.executions[terminal.executions.length - 1], Number(ends[endsSeen][1]));
        }
    });

    return {
        terminal,
        output: () => out,
        press: key => child.stdin.write(key),
        async waitFor(pattern, timeoutMs = 8000) {
            const until = realNow() + timeoutMs;
            while (!pattern.test(out)) {
                if (realNow() > until) throw new Error(`Timed out waiting for ${pattern}; shell printed:\n${JSON.stringify(out)}`);
                await delay(50);
            }
        },
        close() {
            child.kill('SIGKILL');
            try {
                fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
            } catch {
                // The orphaned zsh may still be writing its startup files; the OS temp dir reclaims them.
            }
        },
    };
}

function useFakeClock(): void {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
}

describeWithZsh('dispatching into a real zsh that asks a question at startup', () => {
    let shell: Shell | undefined;
    const defaultGetConfiguration = getConfiguration.getMockImplementation();

    beforeEach(() => {
        mock.env.shell = '/bin/zsh';
        showInformationMessage.mockReset();
        getConfiguration.mockImplementation(() => ({ get: (_key: string, fallback?: unknown) => fallback, inspect: () => undefined }));
    });

    afterEach(() => {
        jest.useRealTimers();
        shell?.close();
        shell = undefined;
        mock.env.shell = '';
        getConfiguration.mockImplementation(defaultGetConfiguration);
    });

    it('typing into the open question, as the old fixed waits did, loses the first character', async () => {
        shell = startShell();
        await shell.waitFor(/Would you like to update\?/);
        shell.terminal.sendText('echo DISPATCH-$((40+2))');
        await shell.waitFor(/command not found: cho/);
        expect(shell.output()).not.toMatch(/\nDISPATCH-42/);
    }, 20_000);

    it('holds the command through 90 seconds of an unanswered question, then runs it intact when the user answers', async () => {
        shell = startShell();
        await shell.waitFor(/Would you like to update\?/);
        useFakeClock();
        const pending = runInTerminal(shell.terminal, 'echo DISPATCH-$((40+2))');

        await jest.advanceTimersByTimeAsync(90_000);
        await delay(500);
        expect(shell.terminal.__typed()).toEqual([]);
        expect(showInformationMessage).toHaveBeenCalledWith(WAITING_FOR_ANSWER_NOTICE, RUN_ANYWAY);

        shell.press('n');
        const run = await pending;
        expect(run.via).toBe('shell-integration');
        await shell.waitFor(/\nDISPATCH-42/);
        expect(shell.output()).not.toMatch(/command not found/);
        await expect(run.ended).resolves.toBe(0);
    }, 30_000);

    it('holds the command for real past the old one-minute cap, and runs it intact when the user answers', async () => {
        shell = startShell();
        await shell.waitFor(/Would you like to update\?/);
        const pending = runInTerminal(shell.terminal, 'echo DISPATCH-$((40+2))');

        await delay(64_000);
        expect(shell.terminal.__typed()).toEqual([]);
        expect(shell.output()).not.toMatch(/command not found/);

        shell.press('n');
        const run = await pending;
        expect(run.via).toBe('shell-integration');
        await shell.waitFor(/\nDISPATCH-42/);
        expect(shell.output()).not.toMatch(/command not found/);
    }, 90_000);

    it('Run Setup holds the constitution command through 90 seconds, then runs claude with the whole prompt file', async () => {
        shell = startShell({ name: 'SpecKit - Constitution' });
        await shell.waitFor(/Would you like to update\?/);
        const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-storage-'));
        const context = { subscriptions: [], globalStorageUri: vscode.Uri.file(storage) } as unknown as vscode.ExtensionContext;
        const outputChannel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;
        provider = new ClaudeCodeProvider(context, outputChannel);
        const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
        registerCommand.mockImplementation((name: string, handler: any) => {
            handlers.set(name, handler);
            return { dispose: jest.fn() };
        });
        registerSpecKitCommands(context, { refresh: jest.fn() } as any, outputChannel);
        createTerminal.mockImplementationOnce(() => shell!.terminal);

        try {
            useFakeClock();
            const runSetup = handlers.get('speckit.constitution')!();
            while (!shell.terminal.show.mock.calls.length) await delay(20);
            await jest.advanceTimersByTimeAsync(90_000);
            await delay(500);

            expect(createTerminal).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'SpecKit - Constitution' }));
            expect(shell.terminal.__typed()).toEqual([]);
            expect(showInformationMessage).toHaveBeenCalledWith(WAITING_FOR_ANSWER_NOTICE, RUN_ANYWAY);

            shell.press('n');
            await runSetup;
            const [line] = shell.terminal.__commands();
            expect(line).toMatch(/^claude .*"\$\(cat ".*prompt-\d+\.md"\)"$/);
            await shell.waitFor(/CLAUDE-PROMPT:\/speckit-constitution/);
            expect(shell.output()).not.toMatch(/command not found/);
        } finally {
            registerCommand.mockReset();
            registerCommand.mockReturnValue({ dispose: jest.fn() });
            fs.rmSync(storage, { recursive: true, force: true });
        }
    }, 30_000);

    it('runs the command intact when the user answers and then clicks Run on a shell that never reports ready', async () => {
        let click!: (choice: string) => void;
        showInformationMessage.mockReturnValueOnce(new Promise(resolve => { click = resolve; }));
        shell = startShell({ integration: false });
        await shell.waitFor(/Would you like to update\?/);
        useFakeClock();
        const pending = runInTerminal(shell.terminal, 'echo DISPATCH-$((40+2))');

        await jest.advanceTimersByTimeAsync(90_000);
        expect(shell.terminal.__typed()).toEqual([]);

        shell.press('n');
        await shell.waitFor(/\x1b\[\?2004h/);
        click(RUN_ANYWAY);
        const run = await pending;
        expect(run.via).toBe('send-text');
        await shell.waitFor(/\nDISPATCH-42/);
        expect(shell.output()).not.toMatch(/command not found/);
    }, 30_000);

    it('reports the exit code of a command that is not found', async () => {
        shell = startShell();
        await shell.waitFor(/Would you like to update\?/);
        shell.press('n');
        const run = await runInTerminal(shell.terminal, 'laude --append-system-prompt x');
        await expect(run.ended).resolves.toBe(127);
        expect(shell.output()).toMatch(/command not found: laude/);
    }, 20_000);
});
