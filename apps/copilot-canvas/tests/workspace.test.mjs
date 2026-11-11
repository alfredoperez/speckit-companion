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

describe('session worktree following', () => {
    const waitFor = async (check) => {
        for (let i = 0; i < 60 && !check(); i++) await delay(50);
        assert.ok(check(), 'condition was not reached');
    };

    it('follows its own session without touching a sibling board, and rebinds watchers', async () => {
        const base = mkdtempSync(join(tmpdir(), 'canvas-follow-'));
        const [parent, childA, childB] = ['parent', 'child-a', 'child-b'].map(name => join(base, name));
        spec(parent, '001-parent', 'Parent');
        spec(childA, '002-a', 'A');
        spec(childB, '003-b', 'B');
        const one = await createSpecServer({ root: parent });
        const two = await createSpecServer({ root: parent });
        try {
            one.followWorkingDirectory(childA);
            assert.equal(one.snapshot.root, childA);
            assert.equal(one.snapshot.rootSource, 'session');
            assert.equal(one.snapshot.specs[0].title, 'A');
            assert.equal(two.snapshot.root, parent, 'a sibling session keeps its own directory');
            two.followWorkingDirectory(childB);
            assert.equal(one.snapshot.root, childA);
            assert.equal(two.snapshot.specs[0].title, 'B');
            spec(childA, '004-new', 'New');
            await waitFor(() => one.snapshot.specs.length === 2);
            spec(parent, '005-old', 'Old repository');
            await delay(400);
            assert.equal(one.snapshot.specs.length, 2, 'the previous directory is no longer watched');
            assert.ok(!(await one.run('002-a', 'ask')).prompt.includes('Repository directory'), 'the board root is the chat directory');
        } finally {
            await one.close();
            await two.close();
            rmSync(base, { recursive: true });
        }
    });

    it('lets an explicit selection win and returns to the session on request', async () => {
        const base = mkdtempSync(join(tmpdir(), 'canvas-follow-manual-'));
        const [chat, picked, moved] = ['chat', 'picked', 'moved'].map(name => join(base, name));
        [chat, picked, moved].forEach((root, i) => spec(root, `00${i}-x`, root));
        let cleared = 0;
        const board = await createSpecServer({ root: chat, saveRoot: () => {}, clearRoot: () => { cleared++; } });
        try {
            board.selectRoot(picked);
            board.followWorkingDirectory(moved);
            assert.equal(board.snapshot.root, picked);
            assert.equal(board.snapshot.rootSource, 'selected');
            board.followSession();
            assert.equal(cleared, 1);
            assert.equal(board.snapshot.root, moved);
            assert.equal(board.snapshot.rootSource, 'session');
        } finally {
            await board.close();
            rmSync(base, { recursive: true });
        }
    });

    it('waits for a running step before moving to the new directory', async () => {
        const base = mkdtempSync(join(tmpdir(), 'canvas-follow-run-'));
        const [first, second] = ['first', 'second'].map(name => join(base, name));
        spec(first, '001-one', 'One');
        spec(second, '002-two', 'Two');
        const board = await createSpecServer({ root: first, send: async () => true });
        try {
            const { prompt } = await board.run('001-one', 'plan');
            board.followWorkingDirectory(second);
            assert.equal(board.snapshot.root, first, 'the run keeps reading its own repository');
            board.began(prompt);
            board.settle();
            assert.equal(board.snapshot.root, second);
            assert.equal(board.snapshot.specs[0].title, 'Two');
        } finally {
            await board.close();
            rmSync(base, { recursive: true });
        }
    });

    it('follows runtime context changes per session, ignores preliminary ones and stale saved roots', async () => {
        const base = mkdtempSync(join(tmpdir(), 'canvas-follow-extension-'));
        const [chat, tree, gone] = ['chat', 'tree', 'gone'].map(name => join(base, name));
        [chat, tree].forEach((root, i) => spec(root, `00${i}-x`, root));
        mkdirSync(join(tree, 'src'));
        globalThis.__copilotWorkspacePath = base;
        await import('../com.github.copilot/extensions/speckit-companion/extension.mjs');
        const [canvas] = globalThis.__copilotJoined[0].canvases;
        const action = name => canvas.actions.find(candidate => candidate.name === name).handler;
        const changed = data => globalThis.__copilotHandlers['session.context_changed']({ data });
        const root = id => action('list_specs')({ instanceId: id, input: {} }).specs[0].title;
        try {
            mkdirSync(join(base, 'files', 'speckit-companion'), { recursive: true });
            writeFileSync(join(base, 'files', 'speckit-companion', 'board.json'), JSON.stringify({ root: gone }));
            await canvas.open({ instanceId: 'follow-a', input: null, session: { workingDirectory: chat } });
            assert.ok(root('follow-a').includes('chat'), 'a stale saved directory falls back to the session');
            changed({ cwd: join(tree, 'src'), gitRoot: tree, pendingGitContext: true });
            assert.ok(root('follow-a').includes('chat'), 'the preliminary event is ignored');
            changed({ cwd: join(tree, 'src'), gitRoot: tree });
            assert.ok(root('follow-a').includes('tree'));
            changed({ cwd: chat });
            await canvas.open({ instanceId: 'follow-a', input: null, session: { workingDirectory: tree } });
            assert.ok(root('follow-a').includes('tree'), 'reopening catches up with the session directory');
            action('select_root')({ instanceId: 'follow-a', input: { root: chat } });
            changed({ cwd: tree });
            assert.ok(root('follow-a').includes('chat'), 'an explicit selection is not overridden');
            action('use_session_directory')({ instanceId: 'follow-a', input: {} });
            assert.ok(root('follow-a').includes('tree'));
            assert.equal(rootSelection(base).read(), null);
        } finally {
            await canvas.onClose({ instanceId: 'follow-a' });
            globalThis.__copilotWorkspacePath = undefined;
            rmSync(base, { recursive: true });
        }
    });
});

