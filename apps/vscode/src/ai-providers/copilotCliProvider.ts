import { AIProviders, CLIDefaults } from '../core/constants';
import { CliTerminalProvider, DispatchContext } from './cliTerminalProvider';

/**
 * GitHub Copilot CLI provider — `copilot -p "$(cat <tmp>)"`.
 *
 * Only deviation from the default pattern: Copilot has no slash-command
 * surface, so an incoming `/speckit.specify …` style command must have the
 * leading slash stripped before it reaches the CLI. Everything else is the
 * shared dispatch dance.
 */
export class CopilotCliProvider extends CliTerminalProvider {
    public readonly name = 'GitHub Copilot CLI';
    public readonly type = AIProviders.COPILOT;

    protected readonly cliBinary = CLIDefaults.copilot;
    protected readonly installHint = {
        displayName: 'GitHub Copilot CLI',
        installCommand: 'gh extension install github/gh-copilot',
    };
    protected readonly defaultTerminalTitle = 'SpecKit - Copilot';
    protected readonly headlessTerminalName = 'Copilot CLI Background';
    protected readonly logPrefix = 'CopilotCliProvider';
    // The `gh copilot` extension runs natively on Windows even when invoked
    // from a WSL-style shell. Translating the temp-file path to `/mnt/c/...`
    // would hand it a form it can't open. Stay on the native path.
    protected readonly convertTempFilePathForWSL = false;

    protected preprocessPrompt(ctx: Omit<DispatchContext, 'cliPath' | 'permissionFlag'>): string {
        return ctx.prompt.startsWith('/') ? ctx.prompt.substring(1) : ctx.prompt;
    }
}
