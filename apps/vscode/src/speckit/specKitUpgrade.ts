import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Shell } from '../core/utils/shellDetection';

const execAsync = promisify(exec);

/** The uv command spec-kit's install page gives, for a CLI too old to have `specify self upgrade`. */
export const UV_UPGRADE_COMMAND = 'uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git';

/** `specify self upgrade`, falling back to uv only when it fails. Windows PowerShell 5.1 has no `||`. */
export function cliUpgradeCommand(shell: Shell): string {
    return shell === 'powershell'
        ? `specify self upgrade; if (-not $?) { ${UV_UPGRADE_COMMAND} }`
        : `specify self upgrade || ${UV_UPGRADE_COMMAND}`;
}

/** Runs every command whatever the last one returned, so one blocked step never skips the rest. */
export function inSequence(commands: string[], shell: Shell): string {
    return commands.join(shell === 'cmd' ? ' & ' : '; ');
}

// The keys come from a file the repository controls and end up in a shell command.
const AGENT_KEY = /^[a-z0-9][a-z0-9-]*$/;

/** The agents spec-kit installed in this project, read from `.specify/integration.json`. */
export function installedAgents(root: string): string[] {
    let data: { installed_integrations?: unknown; integration?: unknown; default_integration?: unknown } | null;
    try {
        data = JSON.parse(fs.readFileSync(path.join(root, '.specify', 'integration.json'), 'utf-8'));
    } catch {
        return [];
    }
    const keys = Array.isArray(data?.installed_integrations)
        ? data.installed_integrations
        : [data?.integration ?? data?.default_integration];
    return keys.filter((key: unknown): key is string => typeof key === 'string' && AGENT_KEY.test(key));
}

export function projectUpgradeCommands(agents: string[]): string[] {
    return agents.map(agent => `specify integration upgrade ${agent}`);
}

export interface SpecifyVersion {
    cli: string;
    integrationUpgrade: boolean;
}

let asked: Promise<SpecifyVersion | undefined> | undefined;

/** `specify version --json`, asked once per session; undefined for a CLI without the JSON form. */
export function specifyVersion(): Promise<SpecifyVersion | undefined> {
    asked ??= execAsync('specify version --json', { timeout: 5000 })
        .then(({ stdout }) => {
            const data = JSON.parse(stdout);
            return {
                cli: typeof data?.cli_version === 'string' ? data.cli_version : '',
                integrationUpgrade: data?.features?.integration_upgrade_command === true,
            };
        })
        .catch(() => undefined);
    return asked;
}

export function _resetSpecifyVersionForTests(): void {
    asked = undefined;
}
