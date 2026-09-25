import { AIProviders } from '../core/constants';
import { buildPromptDispatchCommand } from './aiProvider';
import { CliTerminalProvider, DispatchContext, DispatchPlan } from './cliTerminalProvider';
import { createTempFile } from '../core/utils/tempFileUtils';
import { detectShell, formatPromptFileSubstitution, Shell } from '../core/utils/shellDetection';
import { splitContextPreamble } from './promptBuilder';

function buildSystemPromptFlag(shell: Shell, systemPromptFilePath: string | null): string {
    if (!systemPromptFilePath) return '';
    if (shell === 'cmd') {
        return `--append-system-prompt "${systemPromptFilePath}" `;
    }
    return `--append-system-prompt "${formatPromptFileSubstitution(shell, systemPromptFilePath)}" `;
}

/**
 * Oh My Pi CLI provider.
 *
 * OMP is an interactive terminal agent. It accepts an initial positional message,
 * so dispatch omits `-p`; this preserves tool-approval prompts. The SpecKit
 * context preamble is passed through OMP's `--append-system-prompt` flag so the
 * command remains the only user-visible message.
 */
export class OmpProvider extends CliTerminalProvider {
    public readonly name = 'Oh My Pi';
    public readonly type = AIProviders.OMP;

    protected readonly cliBinary = 'omp';
    protected readonly installHint = {
        displayName: 'Oh My Pi CLI',
        installUrl: 'https://github.com/open-horizon-labs/oh-omp#installation',
    };
    protected readonly defaultTerminalTitle = 'SpecKit - Oh My Pi';
    protected readonly headlessTerminalName = 'Oh My Pi Background';
    protected readonly logPrefix = 'OmpProvider';

    protected async prepareDispatch(ctx: Omit<DispatchContext, 'cliPath' | 'permissionFlag'>): Promise<DispatchPlan> {
        const { preamble, command } = splitContextPreamble(ctx.prompt);
        const filePrefix = ctx.mode === 'headless' ? 'background-prompt' : 'prompt';
        const systemPrefix = ctx.mode === 'headless' ? 'background-system-prompt' : 'system-prompt';

        const promptFilePath = await createTempFile(this.context, command, filePrefix, true);
        const systemPromptFilePath = preamble
            ? await createTempFile(this.context, preamble, systemPrefix, true)
            : null;
        const shell = detectShell();
        const commandLine = buildPromptDispatchCommand({
            cliInvocation: this.cliBinary,
            flags: `${buildSystemPromptFlag(shell, systemPromptFilePath)}${this.getPermissionFlag()}${ctx.mode === 'headless' ? '-p ' : ''}`,
            promptFilePath,
            promptText: command,
            shell,
        });

        return {
            commandLine,
            tempFiles: systemPromptFilePath ? [promptFilePath, systemPromptFilePath] : [promptFilePath],
        };
    }
}
