/** Injectable git runner so tests never need a real repository. */
export type GitRunner = (args: string[], cwd: string, env?: Record<string, string>) => Promise<string>;

/** Default runner factory: the process timeout matches the caller's timeoutMs,
 * so a timed-out race never leaves git running in the background. */
export function makeDefaultGitRunner(timeoutMs: number): GitRunner {
    return (args: string[], cwd: string, env?: Record<string, string>): Promise<string> => {
        const { execFile } = require('child_process');
        return new Promise((resolve, reject) => {
            const options = { cwd, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...env } };
            execFile('git', args, options, (err: Error | null, stdout: string) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stdout);
                }
            });
        });
    };
}
