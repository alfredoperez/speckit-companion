import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANVAS_DESCRIPTION, OPEN_NOTE, SYSTEM_RULE } from '../prompts.mjs';

// extension.mjs joins a Copilot session on import, so it is loaded once against the stub SDK (tests/sdk-stub) and we read what it registered.
async function loadExtension() {
    if (!globalThis.__copilotJoined?.length) await import('../extension.mjs');
    assert.equal(globalThis.__copilotJoined.length, 1, 'joins exactly one session');
    return globalThis.__copilotJoined[0];
}

describe('what the extension tells the agent about opening the board', () => {
    it('appends the stop rule to the system message and declares the canvas in the same words', async () => {
        const config = await loadExtension();
        assert.deepEqual(config.systemMessage, { mode: 'append', content: SYSTEM_RULE });
        const [canvas] = config.canvases;
        assert.equal(canvas.id, 'speckit-spec-board');
        assert.equal(canvas.description, CANVAS_DESCRIPTION);
        assert.match(canvas.description, /only asks to open it, show it and stop/);
        assert.match(canvas.description, /do not read, test or implement any spec until they ask/);
    });

    it('says the same thing in the rule, the description and the open result', () => {
        assert.match(SYSTEM_RULE, /^If the user only asks to open the SpecKit Companion canvas, open it and stop: do not read, test or implement any spec until they ask\./);
        assert.ok(CANVAS_DESCRIPTION.endsWith('do not read, test or implement any spec until they ask.'));
        assert.match(OPEN_NOTE, /wait for the user's next instruction/);
    });

    it('does not stop the agent from running a /speckit command the board sends', () => {
        assert.match(SYSTEM_RULE, /A message that starts with a \/speckit command is a request to run that command, or the skill of that name, so run it\.$/);
    });

    it('opens with the wait note in its status and accepts a null input', async () => {
        const config = await loadExtension();
        const [canvas] = config.canvases;
        assert.deepEqual(canvas.inputSchema.type, ['object', 'null']);
        const result = await canvas.open({ instanceId: 'test-1', input: null, session: { workingDirectory: process.cwd() } });
        try {
            assert.equal(result.title, 'SpecKit Companion');
            assert.ok(result.status.endsWith(OPEN_NOTE));
            assert.match(result.url, /^http:\/\/127\.0\.0\.1:\d+\/\?token=/);
        } finally {
            await canvas.onClose({ instanceId: 'test-1' });
        }
    });
});

describe('how the board learns that a chat turn started and ended', () => {
    it('shows a sent step as running through an idle that is not its own, and stops when its own turn ends', async () => {
        const [canvas] = (await loadExtension()).canvases;
        const root = mkdtempSync(join(tmpdir(), 'canvas-ext-'));
        mkdirSync(join(root, 'specs/001-x'), { recursive: true });
        writeFileSync(join(root, 'specs/001-x/spec.md'), '# X\n');
        const fire = (type, data) => globalThis.__copilotHandlers[type]({ type, data });
        const ctx = { instanceId: 'test-idle', session: { workingDirectory: root } };
        const action = name => canvas.actions.find(a => a.name === name).handler;
        const plan = async () => (await action('list_specs')({ ...ctx, input: {} })).specs[0].steps.plan;
        await canvas.open({ ...ctx, input: null });
        try {
            fire('user.message', { content: 'something the user typed earlier' });
            const { prompt } = await action('run_step')({ ...ctx, input: { spec: '001-x', command: 'plan' } });
            assert.equal(await plan(), 'in-progress');
            fire('session.idle', {});
            assert.equal(await plan(), 'in-progress', 'the earlier turn ending settles nothing');
            fire('user.message', { content: prompt });
            writeFileSync(join(root, 'specs/001-x/plan.md'), '# Plan\n\nStore the flag.\n');
            fire('session.idle', {});
            assert.equal(await plan(), 'completed', 'its own turn ending does, and the written plan.md reads as done');
        } finally {
            await canvas.onClose({ instanceId: 'test-idle' });
        }
    });
});

describe('a turn that starts before the send returns', () => {
    it('is still the sent step\'s turn: its idle stops the step', async () => {
        const [canvas] = (await loadExtension()).canvases;
        const root = mkdtempSync(join(tmpdir(), 'canvas-ext-order-'));
        mkdirSync(join(root, 'specs/001-x'), { recursive: true });
        writeFileSync(join(root, 'specs/001-x/spec.md'), '# X\n');
        const fire = (type, data) => globalThis.__copilotHandlers[type]({ type, data });
        const ctx = { instanceId: 'test-order', session: { workingDirectory: root } };
        const action = name => canvas.actions.find(a => a.name === name).handler;
        const plan = async () => (await action('list_specs')({ ...ctx, input: {} })).specs[0].steps.plan;
        await canvas.open({ ...ctx, input: null });
        globalThis.__copilotOnSend = ({ prompt }) => fire('user.message', { content: prompt });
        try {
            await action('run_step')({ ...ctx, input: { spec: '001-x', command: 'plan' } });
            assert.equal(await plan(), 'in-progress');
            fire('session.idle', {});
            assert.equal(await plan(), 'not-started', 'the turn ended without a plan, and the step is no longer running');
        } finally {
            globalThis.__copilotOnSend = null;
            await canvas.onClose({ instanceId: 'test-order' });
        }
    });
});

describe('what the extension tells the agent about the board\'s actions', () => {
    const action = async (name) => (await loadExtension()).canvases[0].actions.find(a => a.name === name);

    it('tells the agent to list specs through the board instead of reading spec files', async () => {
        const { description } = await action('list_specs');
        assert.match(description, /^List the specs on the board/);
        assert.match(description, /Use this to answer any question about which specs exist or where they stand, instead of reading files under specs\//);
    });

    it('tells the agent to focus the board whenever the user names a spec', async () => {
        const { description } = await action('focus_spec');
        assert.match(description, /Call this whenever the user names a spec or asks to see, show or open one/);
        assert.match(description, /instead of reading its files under specs\//);
    });
});
