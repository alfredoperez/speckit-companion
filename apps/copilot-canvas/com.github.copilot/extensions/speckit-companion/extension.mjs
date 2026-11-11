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
                    description: 'Select and save the absolute repository directory to scan. Use when the board is open in a Project chat rather than a repository checkout.',
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
                        saveRoot: (root) => selection.write(root),
                        clearRoot: () => selection.clear(),
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
    for (const entry of servers.values()) entry.settle();
});
