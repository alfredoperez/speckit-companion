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
const specDirs = () => new Set(readdirSync(join(WS, 'specs'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name));
const outsideSpecs = (paths) => paths.filter((p) => !/^(specs|\.specify|\.speckit-companion)\//.test(p));
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

const SKILL_DIRS = ['.github/skills', '.agents/skills', '.claude/skills'];
const RECORDER = '.specify/extensions/companion/scripts/write-context.py';
const COMPANION = existsSync(join(WS, '.specify/extensions/companion'));
const POINTER = /Before you start, read and follow the run instructions in `(\.speckit-companion\/prompts\/[^`]+\.md)`\./g;
const INLINE_LIFECYCLE = ['speckit-companion:context-update', 'write-context.py', '--advance --by ai', 'closing specify is YOUR job', 'SEED WRITE INSTRUCTIONS'];

/** How this sandbox spells a board command, by the board's own rule: dashed when a skill folder registers it, dotted otherwise. */
function boardCommand(step, commandSet) {
    const dotted = commandSet === 'companion' ? `speckit.companion.${step}` : `speckit.${step}`;
    const dashed = dotted.replace(/\./g, '-');
    return SKILL_DIRS.some((dir) => existsSync(join(WS, dir, dashed, 'SKILL.md'))) ? dashed : dotted;
}

/** POST /api/specify for one workflow and wait for the agent to finish. Returns the sent message, the new spec folders and what the agent touched. */
async function newSpec(name, workflow, description) {
    return inSession(name, async ({ session, log }) => {
        const { url, headers } = await openBoardInstance(session, `${name}-board`);
        const before = specDirs();
        const changedBefore = new Set(changedSince(WS, BASE));
        await sleep(3000);
        const since = Date.now();
        const res = await fetch(new URL('/api/specify', url), { method: 'POST', headers, body: JSON.stringify({ description, workflow }) });
        const posted = await res.json();
        if (!res.ok) throw new Error(`/api/specify ${res.status}: ${JSON.stringify(posted).slice(0, 200)}`);
        let stalled = null;
        try {
            await waitSettled(log, { since, label: `${workflow} specify` });
        } catch (error) {
            if (!(error instanceof Blocked) || !log.users.length) throw error;
            stalled = error.message;
        }
        const created = [...specDirs()].filter((d) => !before.has(d));
        const stray = outsideSpecs(changedSince(WS, BASE).filter((p) => !changedBefore.has(p)));
        return { workflow, description, sent: log.users[0] ?? '', messages: log.users.length, created, stray, tools: [...log.tools], stalled, seconds: Math.round((Date.now() - since) / 1000) };
    });
}

const runs = {};
const DESCRIPTIONS = { speckit: 'Add a Clear completed button.', companion: 'Show how many todos are left in the list footer.' };

async function runOnce(workflow) {
    if (workflow === 'companion' && !COMPANION) throw new Blocked('SpecKit Companion is not installed in this sandbox, so the board cannot offer the Companion workflow');
    runs[workflow] ??= newSpec(`${workflow === 'speckit' ? 2 : 3}-specify-${workflow}`, workflow, DESCRIPTIONS[workflow]).catch((error) => ({ error }));
    const run = await runs[workflow];
    if (run.error) throw run.error;
    return run;
}

/** What the board must put in the chat: the command as this sandbox spells it, the description, at most one pointer sentence, no inline lifecycle text. */
function messageShape(run) {
    const command = `/${boardCommand('specify', run.workflow)}`;
    const pointers = [...run.sent.matchAll(POINTER)].map((m) => m[1]);
    const recorder = existsSync(join(WS, RECORDER));
    const wantsPointer = run.workflow === 'companion' ? true : recorder ? true : null;
    const inline = INLINE_LIFECYCLE.filter((text) => run.sent.includes(text));
    const problems = [
        run.messages !== 1 && `${run.messages} chat messages sent, expected 1`,
        !run.sent.startsWith(`${command} ${run.description}`) && `expected the message to start ${JSON.stringify(`${command} …`)}, it starts ${JSON.stringify(run.sent.slice(0, 40))}`,
        wantsPointer === true && pointers.length !== 1 && `expected one run-instructions sentence, found ${pointers.length}`,
        pointers.length > 1 && wantsPointer !== true && `${pointers.length} run-instructions sentences`,
        pointers.some((file) => !existsSync(join(WS, file))) && `the run-instructions file ${pointers.find((file) => !existsSync(join(WS, file)))} was never written`,
        inline.length && `lifecycle text is inline in the message: ${inline.join(', ')}`,
    ].filter(Boolean);
    const pointerNote = pointers.length ? `one pointer to ${pointers[0]}` : wantsPointer === null ? 'the command alone (no recorder in the sandbox)' : 'no pointer';
    return { command, pointers, problems, note: `sent ${command} with ${pointerNote}` };
}

const created = (run) => run.created.join(',') || 'no spec';

async function stockSpecify() {
    const run = await runOnce('speckit');
    const shape = messageShape(run);
    const problems = [...shape.problems, run.created.length !== 1 && `${run.created.length} new spec folders`].filter(Boolean);
    return { result: problems.length ? 'FAIL' : 'PASS', evidence: `${problems.length ? `${problems.join('; ')}; ` : ''}${shape.note}; ${created(run)}, ${run.seconds}s` };
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
    const run = await runOnce('companion');
    const shape = messageShape(run);
    const ctx = run.created.length === 1 ? readContext(run.created[0]) : null;
    const capture = ctx ? checkCapture(run.created[0]) : { ok: false, note: 'no .spec-context.json' };
    const problems = [
        ...shape.problems,
        run.created.length !== 1 && `${run.created.length} new spec folders`,
        ctx && ctx.workflow !== 'companion' && `recorded workflow ${ctx.workflow}`,
        !capture.ok && capture.note,
    ].filter(Boolean);
    return { result: problems.length ? 'FAIL' : 'PASS', evidence: `${problems.length ? `${problems.join('; ')}; ` : ''}${shape.note}; ${capture.note}; ${created(run)}, ${run.seconds}s` };
}

const settled = async (workflow) => { try { return await runOnce(workflow); } catch (error) { return { workflow, error }; } };

/** A product observation, not a message check: after specify the record should carry the step's complete, not only its start. */
async function recordAdvances() {
    const rows = [];
    for (const run of [await settled('speckit'), await settled('companion')]) {
        if (run.error) { rows.push({ state: 'BLOCKED', note: `${run.workflow}: no run (${run.error.message})` }); continue; }
        const { pointers } = messageShape(run);
        if (!pointers.length) { rows.push({ state: 'SKIP', note: `${run.workflow}: no recorder in the sandbox, so no record is expected` }); continue; }
        const id = run.created.length === 1 ? run.created[0] : null;
        const ctx = id ? readContext(id) : null;
        const history = ctx?.history ?? [];
        const closed = history.some((h) => h.step === 'specify' && h.kind === 'complete');
        const trace = id && existsSync(join(WS, 'specs', id, '.trace.jsonl')) ? readFileSync(join(WS, 'specs', id, '.trace.jsonl'), 'utf8').trim().split('\n').length : 0;
        const readInstructions = run.tools.some((t) => t.detail.includes(pointers[0]));
        const recorderCalls = run.tools.filter((t) => t.detail.includes('write-context.py')).length;
        const facts = [
            `${id ?? created(run)} status=${ctx?.status ?? 'no record'}`,
            `${history.length} history entr${history.length === 1 ? 'y' : 'ies'}, specify complete ${closed ? 'recorded' : 'missing'}`,
            `run instructions ${readInstructions ? 'read' : 'never opened'}`,
            `recorder called ${recorderCalls} time(s) by the agent, ${trace} recorder write(s) traced`,
            run.stalled && run.stalled,
        ].filter(Boolean);
        rows.push({ state: closed ? 'PASS' : 'FAIL', note: `${run.workflow}: ${facts.join('; ')}` });
    }
    const states = rows.map((r) => r.state);
    const result = states.includes('FAIL') ? 'FAIL' : states.includes('BLOCKED') || !states.includes('PASS') ? 'BLOCKED' : 'PASS';
    return { result, evidence: rows.map((r) => r.note).join(' | ') };
}

/** The other product observation: specify writes a spec, it does not build the feature. */
async function staysInSpecify() {
    const rows = [];
    for (const run of [await settled('speckit'), await settled('companion')]) {
        if (run.error) rows.push({ state: 'BLOCKED', note: `${run.workflow}: no run (${run.error.message})` });
        else rows.push({ state: run.stray.length ? 'FAIL' : 'PASS', note: `${run.workflow}: ${run.stray.length ? `changed outside specs/: ${run.stray.join(', ')}` : 'nothing changed outside specs/'}` });
    }
    const states = rows.map((r) => r.state);
    return { result: states.includes('FAIL') ? 'FAIL' : states.includes('BLOCKED') ? 'BLOCKED' : 'PASS', evidence: rows.map((r) => r.note).join(' | ') };
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
    ['new-spec-speckit', 'New spec (Spec Kit) sends the stock specify command as this sandbox spells it, with one run-instructions pointer when the recorder exists and no inline lifecycle text', stockSpecify],
    ['new-spec-companion', 'New spec (Companion) sends the Companion specify command as this sandbox spells it, with one run-instructions pointer and no inline lifecycle text; check_capture passes', companionSpecify],
    ['canvas-new-spec-record-advances', 'product observation: after specify the record carries the step\'s complete, for each workflow that has a recorder', recordAdvances],
    ['canvas-new-spec-stays-in-specify', 'product observation: specify changes nothing outside specs/', staysInSpecify],
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
