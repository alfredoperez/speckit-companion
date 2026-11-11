// SpecKit Companion spec board, as a GitHub Copilot app canvas.
// Wiring only: the board logic lives in server.mjs and specs-core.mjs, which run without the SDK.

import { joinSession, createCanvas, CanvasError } from '@github/copilot-sdk/extension';
import { createSpecServer } from './server.mjs';
import { CANVAS_DESCRIPTION, SPEC_COMMANDS, SYSTEM_RULE, openStatus } from './prompts.mjs';
import { rootSelection, validateRoot } from './workspace.mjs';

const CANVAS_ID = 'speckit-spec-board';
const servers = new Map();

function serverFor(ctx) {
    const entry = servers.get(ctx.instanceId);
    if (!entry) throw new CanvasError('canvas_not_open', 'The spec board is not open. Open it first.');
    return entry;
}

function summary(spec) {
    const { id, title, statusLabel, currentStep, steps, tasks, done, pendingReviews, lastActivity } = spec;
    return { id, title, status: statusLabel, currentStep, steps, tasks, done, pendingReviews, lastActivity };
}

function specError(error) {
    return new CanvasError(error.status === 404 ? 'spec_not_found' : 'spec_board_error', error.message);
}

const specInput = {
    type: 'object',
    additionalProperties: false,
    properties: {
        spec: { type: 'string', minLength: 1, description: 'Spec folder path (specs/042-foo), folder name (042-foo), or number (042).' },
    },
    required: ['spec'],
};

function followDirectory(entry, directory) {
    try {
        entry.followWorkingDirectory(directory);
    } catch (error) {
        session?.log?.(`[speckit-canvas] cannot follow ${directory}: ${error.message}`);
    }
}

/**
 * The sessions this chat created through the runtime's session management, read-only and filtered to this session's own children.
 * The opt-in policy is the user's: it is never enabled from here, so a chat without it simply has no discovered children.
 */
async function discoverChildren() {
    const list = session.rpc?.management?.list;
    if (!list) return { children: [], note: 'This runtime does not expose session management.' };
    try {
        const { sessions } = await list({});
        const children = (sessions ?? [])
            .filter(peer => peer.parentSessionId === session.sessionId)
            .map(peer => ({ sessionId: peer.sessionId, name: peer.name, cwd: peer.cwd, state: peer.state }));
        return { children, note: null };
    } catch (error) {
        return { children: [], note: `Child sessions are not discoverable: ${error.message}` };
    }
}

