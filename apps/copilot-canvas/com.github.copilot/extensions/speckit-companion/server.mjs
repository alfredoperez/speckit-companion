// The canvas page's local server: static assets, a token-guarded JSON API, and a live event stream.
// It never imports the Copilot SDK, so dev.mjs and the tests run it on their own.

import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { statSync, watch } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshot, findSpec, readSpecDetail, recordLive, resolveSpecDirs } from './specs-core.mjs';
import { STEP_COMMANDS, availableCommands, buildAskPrompt, buildInstallPrompt, buildPrompt, buildSpecifyPrompt, buildStepPreamble, commandPattern, commandSetFor, detectCommandSet, resolveCommand, runInstructionsDoc, specifyChoices, stepInstructionsName, writeRunInstructions, writerPath } from './prompts.mjs';
import { BUSY, recordStep } from './run-record.mjs';
import { stepEvidence, withRunningStep } from './spec-rules.mjs';
import { validateRoot } from './workspace.mjs';

const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const ASSETS = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
    '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
    '/viewer.css': ['../vendor/viewer.css', 'text/css; charset=utf-8'],
    '/states-select.mjs': ['../vendor/states-select.mjs', 'text/javascript; charset=utf-8'],
};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'";
const BODY_LIMIT = 16 * 1024;
const DEBOUNCE_MS = 200;
const QUIET_MS = 120000;
const CEILING_MS = 2 * 60 * 60 * 1000;
const LOCK_RETRY_MS = 100;
const LOCK_RETRIES = 20;

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
 * `checkoutWriter` (null for none) is the context writer outside the workspace; `quietMs`, `ceilingMs` and the clock `now` bound a sent step with no word from the session.
 */
