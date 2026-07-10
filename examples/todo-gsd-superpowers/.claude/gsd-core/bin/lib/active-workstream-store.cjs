"use strict";
/**
 * Active Workstream Pointer Store Module
 *
 * Owns active workstream source precedence, session identity, and pointer IO:
 * CLI --ws > GSD_WORKSTREAM env > stored active workstream pointer.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/active-workstream-store.cjs
 * collapsed to a TypeScript source of truth. Behaviour is preserved
 * byte-for-behaviour from the prior hand-written .cjs; only types are added.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const shell_command_projection_cjs_1 = require("./shell-command-projection.cjs");
const workstream_name_policy_cjs_1 = require("./workstream-name-policy.cjs");
const WORKSTREAM_SESSION_ENV_KEYS = [
    'GSD_SESSION_KEY',
    'CODEX_THREAD_ID',
    'CLAUDE_SESSION_ID',
    'CLAUDE_CODE_SSE_PORT',
    'OPENCODE_SESSION_ID',
    'GEMINI_SESSION_ID',
    'CURSOR_SESSION_ID',
    'WINDSURF_SESSION_ID',
    'TERM_SESSION_ID',
    'WT_SESSION',
    'TMUX_PANE',
    'ZELLIJ_SESSION_NAME',
];
let cachedControllingTtyToken = null;
let didProbeControllingTtyToken = false;
function planningRoot(cwd) {
    return node_path_1.default.join(cwd, '.planning');
}
function validateWorkstreamName(name) {
    return (0, workstream_name_policy_cjs_1.isValidActiveWorkstreamName)(name);
}
function sanitizeWorkstreamSessionToken(value) {
    if (value === null || value === undefined)
        return null;
    const raw = typeof value === 'string' ? value : `${value}`;
    const token = raw.trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
    return token ? token.slice(0, 160) : null;
}
/** Test-only seam: clear the memoized controlling-TTY probe cache (#1191). */
function _resetControllingTtyCacheForTests() {
    cachedControllingTtyToken = null;
    didProbeControllingTtyToken = false;
}
function probeControllingTtyToken() {
    if (didProbeControllingTtyToken)
        return cachedControllingTtyToken;
    didProbeControllingTtyToken = true;
    if (!(process.stdin && process.stdin.isTTY)) {
        return cachedControllingTtyToken;
    }
    const ttyPath = (0, shell_command_projection_cjs_1.probeTty)();
    if (ttyPath) {
        const token = sanitizeWorkstreamSessionToken(ttyPath.replace(/^\/dev\//, ''));
        if (token)
            cachedControllingTtyToken = `tty-${token}`;
    }
    return cachedControllingTtyToken;
}
function getControllingTtyToken() {
    for (const envKey of ['TTY', 'SSH_TTY']) {
        const token = sanitizeWorkstreamSessionToken(process.env[envKey]);
        if (token)
            return `tty-${token.replace(/^dev_/, '')}`;
    }
    return probeControllingTtyToken();
}
function getWorkstreamSessionKey() {
    for (const envKey of WORKSTREAM_SESSION_ENV_KEYS) {
        const raw = process.env[envKey];
        const token = sanitizeWorkstreamSessionToken(raw);
        if (token)
            return `${envKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${token}`;
    }
    return getControllingTtyToken();
}
function getSessionScopedWorkstreamFile(cwd, fixedSessionKey) {
    const sessionKey = fixedSessionKey || getWorkstreamSessionKey();
    if (!sessionKey)
        return null;
    let planningAbs;
    try {
        planningAbs = node_fs_1.default.realpathSync.native(planningRoot(cwd));
    }
    catch {
        planningAbs = node_path_1.default.resolve(planningRoot(cwd));
    }
    const projectId = node_crypto_1.default
        .createHash('sha1')
        .update(planningAbs)
        .digest('hex')
        .slice(0, 16);
    const dirPath = node_path_1.default.join(node_os_1.default.tmpdir(), 'gsd-workstream-sessions', projectId);
    return {
        sessionKey,
        dirPath,
        filePath: node_path_1.default.join(dirPath, sessionKey),
    };
}
function createSharedPointerAdapter(cwd) {
    const filePath = node_path_1.default.join(planningRoot(cwd), 'active-workstream');
    return {
        read() {
            const raw = (0, shell_command_projection_cjs_1.platformReadSync)(filePath);
            return raw ? raw.trim() || null : null;
        },
        write(name) {
            (0, shell_command_projection_cjs_1.platformWriteSync)(filePath, name + '\n');
        },
        clear() {
            try {
                node_fs_1.default.unlinkSync(filePath);
            }
            catch { }
        },
    };
}
function createSessionScopedPointerAdapter(cwd, fixedSessionKey) {
    const scoped = getSessionScopedWorkstreamFile(cwd, fixedSessionKey);
    if (!scoped)
        return null;
    return {
        read() {
            const raw = (0, shell_command_projection_cjs_1.platformReadSync)(scoped.filePath);
            return raw ? raw.trim() || null : null;
        },
        write(name) {
            (0, shell_command_projection_cjs_1.platformEnsureDir)(scoped.dirPath);
            (0, shell_command_projection_cjs_1.platformWriteSync)(scoped.filePath, name + '\n');
        },
        clear() {
            try {
                node_fs_1.default.unlinkSync(scoped.filePath);
            }
            catch { }
            try {
                const remaining = node_fs_1.default.readdirSync(scoped.dirPath);
                if (remaining.length === 0) {
                    node_fs_1.default.rmdirSync(scoped.dirPath);
                }
            }
            catch { }
        },
    };
}
function createMemoryPointerAdapter(initialName = null) {
    let value = initialName;
    return {
        read() {
            return value;
        },
        write(name) {
            value = name;
        },
        clear() {
            value = null;
        },
    };
}
function pickActiveWorkstreamAdapter(cwd, opts = {}) {
    if (opts.activeWorkstreamAdapter) {
        return opts.activeWorkstreamAdapter;
    }
    const sessionKey = getWorkstreamSessionKey();
    if (sessionKey) {
        if (opts.activeWorkstreamAdapters && opts.activeWorkstreamAdapters.session) {
            return opts.activeWorkstreamAdapters.session;
        }
        return createSessionScopedPointerAdapter(cwd, sessionKey);
    }
    if (opts.activeWorkstreamAdapters && opts.activeWorkstreamAdapters.shared) {
        return opts.activeWorkstreamAdapters.shared;
    }
    return createSharedPointerAdapter(cwd);
}
function getActiveWorkstream(cwd, opts = {}) {
    const adapter = pickActiveWorkstreamAdapter(cwd, opts);
    if (!adapter)
        return null;
    const name = adapter.read();
    if (!name || !validateWorkstreamName(name)) {
        adapter.clear();
        return null;
    }
    const wsDir = node_path_1.default.join(planningRoot(cwd), 'workstreams', name);
    if (!node_fs_1.default.existsSync(wsDir)) {
        adapter.clear();
        return null;
    }
    return name;
}
function setActiveWorkstream(cwd, name, opts = {}) {
    const adapter = pickActiveWorkstreamAdapter(cwd, opts);
    if (!adapter)
        return;
    if (!name) {
        adapter.clear();
        return;
    }
    if (!validateWorkstreamName(name)) {
        throw new Error('Invalid workstream name: must be alphanumeric, hyphens, underscores, or dots');
    }
    const wsDir = node_path_1.default.join(planningRoot(cwd), 'workstreams', name);
    (0, shell_command_projection_cjs_1.platformEnsureDir)(wsDir);
    adapter.write(name);
}
function clearActiveWorkstream(cwd, opts = {}) {
    const adapter = pickActiveWorkstreamAdapter(cwd, opts);
    if (!adapter)
        return;
    adapter.clear();
}
function parseCliWorkstream(args) {
    const wsEqArg = args.find((arg) => arg.startsWith('--ws='));
    const wsIdx = args.indexOf('--ws');
    if (wsEqArg) {
        const value = wsEqArg.slice('--ws='.length).trim();
        if (!value)
            throw new Error('Missing value for --ws');
        return {
            value,
            source: 'cli',
            args: args.filter((arg) => arg !== wsEqArg),
        };
    }
    if (wsIdx !== -1) {
        const value = args[wsIdx + 1];
        if (!value || value.startsWith('--'))
            throw new Error('Missing value for --ws');
        return {
            value,
            source: 'cli',
            args: args.filter((_, idx) => idx !== wsIdx && idx !== wsIdx + 1),
        };
    }
    return {
        value: null,
        source: null,
        args: args.slice(),
    };
}
function resolveActiveWorkstream(cwd, args, env = process.env, deps = {}) {
    const parsed = parseCliWorkstream(args);
    const getStored = deps.getStored || ((dir) => getActiveWorkstream(dir, deps));
    let ws = null;
    let source = 'none';
    if (parsed.value) {
        ws = parsed.value;
        source = parsed.source ?? 'cli';
    }
    else if (env && typeof env['GSD_WORKSTREAM'] === 'string' && env['GSD_WORKSTREAM'].trim()) {
        ws = env['GSD_WORKSTREAM'].trim();
        source = 'env';
    }
    else {
        ws = getStored(cwd) || null;
        source = ws ? 'store' : 'none';
    }
    if (ws && !validateWorkstreamName(ws)) {
        throw new Error('Invalid workstream name: must be alphanumeric, hyphens, underscores, or dots');
    }
    return {
        ws,
        source,
        args: parsed.args,
    };
}
function applyResolvedWorkstreamEnv(resolution, env = process.env) {
    if (!resolution || !resolution.ws)
        return;
    env['GSD_WORKSTREAM'] = resolution.ws;
}
module.exports = {
    validateWorkstreamName,
    getWorkstreamSessionKey,
    createSharedPointerAdapter,
    createSessionScopedPointerAdapter,
    createMemoryPointerAdapter,
    pickActiveWorkstreamAdapter,
    getActiveWorkstream,
    setActiveWorkstream,
    clearActiveWorkstream,
    parseCliWorkstream,
    resolveActiveWorkstream,
    applyResolvedWorkstreamEnv,
    _resetControllingTtyCacheForTests,
};
