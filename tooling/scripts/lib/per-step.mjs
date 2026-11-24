// Runs desktop-check's talk steps one process each, so a step that hangs its VS Code window cannot sink the steps after it.
import { spawn } from 'node:child_process';

/** The talk steps in desktop-check's source: every `step(...)` whose options carry `needs: 'talk-sandbox'`, with the kind of run it belongs to. */
export function talkSteps(source) {
    const found = [];
    for (const chunk of source.split(/await step\(/).slice(1)) {
        const name = /^\s*'([^']+)'/.exec(chunk)?.[1];
        const options = /\{[^{}]*needs:\s*'talk-sandbox'[^{}]*\}\s*\);/.exec(chunk);
        if (!name || !options) continue;
        found.push({ name, kind: /record:\s*true/.test(options[0]) ? 'record' : 'shots' });
    }
    return found;
}

/** The arguments a child gets: the parent's own, minus --only and --sheet, plus the one step and --append so it keeps its siblings' pictures. */
export function childArgs(argv, extra) {
    const out = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--only') i++;
        else if (argv[i] !== '--sheet') out.push(argv[i]);
    }
    return [...out, '--append', ...extra];
}

/**
 * Runs each name through spawn(name) -> Promise<exit code>, retrying a failure `retries` times. Never throws: a step that fails every try is reported, and the next one still runs.
 */
export async function runPerStep(names, spawnStep, { retries = 1, log = () => undefined } = {}) {
    const results = [];
    for (const name of names) {
        let attempts = 0;
        let ok = false;
        while (!ok && attempts <= retries) {
            attempts++;
            let code;
            try {
                code = await spawnStep(name);
            } catch {
                code = 1;
            }
            ok = code === 0;
            if (!ok && attempts <= retries) log(`retry ${name}: attempt ${attempts} failed`);
        }
        results.push({ name, ok, attempts });
        log(`${ok ? 'ok  ' : 'FAIL'} ${name}${attempts > 1 ? ` (${attempts} attempts)` : ''}`);
    }
    return results;
}

const live = new Set();
let guarded = false;

// A child has its own process group, so an interrupt of the parent has to be passed on or its window outlives the run.
function guardSignals() {
    if (guarded) return;
    guarded = true;
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => {
            for (const pid of live) {
                try {
                    process.kill(-pid, 'SIGKILL');
                } catch {
                    // already gone
                }
            }
            process.exit(130);
        });
    }
}

/** Runs one child to its end and resolves with its exit code. A child past `timeoutMs` (0 for no limit), or one that fails, is killed with its whole process group, so the VS Code window it opened goes too. */
export function spawnChild(script, args, timeoutMs = 0) {
    guardSignals();
    return new Promise(resolveCode => {
        const child = spawn(process.execPath, [script, ...args], { stdio: 'inherit', detached: true });
        const kill = () => {
            try {
                process.kill(-child.pid, 'SIGKILL');
            } catch {
                // already gone
            }
        };
        const timer = timeoutMs > 0 ? setTimeout(() => {
            kill();
            resolveCode(124);
        }, timeoutMs) : undefined;
        if (child.pid) live.add(child.pid);
        child.on('error', () => {
            clearTimeout(timer);
            resolveCode(1);
        });
        child.on('close', code => {
            clearTimeout(timer);
            live.delete(child.pid);
            if (code) kill();
            resolveCode(code ?? 1);
        });
    });
}
