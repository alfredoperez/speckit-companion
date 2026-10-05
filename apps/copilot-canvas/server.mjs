// The canvas page's local server: static assets, a token-guarded JSON API, and a live event stream.
// It never imports the Copilot SDK, so dev.mjs and the tests run it on their own.

import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshot, findSpec, readSpecDetail, resolveSpecDirs } from './specs-core.mjs';
import { STEP_COMMANDS, availableCommands, buildAskPrompt, buildInstallPrompt, buildPrompt, buildSpecifyPrompt, buildStepPreamble, commandPattern, commandSetFor, detectCommandSet, hasWorkspaceWriter, resolveCommand, runInstructionsDoc, specifyChoices, stepInstructionsName, writeRunInstructions, writerPath } from './prompts.mjs';
import { recordStep } from './run-record.mjs';
import { withRunningStep } from './spec-rules.mjs';

const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const ASSETS = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
    '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
    '/viewer.css': ['../vendor/viewer.css', 'text/css; charset=utf-8'],
};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'";
const BODY_LIMIT = 16 * 1024;
const DEBOUNCE_MS = 200;
const QUIET_MS = 120000;

function sendJson(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
}

async function readJson(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
        size += chunk.length;
        if (size > BODY_LIMIT) throw new Error('Request body is too large.');
        chunks.push(chunk);
    }
    if (!chunks.length) return {};
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function tokenMatches(given, expected) {
    if (typeof given !== 'string') return false;
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Start the board server for a workspace.
 * `send(prompt)` puts a prompt into the agent chat; it resolves to false when there is no session (dev mode).
 * `checkoutWriter` is the context writer outside the workspace that run instructions may name; null says there is none.
 * `quietMs` is how long a sent step's folder must sit unchanged before the board stops waiting for `settle()`.
 */
export async function createSpecServer({ root, specDirs, send = async () => false, log = () => {}, checkoutWriter, quietMs = QUIET_MS }) {
    const state = {
        root,
        specDirs: specDirs ?? resolveSpecDirs(root),
        token: randomBytes(24).toString('base64url'),
        clients: new Set(),
        snapshot: null,
        selected: null,
        watchers: new Set(),
        closed: false,
        timer: null,
        runs: new Map(),
        pendingSpecify: null,
        quietTimer: null,
        host: null,
        origin: null,
    };

    const commandSet = () => detectCommandSet(state.root);

    function emit(event, data) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const client of state.clients) {
            try {
                client.write(payload);
            } catch {
                state.clients.delete(client);
            }
        }
    }

    const writer = () => writerPath(state.root, checkoutWriter);

    /** A spec the board sent a step for shows that step as running until the turn settles. */
    function present(spec) {
        const run = state.runs.get(spec.id);
        return run ? withRunningStep(spec, run.step) : spec;
    }

    function snapshot() {
        return { ...state.snapshot, specs: state.snapshot.specs.map(present), selected: state.selected, commandSet: commandSet(), commands: availableCommands(commandSet()), specify: specifyChoices(state.root) };
    }

    /**
     * Drop the runs that are over without a settle: the spec is gone, a live record closed the step after it was sent, or the
     * step's document has sat unchanged for `quietMs`. A new folder that appears after New spec was sent is that run's spec.
     */
    function reviewRuns() {
        const { specs } = state.snapshot;
        const pending = state.pendingSpecify;
        const created = pending && specs.find(spec => !pending.known.has(spec.id));
        if (created) {
            state.runs.set(created.id, { step: 'specify', startedAt: pending.startedAt, owned: pending.owned });
            state.pendingSpecify = null;
        }
        const live = hasWorkspaceWriter(state.root);
        for (const [id, run] of state.runs) {
            const spec = specs.find(s => s.id === id);
            const written = spec?.steps[run.step] === 'completed';
            const sentAt = Date.parse(run.startedAt);
            const recorded = written && live && Date.parse(spec.lastActivity ?? '') > sentAt;
            const quiet = written && Date.now() - Math.max(sentAt, Date.parse(spec.updatedAt ?? '') || 0) >= quietMs;
            if (!spec || recorded || quiet) state.runs.delete(id);
        }
        clearTimeout(state.quietTimer);
        if (state.runs.size && !state.closed) state.quietTimer = setTimeout(scheduleRescan, Math.max(1000, quietMs / 4)).unref();
    }

    function rescan() {
        state.snapshot = buildSnapshot(state.root, state.specDirs);
        reviewRuns();
        emit('snapshot', snapshot());
        return state.snapshot;
    }

    /**
     * The chat turn ended, so nothing the board sent is running any more. Where no context writer exists the board keeps the
     * record itself: a step whose document is there gets its start (the send) and its finish (now), both seen here.
     */
    function settle(now = new Date()) {
        if (!state.runs.size && !state.pendingSpecify) return;
        state.snapshot = buildSnapshot(state.root, state.specDirs);
        reviewRuns();
        for (const [id, run] of state.runs) {
            const spec = state.snapshot.specs.find(s => s.id === id);
            if (!run.owned || spec?.steps[run.step] !== 'completed') continue;
            try {
                recordStep(state.root, spec, run.step, run.startedAt, now.toISOString());
            } catch (error) {
                log(`[speckit-canvas] run record not written: ${error.message}`);
            }
        }
        state.runs.clear();
        state.pendingSpecify = null;
        rescan();
    }

    function scheduleRescan() {
        if (state.closed) return;
        clearTimeout(state.timer);
        state.timer = setTimeout(() => {
            try {
                rescan();
            } catch (error) {
                log(`[speckit-canvas] rescan failed: ${error.message}`);
            }
        }, DEBOUNCE_MS);
    }

    function hold(path, options, listener) {
        let watcher;
        try {
            watcher = watch(path, options, listener);
        } catch (error) {
            // A missing directory is the common case. Where recursive watching is unavailable, still catch folders appearing.
            if (!options.recursive || error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
            try {
                watcher = watch(path, {}, listener);
            } catch {
                return null;
            }
        }
        state.watchers.add(watcher);
        watcher.on('error', () => release(watcher));
        return watcher;
    }

    function release(watcher) {
        if (!watcher) return;
        state.watchers.delete(watcher);
        watcher.close();
    }

    /**
     * Watch one spec directory, whether or not it exists yet. The directory itself is watched recursively; each folder above it,
     * up to the project root, is watched flat for the next folder on the way down appearing, disappearing or being replaced,
     * which re-arms everything below. Nothing else under the root is walked.
     */
    function watchSpecDir(dir) {
        const inside = relative(state.root, resolve(state.root, dir));
        const names = !inside || inside.startsWith('..') || isAbsolute(inside) ? [] : inside.split(sep);
        const base = names.length ? state.root : resolve(state.root, dir);
        const held = [];
        const arm = (from) => {
            if (state.closed) return;
            for (let depth = from; depth <= names.length; depth++) {
                release(held[depth]);
                held[depth] = null;
            }
            for (let depth = from; depth <= names.length; depth++) {
                const path = join(base, ...names.slice(0, depth));
                held[depth] = depth === names.length
                    ? hold(path, { recursive: true }, scheduleRescan)
                    : hold(path, {}, (_event, name) => {
                        if (name != null && String(name) !== names[depth]) return;
                        arm(depth + 1);
                        scheduleRescan();
                    });
                if (!held[depth]) return;
            }
        };
        arm(0);
    }

    function startWatching() {
        for (const dir of state.specDirs) watchSpecDir(dir);
    }

    function requireSpec(query) {
        const spec = findSpec(state.snapshot.specs, query);
        if (!spec) throw Object.assign(new Error(`No spec matches "${query}".`), { status: 404 });
        return spec;
    }

    function focus(query) {
        const spec = requireSpec(query);
        state.selected = spec.id;
        emit('focus', { selected: spec.id });
        return spec;
    }

    async function deliver(spec, command, prompt, instructionsFile = null) {
        const sent = await send(prompt);
        emit('run', { spec, command, prompt, instructionsFile, sent, at: new Date().toISOString() });
        return { prompt, instructionsFile, sent };
    }

    async function run(query, command) {
        const spec = requireSpec(query);
        if (command === 'ask') return deliver(spec.id, command, buildAskPrompt(present(spec)));
        const set = commandSetFor(state.root, spec.workflow);
        const spelling = availableCommands(set).includes(command) ? resolveCommand(state.root, command, set) : null;
        const line = buildPrompt(command, spec.id, set, spelling);
        const startedAt = new Date();
        const preamble = buildStepPreamble(command, spec.id, state.root, set, startedAt, writer());
        const file = preamble ? writeRunInstructions(state.root, stepInstructionsName(command, spec.id), runInstructionsDoc(line.split('\n')[0], preamble)) : null;
        const result = await deliver(spec.id, command, buildPrompt(command, spec.id, set, spelling, file), file);
        if (result.sent && STEP_COMMANDS.includes(command)) {
            state.runs.set(spec.id, { step: command, startedAt: startedAt.toISOString(), owned: !writer() });
            rescan();
        }
        return result;
    }

    async function specify(description, workflow) {
        let built;
        try {
            built = buildSpecifyPrompt({ description, workflow: workflow ?? specifyChoices(state.root).default, root: state.root, specDirs: state.specDirs, writer: writer() });
        } catch (error) {
            throw Object.assign(error, { status: 400 });
        }
        const file = built.instructionsDoc ? writeRunInstructions(state.root, built.instructionsName, built.instructionsDoc) : null;
        const result = await deliver(null, 'specify', built.prompt, file);
        if (result.sent) {
            state.pendingSpecify = { startedAt: built.startedAt, known: new Set(state.snapshot.specs.map(s => s.id)), owned: built.workflow === 'speckit' && !writer() };
        }
        return { ...result, workflow: built.workflow, command: built.command };
    }

    const install = () => deliver(null, 'install', buildInstallPrompt());

    function authorized(req, url) {
        if (req.headers.host !== state.host) return false;
        const origin = req.headers.origin;
        if (origin && origin !== state.origin) return false;
        const site = req.headers['sec-fetch-site'];
        if (site && site !== 'same-origin' && site !== 'none') return false;
        return tokenMatches(req.headers['x-speckit-token'] ?? url.searchParams.get('token'), state.token);
    }

    async function handleApi(req, res, url) {
        if (!authorized(req, url)) return sendJson(res, 403, { error: 'Forbidden' });
        const { pathname } = url;

        if (req.method === 'GET' && pathname === '/api/snapshot') return sendJson(res, 200, snapshot());

        if (req.method === 'GET' && pathname === '/api/spec') {
            const spec = requireSpec(url.searchParams.get('id'));
            const set = commandSetFor(state.root, spec.workflow);
            const detail = readSpecDetail(state.root, spec.id);
            return sendJson(res, 200, { ...detail, spec: present(detail.spec), commandSet: set, commands: availableCommands(set), commandHint: commandPattern(state.root, set) });
        }

        if (req.method === 'GET' && pathname === '/api/events') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
            state.clients.add(res);
            res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`);
            const ping = setInterval(() => res.write(': ping\n\n'), 25000);
            req.on('close', () => {
                clearInterval(ping);
                state.clients.delete(res);
            });
            return;
        }

        if (req.method === 'POST') {
            const body = await readJson(req);
            if (pathname === '/api/refresh') return sendJson(res, 200, { count: rescan().specs.length });
            if (pathname === '/api/focus') return sendJson(res, 200, focus(body.spec));
            if (pathname === '/api/run') return sendJson(res, 200, await run(body.spec, body.command));
            if (pathname === '/api/specify') return sendJson(res, 200, await specify(body.description, body.workflow));
            if (pathname === '/api/install') return sendJson(res, 200, await install());
        }

        return sendJson(res, 404, { error: 'Not found' });
    }

    async function handle(req, res) {
        const url = new URL(req.url, 'http://127.0.0.1');
        try {
            if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
            if (req.headers.host !== state.host) return sendJson(res, 403, { error: 'Forbidden' });
            const asset = ASSETS[url.pathname];
            if (!asset || req.method !== 'GET') return sendJson(res, 404, { error: 'Not found' });
            const body = await readFile(join(PUBLIC_DIR, asset[0]));
            res.writeHead(200, {
                'Content-Type': asset[1],
                'Cache-Control': 'no-store',
                'Content-Security-Policy': CSP,
                'X-Content-Type-Options': 'nosniff',
            });
            res.end(body);
        } catch (error) {
            sendJson(res, error.status ?? 400, { error: error.message });
        }
    }

    const server = createServer((req, res) => void handle(req, res));
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });
    const { port } = server.address();
    state.host = `127.0.0.1:${port}`;
    state.origin = `http://${state.host}`;

    rescan();
    startWatching();

    return {
        url: `${state.origin}/?token=${encodeURIComponent(state.token)}`,
        port,
        token: state.token,
        get snapshot() { return snapshot(); },
        rescan,
        focus,
        run,
        specify,
        settle,
        detail: (query) => {
            const detail = readSpecDetail(state.root, requireSpec(query).id, { html: false });
            return { ...detail, spec: present(detail.spec) };
        },
        async close() {
            state.closed = true;
            clearTimeout(state.timer);
            clearTimeout(state.quietTimer);
            for (const watcher of state.watchers) watcher.close();
            for (const client of state.clients) client.end();
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
        },
    };
}
