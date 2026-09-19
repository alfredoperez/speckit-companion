import { AIProviders } from '../core/constants';
import { CliTerminalProvider, DispatchContext, DispatchPlan } from './cliTerminalProvider';
import { inlineSpecifyTempPath } from './promptBuilder';

/**
 * OpenCode CLI provider — `opencode run "$(cat <tmp>)"`.
 *
 * Uses the default dispatch pattern (no extra temp files) but preprocesses the
 * prompt — see `prepareDispatch()` below, which inlines any `specify <temp.md>`
 * path. OpenCode takes the message positionally on its `run` subcommand —
 * `-p` is its `--password` flag, so the default `-p ` prompt flag makes it
 * print help instead of acting on the prompt. Slash commands pass through.
 *
 * OpenCode also sandboxes file reads to the project directory and auto-rejects
 * paths outside it, so a `specify <temp.md>` dispatch (the spec-editor stages
 * its temp file in extension globalStorage) is inlined into the prompt rather
 * than passed by path — the agent gets the spec without an external read.
 */
export class OpenCodeProvider extends CliTerminalProvider {
    public readonly name = 'OpenCode';
    public readonly type = AIProviders.OPENCODE;

    protected readonly cliBinary = 'opencode';
    protected readonly installHint = {
        displayName: 'OpenCode CLI',
        installCommand: 'npm install -g opencode-ai',
    };
    protected readonly defaultTerminalTitle = 'SpecKit - OpenCode';
    protected readonly headlessTerminalName = 'OpenCode Background';
    protected readonly logPrefix = 'OpenCode';

    protected cliPromptFlag(): string {
        return 'run ';
    }

    protected async prepareDispatch(ctx: Omit<DispatchContext, 'cliPath' | 'permissionFlag'>): Promise<DispatchPlan> {
        const prompt = await inlineSpecifyTempPath(ctx.prompt);
        return super.prepareDispatch({ ...ctx, prompt });
    }
}
