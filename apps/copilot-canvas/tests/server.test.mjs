import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSpecServer } from '../server.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

function call(board, path, { method = 'GET', headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port: board.port, path, method, headers: { host: `127.0.0.1:${board.port}`, ...headers } }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

describe('spec board server', () => {
    let root;
    let board;
    const sent = [];

    before(async () => {
        root = mkdtempSync(join(tmpdir(), 'canvas-server-'));
        mkdirSync(join(root, 'specs'));
        cpSync(join(REPO, 'specs/_01_demo-planned'), join(root, 'specs/_01_demo-planned'), { recursive: true });
        cpSync(join(REPO, 'specs/_02_demo-tasked'), join(root, 'specs/_02_demo-tasked'), { recursive: true });
        mkdirSync(join(root, '.specify/extensions/companion'), { recursive: true });
        board = await createSpecServer({ root, send: async (prompt) => { sent.push(prompt); return true; } });
    });

    after(async () => {
        await board.close();
    });

    const auth = () => ({ 'x-speckit-token': board.token });

    it('serves the page with a strict content security policy', async () => {
        const res = await call(board, '/');
        assert.equal(res.status, 200);
        assert.match(res.headers['content-security-policy'], /default-src 'self'/);
        assert.match(res.body, /SpecKit Companion/);
    });

    it('refuses the API without the token or from another host', async () => {
        assert.equal((await call(board, '/api/snapshot')).status, 403);
        assert.equal((await call(board, '/api/snapshot', { headers: { ...auth(), host: 'evil.test' } })).status, 403);
        assert.equal((await call(board, '/api/snapshot', { headers: { ...auth(), origin: 'http://evil.test' } })).status, 403);
    });

    it('returns the snapshot with the Companion command set', async () => {
        const res = await call(board, '/api/snapshot', { headers: auth() });
        const snapshot = JSON.parse(res.body);
        assert.equal(snapshot.specs.length, 2);
        assert.equal(snapshot.commandSet, 'companion');
        assert.ok(snapshot.commands.includes('resume'));
    });

    it('returns a spec detail with rendered documents', async () => {
        const res = await call(board, '/api/spec?id=_02_demo-tasked', { headers: auth() });
        const detail = JSON.parse(res.body);
        assert.equal(detail.spec.id, 'specs/_02_demo-tasked');
        assert.ok(detail.documents.find(d => d.type === 'tasks').html.includes('type="checkbox"'));
        assert.equal((await call(board, '/api/spec?id=nope-nothing', { headers: auth() })).status, 404);
    });

    it('sends the step command for a spec into the chat', async () => {
        const res = await call(board, '/api/run', { method: 'POST', headers: auth(), body: { spec: 'specs/_01_demo-planned', command: 'tasks' } });
        assert.equal(res.status, 200);
        const { prompt, sent: delivered } = JSON.parse(res.body);
        assert.equal(delivered, true);
        assert.equal(prompt.split('\n')[0], '/speckit.companion.tasks specs/_01_demo-planned');
        assert.equal(sent.at(-1), prompt);
        assert.equal((await call(board, '/api/run', { method: 'POST', headers: auth(), body: { spec: 'specs/_01_demo-planned', command: 'bogus' } })).status, 400);
    });

    it('sends a new spec with the chosen workflow and the preamble that seeds the run record', async () => {
        const res = await call(board, '/api/specify', { method: 'POST', headers: auth(), body: { description: 'Show a footer count', workflow: 'speckit' } });
        assert.equal(res.status, 200);
        const body = JSON.parse(res.body);
        assert.equal(body.command, 'speckit.specify');
        assert.equal(body.workflow, 'speckit');
        assert.ok(sent.at(-1).startsWith('/speckit.specify Show a footer count'));
        assert.match(sent.at(-1), /"workflow": "speckit"/);
        assert.match(sent.at(-1), /"by": "extension"/);
        const auto = await call(board, '/api/specify', { method: 'POST', headers: auth(), body: { description: 'x', workflow: 'auto' } });
        assert.equal(JSON.parse(auto.body).command, 'speckit.companion.auto');
    });

    it('rejects an unknown workflow and an empty description', async () => {
        const unknown = await call(board, '/api/specify', { method: 'POST', headers: auth(), body: { description: 'x', workflow: 'turbo' } });
        assert.equal(unknown.status, 400);
        assert.match(JSON.parse(unknown.body).error, /Unknown workflow/);
        const empty = await call(board, '/api/specify', { method: 'POST', headers: auth(), body: { description: '  ', workflow: 'speckit' } });
        assert.equal(empty.status, 400);
    });

    it('offers the workflow choices in the snapshot', async () => {
        const { specify } = JSON.parse((await call(board, '/api/snapshot', { headers: auth() })).body);
        assert.equal(specify.default, 'companion');
        assert.deepEqual(specify.choices.map(c => c.id), ['companion', 'speckit', 'auto']);
    });

    it('refuses Auto and Companion on a workspace without the extension', async () => {
        const stockRoot = mkdtempSync(join(tmpdir(), 'canvas-stock-'));
        mkdirSync(join(stockRoot, 'specs'));
        const stock = await createSpecServer({ root: stockRoot, send: async () => true });
        try {
            const headers = { 'x-speckit-token': stock.token };
            const auto = await call(stock, '/api/specify', { method: 'POST', headers, body: { description: 'x', workflow: 'auto' } });
            assert.equal(auto.status, 400);
            assert.match(JSON.parse(auto.body).error, /Auto needs the companion spec-kit extension/);
            const ok = await call(stock, '/api/specify', { method: 'POST', headers, body: { description: 'x', workflow: 'speckit' } });
            assert.equal(ok.status, 200);
            const { specify } = JSON.parse((await call(stock, '/api/snapshot', { headers })).body);
            assert.equal(specify.default, 'speckit');
            assert.deepEqual(specify.choices.map(c => c.available), [false, true, false]);
        } finally {
            await stock.close();
        }
    });

    it('sends the step preamble with a run button', async () => {
        await call(board, '/api/run', { method: 'POST', headers: auth(), body: { spec: 'specs/_02_demo-tasked', command: 'implement' } });
        assert.ok(sent.at(-1).startsWith('/speckit.companion.implement specs/_02_demo-tasked'));
        assert.match(sent.at(-1), /<!-- speckit-companion:context-update -->/);
        await call(board, '/api/run', { method: 'POST', headers: auth(), body: { spec: 'specs/_02_demo-tasked', command: 'status' } });
        assert.doesNotMatch(sent.at(-1), /context-update/);
    });

    it('picks up a change on disk without a manual refresh', async () => {
        writeFileSync(join(root, 'specs/_02_demo-tasked/tasks.md'), '- [x] T001 One\n- [ ] T002 Two\n');
        const deadline = Date.now() + 3000;
        let tasks;
        while (Date.now() < deadline) {
            tasks = board.snapshot.specs.find(s => s.id === 'specs/_02_demo-tasked').tasks;
            if (tasks.checked === 1) break;
            await new Promise(r => setTimeout(r, 50));
        }
        assert.deepEqual(tasks, { checked: 1, total: 2 });
    });

    it('streams a snapshot first on the event stream', async () => {
        const first = await new Promise((resolve, reject) => {
            const req = request({ host: '127.0.0.1', port: board.port, path: `/api/events?token=${encodeURIComponent(board.token)}`, headers: { host: `127.0.0.1:${board.port}` } }, (res) => {
                res.once('data', chunk => {
                    resolve(String(chunk));
                    req.destroy();
                });
            });
            req.on('error', reject);
            req.end();
        });
        assert.match(first, /^event: snapshot\n/);
    });
});
