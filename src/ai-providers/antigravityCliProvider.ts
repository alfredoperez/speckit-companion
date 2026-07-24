import { AIProviders } from '../core/constants';
import { CliTerminalProvider } from './cliTerminalProvider';

/**
 * Antigravity CLI provider — `agy -i "$(cat <tmp>)"`.
 *
 * Google's Antigravity ships a terminal agent, the `agy` binary (the successor
 * to Gemini CLI). It is agentic and interactive: `-p` runs a single prompt
 * non-interactively and hangs waiting for tool-approval prompts, so we dispatch
 * with `-i` / `--prompt-interactive` — "run an initial prompt interactively and
 * continue the session" — which lets the user approve edits/commands live in the
 * terminal, the same shape as the other CLI agents.
 */
export class AntigravityCliProvider extends CliTerminalProvider {
    public readonly name = 'Antigravity';
    public readonly type = AIProviders.ANTIGRAVITY;

    protected readonly cliBinary = 'agy';
    protected readonly installHint = {
        displayName: 'Antigravity CLI (agy)',
        installCommand: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
    };
    protected readonly defaultTerminalTitle = 'SpecKit - Antigravity';
    protected readonly headlessTerminalName = 'Antigravity Background';
    protected readonly logPrefix = 'Antigravity';

    protected cliPromptFlag(): string {
        return '-i ';
    }
}
