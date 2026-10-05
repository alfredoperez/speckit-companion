// A detached tmux session on a server of its own: start a program in it, send keys, read the screen.
import { execFile, execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);
export const sleep = ms => new Promise(done => setTimeout(done, ms));

/** The caller's environment without the variables that mark a process as running inside Claude Code or tmux. */
export function outsideEnv(env = process.env) {
    const out = {};
    for (const [key, value] of Object.entries(env)) {
        if (key === 'CLAUDE_CONFIG_DIR' || !/^(CLAUDE|TMUX)/.test(key)) out[key] = value;
    }
    return out;
}

export async function startSession({ name, cols, rows, cwd, command, env = {} }) {
    // A private server reads no user config, and a manual window size survives someone attaching to watch.
    const tmux = (...args) => run('tmux', ['-L', name, ...args], { env: outsideEnv(), maxBuffer: 16 << 20 });
    await tmux(
        '-f', '/dev/null',
        'start-server', ';',
        'set-option', '-g', 'default-terminal', 'tmux-256color', ';',
        'set-option', '-g', 'window-size', 'manual', ';',
        'set-option', '-g', 'status', 'off', ';',
        'set-option', '-g', 'escape-time', '50', ';',
        'new-session', '-d', '-s', name, '-x', String(cols), '-y', String(rows), '-c', cwd, '-e', 'COLORTERM=truecolor', ...Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]), '--', ...command,
    );
    // A killed server leaves its socket file behind.
    const socket = (await tmux('display-message', '-p', '-t', name, '#{socket_path}')).stdout.trim();
    let dead = false;
    return {
        name,
        watch: `tmux -L ${name} attach -t ${name} -r`,
        /** Named keys such as Enter, Tab, Down, Escape, C-x, or single characters. */
        async keys(...keys) {
            for (const key of keys) {
                await tmux('send-keys', '-t', name, key);
                await sleep(120);
            }
        },
        async type(text) {
            await tmux('send-keys', '-t', name, '-l', '--', text);
        },
        /** The screen with its colour escapes; throws once the program has exited. */
        async capture() {
            const { stdout } = await tmux('capture-pane', '-e', '-p', '-t', name);
            return stdout;
        },
        async alive() {
            if (dead) return false;
            return tmux('has-session', '-t', name).then(() => true, () => false);
        },
        async kill() {
            if (dead) return;
            dead = true;
            await tmux('kill-server').catch(() => undefined);
            if (socket) rmSync(socket, { force: true });
        },
        /** For a signal handler, where nothing can be awaited. */
        killNow() {
            if (dead) return;
            dead = true;
            try {
                execFileSync('tmux', ['-L', name, 'kill-server'], { stdio: 'ignore' });
            } catch {
                // The server is already gone.
            }
            if (socket) rmSync(socket, { force: true });
        },
    };
}
