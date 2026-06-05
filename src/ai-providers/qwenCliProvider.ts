import { AIProviders } from '../core/constants';
import { CliTerminalProvider } from './cliTerminalProvider';

/**
 * Qwen Code CLI provider — `qwen -p "$(cat <tmp>)"`.
 *
 * Shape is the default `CliTerminalProvider` pattern: write prompt to a temp
 * file, invoke the CLI with `-p`, clean up. No prompt preprocessing, no
 * additional temp files. The slash-command entry passes the slash through;
 * Qwen treats it as a regular prompt.
 */
export class QwenCliProvider extends CliTerminalProvider {
    public readonly name = 'Qwen Code';
    public readonly type = AIProviders.QWEN;

    protected readonly cliBinary = 'qwen';
    protected readonly installHint = {
        displayName: 'Qwen Code CLI',
        installCommand: 'npm install -g @qwen-code/qwen-code@latest',
    };
    protected readonly defaultTerminalTitle = 'SpecKit - Qwen Code';
    protected readonly headlessTerminalName = 'Qwen Code Background';
    protected readonly logPrefix = 'Qwen';
}
