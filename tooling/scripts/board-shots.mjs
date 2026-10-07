// Takes the Copilot app board's pictures into the shots library: light theme, twice the pixel density, headless.
// usage: node tooling/scripts/board-shots.mjs [--out <dir>] [--record <dir>]
// --record also films the recording below, saving its frames and one JSON of facts under <dir>/<name>/.
import { mkdtempSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createSpecServer } from '../../apps/copilot-canvas/server.mjs';
import { RUN_FOLDER, RUN_STATES, writeTeamboardRun } from './lib/teamboard-run.mjs';
import { SCROLL_PX_PER_FRAME, recordDir, startRecording } from './lib/recording.mjs';

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
}

await browser.close(); await board.close(); await stock.close();
console.log(`Board pictures written to ${OUT}`);
process.exit(0);
