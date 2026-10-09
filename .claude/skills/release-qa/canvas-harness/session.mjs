import { CopilotClient, approveAll } from '@github/copilot-sdk';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '../../../..');
export const BOARD = 'speckit-spec-board';

const APP = process.env.COPILOT_APP ?? '/Applications/GitHub Copilot.app';
export const APP_SDK = join(APP, 'Contents/Resources/copilot-sdk');
export const RESOLVER = join(APP, 'Contents/Resources/copilot-extension-host/preloads/extension_sdk_resolver.mjs');
export const SESSION_TIMEOUT_MS = Number(process.env.CANVAS_SESSION_TIMEOUT ?? 300) * 1000;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Blocked extends Error {}

/** The file or command a tool call names, so a transcript can answer "did it read that file, did it call that script". */
function toolDetail(args) {
    const value = args?.path ?? args?.command ?? args?.pattern ?? args?.skill ?? args?.name ?? '';
    return String(value).slice(0, 400);
}

export function withDeadline(promise, ms, label) {
    let timer;
    const stall = new Promise((_, reject) => { timer = setTimeout(() => reject(new Blocked(`${label} stalled after ${Math.round(ms / 1000)}s`)), ms); });
    return Promise.race([promise, stall]).finally(() => clearTimeout(timer));
}

/** A fresh Copilot client and session in `cwd`, with the canvas extension host launched the way the Copilot app launches it. */
export async function openSession(cwd) {
    const client = new CopilotClient({
        workingDirectory: cwd,
        logLevel: 'error',
        extensionLaunchProvider: {
            async resolve(req) {
                return { launch: { executable: process.execPath, args: [join(HERE, 'bootstrap.mjs')], env: { EXTENSION_PATH: req.modulePath, COPILOT_SDK_PATH: APP_SDK, COPILOT_RESOLVER: RESOLVER } } };
            },
        },
    });
    const log = { models: new Set(), users: [], replies: [], tools: [], errors: [], idleAt: 0, busy: false };
    let session;
    try {
        await withDeadline(client.start(), 90_000, 'Copilot client start');
        session = await withDeadline(client.createSession({ workingDirectory: cwd, onPermissionRequest: approveAll, requestCanvasRenderer: true, requestExtensions: true, extensionSdkPath: APP_SDK }), 90_000, 'session create');
    } catch (error) {
        await stopClient(client);
        throw error;
    }
    session.on((e) => {
        const d = e.data ?? {};
        if (d.model) log.models.add(d.model);
        if (e.type === 'session.idle') { log.idleAt = Date.now(); log.busy = false; return; }
        if (/^(user\.message|assistant\.(turn_start|message)|tool\.execution_start)$/.test(e.type)) log.busy = true;
        if (e.type === 'user.message') log.users.push(String(d.content ?? ''));
        if (e.type === 'tool.execution_start') log.tools.push({ name: d.toolName, canvasId: d.arguments?.canvasId ?? null, detail: toolDetail(d.arguments) });
        if (e.type === 'assistant.message' && d.content) log.replies.push(String(d.content));
        if (e.type === 'session.error') log.errors.push(JSON.stringify(d).slice(0, 300));
    });
    const close = async () => {
        await session.abort().catch(() => {});
        await stopClient(client);
    };
    return { client, session, log, close };
}

async function stopClient(client) {
    try { await withDeadline(client.stop(), 20_000, 'client stop'); } catch { await client.forceStop().catch(() => {}); }
}

export async function waitForBoard(session) {
    for (let i = 0; i < 60; i++) {
        const { canvases } = await session.rpc.canvas.list();
        if (canvases.some((c) => c.canvasId === BOARD)) return;
        await sleep(500);
    }
    throw new Blocked(`the ${BOARD} canvas was never declared (is the canvas extension installed for Copilot?)`);
}

/** Waits for the turn that follows a send: at least one user message, then idle with no activity for `settleMs`. */
export async function waitSettled(log, { since, settleMs = 8000, timeoutMs = SESSION_TIMEOUT_MS, label }) {
    const end = since + timeoutMs;
    while (Date.now() < end) {
        await sleep(1000);
        if (log.users.length && !log.busy && log.idleAt > since && Date.now() - log.idleAt > settleMs) return;
    }
    throw new Blocked(`${label}: the agent did not go idle within ${Math.round(timeoutMs / 1000)}s`);
}

export function transcript(log) {
    return { models: [...log.models], sentMessages: log.users, replies: log.replies, tools: log.tools, errors: log.errors };
}

export const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

/** Every path changed since `base`, committed or not. */
export function changedSince(cwd, base) {
    const committed = git(cwd, 'diff', '--name-only', base, 'HEAD').split('\n');
    const working = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd, encoding: 'utf8' }).split('\n').map((l) => l.slice(3));
    return [...new Set([...committed, ...working].filter(Boolean))];
}
