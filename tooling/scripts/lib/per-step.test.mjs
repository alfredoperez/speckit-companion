import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { childArgs, runPerStep, spawnChild, talkSteps } from './per-step.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

test('a step that fails once passes on its retry, and the others still run', async () => {
    const calls = [];
    const results = await runPerStep(['a', 'b', 'c'], async name => {
        calls.push(name);
        return name === 'b' && calls.filter(call => call === 'b').length === 1 ? 124 : 0;
    });
    assert.deepEqual(calls, ['a', 'b', 'b', 'c']);
    assert.deepEqual(results.map(result => [result.name, result.ok, result.attempts]), [['a', true, 1], ['b', true, 2], ['c', true, 1]]);
});

test('a step that fails twice is reported, is not tried a third time, and the next one runs', async () => {
    const calls = [];
    const results = await runPerStep(['a', 'b', 'c'], async name => {
        calls.push(name);
        return name === 'a' ? 1 : 0;
    });
    assert.deepEqual(calls, ['a', 'a', 'b', 'c']);
    assert.deepEqual(results.map(result => result.ok), [false, true, true]);
});

test('a spawner that throws counts as a failure instead of ending the run', async () => {
    const results = await runPerStep(['a', 'b'], async name => {
        if (name === 'a') throw new Error('spawn failed');
        return 0;
    });
    assert.deepEqual(results.map(result => result.ok), [false, true]);
});

test('the child gets one step and --append, and loses --only and --sheet', () => {
    assert.deepEqual(
        childArgs(['--shots', 'out', '--only', 'x,y', '--sheet', '--scale', '3'], ['--only', 'x']),
        ['--shots', 'out', '--scale', '3', '--append', '--only', 'x'],
    );
});

test('talkSteps finds the talk steps of desktop-check and their kind', () => {
    const found = talkSteps(readFileSync(join(HERE, '..', 'desktop-check.mjs'), 'utf8'));
    const byName = Object.fromEntries(found.map(({ name, kind }) => [name, kind]));
    assert.equal(byName['talk-new-spec'], 'shots');
    assert.equal(byName['talk-film-ticking'], 'record');
    assert.equal(byName['talk-builder'], 'shots');
    assert.equal(found.length, 11);
    assert.ok(!('sidebar-panes' in byName));
});

test('spawnChild ends a child past its time limit, so the run exits', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'per-step-'));
    const hang = join(dir, 'hang.mjs');
    writeFileSync(hang, 'setInterval(() => {}, 1000);');
    try {
        assert.equal(await spawnChild(hang, [], 300), 124);
        assert.equal(await spawnChild(join(dir, 'missing.mjs'), [], 5000), 1);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
