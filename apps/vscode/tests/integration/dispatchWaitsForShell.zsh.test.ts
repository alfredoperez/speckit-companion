// A real zsh asks a one-key question at startup; a precmd hook stands in for VS Code's OSC 633 integration, loaded after the user's rc as VS Code loads it.
import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { runInTerminal } from '../../src/core/utils/terminalUtils';

const mock = vscode as unknown as {
    createMockTerminal: (o: { name?: string; shellIntegration?: boolean; write?: (d: string) => void }) => any;
    __fireShellExecutionEnd: (terminal: unknown, execution: unknown, exitCode: number) => void;
};

const available = process.platform !== 'win32'
    && ['zsh', 'python3'].every(bin => spawnSync('which', [bin]).status === 0);
const describeWithZsh = available ? describe : describe.skip;

const USER_ZSHRC = 'read -k 1 "REPLY?[oh-my-zsh] Would you like to update? [Y/n] "\necho\n';
const INJECTED_ZSHRC = [
    '. "$USER_ZDOTDIR/.zshrc"',
    '__sim_ran=0',
    'preexec() { __sim_ran=1 }',
    "precmd() { local s=$?; if (( __sim_ran )); then printf '\\e]633;D;%s\\a' $s; __sim_ran=0; fi; printf '\\e]633;A\\a' }",
    "PS1='%% '",
    '',
].join('\n');
const PTY_BRIDGE = "import pty, sys\nsys.exit(pty.spawn(['zsh', '-i']) >> 8)";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Shell {
    terminal: any;
    output(): string;
    press(key: string): void;
    waitFor(pattern: RegExp, timeoutMs?: number): Promise<void>;
    close(): void;
}

function startShell(): Shell {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-zsh-'));
    const userDir = path.join(root, 'user');
    const injectDir = path.join(root, 'inject');
    fs.mkdirSync(userDir);
    fs.mkdirSync(injectDir);
    fs.writeFileSync(path.join(userDir, '.zshrc'), USER_ZSHRC);
    fs.writeFileSync(path.join(injectDir, '.zshrc'), INJECTED_ZSHRC);

    const child: ChildProcessWithoutNullStreams = spawn('python3', ['-c', PTY_BRIDGE], {
        env: { ...process.env, ZDOTDIR: injectDir, USER_ZDOTDIR: userDir, TERM: 'xterm', HISTFILE: path.join(root, 'history') },
    });
    let out = '';
    let integrated = false;
    let endsSeen = 0;
    const terminal = mock.createMockTerminal({
        name: 'SpecKit - Claude Code',
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
            const until = Date.now() + timeoutMs;
            while (!pattern.test(out)) {
                if (Date.now() > until) throw new Error(`Timed out waiting for ${pattern}; shell printed:\n${JSON.stringify(out)}`);
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

describeWithZsh('dispatching into a real zsh that asks a question at startup', () => {
    let shell: Shell;

    beforeEach(() => {
        shell = startShell();
    });

    afterEach(() => {
        shell.close();
    });

    it('the previous behaviour, typing after a fixed 5 s wait, loses the first character to the question', async () => {
        await shell.waitFor(/Would you like to update\?/);
        await delay(5000);
        shell.terminal.sendText('echo DISPATCH-$((40+2))');
        await shell.waitFor(/command not found: cho/);
        expect(shell.output()).not.toMatch(/\nDISPATCH-42/);
    }, 20_000);

    it('runInTerminal holds the command until the question is answered, and it runs intact', async () => {
        await shell.waitFor(/Would you like to update\?/);
        const pending = runInTerminal(shell.terminal, 'echo DISPATCH-$((40+2))');

        await delay(6000);
        expect(shell.terminal.__typed()).toEqual([]);

        shell.press('n');
        const run = await pending;
        expect(run.via).toBe('shell-integration');

        await shell.waitFor(/\nDISPATCH-42/);
        expect(shell.output()).not.toMatch(/command not found/);
        await expect(run.ended).resolves.toBe(0);
    }, 20_000);

    it('reports the exit code of a command that is not found', async () => {
        await shell.waitFor(/Would you like to update\?/);
        shell.press('n');
        const run = await runInTerminal(shell.terminal, 'laude --append-system-prompt x');
        await expect(run.ended).resolves.toBe(127);
        expect(shell.output()).toMatch(/command not found: laude/);
    }, 20_000);
});
