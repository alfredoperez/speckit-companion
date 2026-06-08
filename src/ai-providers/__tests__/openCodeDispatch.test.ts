import * as vscode from 'vscode';
import { buildPromptDispatchCommand } from '../aiProvider';
import { getPermissionFlagForProvider } from '../permissionValidation';
import { CliTerminalProvider } from '../cliTerminalProvider';
import { OpenCodeProvider } from '../openCodeProvider';
import { QwenCliProvider } from '../qwenCliProvider';
import { CopilotCliProvider } from '../copilotCliProvider';
import { AIProviderType } from '../aiProvider';
import { AIProviders } from '../../core/constants';

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
