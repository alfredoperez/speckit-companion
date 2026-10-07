#!/usr/bin/env node
// Puts one spec through every state of a Spec Kit run by writing its files, and saves the real Claude Code screen at each state as a cell grid for the video terminal player. No model turn runs.
// usage: node tooling/video/terminal-player/capture-run.mjs [--fixture clear-completed] [--out <dir>] [--cols 120] [--rows 38] [--recipe claude-mod] [--mod <plugin-dir>] [--look claude|site]
import { execFile } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { LOOKS, gridJson, gridText, parseAnsi, rowText } from '../../scripts/lib/terminal/ansi.mjs';
import { dialog, focusedControl, paneHasKeyboard, paneRows, paneText, promptBox } from '../../scripts/lib/terminal/screen.mjs';
import { outsideEnv, sleep, startSession } from '../../scripts/lib/terminal/tmux.mjs';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > -1 ? process.argv[at + 1] : fallback;
};
const FIXTURE = arg('fixture', 'clear-completed');
const RECIPE = arg('recipe', 'claude-mod');
const COLS = Number(arg('cols', 120));
const ROWS = Number(arg('rows', 38));
const OUT = resolve(arg('out', join(REPO, '.terminal-check', `video-${FIXTURE}`)));
const MOD = resolve(arg('mod', join(REPO, 'apps', 'claude-mod')));
const LOOK = arg('look', 'claude');
const SPEC = `001-${FIXTURE}`;
if (!Object.hasOwn(LOOKS, LOOK)) throw new Error(`Unknown --look "${LOOK}". Use ${Object.keys(LOOKS).join(' or ')}.`);
const SHOWN_PATH = '~/dev/todo-app';

