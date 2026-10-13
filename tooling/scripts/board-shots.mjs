// Takes the Copilot app board's pictures into the shots library: light theme, twice the pixel density, headless.
// usage: node tooling/scripts/board-shots.mjs [--out <dir>] [--record <dir>]
// --record also films the recording below, saving its frames and one JSON of facts under <dir>/<name>/.
import { mkdtempSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createSpecServer } from '../../apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/server.mjs';
import { RUN_FOLDER, RUN_STATES, tickTask, writeTeamboardRecord, writeTeamboardRun } from './lib/teamboard-run.mjs';
import { FPS, HOLD_SECONDS, READ_SECONDS, SCROLL_PX_PER_FRAME, recordDir, startRecording } from './lib/recording.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const at = process.argv.indexOf('--out');
const OUT = resolve(REPO, at > -1 ? process.argv[at + 1] : '.shots');
mkdirSync(OUT, { recursive: true });
const RECORD = recordDir();
if (RECORD) mkdirSync(RECORD, { recursive: true });
const TEAMBOARD = join(REPO, 'apps/vscode/webview/src/spec-viewer/__fixtures__/teamboard/041-profile-photo-upload');
const root = join(mkdtempSync(join(tmpdir(), 'canvas-page-')), 'teamboard'); mkdirSync(root);
mkdirSync(join(root, 'specs'));
for (const demo of ['_00_demo-specified', '_01_demo-planned', '_02_demo-tasked', '_03_demo-living']) cpSync(join(REPO, 'specs', demo), join(root, 'specs', demo), { recursive: true });
const rich = join(root, 'specs', '041-profile-photo-upload');
mkdirSync(join(rich, 'checklists'), { recursive: true });
for (const name of ['spec.md', 'plan.md', 'tasks.md', 'research.md', 'data-model.md']) cpSync(join(TEAMBOARD, name), join(rich, name));
cpSync(join(TEAMBOARD, 'spec-context.completed.json'), join(rich, '.spec-context.json'));
for (const id of ['T001', 'T002', 'T003', 'T004', 'T005', 'T006']) tickTask(join(rich, 'tasks.md'), id);
mkdirSync(join(root, '.specify/extensions/companion'), { recursive: true });
const board = await createSpecServer({ root, send: async () => true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const opts = { viewport: { width: 1180, height: 760 }, deviceScaleFactor: 2, colorScheme: 'light' };
const page = await browser.newPage(opts);
await page.goto(board.url);
await page.waitForSelector('.spec-card');
await page.waitForFunction(() => document.body.classList.contains('vscode-light'));
const shot = (p, name, clip) => p.screenshot({ path: join(OUT, name + '.png'), ...(clip ? { clip } : {}) });
const toastShown = (p) => p.waitForFunction(() => getComputedStyle(document.getElementById('toast')).opacity === '1');
await page.click('[data-filter="all"]');
await page.click('.spec-card[data-id="specs/_02_demo-tasked"]');
await page.waitForSelector('.next');
await shot(page, 'board', {x:0,y:0,width:1180,height:664});
await page.click('.spec-card[data-id="specs/041-profile-photo-upload"]');
await page.waitForSelector('.next-title:has-text("finished")');
await page.waitForSelector('.dossier-timing__duration');
await shot(page, 'board-completed-overview');
// The board in a panel dragged narrow: one pane at a time, the list and then the spec.
const narrow = await browser.newPage({ ...opts, viewport: { width: 420, height: 760 } });
await narrow.goto(board.url);
await narrow.waitForSelector('.spec-card');
await narrow.click('[data-filter="all"]');
await shot(narrow, 'board-narrow');
await narrow.click('.spec-card[data-id="specs/041-profile-photo-upload"]');
await narrow.waitForSelector('.next-title:has-text("finished")');
await narrow.waitForSelector('.dossier-timing__duration');
await shot(narrow, 'board-narrow-detail');
await narrow.close();
await page.click('.spec-card[data-id="specs/_01_demo-planned"]');
await page.waitForSelector('.next-title:has-text("Next: Tasks")');
await shot(page, 'board-next-step', {x:360,y:57,width:820,height:400});
await page.click('.next .btn-primary');
await page.waitForSelector('.toast.is-visible');
await page.waitForSelector('.next .btn-primary:not(:disabled)');
await toastShown(page);
await shot(page, 'board-sent');
await page.click('#toast-actions button:has-text("Show prompt")');
await page.waitForTimeout(400);
await shot(page, 'board-sent-prompt', {x:300,y:240,width:880,height:520});
await page.click('#toast-actions [aria-label="Dismiss"]');
await page.click('#new-spec-toggle');
await page.fill('#new-spec-text', 'Show a footer count');
await page.waitForTimeout(300);
await shot(page, 'board-new-spec');

// One spec walked through a run, a step at a time: each state is the picture for that step in the docs.
const walkRoot = join(mkdtempSync(join(tmpdir(), 'canvas-page-walk-')), 'teamboard');
mkdirSync(join(walkRoot, '.specify/extensions/companion'), { recursive: true });
for (const demo of ['_02_demo-tasked', '_03_demo-living']) cpSync(join(REPO, 'specs', demo), join(walkRoot, 'specs', demo), { recursive: true });
writeTeamboardRun(REPO, join(walkRoot, 'specs', RUN_FOLDER), RUN_STATES[0]);
const walk = await createSpecServer({ root: walkRoot, send: async () => true });
const wp = await browser.newPage(opts);
for (const state of RUN_STATES) {
    writeTeamboardRun(REPO, join(walkRoot, 'specs', RUN_FOLDER), state);
    await wp.goto(walk.url);
    await wp.waitForSelector('.spec-card');
    await wp.waitForFunction(() => document.body.classList.contains('vscode-light'));
    await wp.click('[data-filter="all"]');
    await wp.click(`.spec-card[data-id="specs/${RUN_FOLDER}"]`);
    await wp.waitForSelector('.next');
    if (state === 'planned') await wp.click('.tab:has-text("Plan")');
    if (state === 'tasked' || state === 'implementing') await wp.click('.tab:has-text("Tasks")');
    await wp.waitForTimeout(400);
    await shot(wp, `board-walk-${state}`);
}
await walk.close();

const stockRoot = join(mkdtempSync(join(tmpdir(), 'canvas-page-stock-')), 'todo-app');
mkdirSync(join(stockRoot, 'specs'), { recursive: true });
cpSync(join(REPO, 'specs', '_01_demo-planned'), join(stockRoot, 'specs', '_01_demo-planned'), { recursive: true });
const stock = await createSpecServer({ root: stockRoot, send: async () => true });
const sp = await browser.newPage(opts);
await sp.goto(stock.url);
await sp.waitForSelector('.next');
await sp.waitForFunction(() => document.body.classList.contains('vscode-light'));
await shot(sp, 'board-stock');
await sp.locator('.next .install-hint .btn-link').click();
await sp.waitForTimeout(300);
await shot(sp, 'board-install-hint', {x:360,y:57,width:820,height:470});
await sp.click('#new-spec-toggle');
await sp.waitForTimeout(300);
await shot(sp, 'board-stock-new-spec');
// The note hides itself after four seconds, so on a slow machine it may already be gone.
const dismissToast = page => page.click('.toast.is-visible [aria-label="Dismiss"]', { timeout: 500 }).catch(() => {});

if (RECORD) {
    const rp = await browser.newPage(opts);
    await rp.goto(board.url);
    await rp.waitForSelector('.spec-card');
    await rp.waitForFunction(() => document.body.classList.contains('vscode-light'));
    await rp.click('[data-filter="all"]');
    await rp.click(`.spec-card[data-id="specs/${RUN_FOLDER}"]`);
    await rp.waitForSelector('.next');
    await rp.click('.tab:has-text("Tasks")');
    await rp.waitForTimeout(600);
    const recording = startRecording(RECORD, 'board-tasks-read', {
        surface: 'The GitHub Copilot app board on a headless Chrome page, light theme',
        what: 'The task list of a run on the Copilot board, scrolled slowly from the first phase to the last. Under every task is the line the assistant wrote when it finished it and the files that task touched, so the whole of what the run did reads as one list without leaving the board.',
        grab: file => rp.screenshot({ path: file }),
    });
    await recording.hold();
    for (let frames = 0; frames < 900; frames++) {
        const left = await rp.$eval('#detail', (detail, by) => {
            detail.scrollBy({ top: by, behavior: 'instant' });
            return Math.round(detail.scrollHeight - detail.clientHeight - detail.scrollTop);
        }, SCROLL_PX_PER_FRAME);
        await recording.frame();
        if (left <= 0) break;
    }
    await recording.hold();
    await recording.close();

    // A run advancing a step at a time: the step is sent from the board's own button, and the rest is the fixture's files changing under the server.
    const liveRoot = join(mkdtempSync(join(tmpdir(), 'canvas-page-run-')), 'teamboard');
    mkdirSync(join(liveRoot, '.specify/extensions/companion'), { recursive: true });
    cpSync(join(REPO, 'specs', '_03_demo-living'), join(liveRoot, 'specs', '_03_demo-living'), { recursive: true });
    const liveFolder = join(liveRoot, 'specs', RUN_FOLDER);
    writeTeamboardRun(REPO, liveFolder, 'tasked');
    const live = await createSpecServer({ root: liveRoot, send: async () => true });
    const lp = await browser.newPage(opts);
    await lp.goto(live.url);
    await lp.waitForSelector('.spec-card');
    await lp.waitForFunction(() => document.body.classList.contains('vscode-light'));
    await lp.click('[data-filter="all"]');
    await lp.click(`.spec-card[data-id="specs/${RUN_FOLDER}"]`);
    await lp.waitForSelector('.next-title:has-text("Next: Implement")');
    await lp.click('.tab:has-text("Tasks")');
    await lp.waitForFunction(() => document.querySelector('.panel')?.textContent.includes('T006'));
    const film = startRecording(RECORD, 'board-run-steps', {
        surface: 'The GitHub Copilot app board on a headless Chrome page, light theme',
        what: 'A run on the Copilot board moving through its steps. The rail reads Specify, Plan and Tasks done with Implement not started, the Implement button is pressed, and a note at the foot says the implement command went to the chat. Implement turns to Running on the rail, the tasks tick off one at a time with the count beside the Tasks tab climbing to six of six, and the rail reaches Implement done on its own, each finished task now carrying the line the assistant wrote and the files it touched.',
        grab: file => lp.screenshot({ path: file }),
    });
    await film.hold(READ_SECONDS);
    await lp.click('.next .btn-primary');
    await lp.waitForSelector('.toast.is-visible');
    await film.hold(READ_SECONDS);
    await dismissToast(lp);
    await film.hold();
    const tasksFile = join(liveFolder, 'tasks.md');
    // The first phase is in frame, so those ticks get a beat long enough to read; the second phase is below the fold, where only the counts move.
    const inFrame = ['T001', 'T002', 'T003', 'T004'];
    for (const id of [...inFrame, 'T005', 'T006']) {
        tickTask(tasksFile, id);
        await film.hold(inFrame.includes(id) ? READ_SECONDS : HOLD_SECONDS);
    }
    // The recorder closes the step and the chat turn ends, which is what takes the board off running.
    writeTeamboardRecord(REPO, liveFolder, 'completed');
    live.settle();
    await lp.waitForSelector('.next-title:has-text("finished")');
    await film.hold(READ_SECONDS);
    await film.close();
    await lp.close();
    await live.close();

    // One spec's whole journey: the list, one spec opened at Specify, then Plan, Tasks and Implement each sent from the board and finishing under it.
    const journeyRoot = join(mkdtempSync(join(tmpdir(), 'canvas-page-journey-')), 'teamboard');
    mkdirSync(join(journeyRoot, '.specify/extensions/companion'), { recursive: true });
    for (const demo of ['_01_demo-planned', '_02_demo-tasked', '_03_demo-living']) cpSync(join(REPO, 'specs', demo), join(journeyRoot, 'specs', demo), { recursive: true });
    const journeyFolder = join(journeyRoot, 'specs', RUN_FOLDER);
    const journeySource = join(REPO, 'apps/vscode/webview/src/spec-viewer/__fixtures__/teamboard', RUN_FOLDER);
    writeTeamboardRun(REPO, journeyFolder, 'specified');
    const journey = await createSpecServer({ root: journeyRoot, send: async () => true });
    // A shorter window than the pictures use, so the frame is close to a video's shape and still holds the first phase of tasks.
    const jp = await browser.newPage({ ...opts, viewport: { width: 1180, height: 720 } });
    await jp.goto(journey.url);
    await jp.waitForSelector('.spec-card');
    await jp.waitForFunction(() => document.body.classList.contains('vscode-light'));
    await jp.click('[data-filter="all"]');
    // It opens on a finished spec, so picking the one still at Specify is a change the viewer can see.
    await jp.click('.spec-card[data-id="specs/_03_demo-living"]');
    await jp.waitForSelector('.next');
    await jp.waitForTimeout(400);
    const events = [];
    const trip = startRecording(RECORD, 'board-spec-journey', {
        surface: 'The GitHub Copilot app board on a headless Chrome page, light theme',
        what: 'The specs of a project listed on the Copilot board. One of them, still at Specify, is opened and its spec read a little, then Plan, Tasks and Implement are each sent from the board and each finishes: the rail fills a step at a time, the Plan and Tasks documents appear as their steps end, the six tasks tick off with the count beside the Tasks tab, and the rail ends with every step done.',
        grab: file => jp.screenshot({ path: file }),
    });
    const mark = name => events.push({ name, frame: trip.frames, at: Number((trip.frames / FPS).toFixed(3)) });
    // The step's own button, then the toast that says it went to the chat, read and dismissed.
    const sendStep = async name => {
        mark(`${name} sent`);
        await jp.click('.next .btn-primary');
        await jp.waitForSelector('.toast.is-visible');
        await trip.hold(1);
        await dismissToast(jp);
        await trip.hold(0.5);
    };
    // The step ends: its files arrive and the run record moves on, which is what the chat would have left behind.
    const finishStep = async (state, files, nextTitle) => {
        for (const file of files) cpSync(join(journeySource, file), join(journeyFolder, file));
        writeTeamboardRecord(REPO, journeyFolder, state);
        journey.settle();
        await jp.waitForSelector(`.next-title:has-text("${nextTitle}")`);
        mark(state);
    };
    const scrollDetail = async (frames, direction) => {
        for (let frame = 0; frame < frames; frame++) {
            await jp.$eval('#detail', (detail, by) => detail.scrollBy({ top: by, behavior: 'instant' }), SCROLL_PX_PER_FRAME * direction);
            await trip.frame();
        }
    };
    mark('list');
    await trip.hold(1.5);
    mark('open');
    await jp.click(`.spec-card[data-id="specs/${RUN_FOLDER}"]`);
    await jp.waitForSelector('.next-title:has-text("Next: Plan")');
    await trip.hold(1.5);
    mark('scroll down');
    await scrollDetail(12, 1);
    await trip.hold(0.5);
    mark('scroll up');
    await scrollDetail(12, -1);
    await trip.hold(0.5);
    await sendStep('plan');
    await finishStep('planned', ['plan.md', 'research.md', 'data-model.md'], 'Next: Tasks');
    await trip.hold(1);
    mark('plan tab');
    await jp.click('.tab:has-text("Plan")');
    await trip.hold(1.5);
    await sendStep('tasks');
    await finishStep('tasked', ['tasks.md'], 'Next: Implement');
    await trip.hold(1);
    mark('tasks tab');
    await jp.click('.tab:has-text("Tasks")');
    await jp.waitForFunction(() => document.querySelector('.panel')?.textContent.includes('T006'));
    await trip.hold(1.5);
    await sendStep('implement');
    const journeyTasks = join(journeyFolder, 'tasks.md');
    for (const id of ['T001', 'T002', 'T003', 'T004', 'T005', 'T006']) {
        tickTask(journeyTasks, id);
        mark(`${id} done`);
        await trip.hold(0.75);
    }
    writeTeamboardRecord(REPO, journeyFolder, 'completed');
    journey.settle();
    await jp.waitForSelector('.next-title:has-text("finished")');
    mark('completed');
    await trip.hold(2);
    const facts = await trip.close();
    writeFileSync(join(RECORD, facts.name, 'events.json'), `${JSON.stringify(events, null, 2)}\n`);
    await jp.close();
    await journey.close();
}

await browser.close(); await board.close(); await stock.close();
console.log(`Board pictures written to ${OUT}`);
process.exit(0);
