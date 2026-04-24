/**
 * Pure helper for assembling the shell command that pipes a prompt file into
 * `codex exec`. Currently supports two shell families:
 *
 * - `sh`  — bash-family shells (bash, zsh, dash, etc.) on macOS / Linux /
 *           WSL / Git Bash. Uses `cat "<file>" | codex exec -`.
 * - `ps`  — PowerShell (Windows PowerShell 5.x and PowerShell 7+). Uses
 *           `$OutputEncoding = [System.Text.UTF8Encoding]::new(); Get-Content
 *           "<file>" -Raw -Encoding UTF8 | codex exec -`. The encoding
 *           prelude forces UTF-8 on the native-command pipe (Windows
 *           PowerShell 5.1 otherwise defaults to ASCII, which corrupts
 *           non-ASCII prompt bytes before they reach `codex exec -`).
 *
 * The helper intentionally does NOT use `<` input redirection because
 * PowerShell does not support it, and we want a single code path per shell
 * family that cleanly pipes stdin into `codex exec -`.
 *
 * The caller MUST pass a safe `promptFilePath`. This helper does not escape
 * it because it is expected to be a filename produced by `createTempFile`
 * (which yields a predictable temp path with no user-controlled characters).
 */

export interface CodexExecCommandOptions {
    script: 'sh' | 'ps';
    promptFilePath: string;
    permissionFlag?: string;
}

/**
 * Build the full shell command string to stream a prompt file into
 * `codex exec` for the requested shell family.
 *
 * @param opts.script           `'sh'` for bash-family, `'ps'` for PowerShell.
 *                              Any unknown value falls back to `'sh'`.
 * @param opts.promptFilePath   Absolute path to the prompt file. Used
 *                              verbatim inside double quotes; must be safe.
 * @param opts.permissionFlag   Optional flag placed immediately before the
 *                              trailing `-`. Empty / whitespace-only values
 *                              are treated as if the flag were omitted.
 */
export function buildCodexExecCommand(opts: CodexExecCommandOptions): string {
    const { script, promptFilePath, permissionFlag } = opts;

    const trimmedFlag = permissionFlag?.trim() ?? '';
    const flagSegment = trimmedFlag.length > 0 ? `${trimmedFlag} ` : '';

    if (script === 'ps') {
        return `$OutputEncoding = [System.Text.UTF8Encoding]::new(); Get-Content "${promptFilePath}" -Raw -Encoding UTF8 | codex exec ${flagSegment}-`;
    }

    return `cat "${promptFilePath}" | codex exec ${flagSegment}-`;
}
