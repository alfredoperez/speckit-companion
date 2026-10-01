import * as fs from 'fs';
import * as vscode from 'vscode';
import { Timing } from '../../core/constants';
import { ClaudeCodeProvider } from '../claudeCodeProvider';
import { QwenCliProvider } from '../qwenCliProvider';

jest.mock('../../core/utils/tempFileUtils', () => ({
    createTempFile: jest.fn().mockResolvedValue('/tmp/prompt.md'),
}));

const mock = vscode as unknown as {
    createMockTerminal: (o?: { name?: string; shellIntegration?: boolean }) => any;
};
const createTerminal = vscode.window.createTerminal as jest.Mock;
const defaultCreateTerminal = createTerminal.getMockImplementation();

async function flush(): Promise<void> {
    for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve));
}

describe('a terminal provider dispatching into a shell that is still starting', () => {
    let terminal: any;

    beforeEach(() => {
        terminal = mock.createMockTerminal({ shellIntegration: false });
        createTerminal.mockImplementation(() => terminal);
    });

    afterEach(() => {
        createTerminal.mockImplementation(defaultCreateTerminal);
    });

    it('Claude Code shows the terminal at once but types nothing until the shell is at its prompt', async () => {
        const provider = new ClaudeCodeProvider({} as vscode.ExtensionContext, { appendLine: jest.fn() } as unknown as vscode.OutputChannel);
        const dispatched = provider.executeInTerminal('/speckit-plan specs/012-login');
        await flush();

        expect(terminal.show).toHaveBeenCalled();
        expect(terminal.__typed()).toEqual([]);

        terminal.__activateShellIntegration();
        await dispatched;

        const [line] = terminal.__commands();
        expect(line).toMatch(/^claude /);
        expect(terminal.shellIntegration.executeCommand).toHaveBeenCalledWith(line);
        expect(terminal.sendText).not.toHaveBeenCalled();
    });

    it('the Claude Code slash path waits the same way', async () => {
        const provider = new ClaudeCodeProvider({} as vscode.ExtensionContext, { appendLine: jest.fn() } as unknown as vscode.OutputChannel);
        const dispatched = provider.executeSlashCommand('speckit.constitution', 'SpecKit - Constitution');
        await flush();
        expect(terminal.__typed()).toEqual([]);

        terminal.__activateShellIntegration();
        await dispatched;
        expect(terminal.__commands()).toEqual([expect.stringMatching(/^claude .*"\/speckit-constitution"$/)]);
    });

    it('Run Setup types nothing past the old one-minute cap, and sends the whole command when Run is clicked', async () => {
        jest.useFakeTimers();
        let click!: (choice: string) => void;
        (vscode.window.showInformationMessage as jest.Mock).mockReturnValueOnce(new Promise(resolve => { click = resolve; }));
        try {
            const provider = new ClaudeCodeProvider({} as vscode.ExtensionContext, { appendLine: jest.fn() } as unknown as vscode.OutputChannel);
            const dispatched = provider.executeInTerminal('/speckit-constitution', 'SpecKit - Constitution');
            await jest.advanceTimersByTimeAsync(90_000);
            expect(terminal.__typed()).toEqual([]);

            click('Run');
            await dispatched;
            expect(terminal.sendText).toHaveBeenCalledTimes(1);
            expect(terminal.sendText).toHaveBeenCalledWith('claude "$(cat "/tmp/prompt.md")"', true);
        } finally {
            jest.useRealTimers();
        }
    });

    it('still removes the prompt file when the waiting terminal is closed', async () => {
        jest.useFakeTimers();
        const unlink = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);
        try {
            const provider = new ClaudeCodeProvider({} as vscode.ExtensionContext, { appendLine: jest.fn() } as unknown as vscode.OutputChannel);
            const dispatched = provider.executeInTerminal('/speckit-constitution', 'SpecKit - Constitution');
            const failed = expect(dispatched).rejects.toThrow('closed before its command ran');
            await jest.advanceTimersByTimeAsync(10_000);
            (vscode as any).__fireCloseTerminal(terminal);
            await failed;

            await jest.advanceTimersByTimeAsync(Timing.tempFileCleanupDelay);
            expect(unlink).toHaveBeenCalledWith('/tmp/prompt.md');
            expect(terminal.__typed()).toEqual([]);
        } finally {
            unlink.mockRestore();
            jest.useRealTimers();
        }
    });

    it('a default-pattern CLI provider waits the same way', async () => {
        const provider = new QwenCliProvider({} as vscode.ExtensionContext, { appendLine: jest.fn() } as unknown as vscode.OutputChannel);
        jest.spyOn(provider as any, 'ensureInstalled').mockResolvedValue(undefined);
        const dispatched = provider.executeInTerminal('/speckit.plan specs/012-login');
        await flush();
        expect(terminal.__typed()).toEqual([]);

        terminal.__activateShellIntegration();
        await dispatched;
        expect(terminal.__commands()).toEqual([expect.stringMatching(/^qwen /)]);
    });
});
