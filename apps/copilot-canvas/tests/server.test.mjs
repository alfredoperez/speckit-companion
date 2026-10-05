import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, existsSync } from 'node:fs';
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
        const tasked = join(root, 'specs/_02_demo-tasked/.spec-context.json');
        writeFileSync(tasked, readFileSync(tasked, 'utf8').replace('"workflow": "speckit"', '"workflow": "companion"'));
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
        const res = await call(board, '/api/run', { method: 'POST', headers: auth(), body: { spec: 'specs/_02_demo-tasked', command: 'plan' } });
        assert.equal(res.status, 200);
        const { prompt, sent: delivered } = JSON.parse(res.body);
        assert.equal(delivered, true);
        assert.equal(prompt.split('\n')[0], '/speckit.companion.plan specs/_02_demo-tasked');
        assert.equal(sent.at(-1), prompt);
        assert.equal((await call(board, '/api/run', { method: 'POST', headers: auth(), body: { spec: 'specs/_01_demo-planned', command: 'bogus' } })).status, 400);
    });

    it('keeps a stock-workflow spec on the stock commands even with Companion installed', async () => {
        const res = await call(board, '/api/run', { method: 'POST', headers: auth(), body: { spec: 'specs/_01_demo-planned', command: 'tasks' } });
        const { prompt } = JSON.parse(res.body);
        assert.equal(prompt.split('\n')[0], '/speckit.tasks specs/_01_demo-planned');
        assert.doesNotMatch(prompt, /speckit\.companion/);
        const stock = JSON.parse((await call(board, '/api/spec?id=_01_demo-planned', { headers: auth() })).body);
        assert.equal(stock.commandSet, 'speckit');
        assert.ok(!stock.commands.includes('mark-complete'));
        const companion = JSON.parse((await call(board, '/api/spec?id=_02_demo-tasked', { headers: auth() })).body);
        assert.equal(companion.commandSet, 'companion');
        assert.ok(companion.commands.includes('mark-complete'));
    });

    it('sends a new spec with the chosen workflow and writes the preamble that seeds the run record to a file', async () => {
        const res = await call(board, '/api/specify', { method: 'POST', headers: auth(), body: { description: 'Show a footer count', workflow: 'speckit' } });
        assert.equal(res.status, 200);
        const body = JSON.parse(res.body);
        assert.equal(body.command, 'speckit.specify');
        assert.equal(body.workflow, 'speckit');
        assert.match(body.instructionsFile, /^\.speckit-companion\/prompts\/specify-\d{8}T\d{9}Z\.md$/);
        assert.ok(sent.at(-1).startsWith('/speckit.specify Show a footer count'));
        assert.ok(sent.at(-1).endsWith(`Before you start, read and follow the run instructions in \`${body.instructionsFile}\`.`));
        const file = readFileSync(join(root, body.instructionsFile), 'utf8');
        assert.match(file, /"workflow": "speckit"/);
        assert.match(file, /"by": "extension"/);
        const auto = await call(board, '/api/specify', { method: 'POST', headers: auth(), body: { description: 'x', workflow: 'auto' } });
        assert.equal(JSON.parse(auto.body).command, 'speckit.companion.auto');
    });

    it('sends a short message for every command in both command sets, with the preamble in the file it names', async () => {
        const cases = [
            ...['plan', 'tasks', 'implement'].map(command => ({ path: '/api/run', body: { spec: 'specs/_02_demo-tasked', command }, line: `/speckit.companion.${command} specs/_02_demo-tasked`, file: `.speckit-companion/prompts/${command}-_02_demo-tasked.md`, phrase: 'This command\'s body carries the full' })),
            ...['plan', 'tasks', 'implement'].map(command => ({ path: '/api/run', body: { spec: 'specs/_01_demo-planned', command }, line: `/speckit.${command} specs/_01_demo-planned`, file: `.speckit-companion/prompts/${command}-_01_demo-planned.md`, phrase: 'Canonical statuses' })),
            ...[['companion', 'speckit.companion.specify'], ['speckit', 'speckit.specify'], ['auto', 'speckit.companion.auto']].map(([workflow, command]) => ({ path: '/api/specify', body: { description: 'Count things', workflow }, line: `/${command} Count things`, file: null, phrase: 'SEED WRITE INSTRUCTIONS' })),
        ];
        for (const { path, body, line, file, phrase } of cases) {
            const res = await call(board, path, { method: 'POST', headers: auth(), body });
            assert.equal(res.status, 200, line);
            const { prompt, instructionsFile } = JSON.parse(res.body);
            assert.equal(sent.at(-1), prompt);
            if (file) assert.equal(instructionsFile, file);
            const paragraphs = prompt.split('\n\n');
            assert.equal(paragraphs[0], line);
            assert.equal(paragraphs.at(-1), `Before you start, read and follow the run instructions in \`${instructionsFile}\`.`);
            assert.ok(paragraphs.length <= 3, `${line}: the command, at most one rule, and the sentence`);
            const written = readFileSync(join(root, instructionsFile), 'utf8');
            for (const text of ['speckit-companion:context-update', phrase]) {
                assert.ok(!prompt.includes(text), `${line}: "${text}" stays out of the chat`);
                assert.ok(written.includes(text), `${line}: "${text}" is in the file`);
            }
        }
        assert.equal(readFileSync(join(root, '.speckit-companion/.gitignore'), 'utf8'), '*\n');
    });

    it('replaces a spec\'s older file for the same step', async () => {
        const file = join(root, '.speckit-companion/prompts/plan-_02_demo-tasked.md');
        writeFileSync(file, 'stale');
        await call(board, '/api/run', { method: 'POST', headers: auth(), body: { spec: 'specs/_02_demo-tasked', command: 'plan' } });
        assert.doesNotMatch(readFileSync(file, 'utf8'), /stale/);
    });

    it('sends one line asking the agent to install Companion and commit its skill files', async () => {
        const res = await call(board, '/api/install', { method: 'POST', headers: auth(), body: {} });
        assert.equal(res.status, 200);
        assert.match(sent.at(-1), /^Run `specify extension add companion --from https:\/\/github\.com\/alfredoperez\/speckit-companion\/releases\/download\/companion-latest\/companion\.zip --force` in this project, then commit the skill files it generates/);
        assert.ok(!sent.at(-1).includes('\n'));
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

    it('writes no file and adds no sentence for a command that has no preamble', async () => {
        const res = await call(board, '/api/run', { method: 'POST', headers: auth(), body: { spec: 'specs/_02_demo-tasked', command: 'status' } });
        assert.equal(JSON.parse(res.body).instructionsFile, null);
        assert.equal(sent.at(-1), '/speckit.companion.status specs/_02_demo-tasked');
        assert.ok(!existsSync(join(root, '.speckit-companion/prompts/status-_02_demo-tasked.md')));
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

/** Open the event stream and collect every snapshot it carries. */
function listen(board) {
    const snapshots = [];
    let buffer = '';
    const req = request({ host: '127.0.0.1', port: board.port, path: `/api/events?token=${encodeURIComponent(board.token)}`, headers: { host: `127.0.0.1:${board.port}` } }, (res) => {
        res.on('data', chunk => {
            buffer += chunk;
            let end;
            while ((end = buffer.indexOf('\n\n')) !== -1) {
                const frame = buffer.slice(0, end);
                buffer = buffer.slice(end + 2);
                const data = frame.match(/^event: snapshot\ndata: (.*)$/s)?.[1];
                if (data) snapshots.push(JSON.parse(data));
            }
        });
        res.on('error', () => {});
    });
    req.on('error', () => {});
    req.end();
    return { snapshots, close: () => req.destroy() };
}

async function until(check, what, ms = 5000) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
        if (check()) return;
        await new Promise(r => setTimeout(r, 25));
    }
    assert.fail(`timed out waiting for ${what}`);
}

const ids = snapshot => snapshot.specs.map(s => s.id);

describe('watching for spec folders that are not there yet', () => {
    async function open(prepare = () => {}) {
        const root = mkdtempSync(join(tmpdir(), 'canvas-watch-'));
        prepare(root);
        const board = await createSpecServer({ root, send: async () => true });
        const stream = listen(board);
        await until(() => stream.snapshots.length === 1, 'the opening snapshot');
        return { root, board, stream, close: async () => { stream.close(); await board.close(); } };
    }
    const addSpec = (root, id) => {
        mkdirSync(join(root, id), { recursive: true });
        writeFileSync(join(root, id, 'spec.md'), '# Spec\n');
    };

    it('shows the first spec of a project that had no specs folder, without a refresh', async () => {
        const { root, board, stream, close } = await open();
        try {
            assert.deepEqual(ids(board.snapshot), []);
            addSpec(root, 'specs/001-x');
            await until(() => stream.snapshots.some(s => ids(s).includes('specs/001-x')), 'a snapshot event with the new spec');
            assert.deepEqual(ids(board.snapshot), ['specs/001-x']);
            writeFileSync(join(root, 'specs/001-x/tasks.md'), '- [x] T001 One\n- [ ] T002 Two\n');
            await until(() => stream.snapshots.at(-1).specs[0]?.tasks?.total === 2, 'a later change inside the new folder');
        } finally {
            await close();
        }
    });

    it('shows the first spec when the specs folder was there but empty', async () => {
        const { root, board, stream, close } = await open(root => mkdirSync(join(root, 'specs')));
        try {
            addSpec(root, 'specs/001-x');
            await until(() => stream.snapshots.some(s => ids(s).includes('specs/001-x')), 'a snapshot event with the new spec');
            assert.deepEqual(ids(board.snapshot), ['specs/001-x']);
        } finally {
            await close();
        }
    });

    it('keeps watching after the specs folder is deleted and created again', async () => {
        const { root, board, stream, close } = await open(root => addSpec(root, 'specs/001-x'));
        try {
            assert.deepEqual(ids(board.snapshot), ['specs/001-x']);
            rmSync(join(root, 'specs'), { recursive: true });
            await until(() => ids(stream.snapshots.at(-1)).length === 0, 'a snapshot event without the deleted spec');
            addSpec(root, 'specs/002-y');
            await until(() => ids(stream.snapshots.at(-1)).includes('specs/002-y'), 'a snapshot event with the recreated folder\'s spec');
            assert.deepEqual(ids(board.snapshot), ['specs/002-y']);
            writeFileSync(join(root, 'specs/002-y/plan.md'), '# Plan\n');
            await until(() => stream.snapshots.at(-1).specs[0]?.files?.plan === 'plan.md', 'a change inside the recreated folder');
        } finally {
            await close();
        }
    });

    it('finds a spec folder two levels down that did not exist, such as .specify/specs', async () => {
        const { root, stream, close } = await open();
        try {
            addSpec(root, '.specify/specs/003-z');
            await until(() => stream.snapshots.some(s => ids(s).includes('.specify/specs/003-z')), 'a snapshot event with the nested spec');
        } finally {
            await close();
        }
    });
});

describe('a stock Spec Kit project, with no Companion writer anywhere', () => {
    const STALE = {
        workflow: 'speckit',
        specName: 'Todo Stars',
        selectedAt: '2026-10-05T14:54:53.999Z',
        currentStep: 'specify',
        status: 'specifying',
        history: [{ step: 'specify', substep: null, kind: 'start', by: 'extension', at: '2026-10-05T14:54:53.999Z' }],
    };
    const SPECIFIED = {
        ...STALE,
        status: 'specified',
        history: [...STALE.history, { step: 'specify', substep: null, kind: 'complete', by: 'extension', at: '2026-10-05T14:56:35.000Z' }],
    };
    const SPEC = 'specs/001-todo-stars';

    async function open({ record = STALE, files = ['spec.md', 'plan.md'], quietMs } = {}) {
        const root = mkdtempSync(join(tmpdir(), 'canvas-stock-run-'));
        for (const step of ['specify', 'plan', 'tasks', 'implement']) {
            mkdirSync(join(root, '.github/skills', `speckit-${step}`), { recursive: true });
            writeFileSync(join(root, '.github/skills', `speckit-${step}`, 'SKILL.md'), `# ${step}\n`);
        }
        mkdirSync(join(root, SPEC), { recursive: true });
        for (const file of files) writeFileSync(join(root, SPEC, file), `# ${file}\n`);
        if (record) writeFileSync(join(root, SPEC, '.spec-context.json'), JSON.stringify(record));
        const sent = [];
        const board = await createSpecServer({ root, checkoutWriter: null, quietMs, send: async (prompt) => { sent.push(prompt); return true; } });
        const row = () => board.snapshot.specs.find(s => s.id === SPEC);
        const context = () => JSON.parse(readFileSync(join(root, SPEC, '.spec-context.json'), 'utf8'));
        return { root, board, sent, row, context };
    }

    it('reads a record stuck on specifying as planned when spec.md and plan.md are on disk', async () => {
        const { board, row } = await open();
        try {
            assert.deepEqual(row().steps, { specify: 'completed', plan: 'completed', tasks: 'not-started', implement: 'not-started' });
            assert.equal(row().statusLabel, 'Planned');
            const detail = JSON.parse((await call(board, `/api/spec?id=${SPEC}`, { headers: { 'x-speckit-token': board.token } })).body);
            assert.equal(detail.spec.status, 'planned');
            assert.doesNotMatch(detail.overviewHtml, /is-in-flight/);
        } finally {
            await board.close();
        }
    });

    it('sends the dashed command the project registers and nothing else: no fallback line, no instruction file', async () => {
        const { root, board, sent } = await open();
        try {
            const result = await board.run(SPEC, 'tasks');
            assert.equal(sent.at(-1), '/speckit-tasks specs/001-todo-stars');
            assert.equal(result.instructionsFile, null);
            assert.ok(!existsSync(join(root, '.speckit-companion')), 'nothing written for the run');
            const detail = JSON.parse((await call(board, `/api/spec?id=${SPEC}`, { headers: { 'x-speckit-token': board.token } })).body);
            assert.equal(detail.commandHint, '/speckit-<step>');
        } finally {
            await board.close();
        }
    });

    it('never mentions write-context.py to the agent, for a step or for a new spec', async () => {
        const { root, board, sent } = await open();
        try {
            for (const step of ['plan', 'tasks', 'implement']) await board.run(SPEC, step);
            const created = await board.specify('Star a todo', 'speckit');
            assert.equal(created.instructionsFile, null);
            assert.ok(sent.at(-1).startsWith('/speckit-specify Star a todo'));
            for (const prompt of sent) assert.doesNotMatch(prompt, /write-context|spec-context|run instructions/);
            assert.ok(!existsSync(join(root, '.speckit-companion')));
        } finally {
            await board.close();
        }
    });

    it('shows a step it sent as running, then records it once the turn settles with the document on disk', async () => {
        const { root, board, row, context } = await open({ record: SPECIFIED });
        try {
            assert.equal(row().statusLabel, 'Planned', 'plan.md is there though the record never heard of a plan');
            await board.run(SPEC, 'tasks');
            assert.equal(row().steps.tasks, 'in-progress');
            assert.equal(row().statusLabel, 'Tasking');
            assert.equal(board.detail(SPEC).spec.steps.tasks, 'in-progress');
            writeFileSync(join(root, SPEC, 'tasks.md'), '- [ ] T001 One\n');
            board.rescan();
            assert.equal(row().steps.tasks, 'in-progress', 'still running until the turn ends');
            board.settle(new Date(Date.now() + 90000));
            assert.equal(row().steps.tasks, 'completed');
            assert.equal(row().statusLabel, 'Ready to Implement');
            const record = context();
            assert.equal(record.status, 'ready-to-implement');
            assert.equal(record.currentStep, 'tasks');
            assert.deepEqual(record.history.slice(-2).map(e => [e.step, e.kind, e.by]), [['tasks', 'start', 'extension'], ['tasks', 'complete', 'extension']]);
            assert.deepEqual(record.history.slice(0, 2), SPECIFIED.history, 'history is appended to');
            const { timing } = board.detail(SPEC);
            assert.equal(timing.tasks.durationTrusted, true);
            assert.equal(timing.plan, undefined, 'plan ran outside the board, so it has no time');
        } finally {
            await board.close();
        }
    });

    it('stops showing a step as running, and records nothing, when the turn settles without the document', async () => {
        const { board, row, context } = await open();
        try {
            await board.run(SPEC, 'tasks');
            board.settle();
            assert.equal(row().steps.tasks, 'not-started');
            assert.equal(row().statusLabel, 'Planned');
            assert.deepEqual(context(), STALE);
        } finally {
            await board.close();
        }
    });

    it('stops waiting for the turn once the step\'s document has sat unchanged, without recording a time', async () => {
        const { root, board, row, context } = await open({ quietMs: 40 });
        try {
            await board.run(SPEC, 'tasks');
            writeFileSync(join(root, SPEC, 'tasks.md'), '- [ ] T001 One\n');
            board.rescan();
            assert.equal(row().steps.tasks, 'in-progress');
            await new Promise(r => setTimeout(r, 80));
            board.rescan();
            assert.equal(row().steps.tasks, 'completed');
            assert.deepEqual(context(), STALE);
        } finally {
            await board.close();
        }
    });

    it('follows a new spec from the send to its folder, and starts its record when the turn settles', async () => {
        const { root, board } = await open();
        try {
            await board.specify('Count the stars', 'speckit');
            const created = 'specs/002-star-count';
            mkdirSync(join(root, created));
            writeFileSync(join(root, created, 'spec.md'), '# Feature Specification: Star Count\n');
            board.rescan();
            const row = () => board.snapshot.specs.find(s => s.id === created);
            assert.equal(row().steps.specify, 'in-progress');
            assert.equal(row().statusLabel, 'Specifying');
            board.settle(new Date(Date.now() + 60000));
            assert.equal(row().steps.specify, 'completed');
            const record = JSON.parse(readFileSync(join(root, created, '.spec-context.json'), 'utf8'));
            assert.equal(record.workflow, 'speckit');
            assert.equal(record.specName, 'Star Count');
            assert.equal(record.status, 'specified');
            assert.deepEqual(record.history.map(e => e.kind), ['start', 'complete']);
        } finally {
            await board.close();
        }
    });

    it('records nothing for a step nobody sent from the board: the files alone say where the spec stands', async () => {
        const { root, board, row } = await open({ record: null });
        try {
            board.settle();
            assert.equal(row().hasContext, false);
            assert.deepEqual(row().steps, { specify: 'completed', plan: 'completed', tasks: 'not-started', implement: 'not-started' });
            assert.ok(!existsSync(join(root, SPEC, '.spec-context.json')));
        } finally {
            await board.close();
        }
    });

    it('leaves a record that stopped mid-step alone, so that step is not handed a time nobody measured', async () => {
        const { root, board, row, context } = await open();
        try {
            await board.run(SPEC, 'tasks');
            writeFileSync(join(root, SPEC, 'tasks.md'), '- [ ] T001 One\n');
            board.settle(new Date(Date.now() + 90000));
            assert.equal(row().statusLabel, 'Ready to Implement');
            assert.deepEqual(context(), STALE);
            const detail = JSON.parse((await call(board, `/api/spec?id=${SPEC}`, { headers: { 'x-speckit-token': board.token } })).body);
            assert.match(detail.overviewHtml, /Timing coverage: 0 of 4 phases/);
            assert.match(detail.overviewHtml, /No step has a time\. The board times a step it sends, from the send to the end of that chat turn\./);
            assert.doesNotMatch(detail.overviewHtml, /dossier-timing__duration|is-in-flight/);
        } finally {
            await board.close();
        }
    });

    it('says on the Overview what a board-kept time measures', async () => {
        const { root, board } = await open({ record: SPECIFIED });
        try {
            await board.run(SPEC, 'tasks');
            writeFileSync(join(root, SPEC, 'tasks.md'), '- [ ] T001 One\n');
            board.settle(new Date(Date.now() + 90000));
            const detail = JSON.parse((await call(board, `/api/spec?id=${SPEC}`, { headers: { 'x-speckit-token': board.token } })).body);
            assert.match(detail.overviewHtml, /Timed by the board: from the moment it sent a step to the end of that chat turn\. A step run any other way has no time\./);
            assert.match(detail.overviewHtml, /Timing coverage: 2 of 4 phases/);
            assert.match(detail.overviewHtml, /Specify<\/span><span class="dossier-timing__duration">1m 41s/);
        } finally {
            await board.close();
        }
    });
});

describe('a project where the agent keeps the record', () => {
    it('leaves the record to the agent: a settle writes nothing', async () => {
        const root = mkdtempSync(join(tmpdir(), 'canvas-live-'));
        mkdirSync(join(root, 'specs/001-x'), { recursive: true });
        mkdirSync(join(root, '.specify/extensions/companion/scripts'), { recursive: true });
        writeFileSync(join(root, '.specify/extensions/companion/scripts/write-context.py'), '');
        writeFileSync(join(root, 'specs/001-x/spec.md'), '# X\n');
        const record = { workflow: 'speckit', specName: 'X', currentStep: 'specify', status: 'specified', history: [] };
        writeFileSync(join(root, 'specs/001-x/.spec-context.json'), JSON.stringify(record));
        const board = await createSpecServer({ root, send: async () => true });
        try {
            const result = await board.run('specs/001-x', 'plan');
            assert.match(readFileSync(join(root, result.instructionsFile), 'utf8'), /python3 "\.specify\/extensions\/companion\/scripts\/write-context\.py"/);
            assert.equal(board.snapshot.specs[0].steps.plan, 'in-progress');
            writeFileSync(join(root, 'specs/001-x/plan.md'), '# Plan\n');
            board.settle();
            assert.deepEqual(JSON.parse(readFileSync(join(root, 'specs/001-x/.spec-context.json'), 'utf8')), record);
            assert.equal(board.snapshot.specs[0].steps.plan, 'completed', 'plan.md is there and the record never heard of a plan');
        } finally {
            await board.close();
        }
    });
});
