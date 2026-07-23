import { AIProviders } from '../core/constants';
import { CliTerminalProvider } from './cliTerminalProvider';

/**
 * Antigravity CLI provider — `antigravity -p "$(cat <tmp>)"`.
 *
 * Google's agentic coding tool. Shape is the default `CliTerminalProvider`
 * pattern (same as Qwen): write the prompt to a temp file, invoke the CLI
 * with `-p`, clean up. The slash-command entry passes the slash through.
 *
 * The exact binary name and prompt flag are the one detail that can't be
 * verified from inside this repo; they're isolated here so a maintainer can
 * correct them in one place if the real invocation differs.
 */
export class AntigravityCliProvider extends CliTerminalProvider {
    public readonly name = 'Antigravity';
    public readonly type = AIProviders.ANTIGRAVITY;

    protected readonly cliBinary = 'antigravity';
    // Antigravity is a download — surface the install page as an openable URL, not a copyable command.
    protected readonly installHint = {
        displayName: 'Antigravity CLI',
        installUrl: 'https://antigravity.google',
    };
    protected readonly defaultTerminalTitle = 'SpecKit - Antigravity';
    protected readonly headlessTerminalName = 'Antigravity Background';
    protected readonly logPrefix = 'Antigravity';
}
