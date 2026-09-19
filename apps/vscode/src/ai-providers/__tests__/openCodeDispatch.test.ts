import * as vscode from 'vscode';
import { buildPromptDispatchCommand } from '../aiProvider';
import { getPermissionFlagForProvider } from '../permissionValidation';
import { CliTerminalProvider } from '../cliTerminalProvider';
import { OpenCodeProvider } from '../openCodeProvider';
import { QwenCliProvider } from '../qwenCliProvider';
import { CopilotCliProvider } from '../copilotCliProvider';
import { AIProviderType } from '../aiProvider';
import { AIProviders } from '../../core/constants';
import { inlineSpecifyTempPath } from '../promptBuilder';
import { createTempFile } from '../../core/utils/tempFileUtils';

jest.mock('../../core/utils/tempFileUtils', () => ({
    createTempFile: jest.fn().mockResolvedValue('/tmp/p.md'),
}));

/** Reaches the protected dispatch primitives a provider feeds the base class. */
type DispatchInternals = CliTerminalProvider & {
    cliBinary: string;
    cliPromptFlag(): string;
};

function mockAutoApproveMode() {
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn((key: string, defaultValue?: unknown) =>
            key === 'permissionMode' ? 'auto-approve' : defaultValue
        ),
    });
}

function makeProvider<T extends CliTerminalProvider>(
    Ctor: new (...args: any[]) => T,
): DispatchInternals {
    return new Ctor({} as any, {} as any) as unknown as DispatchInternals;
}

/** The exact bash line the base class assembles for a default-pattern provider. */
function dispatchedBashCommand(p: DispatchInternals, type: AIProviderType): string {
    return buildPromptDispatchCommand({
        cliInvocation: p.cliBinary,
        flags: `${getPermissionFlagForProvider(type)}${p.cliPromptFlag()}`,
        promptFilePath: '/tmp/p.md',
        promptText: 'unused',
        shell: 'bash',
    });
}

describe('OpenCode dispatch uses the `run` subcommand', () => {
    beforeEach(() => mockAutoApproveMode());

    it('OpenCode dispatches via `run`, not the `-p` (--password) flag', () => {
        const opencode = makeProvider(OpenCodeProvider);

        expect(opencode.cliPromptFlag()).toBe('run ');

        const line = dispatchedBashCommand(opencode, AIProviders.OPENCODE);
        expect(line).toBe('opencode run "$(cat "/tmp/p.md")"');
        expect(line).toContain('opencode run "');
        expect(line).not.toContain('-p');
    });

    describe('regression — other providers keep their `-p ` prompt flag (FR-003 / SC-002)', () => {
        it('Qwen still emits `qwen --yolo -p `', () => {
            const qwen = makeProvider(QwenCliProvider);

            expect(qwen.cliPromptFlag()).toBe('-p ');
            expect(dispatchedBashCommand(qwen, AIProviders.QWEN)).toBe(
                'qwen --yolo -p "$(cat "/tmp/p.md")"'
            );
        });

        it('Copilot still emits its `-p ` form', () => {
            const copilot = makeProvider(CopilotCliProvider);

            expect(copilot.cliPromptFlag()).toBe('-p ');
            // Copilot forces auto-approve (`--yolo `) at dispatch; the prompt
            // flag itself stays `-p `.
            expect(dispatchedBashCommand(copilot, AIProviders.COPILOT)).toBe(
                'copilot --yolo -p "$(cat "/tmp/p.md")"'
            );
        });
    });
});

describe('OpenCode inlines a `specify <temp.md>` dispatch (issue #207)', () => {
    beforeEach(() => mockAutoApproveMode());

    describe('inlineSpecifyTempPath', () => {
        it('replaces the path arg with the full file body, bookkeeping included', async () => {
            const body = 'Build a login form.\n\n## Post-Specification\nrun the capture hook';
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValueOnce(Buffer.from(body));

            // Path has a space ("Application Support") — the whole arg is the path.
            const out = await inlineSpecifyTempPath(
                '/speckit.specify /Users/x/Application Support/Code/spec.md'
            );

            expect(out).toBe(`/speckit.specify\n\n${body}`);
            // NOT stripped at the marker the way cleanCommandArg strips it.
            expect(out).toContain('## Post-Specification');
        });

        it('leaves a free-text specify prompt unchanged', async () => {
            expect(await inlineSpecifyTempPath('/speckit.specify add user auth'))
                .toBe('/speckit.specify add user auth');
        });

        it('leaves non-specify commands unchanged', async () => {
            expect(await inlineSpecifyTempPath('/speckit.plan /Users/x/spec.md'))
                .toBe('/speckit.plan /Users/x/spec.md');
        });

        it('returns the prompt unchanged when the file cannot be read', async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('nope'));
            expect(await inlineSpecifyTempPath('/speckit.specify /tmp/missing.md'))
                .toBe('/speckit.specify /tmp/missing.md');
        });
    });

    it('prepareDispatch writes the inlined spec — no external path — into the dispatched temp file', async () => {
        const body = 'Authored spec body.';
        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValueOnce(Buffer.from(body));
        const opencode = makeProvider(OpenCodeProvider);

        const plan = await (opencode as unknown as {
            prepareDispatch(ctx: unknown): Promise<{ commandLine: string }>;
        }).prepareDispatch({
            mode: 'terminal',
            prompt: '/speckit.specify /Users/x/Application Support/Code/spec.md',
            slashCommand: null,
        });

        const writtenPrompt = (createTempFile as jest.Mock).mock.calls.at(-1)?.[1];
        expect(writtenPrompt).toBe(`/speckit.specify\n\n${body}`);
        expect(writtenPrompt).not.toContain('Application Support');
        expect(plan.commandLine).toContain('opencode run "');
        expect(plan.commandLine).toContain('/tmp/p.md');
    });
});