const { stdout } = await run('bash', ['-c', '. .claude/sandboxes-env.sh && echo "$SANDBOXES_REPO"'], { cwd: REPO });
const root = mkdtempSync(join(tmpdir(), 'speckit-video-'));
await run(join(stdout.trim().split('\n').at(-1), 'recipes', RECIPE, 'setup.sh'), [join(root, 'project')], { env: outsideEnv(), maxBuffer: 16 << 20 });
const project = realpathSync(join(root, 'project'));
mkdirSync(join(project, '.claude'), { recursive: true });
writeFileSync(join(project, '.claude', 'settings.json'), JSON.stringify({ permissions: { defaultMode: 'acceptEdits' } }));
mkdirSync(join(root, 'bin'));
writeFileSync(join(root, 'bin', 'code'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const session = await startSession({ name: `speckit-video-${process.pid}`, cols: COLS, rows: ROWS, cwd: project, command: ['claude', '--plugin-dir', MOD], env: { VISUAL: join(root, 'bin', 'code'), EDITOR: '' } });
const stop = async () => {
    await session.kill();
    rmSync(root, { recursive: true, force: true });
};
process.on('SIGINT', () => {
    session.killNow();
    process.exit(130);
});

async function look() {
    for (let tries = 0; tries < 20; tries++) {
        const grid = parseAnsi(await session.capture());
        const found = dialog(grid);
        if (!found) return grid;
        if (found.kind !== 'trust') throw new Error(`an unexpected dialog: ${found.asked}`);
        // The dialog can be on screen before it takes keys, so the cursor is moved and seen on Yes before Enter.
        await sleep(1000);
        if (!found.options.find(o => o.selected)?.label.startsWith('Yes')) {
            await session.keys('Down');
            continue;
        }
        await session.keys('Enter');
        await sleep(1200);
    }
    throw new Error('a dialog would not go away');
}

async function waitFor(what, test, timeout = 15000) {
    const until = Date.now() + timeout;
    for (;;) {
        const grid = await look();
        if (test(grid)) return grid;
        if (Date.now() > until) throw new Error(`${what}. The screen read:\n${gridText(grid)}`);
        await sleep(300);
    }
}

/** Hides what belongs to the capture machine and not to the product: the throwaway folder's path and tmux's own hint line. */
function scrub(grid) {
    for (const cells of grid) {
        const text = rowText(cells);
        if (/tmux (detected|focus-events)/.test(text)) {
            const border = cells.filter(c => c.ch === '│');
            cells.splice(0, cells.length, ...border);
            cells.tail = null;
        }
        // Claude Code's own passing notices: the effort level, an update waiting for a restart.
        const notice = text.search(/◐ \w+ · \/effort|✔ Update installed/);
        if (notice >= 0) cells.splice(0, cells.length, ...cells.filter(c => c.col < notice || c.ch === '│'));
        // A narrow terminal shows the folder shortened, so the shown form is matched, not the path itself.
        const hit = text.match(/\/\S*speckit-video-\S+\/project/);
        if (!hit) continue;
        const at = hit.index;
        const first = cells.find(c => c.col === at);
        const kept = cells.filter(c => c.col < at || c.col >= at + hit[0].length);
        cells.splice(0, cells.length, ...kept, ...[...SHOWN_PATH].map((ch, i) => ({ ...first, ch, col: at + i, w: 1 })));
        cells.sort((a, b) => a.col - b.col);
    }
    return grid;
}

const saved = [];
async function save(name, grid) {
    scrub(grid);
    const pane = paneRows(grid);
    const prompt = promptBox(grid);
    const data = gridJson(grid, { look: LOOK, cols: COLS, pane: pane && { col: pane.col, top: pane.top, bottom: pane.bottom } });
    data.prompt = prompt && { row: prompt.row };
    // The band is the last row left of the pane that names the spec.
    data.band = grid.findLastIndex(cells => rowText(cells, 0, pane?.col ?? Infinity).includes(SPEC));
    writeFileSync(join(OUT, `${name}.grid.json`), JSON.stringify(data));
    writeFileSync(join(OUT, `${name}.txt`), gridText(grid) + '\n');
    saved.push(name);
    console.log(`saved ${name}${pane ? ` (pane at column ${pane.col})` : ''}`);
}

const dir = join(project, 'specs', SPEC);
const fixture = join(HERE, 'fixtures', FIXTURE);
const minute = n => new Date(Date.UTC(2026, 9, 5, 15, n)).toISOString();
const STEPS = ['specify', 'plan', 'tasks', 'implement'];
const ENDS = [2, 5, 6, 14];
/** The run record as it stands with `done` steps finished and, if `running`, the next one started. */
function record(done, running, status) {
    const history = [];
    STEPS.forEach((step, i) => {
        if (i < done || (i === done && running)) history.push({ step, substep: null, kind: 'start', from: { step: STEPS[i - 1] ?? null, substep: null }, by: 'extension', at: minute(ENDS[i - 1] ?? 0) });
        if (i < done) history.push({ step, substep: null, kind: 'complete', by: 'ai', at: minute(ENDS[i]) });
    });
    const current = STEPS[Math.min(STEPS.length - 1, running ? done : Math.max(0, done - 1))];
    writeFileSync(join(dir, '.spec-context.json'), JSON.stringify({ workflow: 'speckit', specName: 'Clear completed todos', branch: SPEC, selectedAt: minute(0), currentStep: current, status, history }, null, 2));
}
const pane = grid => paneText(grid);
const state = async (name, write, pattern) => {
    write();
    const grid = await waitFor(`${name}: the pane never showed ${pattern}`, g => pattern.test(pane(g)), 20000);
    await sleep(600);
    await save(name, await look() ?? grid);
};
const tick = (n) => {
    let text = readFileSync(join(fixture, 'tasks.md'), 'utf8');
    for (let i = 1; i <= n; i++) text = text.replace(`- [ ] **T00${i}**`, `- [x] **T00${i}**`);
    writeFileSync(join(dir, 'tasks.md'), text);
};
async function focusOn(label) {
    if (!paneHasKeyboard(await look())) {
        await session.keys('C-x', 'Tab');
        await waitFor('the pane did not take the keyboard', paneHasKeyboard, 5000);
    }
    for (let presses = 0; presses < 40; presses++) {
        if (focusedControl(await look()) === label) return;
        await session.keys('Down');
        await sleep(150);
    }
    throw new Error(`no control named "${label}" took the focus`);
}

try {
    await waitFor('Claude Code did not reach its prompt', grid => promptBox(grid)?.text === '' && /Claude Code v/.test(gridText(grid)), 90000);
    await sleep(1500);
    await save('idle', await look());

    mkdirSync(dir, { recursive: true });
    record(0, true, 'specifying');
    await waitFor('no band for the new spec', grid => gridText(grid).includes(SPEC), 20000);
    if (!paneRows(await waitFor('', () => true))) {
        await sleep(5000);
        if (!paneRows(await look())) {
            console.log(`the pane did not open by itself at ${COLS} columns; opening it with /speckit-tracker`);
            await session.type('/speckit-tracker 001');
            await session.keys('Enter');
            await waitFor('the pane did not open', grid => paneRows(grid) !== null);
            await session.keys('Escape');
        }
    }
    await sleep(1500);
    await save('specifying', await look());

    await state('specified', () => { cpSync(join(fixture, 'spec.md'), join(dir, 'spec.md')); record(1, false, 'specified'); }, /^✓ Specify\b/m);
    await state('planning', () => record(1, true, 'planning'), /^● Plan\b/m);
    await state('planned', () => { cpSync(join(fixture, 'plan.md'), join(dir, 'plan.md')); record(2, false, 'planned'); }, /^✓ Plan\b/m);
    await state('tasking', () => record(2, true, 'creating-tasks'), /^● Tasks\b/m);
    await state('tasked', () => { tick(0); record(3, false, 'ready-to-implement'); }, /\b0\/5$/m);

    await focusOn('Plan');
    await sleep(500);
    await save('focus-plan', await look());
    await session.keys('Enter');
    await waitFor('plan.md did not open in the pane', grid => /b: Back/.test(pane(grid)));
    await sleep(600);
    await save('open-plan', await look());
    await session.keys('o');
    await sleep(800);
    await save('open-plan-editor', await look());
    await session.keys('b');
    await waitFor('the steps did not come back', grid => /^✓ Plan\b/m.test(pane(grid)) && !/b: Back/.test(pane(grid)));
    await session.keys('Escape');
    await waitFor('the pane kept the keyboard', grid => !paneHasKeyboard(grid), 5000);
    await sleep(600);

    await state('implementing', () => record(3, true, 'implementing'), /^● Implement\b/m);
    for (let n = 1; n <= 5; n++) await state(`tick-${n}`, () => tick(n), new RegExp(`\\b${n}/5$`, 'm'));
    await state('done', () => record(4, false, 'completed'), /^✓ Implement\b/m);
    writeFileSync(join(OUT, 'frames.json'), JSON.stringify({ fixture: FIXTURE, recipe: RECIPE, cols: COLS, rows: ROWS, frames: saved }, null, 2));
    console.log(`\n${saved.length} frames in ${OUT}`);
} catch (error) {
    console.error(String(error?.message ?? error));
    process.exitCode = 1;
} finally {
    await stop();
}
