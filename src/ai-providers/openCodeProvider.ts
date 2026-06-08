import { AIProviders } from '../core/constants';
import { CliTerminalProvider } from './cliTerminalProvider';

/**
 * OpenCode CLI provider — `opencode run "$(cat <tmp>)"`.
 *
 * Default dispatch pattern with no prompt preprocessing and no extra temp
 * files. OpenCode takes the message positionally on its `run` subcommand —
 * `-p` is its `--password` flag, so the default `-p ` prompt flag makes it
 * print help instead of acting on the prompt. Slash commands pass through.
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
}
