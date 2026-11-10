import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { rootSelection, validateRoot } from '../com.github.copilot/extensions/speckit-companion/workspace.mjs';
import { buildSnapshot } from '../com.github.copilot/extensions/speckit-companion/specs-core.mjs';
import { createSpecServer } from '../com.github.copilot/extensions/speckit-companion/server.mjs';

function spec(root, id, title) {
    mkdirSync(join(root, 'specs', id), { recursive: true });
    writeFileSync(join(root, 'specs', id, 'spec.md'), `# ${title}\n`);
}

describe('repository root selection', () => {
    it('validates paths and restores the session selection independently of the panel', () => {
        const workspace = mkdtempSync(join(tmpdir(), 'canvas-root-storage-'));
        try {
            assert.throws(() => validateRoot('relative/path'), /absolute/);
            assert.throws(() => validateRoot(''), /absolute/);
            assert.throws(() => validateRoot(join(workspace, 'missing')), /ENOENT/);
            writeFileSync(join(workspace, 'file'), '');
            assert.throws(() => validateRoot(join(workspace, 'file')), /directory/);
            assert.equal(rootSelection(workspace).read(), null);
            rootSelection(workspace).write(workspace);
            assert.equal(rootSelection(workspace).read(), workspace);
            writeFileSync(join(workspace, 'files/speckit-companion/board.json'), 'broken');
            assert.throws(() => rootSelection(workspace).read(), SyntaxError);
            assert.throws(() => rootSelection().write(workspace), /storage is unavailable/);
        } finally {
            rmSync(workspace, { recursive: true });
        }
    });

    it('distinguishes a missing spec directory from an empty one', () => {
        const root = mkdtempSync(join(tmpdir(), 'canvas-root-empty-'));
        try {
            assert.equal(buildSnapshot(root).missingSpecDirectories, true);
            mkdirSync(join(root, 'specs'));
            assert.equal(buildSnapshot(root).missingSpecDirectories, false);
        } finally {
            rmSync(root, { recursive: true });
        }
    });

    it('switches the existing server, resets focus, persists selection and watches the new root', async () => {
        const workspace = mkdtempSync(join(tmpdir(), 'canvas-root-switch-'));
        const first = join(workspace, 'first');
        const second = join(workspace, 'second');
        spec(first, '001-one', 'First');
        spec(second, '002-two', 'Second');
        const selection = rootSelection(workspace);
        const board = await createSpecServer({ root: first, saveRoot: selection.write });
        try {
            board.focus('001-one');
            const response = await fetch(new URL('/api/root', board.url), {
                method: 'POST',
                headers: { 'x-speckit-token': board.token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ root: second }),
            });
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { root: second, count: 1 });
            assert.equal(board.snapshot.selected, null);
            assert.equal(selection.read(), second);
            assert.equal(board.snapshot.specs[0].title, 'Second');
            const message = await board.run('002-two', 'ask');
            assert.ok(message.prompt.includes(`Repository directory: ${JSON.stringify(second)}`));
            spec(second, '003-three', 'Third');
            for (let i = 0; i < 50 && board.snapshot.specs.length !== 2; i++) await delay(50);
            assert.equal(board.snapshot.specs.length, 2, 'new repository changes are watched without refresh');
            const bad = await fetch(new URL('/api/root', board.url), {
                method: 'POST',
                headers: { 'x-speckit-token': board.token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ root: join(workspace, 'missing') }),
            });
            assert.equal(bad.status, 400);
            assert.equal(board.snapshot.root, second);
            assert.equal(selection.read(), second);
        } finally {
            await board.close();
            rmSync(workspace, { recursive: true });
        }
    });

    it('keeps the existing board when saving fails and refuses a switch during a run', async () => {
        const root = mkdtempSync(join(tmpdir(), 'canvas-root-busy-'));
        spec(root, '001-one', 'First');
        const board = await createSpecServer({ root, saveRoot: () => { throw new Error('disk full'); }, send: async () => true });
        try {
            assert.throws(() => board.selectRoot(root), /disk full/);
            assert.equal(board.snapshot.root, root);
            await board.run('001-one', 'plan');
            assert.throws(() => board.selectRoot(root), /current spec step/);
        } finally {
            await board.close();
            rmSync(root, { recursive: true });
        }
    });

    it('opens a chat board at an explicit root and restores it in a fresh panel', async () => {
        const workspace = mkdtempSync(join(tmpdir(), 'canvas-root-extension-'));
        const chat = join(workspace, 'chat');
        const repository = join(workspace, 'repository');
        mkdirSync(chat);
        spec(repository, '001-one', 'Repository spec');
        globalThis.__copilotWorkspacePath = workspace;
        await import('../com.github.copilot/extensions/speckit-companion/extension.mjs');
        const [canvas] = globalThis.__copilotJoined[0].canvases;
        const list = canvas.actions.find(action => action.name === 'list_specs').handler;
        const select = canvas.actions.find(action => action.name === 'select_root').handler;
        try {
            await canvas.open({ instanceId: 'root-first', input: { root: repository }, session: { workingDirectory: chat } });
            assert.equal(list({ instanceId: 'root-first', input: {} }).count, 1);
            const run = canvas.actions.find(action => action.name === 'run_step').handler;
            const message = await run({ instanceId: 'root-first', input: { spec: '001-one', command: 'plan' } });
            assert.ok(message.prompt.includes(`Repository directory: ${JSON.stringify(repository)}`));
            await canvas.onClose({ instanceId: 'root-first' });
            await canvas.open({ instanceId: 'root-second', input: null, session: { workingDirectory: chat } });
            assert.equal(list({ instanceId: 'root-second', input: {} }).count, 1);
            assert.equal(select({ instanceId: 'root-second', input: { root: chat } }).count, 0);
            assert.equal(JSON.parse(readFileSync(join(workspace, 'files/speckit-companion/board.json'), 'utf8')).root, chat);
            await canvas.onClose({ instanceId: 'root-second' });
            await canvas.open({ instanceId: 'root-second', input: { root: repository }, session: { workingDirectory: chat } });
            assert.equal(list({ instanceId: 'root-second', input: {} }).count, 0, 'rehydrating an old open input preserves the later selection');
        } finally {
            await canvas.onClose({ instanceId: 'root-first' });
            await canvas.onClose({ instanceId: 'root-second' });
            globalThis.__copilotWorkspacePath = undefined;
            rmSync(workspace, { recursive: true });
        }
    });
});