describe('coordinator-bound source session', () => {
    it('binds, rebinds the same session to a new worktree, persists, and rolls back on failure', async () => {
        const base = mkdtempSync(join(tmpdir(), 'canvas-bind-'));
        const [chat, treeA, treeB] = ['chat', 'tree-a', 'tree-b'].map(name => join(base, name));
        mkdirSync(chat);
        spec(treeA, '001-a', 'A');
        spec(treeB, '002-b', 'B');
        globalThis.__copilotWorkspacePath = base;
        await import('../com.github.copilot/extensions/speckit-companion/extension.mjs');
        const [canvas] = globalThis.__copilotJoined.at(-1).canvases;
        const action = name => canvas.actions.find(candidate => candidate.name === name).handler;
        const title = id => action('list_specs')({ instanceId: id, input: {} }).specs[0]?.title;
        const open = () => canvas.open({ instanceId: 'bind-a', input: null, session: { workingDirectory: chat } });
        try {
            await open();
            const bound = action('bind_coordinated_session')({ instanceId: 'bind-a', input: { sessionId: 'c1', cwd: treeA, name: 'agents' } });
            assert.deepEqual(bound.source, { sessionId: 'c1', name: 'agents' });
            assert.equal(title('bind-a'), 'A');
            action('bind_coordinated_session')({ instanceId: 'bind-a', input: { sessionId: 'c1', cwd: treeB } });
            assert.equal(title('bind-a'), 'B', 'the same session rebinds to a new worktree');
            assert.throws(() => action('bind_coordinated_session')({ instanceId: 'bind-a', input: { sessionId: 'c2', cwd: join(base, 'missing') } }), /ENOENT/);
            assert.equal(title('bind-a'), 'B', 'a failed bind keeps the previous binding');
            assert.equal(rootSelection(base).source().sessionId, 'c1');
            await canvas.onClose({ instanceId: 'bind-a' });
            await open();
            assert.equal(title('bind-a'), 'B', 'the binding survives a reopen and outranks the own directory');
            globalThis.__copilotHandlers['session.context_changed']({ data: { cwd: chat } });
            assert.equal(title('bind-a'), 'B');
            action('select_root')({ instanceId: 'bind-a', input: { root: treeA } });
            assert.equal(rootSelection(base).source(), null, 'a manual choice replaces the binding');
            action('bind_coordinated_session')({ instanceId: 'bind-a', input: { sessionId: 'c1', cwd: treeB } });
            action('use_session_directory')({ instanceId: 'bind-a', input: {} });
            assert.equal(rootSelection(base).source(), null);
            assert.equal(action('list_specs')({ instanceId: 'bind-a', input: {} }).specs.length, 0, 'back on the empty chat directory');
        } finally {
            await canvas.onClose({ instanceId: 'bind-a' });
            globalThis.__copilotWorkspacePath = undefined;
            rmSync(base, { recursive: true });
        }
    });

    it('refuses a bind while a step is running and keeps commands in the owning chat', async () => {
        const base = mkdtempSync(join(tmpdir(), 'canvas-bind-run-'));
        const [chat, tree] = ['chat', 'tree'].map(name => join(base, name));
        spec(chat, '001-c', 'C');
        spec(tree, '002-t', 'T');
        const board = await createSpecServer({ root: chat, send: async () => true, saveRoot: () => {}, clearRoot: () => {} });
        try {
            await board.run('001-c', 'plan');
            assert.throws(() => board.bindSession({ sessionId: 'c1', cwd: tree }), /Wait for the current spec step/);
            assert.equal(board.snapshot.root, chat);
            assert.throws(() => board.bindSession({ sessionId: ' ', cwd: tree }), /session id/);
        } finally {
            await board.close();
            rmSync(base, { recursive: true });
        }
    });
});

