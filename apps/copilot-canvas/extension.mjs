// SpecKit Companion spec board, as a GitHub Copilot app canvas.
// Wiring only: the board logic lives in server.mjs and specs-core.mjs, which run without the SDK.

import { joinSession, createCanvas, CanvasError } from '@github/copilot-sdk/extension';
import { createSpecServer } from './server.mjs';
import { SPEC_COMMANDS } from './prompts.mjs';

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

const session = await joinSession({
    canvases: [
        createCanvas({
            id: CANVAS_ID,
            displayName: 'SpecKit Companion',
            description: 'A live board of every spec: its specify → plan → tasks → implement pipeline, task progress and run history, with a button that runs the next step.',
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    spec: { type: 'string', description: 'Optional spec to open focused (path, folder name, or number).' },
                },
            },
            actions: [
                {
                    name: 'list_specs',
                    description: 'List the specs on the board with status, pipeline step badges and task progress. Pass filter "active" to skip completed/archived specs.',
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
                    description: 'Select a spec on the board so the user sees its documents and pipeline.',
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
                const root = ctx.session?.workingDirectory;
                if (!root) throw new CanvasError('workspace_unavailable', 'The session has no working directory.');
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await createSpecServer({
                        root,
                        send: async (prompt) => {
                            await session.send({ prompt });
                            return true;
                        },
                        log: (message) => session.log?.(message),
                    });
                    servers.set(ctx.instanceId, entry);
                }
                if (ctx.input?.spec) {
                    try {
                        entry.focus(ctx.input.spec);
                    } catch { /* open unfocused when the spec is unknown */ }
                }
                const { specs } = entry.snapshot;
                const active = specs.filter(s => !s.done).length;
                return { title: 'SpecKit Companion', status: `${active} active · ${specs.length} specs`, url: entry.url };
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
