import { execFile } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isCompanionInstalled } from './prompts.mjs';

const AGENT_KEY = /^[a-z0-9][a-z0-9-]*$/;
const COMPANION_DIRS = ['.specify/extensions/companion/commands', '.claude/skills', '.agents/skills', '.github/skills'];

let asked;
let askedAt = 0;
const RECHECK_MS = 60_000;

/** `specify version`, asked once per session; resolves to { installed, version }. */
export function checkCli(run = execFile) {
    asked ??= (askedAt = Date.now(), new Promise((resolve) => {
        try {
            run('specify', ['version'], { timeout: 5000 }, (error, stdout) => {
                if (error) return resolve({ installed: false, version: '' });
                resolve({ installed: true, version: (String(stdout).match(/\d+\.\d+\.\d+\S*/) ?? [''])[0] });
            });
        } catch {
            resolve({ installed: false, version: '' });
        }
    }));
    return asked;
}

/** Re-asks a failed check at most once a minute, so installing the CLI shows up without a restart; null when it is not due. */
export function recheckCli(cli, run = execFile, now = Date.now()) {
    if (!cli || cli.installed || now - askedAt < RECHECK_MS) return null;
    asked = undefined;
    return checkCli(run);
}

export function resetCliCheck() {
    asked = undefined;
}

/** Same placeholder rule as VS Code's constitution check; the Sync Impact Report comment is not read. */
export function constitutionState(root) {
    let content;
    try {
        content = readFileSync(join(root, '.specify', 'memory', 'constitution.md'), 'utf-8');
    } catch {
        return 'missing';
    }
    const body = content.replace(/<!--[\s\S]*?-->/g, '');
    return /\[PROJECT_NAME\]|\[PRINCIPLE_\d+_NAME\]|\[PLACEHOLDER\]/.test(body) ? 'template' : 'filled';
}

function agentSetUp(root) {
    try {
        const data = JSON.parse(readFileSync(join(root, '.specify', 'integration.json'), 'utf-8'));
        const keys = Array.isArray(data?.installed_integrations) ? data.installed_integrations : [data?.integration ?? data?.default_integration];
        return keys.some(key => typeof key === 'string' && AGENT_KEY.test(key));
    } catch {
        return false;
    }
}

/** Companion files that are symlinks: a linked worktree or a --dev install keeps them out of the checkout. */
function symlinkedCompanionFiles(root) {
    const linked = [];
    for (const dir of COMPANION_DIRS) {
        let names;
        try { names = readdirSync(join(root, dir)); } catch { continue; }
        for (const name of names) {
            if (!/companion/.test(`${dir}/${name}`)) continue;
            try { if (lstatSync(join(root, dir, name)).isSymbolicLink()) linked.push(`${dir}/${name}`); } catch { /* gone */ }
        }
    }
    return linked;
}

/** `cli` is the cached `specify version` result, or null while it is still being asked. */
export function projectHealth(root, cli) {
    const constitution = constitutionState(root);
    const companion = isCompanionInstalled(root);
    const items = [
        cli
            ? { id: 'cli', ok: cli.installed, label: 'Spec Kit CLI', detail: cli.installed ? (cli.version ? `v${cli.version}` : 'Installed') : 'Not installed', fix: cli.installed ? undefined : 'uv tool install specify-cli --from git+https://github.com/github/spec-kit.git' }
            : { id: 'cli', ok: true, pending: true, label: 'Spec Kit CLI', detail: 'Checking…' },
        { id: 'companion', ok: companion, label: 'Companion', detail: companion ? 'Installed' : 'Not installed', fix: companion ? undefined : 'Use the install command shown in the New spec form' },
        { id: 'constitution', ok: constitution === 'filled', label: 'Constitution', detail: constitution === 'filled' ? 'Filled in' : constitution === 'template' ? 'Still the template' : 'Missing', fix: constitution === 'filled' ? undefined : 'Run /speckit.constitution' },
    ];
    const agent = agentSetUp(root);
    items.push({ id: 'agent', ok: agent, label: 'AI agent', detail: agent ? 'Set up' : 'None set up', fix: agent ? undefined : 'Run specify init --here to pick an agent' });
    if (existsSync(join(root, 'package.json'))) {
        const modules = existsSync(join(root, 'node_modules'));
        items.push({ id: 'node-modules', ok: modules, label: 'Dependencies', detail: modules ? 'node_modules present' : 'node_modules missing at this root', fix: modules ? undefined : 'Run npm install here' });
    }
    if (companion) {
        const linked = symlinkedCompanionFiles(root);
        items.push({ id: 'companion-files', ok: linked.length === 0, label: 'Companion files', detail: linked.length === 0 ? 'Real files' : `${linked.length} symlinked`, fix: linked.length === 0 ? undefined : 'Reinstall Companion in this checkout, not with --dev' });
    }
    return items;
}