export async function createSpecServer({ root, workingDirectory = root, manual = false, bound = null, coordinatedSessions = [], saveCoordinatedSessions, discoverChildren, childPollMs = 0, specDirs, saveRoot, clearRoot, send = async () => false, log = () => {}, checkoutWriter, quietMs = QUIET_MS, ceilingMs = CEILING_MS, now = Date.now }) {
    const state = {
        root,
        workingDirectory,
        manual,
        bound: manual ? bound : null,
        coordinatedSessions,
        children: [],
        childNote: null,
        failed: null,
        discovering: false,
        pollTimer: null,
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
        runTimer: null,
        retries: new Set(),
        sentKey: null,
        busy: false,
        sawTurnStart: false,
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
        return run && !run.quiet ? withRunningStep(spec, run.step) : spec;
    }

    function snapshot() {
        return { ...state.snapshot, rootSource: state.bound ? 'bound' : state.manual ? 'selected' : state.root === state.workingDirectory ? 'session' : 'child', boundSession: state.bound, coordinatedSessions: state.coordinatedSessions, children: state.children, childNote: state.childNote, specs: state.snapshot.specs.map(present), selected: state.selected, commandSet: commandSet(), commands: availableCommands(commandSet()), specify: specifyChoices(state.root) };
    }

    /** The step's document as it is on disk right now, so a later look can tell whether the run touched it. */
    function fingerprint(spec, step) {
        const file = step === 'specify' ? spec.files.spec : step === 'plan' ? 'plan.md' : 'tasks.md';
        const stat = file ? statSync(join(state.root, spec.id, file), { throwIfNoEntry: false }) : null;
        return stat ? `${stat.mtimeMs}:${stat.size}` : null;
    }

    /** A run did its step when the step's document is written and is not the file that was there at the send. */
    const didStep = (run, spec) => stepEvidence(spec, run.step) && fingerprint(spec, run.step) !== run.before;

    /** Stop following runs that ended with no word from the session; a new folder after New spec was sent is that run's spec. */
    function reviewRuns() {
        const { specs } = state.snapshot;
        const pending = state.pendingSpecify;
        const created = pending && specs.find(spec => !pending.known.has(spec.id));
        if (created) {
            state.runs.set(created.id, { step: 'specify', prompt: pending.prompt, startedAt: pending.startedAt, started: pending.started, before: null, owned: pending.owned });
            state.pendingSpecify = null;
        } else if (pending && now() - Date.parse(pending.startedAt) >= ceilingMs) {
            state.pendingSpecify = null;
        }
        const live = recordLive(state.root);
        let wake = Infinity;
        for (const [id, run] of state.runs) {
            const spec = specs.find(s => s.id === id);
            const sentAt = Date.parse(run.startedAt);
            const idleFor = now() - Math.max(sentAt, Date.parse(spec?.updatedAt ?? '') || 0);
            // Companion's recorder closed the step after the send: the record leads there.
            const recorded = spec && live && spec.steps[run.step] === 'completed' && Date.parse(spec.lastActivity ?? '') > sentAt;
            if (!spec || recorded || idleFor >= ceilingMs) {
                state.runs.delete(id);
                continue;
            }
            // Last resort with no word of a turn: a written document nothing has touched since stops looking like running, and the run waits for the idle.
            const mayBeOver = !run.started && !state.busy && didStep(run, spec);
            run.quiet = mayBeOver && idleFor >= quietMs;
            wake = Math.min(wake, ceilingMs - idleFor, mayBeOver && !run.quiet ? quietMs - idleFor : Infinity);
        }
        clearTimeout(state.runTimer);
        if (Number.isFinite(wake) && !state.closed) state.runTimer = setTimeout(scheduleRescan, Math.max(50, wake)).unref();
    }

    /** Read the folders again; a scan nobody asked for (a file event) reaches the page only when it changed something. */
    function rescan({ asked = true } = {}) {
        state.snapshot = buildSnapshot(state.root, state.specDirs);
        reviewRuns();
        if (reconcile()) return state.snapshot;
        const next = snapshot();
        const key = JSON.stringify({ ...next, generatedAt: null });
        if (asked || key !== state.sentKey) emit('snapshot', next);
        state.sentKey = key;
        return state.snapshot;
    }

    const idle = () => !state.runs.size && !state.pendingSpecify && !state.retries.size;

    function selectRoot(root) {
        const nextRoot = validateRoot(root);
        if (!idle()) throw new Error('Wait for the current spec step to finish before changing repositories.');
        const nextDirs = resolveSpecDirs(nextRoot);
        const nextSnapshot = buildSnapshot(nextRoot, nextDirs);
        if (!saveRoot) throw new Error('Repository selection is unavailable without session storage.');
        const keepSource = state.bound && nextRoot === state.root ? state.bound : null;
        saveRoot(nextRoot, keepSource ?? undefined);
        state.manual = true;
        state.bound = keepSource;
        applyRoot(nextRoot, nextDirs, nextSnapshot);
        return snapshot();
    }

    /**
     * The coordinating agent names a session and its worktree, read from the app's own session details. This is a caller-provided
     * binding: the board cannot verify ownership. Rebinding the same or another session replaces the previous one.
     */
    function bindSession({ sessionId, cwd, name }) {
        if (typeof sessionId !== 'string' || !sessionId.trim()) throw new Error('A source session id is required.');
        const nextRoot = validateRoot(cwd);
        if (!idle()) throw new Error('Wait for the current spec step to finish before changing repositories.');
        if (!saveRoot) throw new Error('Repository selection is unavailable without session storage.');
        const nextDirs = resolveSpecDirs(nextRoot);
        const nextSnapshot = buildSnapshot(nextRoot, nextDirs);
        const source = { sessionId: sessionId.trim(), name: typeof name === 'string' && name.trim() ? name.trim() : sessionId.trim() };
        saveRoot(nextRoot, source);
        state.manual = true;
        state.bound = source;
        applyRoot(nextRoot, nextDirs, nextSnapshot);
        return snapshot();
    }

    function updateCoordinatedSessions(sessions) {
        if (!Array.isArray(sessions)) throw new Error('A complete sessions array is required.');
        const ids = new Set();
        const next = sessions.map(session => {
            if (!session || typeof session !== 'object' || Array.isArray(session) ||
                Object.keys(session).some(key => !['sessionId', 'cwd', 'name', 'activity'].includes(key)) ||
                typeof session.sessionId !== 'string' || !session.sessionId.trim() ||
                typeof session.name !== 'string' || !session.name.trim() ||
                (session.activity !== undefined && !['busy', 'idle', 'unknown'].includes(session.activity))) {
                throw new Error('Each session requires an id, name and absolute directory, with optional busy, idle or unknown activity.');
            }
            const sessionId = session.sessionId.trim();
            if (ids.has(sessionId)) throw new Error(`Duplicate coordinated session id: ${sessionId}`);
            ids.add(sessionId);
            return { sessionId, cwd: validateRoot(session.cwd), name: session.name.trim(), ...(session.activity ? { activity: session.activity } : {}) };
        });
        const selected = state.bound && next.find(session => session.sessionId === state.bound.sessionId);
        const moved = selected && selected.cwd !== state.root;
        if (moved && !idle()) throw new Error('Wait for the current spec step to finish before changing repositories.');
        if (!saveCoordinatedSessions) throw new Error('Session storage is unavailable; the session list cannot be saved.');
        const nextDirs = moved ? resolveSpecDirs(selected.cwd) : null;
        const nextSnapshot = moved ? buildSnapshot(selected.cwd, nextDirs) : null;
        const source = selected ? { sessionId: selected.sessionId, name: selected.name } : state.bound;
        saveCoordinatedSessions(next, state.manual ? (selected?.cwd ?? state.root) : null, source);
        state.coordinatedSessions = next;
        state.bound = source;
        if (moved) applyRoot(selected.cwd, nextDirs, nextSnapshot);
        else rescan();
        return snapshot();
    }

    function selectCoordinatedSession(sessionId) {
        const selected = state.coordinatedSessions.find(session => session.sessionId === sessionId);
        if (!selected) throw Object.assign(new Error('The coordinated session is unavailable. Ask the coordinator to refresh the list.'), { status: 404 });
        return bindSession(selected);
    }

    /** Go back to following the session; the saved choice is removed first so a reload agrees. */
    function followSession() {
        if (!state.manual) return snapshot();
        if (!idle()) throw new Error('Wait for the current spec step to finish before changing repositories.');
        if (!clearRoot) throw new Error('Repository selection is unavailable without session storage.');
        const target = validateRoot(desiredRoot());
        clearRoot();
        state.manual = false;
        state.bound = null;
        state.failed = null;
        applyRoot(target);
        return snapshot();
    }

    function lacksSpecs(directory) {
        try {
            return buildSnapshot(directory, resolveSpecDirs(directory)).specs.length === 0;
        } catch {
            return true;
        }
    }

    /**
     * Where the board belongs without a manual choice: the session's own directory, unless that holds no specs and the session
     * has exactly one child it owns. With several children nothing is guessed; the board lists them and waits for a pick.
     */
    function desiredRoot() {
        const own = state.workingDirectory;
        if (state.children.length === 1 && (!own || lacksSpecs(own))) return state.children[0].cwd;
        return own;
    }

    /**
     * The session's working directory changed (the runtime reports it per session). Without a manual choice the board follows it,
     * but only once no step sent from the board is running or being recorded, so a run never ends up read from another repository.
     */
    function followWorkingDirectory(directory) {
        state.workingDirectory = validateRoot(directory);
        state.failed = null;
        reconcile();
    }

    function reconcile() {
        const target = desiredRoot();
        if (state.manual || state.closed || !target || target === state.root || target === state.failed || !idle()) return false;
        try {
            applyRoot(validateRoot(target));
        } catch (error) {
            log(`[speckit-canvas] could not follow ${target}: ${error.message}`);
            state.failed = target;
            return false;
        }
        return true;
    }

    /** Sessions this one owns, as the runtime reports them; a vanished child drops out and the board falls back to the session. */
    function setChildren(children, note = null) {
        const next = children.filter(child => child && typeof child.cwd === 'string' && child.cwd).map(({ sessionId, name, cwd, state: childState }) => ({ sessionId, name, cwd, state: childState }));
        state.children = next;
        state.childNote = note;
        state.failed = null;
        if (!reconcile()) rescan({ asked: false });
    }

    async function refreshChildren() {
        if (!discoverChildren || state.closed || state.discovering) return;
        state.discovering = true;
        try {
            const { children, note } = await discoverChildren();
            if (!state.closed) setChildren(children, note);
        } catch (error) {
            if (!state.closed) setChildren([], error.message);
        } finally {
            state.discovering = false;
        }
    }

    /** Pick one of the sessions this one owns; only a listed session counts, never a path the caller names. */
    function selectChild(sessionId) {
        const child = state.children.find(candidate => candidate.sessionId === sessionId);
        if (!child) throw Object.assign(new Error(`${sessionId} is not a session owned by this chat.`), { status: 404 });
        return selectRoot(child.cwd);
    }

    function applyRoot(nextRoot, nextDirs = resolveSpecDirs(nextRoot), nextSnapshot = buildSnapshot(nextRoot, nextDirs)) {
        clearTimeout(state.timer);
        clearTimeout(state.runTimer);
        for (const watcher of state.watchers) watcher.close();
        state.watchers.clear();
        state.root = nextRoot;
        state.specDirs = nextDirs;
        state.selected = null;
        state.snapshot = nextSnapshot;
        state.sentKey = null;
        startWatching();
        rescan();
        return snapshot();
    }

    /** Write a settled step to the record, trying again for a couple of seconds while another writer holds its lock. */
    function writeRecord(spec, run, endedAt, closing, attempt = 0) {
        let result = false;
        try {
            result = recordStep(state.root, spec, run.step, run.startedAt, endedAt, { closing });
        } catch (error) {
            log(`[speckit-canvas] run record not written: ${error.message}`);
        }
        if (result !== BUSY) return result;
        if (attempt >= LOCK_RETRIES || state.closed) return log(`[speckit-canvas] run record not written: ${spec.id} is locked by another writer`);
        const timer = setTimeout(() => {
            state.retries.delete(timer);
            if (writeRecord(spec, run, endedAt, closing, attempt + 1) === true) rescan();
        }, LOCK_RETRY_MS).unref();
        state.retries.add(timer);
    }

    /** The session took a message into a turn: a run whose prompt it carries has started, and only a started run settles. */
    function began(content) {
        state.busy = true;
        state.sawTurnStart = true;
        const lines = typeof content === 'string' ? content.split(/\r\n?|\n/).map(line => line.trim()) : [];
        const carries = prompt => lines.includes(prompt.split('\n')[0].trim());
        for (const run of state.runs.values()) if (carries(run.prompt)) run.started = true;
        if (state.pendingSpecify && carries(state.pendingSpecify.prompt)) state.pendingSpecify.started = true;
    }

    /**
     * The chat turn ended: started runs stop running. One that did its step is recorded where there is no context writer;
     * where there is one, the board only closes a document step the recorder left open, or the next step would never unlock.
     */
    function settle(at = new Date(now())) {
        state.busy = false;
        // A host that never reports a turn starting gives no way to pair, so there every run settles.
        const over = run => run.started || !state.sawTurnStart;
        if (![...state.runs.values(), state.pendingSpecify].some(run => run && over(run))) {
            reconcile();
            return;
        }
        state.snapshot = buildSnapshot(state.root, state.specDirs);
        reviewRuns();
        for (const [id, run] of state.runs) {
            if (!over(run)) continue;
            state.runs.delete(id);
            const spec = state.snapshot.specs.find(s => s.id === id);
            if (!spec || !didStep(run, spec)) continue;
            const closing = Boolean(writer());
            if (closing ? run.step === 'implement' : !run.owned) continue;
            writeRecord(spec, run, at.toISOString(), closing);
        }
        if (state.pendingSpecify && over(state.pendingSpecify)) state.pendingSpecify = null;
        rescan();
    }

    function scheduleRescan() {
        if (state.closed) return;
        clearTimeout(state.timer);
        state.timer = setTimeout(() => {
            try {
                rescan({ asked: false });
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
        if (state.root !== state.workingDirectory) {
            prompt += `\n\nRepository directory: ${JSON.stringify(state.root)}. Run this request in that repository; resolve all relative spec, command and instruction-file paths from that directory, not the chat working directory.`;
            if (instructionsFile) instructionsFile = resolve(state.root, instructionsFile);
        }
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
        const startedAt = new Date(now());
        const preamble = buildStepPreamble(command, spec.id, state.root, set, startedAt, writer());
        const file = preamble ? writeRunInstructions(state.root, stepInstructionsName(command, spec.id), runInstructionsDoc(line.split('\n')[0], preamble, spelling?.instructions)) : null;
        const prompt = buildPrompt(command, spec.id, set, spelling, file);
        if (!STEP_COMMANDS.includes(command)) return deliver(spec.id, command, prompt, file);
        // The run is known before the send, so a turn that starts while the send is still in flight finds it.
        const earlier = state.runs.get(spec.id);
        const mine = { step: command, prompt, startedAt: startedAt.toISOString(), started: false, before: fingerprint(spec, command), owned: !writer() };
        state.runs.set(spec.id, mine);
        const restore = () => {
            if (state.runs.get(spec.id) !== mine) return;
            if (earlier) state.runs.set(spec.id, earlier);
            else state.runs.delete(spec.id);
        };
        let result;
        try {
            result = await deliver(spec.id, command, prompt, file);
        } catch (error) {
            restore();
            throw error;
        }
        if (result.sent) rescan();
        else restore();
        return result;
    }

    async function specify(description, workflow) {
        let built;
        try {
            built = buildSpecifyPrompt({ description, workflow: workflow ?? specifyChoices(state.root).default, root: state.root, specDirs: state.specDirs, writer: writer(), now: new Date(now()) });
        } catch (error) {
            throw Object.assign(error, { status: 400 });
        }
        const file = built.instructionsDoc ? writeRunInstructions(state.root, built.instructionsName, built.instructionsDoc) : null;
        const earlier = state.pendingSpecify;
        const mine = { prompt: built.prompt, startedAt: built.startedAt, started: false, known: new Set(state.snapshot.specs.map(s => s.id)), owned: built.workflow === 'speckit' && !writer() };
        state.pendingSpecify = mine;
        const restore = () => {
            if (state.pendingSpecify === mine) state.pendingSpecify = earlier;
        };
        let result;
        try {
            result = await deliver(null, 'specify', built.prompt, file);
        } catch (error) {
            restore();
            throw error;
        }
        if (!result.sent) restore();
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
            if (pathname === '/api/root') {
                const next = selectRoot(body.root);
                return sendJson(res, 200, { root: next.root, count: next.specs.length });
            }
            if (pathname === '/api/root/follow') {
                const next = followSession();
                return sendJson(res, 200, { root: next.root, count: next.specs.length });
            }
            if (pathname === '/api/root/child') {
                const next = selectChild(body.sessionId);
                return sendJson(res, 200, { root: next.root, count: next.specs.length });
            }
            if (pathname === '/api/root/coordinated') {
                const next = selectCoordinatedSession(body.sessionId);
                return sendJson(res, 200, { root: next.root, count: next.specs.length });
            }
            if (pathname === '/api/refresh') {
                await refreshChildren();
                return sendJson(res, 200, { count: rescan().specs.length });
            }
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
    if (discoverChildren) {
        refreshChildren();
        if (childPollMs > 0) state.pollTimer = setInterval(refreshChildren, childPollMs).unref();
    }

    return {
        url: `${state.origin}/?token=${encodeURIComponent(state.token)}`,
        port,
        token: state.token,
        get snapshot() { return snapshot(); },
        rescan,
        selectRoot,
        selectChild,
        bindSession,
        updateCoordinatedSessions,
        selectCoordinatedSession,
        refreshChildren,
        followSession,
        followWorkingDirectory,
        focus,
        run,
        specify,
        settle,
        began,
        detail: (query) => {
            const detail = readSpecDetail(state.root, requireSpec(query).id, { html: false });
            return { ...detail, spec: present(detail.spec) };
        },
        async close() {
            state.closed = true;
            clearInterval(state.pollTimer);
            clearTimeout(state.timer);
            clearTimeout(state.runTimer);
            for (const timer of state.retries) clearTimeout(timer);
            for (const watcher of state.watchers) watcher.close();
            for (const client of state.clients) client.end();
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
        },
    };
}
