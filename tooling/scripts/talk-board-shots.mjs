// The Copilot app board's pictures for the talk, on a copy of the Conduit talk sandbox: light theme, twice the pixel density, headless.
// usage: node tooling/scripts/talk-board-shots.mjs <talk sandbox> [--out <dir>]
// The sandbox is copied first, so walking the Article Draft Autosave run never touches it.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createSpecServer } from '../../apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/server.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SANDBOX = process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : undefined;
if (!SANDBOX || !existsSync(join(SANDBOX, '.talk', 'state.mjs'))) {
    console.error('usage: node tooling/scripts/talk-board-shots.mjs <talk sandbox with .talk/state.mjs> [--out <dir>]');
    process.exit(2);
}
const at = process.argv.indexOf('--out');
const OUT = resolve(REPO, at > -1 ? process.argv[at + 1] : '.shots');
mkdirSync(OUT, { recursive: true });

const root = join(mkdtempSync(join(tmpdir(), 'canvas-talk-')), 'conduit');
cpSync(SANDBOX, root, { recursive: true, filter: (from) => !from.includes(`${SANDBOX}/node_modules`) && !from.includes(`${SANDBOX}/.git/`) });
const state = (name) => execFileSync('node', [join(root, '.talk', 'state.mjs'), name], { stdio: 'pipe' });
const AUTOSAVE = 'specs/003-article-draft-autosave';

const board = await createSpecServer({ root, send: async () => true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 2, colorScheme: 'light' });
const open = async (tab) => {
    await page.goto(board.url);
    await page.waitForSelector('.spec-card');
    await page.waitForFunction(() => document.body.classList.contains('vscode-light'));
    await page.click('[data-filter="all"]');
    await page.click(`.spec-card[data-id="${AUTOSAVE}"]`);
    await page.waitForSelector('.next');
    if (tab) await page.click(`.tab:has-text("${tab}")`);
    await page.waitForTimeout(500);
};
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const written = [];

state('implementing');
await open('Tasks');
await shot('talk-board-implementing');
written.push('talk-board-implementing');

state('planned');
await open('Plan');
await shot('talk-board-planned');
written.push('talk-board-planned');

state('completed');
await open();
await page.waitForSelector('.dossier-timing__duration');
await shot('talk-board-overview');
written.push('talk-board-overview');

await browser.close();
await board.close();
console.log(`${written.length} board pictures in ${OUT}: ${written.join(', ')}`);
