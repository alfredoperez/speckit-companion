// Usage: node checks.mjs <workspace-dir> <results-dir>. Run through canvas-checks.sh, which validates both first.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BOARD, Blocked, REPO, changedSince, git, openSession, sleep, transcript, waitForBoard, waitSettled } from './session.mjs';

const [WS, OUT] = process.argv.slice(2).map((p) => resolve(p));
const TRANSCRIPTS = join(OUT, 'canvas-transcripts');
mkdirSync(TRANSCRIPTS, { recursive: true });
const BASE = git(WS, 'rev-parse', 'HEAD');
const models = new Set();

const save = (name, data) => writeFileSync(join(TRANSCRIPTS, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
const specDirs = () => new Set(readdirSync(join(WS, 'specs')));
const outsideSpecs = (paths) => paths.filter((p) => !/^(specs|\.specify)\//.test(p));
const readContext = (id) => { const p = join(WS, 'specs', id, '.spec-context.json'); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; };

/** One session: open it, wait for the board, run `body`, always close it and keep its transcript. */
async function inSession(name, body) {
    const s = await openSession(WS);
    try {
        await waitForBoard(s.session);
        return await body(s);
    } finally {
        await s.close();
        s.log.models.forEach((m) => models.add(m));
        save(name, transcript(s.log));
    }
}

async function openBoardInstance(session, instanceId) {
    const opened = await session.rpc.canvas.open({ canvasId: BOARD, instanceId, input: {} });
    const url = new URL(opened.url);
    return { url, headers: { 'x-speckit-token': url.searchParams.get('token'), 'content-type': 'application/json' } };
}

const OPEN_PROMPT = 'Open the SpecKit Companion canvas';

async function bareOpens() {
    const rows = [];
    for (let i = 1; i <= 3; i++) {
        rows.push(await inSession(`1-bare-open-${i}`, async ({ session, log }) => {
            const since = Date.now();
            await session.send({ prompt: OPEN_PROMPT });
            await waitSettled(log, { since, settleMs: 3000, label: `bare open ${i}` });
            const status = git(WS, 'status', '--short');
            const opened = log.tools.some((t) => t.name === 'open_canvas' && t.canvasId === BOARD);
            const exact = log.users.length === 1 && log.users[0] === OPEN_PROMPT;
            const problems = [!exact && `sent ${log.users.length} message(s), first ${JSON.stringify((log.users[0] ?? '').slice(0, 60))}`, !opened && 'board never opened', status && `workspace dirty: ${status.split('\n').join(', ')}`].filter(Boolean);
            return { ok: !problems.length, note: problems.length ? `session ${i}: ${problems.join('; ')}` : `session ${i}: opened, ${log.tools.length} tool call(s)` };
        }));
    }
    return { result: rows.every((r) => r.ok) ? 'PASS' : 'FAIL', evidence: rows.map((r) => r.note).join(' | ') };
}

/** POST /api/specify for one workflow and wait for the agent to finish. Returns the sent message and the new spec folders. */
async function newSpec(name, workflow, description) {
    return inSession(name, async ({ session, log }) => {
        const { url, headers } = await openBoardInstance(session, `${name}-board`);
        const before = specDirs();
        await sleep(3000);
        const since = Date.now();
        const res = await fetch(new URL('/api/specify', url), { method: 'POST', headers, body: JSON.stringify({ description, workflow }) });
        const posted = await res.json();
        if (!res.ok) throw new Error(`/api/specify ${res.status}: ${JSON.stringify(posted).slice(0, 200)}`);
        await waitSettled(log, { since, label: `${workflow} specify` });
        const created = [...specDirs()].filter((d) => !before.has(d));
        return { posted, sent: log.users[0] ?? '', created, seconds: Math.round((Date.now() - since) / 1000) };
    });
}

async function stockSpecify() {
    const run = await newSpec('2-specify-speckit', 'speckit', 'Add a Clear completed button.');
    const stray = outsideSpecs(changedSince(WS, BASE));
    const ctx = run.created.length === 1 ? readContext(run.created[0]) : null;
    const problems = [
        !run.sent.startsWith('/speckit.specify ') && `message starts ${JSON.stringify(run.sent.slice(0, 40))}`,
        !(run.sent.includes('--advance --by ai') && run.sent.includes('closing specify is YOUR job')) && 'stock lifecycle close missing from the message',
        stray.length && `implemented outside specs/: ${stray.join(', ')}`,
        run.created.length !== 1 && `${run.created.length} new spec folders`,
    ].filter(Boolean);
    const detail = `${run.created.join(',') || 'no spec'} workflow=${ctx?.workflow} status=${ctx?.status}, ${run.seconds}s`;
    return { result: problems.length ? 'FAIL' : 'PASS', evidence: problems.length ? `${problems.join('; ')} (${detail})` : `sent /speckit.specify with the stock close; no files outside specs/; ${detail}` };
}

function checkCapture(specId) {
    const local = join(WS, '.specify/extensions/companion/scripts/check_capture.py');
    const script = existsSync(local) ? local : join(REPO, 'apps/speckit-extension/scripts/check_capture.py');
    const run = spawnSync('python3', [script, '--strict', join('specs', specId)], { cwd: WS, encoding: 'utf8' });
    writeFileSync(join(TRANSCRIPTS, '3-check-capture.txt'), `${script}\n\n${run.stdout}${run.stderr}`);
    const fails = (run.stdout.match(/^.*FAIL.*$/gm) ?? []).slice(0, 3).join(' / ');
    return { ok: run.status === 0, note: run.status === 0 ? 'check_capture --strict passed' : `check_capture exit ${run.status}: ${fails}` };
}

async function companionSpecify() {
    const run = await newSpec('3-specify-companion', 'companion', 'Show how many todos are left in the list footer.');
    const ctx = run.created.length === 1 ? readContext(run.created[0]) : null;
    const capture = ctx ? checkCapture(run.created[0]) : { ok: false, note: 'no .spec-context.json' };
    const stray = outsideSpecs(changedSince(WS, BASE));
    const problems = [
        !run.sent.startsWith('/speckit.companion.specify ') && `message starts ${JSON.stringify(run.sent.slice(0, 40))}`,
        run.created.length !== 1 && `${run.created.length} new spec folders`,
        ctx && ctx.workflow !== 'companion' && `recorded workflow ${ctx.workflow}`,
        !capture.ok && capture.note,
    ].filter(Boolean);
    const detail = `${run.created.join(',') || 'no spec'} status=${ctx?.status}, ${run.seconds}s${stray.length ? `, files outside specs/: ${stray.join(', ')}` : ''}`;
    return { result: problems.length ? 'FAIL' : 'PASS', evidence: problems.length ? `${problems.join('; ')} (${detail})` : `sent /speckit.companion.specify; ${capture.note}; ${detail}` };
}

async function stockCommandSet() {
    const id = '_01_demo-planned';
    const file = join(WS, 'specs', id, '.spec-context.json');
    if (!existsSync(file)) throw new Blocked(`specs/${id} missing from the workspace`);
    const original = readFileSync(file, 'utf8');
    return inSession('4-spec-commandset', async ({ session }) => {
        const { url, headers } = await openBoardInstance(session, 'commandset-board');
        const workspaceSet = (await (await fetch(new URL('/api/snapshot', url), { headers })).json()).commandSet;
        const commandSetAs = async (workflow) => {
            writeFileSync(file, JSON.stringify({ ...JSON.parse(original), workflow }, null, 2) + '\n');
            await fetch(new URL('/api/refresh', url), { method: 'POST', headers, body: '{}' });
            return (await (await fetch(new URL(`/api/spec?id=${encodeURIComponent(`specs/${id}`)}`, url), { headers })).json()).commandSet;
        };
        try {
            const stock = await commandSetAs('speckit');
            const companion = await commandSetAs('companion');
            const ok = stock === 'speckit' && companion === workspaceSet;
            return { result: ok ? 'PASS' : 'FAIL', evidence: `workspace=${workspaceSet}; spec recorded speckit → ${stock}; recorded companion → ${companion}` };
        } finally {
            writeFileSync(file, original);
        }
    });
}

const CHECKS = [
    ['bare-open-x3', 'three new sessions send only "Open the SpecKit Companion canvas"; the board opens; workspace stays clean', bareOpens],
    ['new-spec-speckit', 'New spec (Spec Kit) sends /speckit.specify with the stock close; the agent does not implement', stockSpecify],
    ['new-spec-companion', 'New spec (Companion) sends /speckit.companion.specify; check_capture passes', companionSpecify],
    ['stock-commandset', 'GET /api/spec returns the stock commandSet for a spec recorded as speckit', stockCommandSet],
];

const checks = [];
for (const [id, what, run] of CHECKS) {
    let row;
    try {
        row = await run();
    } catch (error) {
        row = { result: error instanceof Blocked ? 'BLOCKED' : 'FAIL', evidence: error.message };
    }
    checks.push({ id, what, ...row });
    console.log(`${row.result} ${id}: ${row.evidence}`);
    writeFileSync(join(OUT, 'canvas-checks.json'), JSON.stringify({ workspace: WS, baseCommit: BASE, model: [...models].join(', ') || null, checks }, null, 2) + '\n');
}
console.log(`model: ${[...models].join(', ') || 'unknown'}`);
process.exit(checks.every((c) => c.result === 'PASS') ? 0 : 1);