const session = await joinSession({
    systemMessage: { mode: 'append', content: SYSTEM_RULE },
    canvases: [
        createCanvas({
            id: CANVAS_ID,
            displayName: 'SpecKit Companion',
            description: CANVAS_DESCRIPTION,
            inputSchema: {
                type: ['object', 'null'],
                additionalProperties: false,
                properties: {
                    root: { type: 'string', minLength: 1, description: 'Initial absolute repository directory when the chat has no saved selection. Use select_root to change a saved selection.' },
                    spec: { type: 'string', description: 'Optional spec to open focused (path, folder name, or number).' },
                },
            },
            actions: [
                {
                    name: 'select_root',
                    description: 'Select and save the absolute repository directory to scan. Use when the board is open in a Project chat rather than a repository checkout: pass the worktree path of the coordinated session that owns the repository (from the session\'s own details), never a guessed or most-recent one.',
                    inputSchema: {
                        type: 'object',
                        additionalProperties: false,
                        properties: { root: { type: 'string', minLength: 1 } },
                        required: ['root'],
                    },
                    handler: (ctx) => {
                        try {
                            const snapshot = serverFor(ctx).selectRoot(ctx.input.root);
                            return { root: snapshot.root, count: snapshot.specs.length };
                        } catch (error) {
                            throw specError(error);
                        }
                    },
                },
                {
                    name: 'select_child',
                    description: 'Select one of the sessions this chat created (listed in the board) and save the choice. Use when the board lists several child sessions and the user says which one to show. Specs are read from that child\'s worktree; commands still run in this chat with that repository named.',
                    inputSchema: {
                        type: 'object',
                        additionalProperties: false,
                        properties: { sessionId: { type: 'string', minLength: 1 } },
                        required: ['sessionId'],
                    },
                    handler: (ctx) => {
                        try {
                            const snapshot = serverFor(ctx).selectChild(ctx.input.sessionId);
                            return { root: snapshot.root, count: snapshot.specs.length };
                        } catch (error) {
                            throw specError(error);
                        }
                    },
                },
                {
                    name: 'update_coordinated_sessions',
                    description: 'Coordinator only: replace the complete list of your own nonarchived app sessions, including idle sessions, using scoped get_sessions_status and get_session for exact ids, names and worktree directories. Refresh after create, resume, switch, archive or worktree changes. The board cannot verify ownership; never supply unrelated sessions or guess a latest session. The user chooses a source; commands still run in this chat, not the child.',
                    inputSchema: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            sessions: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        sessionId: { type: 'string', minLength: 1 },
                                        cwd: { type: 'string', minLength: 1 },
                                        name: { type: 'string', minLength: 1 },
                                        activity: { type: 'string', enum: ['busy', 'idle', 'unknown'] },
                                    },
                                    required: ['sessionId', 'cwd', 'name'],
                                },
                            },
                        },
                        required: ['sessions'],
                    },
                    handler: (ctx) => {
                        try {
                            const snapshot = serverFor(ctx).updateCoordinatedSessions(ctx.input.sessions);
                            return { count: snapshot.coordinatedSessions.length, root: snapshot.root, source: snapshot.boundSession };
                        } catch (error) {
                            throw specError(error);
                        }
                    },
                },
                {
                    name: 'bind_coordinated_session',
                    description: 'Coordinator only. Show a coordinated session\'s worktree on this board. First read that session with your get_session tool and pass its exact session id, its worktree path and its name; never guess, scan sessions, or use a latest one, and when several children exist use the one the user means. This is a caller-provided binding the board cannot verify, and it does not follow later changes: call it again whenever the child is created, resumed, switched or its worktree changes. It is saved and outranks following; use_session_directory clears it. Commands from the board still run in this chat, naming that repository, not in the child.',
                    inputSchema: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            sessionId: { type: 'string', minLength: 1 },
                            cwd: { type: 'string', minLength: 1, description: 'Absolute worktree path from get_session.' },
                            name: { type: 'string' },
                        },
                        required: ['sessionId', 'cwd'],
                    },
                    handler: (ctx) => {
                        try {
                            const snapshot = serverFor(ctx).bindSession(ctx.input);
                            return { root: snapshot.root, count: snapshot.specs.length, source: snapshot.boundSession };
                        } catch (error) {
                            throw specError(error);
                        }
                    },
                },
                {
                    name: 'use_session_directory',
                    description: 'Drop the saved repository selection and follow this session\'s working directory again. The board then moves with the session\'s worktree automatically.',
                    handler: (ctx) => {
                        try {
                            const snapshot = serverFor(ctx).followSession();
                            return { root: snapshot.root, count: snapshot.specs.length };
                        } catch (error) {
                            throw specError(error);
                        }
                    },
                },
                {
                    name: 'list_specs',
                    description: 'List the specs on the board with status, pipeline step badges and task progress. Use this to answer any question about which specs exist or where they stand, instead of reading files under specs/. Pass filter "active" to skip completed and archived specs.',
                    inputSchema: {
                        type: 'object',
                        additionalProperties: false,
                        properties: { filter: { type: 'string', enum: ['all', 'active', 'done'] } },
                    },
                    handler: (ctx) => {
                        const { specs } = serverFor(ctx).snapshot;
                        const filter = ctx.input?.filter ?? 'all';
                        const picked = filter === 'all' ? specs : specs.filter(s => (filter === 'done' ? s.done : !s.done));
                        return { count: picked.length, specs: picked.map(summary) };
                    },
                },
                {
                    name: 'get_spec',
                    description: 'Get one spec: status, step badges, task list with done state, per-phase progress, run history, intent and decisions.',
                    inputSchema: specInput,
                    handler: (ctx) => {
                        try {
                            return serverFor(ctx).detail(ctx.input.spec);
                        } catch (error) {
                            throw specError(error);
                        }
                    },
                },
                {
                    name: 'focus_spec',
                    description: 'Select a spec on the board so the user sees its documents and pipeline. Call this whenever the user names a spec or asks to see, show or open one, instead of reading its files under specs/.',
                    inputSchema: specInput,
                    handler: (ctx) => {
                        try {
                            return summary(serverFor(ctx).focus(ctx.input.spec));
                        } catch (error) {
                            throw specError(error);
                        }
                    },
                },
                {
                    name: 'run_step',
                    description: 'Send the SpecKit command for a spec into this chat (plan, tasks, implement, status, resume, doctor, mark-complete), exactly as the board buttons do.',
                    inputSchema: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            spec: specInput.properties.spec,
                            command: { type: 'string', enum: SPEC_COMMANDS },
                        },
                        required: ['spec', 'command'],
                    },
                    handler: async (ctx) => {
                        try {
                            return await serverFor(ctx).run(ctx.input.spec, ctx.input.command);
                        } catch (error) {
                            throw specError(error);
                        }
                    },
                },
                {
                    name: 'refresh',
                    description: 'Re-read every spec folder and update the board.',
                    handler: (ctx) => ({ count: serverFor(ctx).rescan().specs.length }),
                },
            ],
            open: async (ctx) => {
                const selection = rootSelection(session.workspacePath);
                let savedRoot = null;
                try {
                    savedRoot = selection.read();
                } catch (error) {
                    // A saved directory that is gone or unreadable no longer applies; the board follows the session until a new one is chosen.
                    session.log?.(`[speckit-canvas] ignoring the saved repository selection: ${error.message}`);
                }
                const current = ctx.session?.workingDirectory;
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    const root = savedRoot ?? ctx.input?.root ?? current;
                    if (!root) throw new CanvasError('workspace_unavailable', 'The session has no working directory.');
                    const resolvedRoot = validateRoot(root);
                    if (!savedRoot && ctx.input?.root) selection.write(resolvedRoot);
                    entry = await createSpecServer({
                        root: resolvedRoot,
                        workingDirectory: current,
                        manual: Boolean(savedRoot || ctx.input?.root),
                        bound: savedRoot ? selection.source() : null,
                        coordinatedSessions: selection.sessions(),
                        saveCoordinatedSessions: (sessions, root, source) => selection.writeSessions(sessions, root, source),
                        saveRoot: (root, source) => selection.write(root, source),
                        clearRoot: () => selection.clear(),
                        discoverChildren,
                        childPollMs: 15000,
                        send: async (prompt) => {
                            await session.send({ prompt });
                            return true;
                        },
                        log: (message) => session.log?.(message),
                    });
                    servers.set(ctx.instanceId, entry);
                }
                if (current) followDirectory(entry, current);
                if (ctx.input?.spec) {
                    try {
                        entry.focus(ctx.input.spec);
                    } catch { /* open unfocused when the spec is unknown */ }
                }
                const { specs } = entry.snapshot;
                const active = specs.filter(s => !s.done).length;
                return { title: 'SpecKit Companion', status: openStatus(active, specs.length), url: entry.url };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (!entry) return;
                servers.delete(ctx.instanceId);
                await entry.close();
            },
        }),
    ],
});

// The runtime reports this session's own working directory changes (for example into a new worktree); a preliminary event precedes the settled one.
session.on?.('session.context_changed', (event) => {
    const data = event?.data;
    const directory = data?.gitRoot ?? data?.cwd;
    if (!directory || data.pendingGitContext) return;
    for (const entry of servers.values()) followDirectory(entry, directory);
});
// A step the board sent starts when the session takes its message into a turn, and stops when that turn ends.
session.on?.('user.message', (event) => {
    for (const entry of servers.values()) entry.began(event?.data?.content);
});
session.on?.('session.idle', () => {
    for (const entry of servers.values()) {
        entry.settle();
        entry.refreshChildren();
    }
});
