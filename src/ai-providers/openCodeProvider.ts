import { AIProviders } from '../core/constants';
import { CliTerminalProvider } from './cliTerminalProvider';

/**
 * OpenCode CLI provider — `opencode -p "$(cat <tmp>)"`.
 *
 * Identical shape to Qwen: default dispatch pattern, no prompt preprocessing,
 * no extra temp files. Slash commands pass through as prompts.
 */
export class OpenCodeProvider extends CliTerminalProvider {
    public readonly name = 'OpenCode';
    public readonly type = AIProviders.OPENCODE;

    protected readonly cliBinary = 'opencode';
    protected readonly cliPathSettingKey = 'opencodePath';
    protected readonly installHint = {
        displayName: 'OpenCode CLI',
        installCommand: 'npm install -g opencode-ai',
    };
    protected readonly defaultTerminalTitle = 'SpecKit - OpenCode';
    protected readonly headlessTerminalName = 'OpenCode Background';
    protected readonly logPrefix = 'OpenCode';
}