describe('parent chat following owned sessions', () => {
    const waitFor = async (check) => {
        for (let i = 0; i < 60 && !check(); i++) await delay(50);
        assert.ok(check(), 'condition was not reached');
    };
    const child = (sessionId, cwd) => ({ sessionId, name: sessionId, cwd, state: 'idle' });

    it('shows the only owned session\'s worktree, follows its changes and falls back when it goes away', async () => {
        const base = mkdtempSync(join(tmpdir(), 'canvas-owned-'));
        const [chat, treeA, treeB] = ['chat', 'tree-a', 'tree-b'].map(name => join(base, name));
        mkdirSync(chat);
        spec(treeA, '001-a', 'A');
        spec(treeB, '002-b', 'B');
        let owned = [child('c1', treeA)];
        const board = await createSpecServer({ root: chat, discoverChildren: async () => ({ children: owned, note: null }) });
        try {
            await waitFor(() => board.snapshot.root === treeA);
            assert.equal(board.snapshot.rootSource, 'child');
            assert.equal(board.snapshot.specs[0].title, 'A');
            owned = [child('c1', treeB)];
            await board.refreshChildren();
            assert.equal(board.snapshot.root, treeB, 'a new worktree for the same session is followed');
            owned = [];
            await board.refreshChildren();
            assert.equal(board.snapshot.root, chat, 'an archived session drops out');
            assert.equal(board.snapshot.rootSource, 'session');
        } finally {
            await board.close();
            rmSync(base, { recursive: true });
        }
    });

    it('never guesses between several sessions and only accepts a listed one', async () => {
        const base = mkdtempSync(join(tmpdir(), 'canvas-owned-many-'));
        const [chat, treeA, treeB] = ['chat', 'tree-a', 'tree-b'].map(name => join(base, name));
        mkdirSync(chat);
        spec(treeA, '001-a', 'A');
        spec(treeB, '002-b', 'B');
        const saved = [];
        const board = await createSpecServer({
            root: chat,
            saveRoot: root => saved.push(root),
            clearRoot: () => {},
            discoverChildren: async () => ({ children: [child('c1', treeA), child('c2', treeB)], note: null }),
        });
        try {
            await waitFor(() => board.snapshot.children.length === 2);
            assert.equal(board.snapshot.root, chat);
            assert.throws(() => board.selectChild('someone-elses'), /not a session owned/);
            assert.throws(() => board.selectChild(undefined), /not a session owned/);
            board.selectChild('c2');
            assert.equal(board.snapshot.root, treeB);
            assert.equal(board.snapshot.rootSource, 'selected');
            assert.deepEqual(saved, [treeB]);
        } finally {
            await board.close();
            rmSync(base, { recursive: true });
        }
    });

    it('keeps a chat that holds specs, honours a manual choice and defers during a run', async () => {
        const base = mkdtempSync(join(tmpdir(), 'canvas-owned-keep-'));
        const [chat, tree, empty] = ['chat', 'tree', 'empty'].map(name => join(base, name));
        spec(chat, '001-chat', 'Chat');
        spec(tree, '002-tree', 'Tree');
        mkdirSync(empty);
        const discover = async () => ({ children: [child('c1', tree)], note: null });
        const withSpecs = await createSpecServer({ root: chat, discoverChildren: discover });
        const manual = await createSpecServer({ root: empty, manual: true, discoverChildren: discover });
        try {
            await delay(150);
            assert.equal(withSpecs.snapshot.root, chat, 'a chat that holds specs is not replaced');
            assert.equal(manual.snapshot.root, empty, 'an explicit choice outranks discovery');
        } finally {
            await withSpecs.close();
            await manual.close();
        }
        const owned = [];
        const board = await createSpecServer({ root: chat, send: async () => true, discoverChildren: async () => ({ children: owned, note: null }) });
        try {
            const { prompt } = await board.run('001-chat', 'plan');
            owned.push(child('c1', tree));
            board.followWorkingDirectory(empty);
            await board.refreshChildren();
            assert.equal(board.snapshot.root, chat, 'a step in flight keeps its repository');
            board.began(prompt);
            board.settle();
            assert.equal(board.snapshot.root, tree, 'the move happens once the step has settled');
        } finally {
            await board.close();
            rmSync(base, { recursive: true });
        }
    });

    it('surfaces a runtime that cannot list sessions and names the repository on commands', async () => {
        const base = mkdtempSync(join(tmpdir(), 'canvas-owned-note-'));
        const [chat, tree] = ['chat', 'tree'].map(name => join(base, name));
        mkdirSync(chat);
        spec(tree, '001-t', 'T');
        let unavailable = true;
        const board = await createSpecServer({
            root: chat,
            send: async () => true,
            discoverChildren: async () => {
                if (unavailable) throw new Error('management is disabled');
                return { children: [child('c1', tree)], note: null };
            },
        });
        try {
            await waitFor(() => board.snapshot.childNote === 'management is disabled');
            assert.equal(board.snapshot.root, chat);
            unavailable = false;
            await board.refreshChildren();
            assert.equal(board.snapshot.root, tree);
            assert.equal(board.snapshot.childNote, null);
            const { prompt } = await board.run('001-t', 'plan');
            assert.ok(prompt.includes(`Repository directory: ${JSON.stringify(tree)}`), 'the command names the owned worktree');
        } finally {
            await board.close();
            rmSync(base, { recursive: true });
        }
    });

    it('lists only sessions whose parent is this session through the runtime', async () => {
        const base = mkdtempSync(join(tmpdir(), 'canvas-owned-rpc-'));
        const [chat, mine, other] = ['chat', 'mine', 'other'].map(name => join(base, name));
        mkdirSync(chat);
        spec(mine, '001-m', 'Mine');
        spec(other, '002-o', 'Other');
        const calls = [];
        globalThis.__copilotWorkspacePath = base;
        globalThis.__copilotManagementList = async params => {
            calls.push(params);
            return { sessions: [
                { sessionId: 'x1', name: 'x1', cwd: other, state: 'busy', parentSessionId: 'someone-else' },
                { sessionId: 'x2', name: 'x2', cwd: other, state: 'idle' },
                { sessionId: 'm1', name: 'm1', cwd: mine, state: 'idle', parentSessionId: 'parent-session' },
            ] };
        };
        await import('../com.github.copilot/extensions/speckit-companion/extension.mjs');
        const [canvas] = globalThis.__copilotJoined.at(-1).canvases;
        const action = name => canvas.actions.find(candidate => candidate.name === name).handler;
        try {
            await canvas.open({ instanceId: 'owned-a', input: null, session: { workingDirectory: chat } });
            await waitFor(() => action('list_specs')({ instanceId: 'owned-a', input: {} }).specs[0]?.title === 'Mine');
            assert.deepEqual(calls[0], {});
            assert.throws(() => action('select_child')({ instanceId: 'owned-a', input: { sessionId: 'x2' } }), /not a session owned/);
        } finally {
            await canvas.onClose({ instanceId: 'owned-a' });
            globalThis.__copilotManagementList = undefined;
            globalThis.__copilotWorkspacePath = undefined;
            rmSync(base, { recursive: true });
        }
    });
});
