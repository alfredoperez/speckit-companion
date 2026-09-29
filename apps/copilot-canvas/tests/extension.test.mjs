import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
        assert.match(canvas.description, /show it and stop/);
        assert.match(canvas.description, /Do not read, test or implement any spec unless the user asks for that spec by name/);
    });

    it('says the same thing in the rule, the description and the open result', () => {
        assert.match(SYSTEM_RULE, /show it and stop\. Do not read, test or implement any spec unless the user asks for that spec by name\.$/);
        assert.ok(CANVAS_DESCRIPTION.endsWith('Do not read, test or implement any spec unless the user asks for that spec by name.'));
        assert.match(OPEN_NOTE, /wait for the user's next instruction/);
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
