// Drives the board page in headless Chrome (playwright-core, the installed Google Chrome), against a
// throwaway sandbox: what the Copilot app shows minus the app. Skips when Chrome is not available.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSpecServer } from '../server.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const TEAMBOARD = join(REPO, 'apps/vscode/webview/src/spec-viewer/__fixtures__/teamboard/041-profile-photo-upload');
const SHOTS = process.env.CANVAS_SHOTS ? resolve(process.env.CANVAS_SHOTS) : null;

async function launch() {
    let chromium;
    try {
        ({ chromium } = await import('playwright-core'));
    } catch {
        return null;
    }
    for (const options of [{ channel: 'chrome' }, {}]) {
        try {
            return await chromium.launch({ headless: true, ...options });
        } catch { /* try the next option */ }
    }
    return null;
}

describe('board page', { concurrency: false }, async () => {
    let root;
    let board;
    let browser;
    let page;
    const sent = [];

    before(async () => {
        root = mkdtempSync(join(tmpdir(), 'canvas-page-'));
        mkdirSync(join(root, 'specs'));
        for (const demo of ['_00_demo-specified', '_01_demo-planned', '_02_demo-tasked', '_03_demo-living']) {
            cpSync(join(REPO, 'specs', demo), join(root, 'specs', demo), { recursive: true });
        }
        const rich = join(root, 'specs', '041-profile-photo-upload');
        mkdirSync(join(rich, 'checklists'), { recursive: true });
        for (const name of ['spec.md', 'plan.md', 'tasks.md', 'research.md', 'data-model.md']) cpSync(join(TEAMBOARD, name), join(rich, name));
        cpSync(join(TEAMBOARD, 'spec-context.completed.json'), join(rich, '.spec-context.json'));
        mkdirSync(join(root, '.specify/extensions/companion'), { recursive: true });
        board = await createSpecServer({ root, send: async (prompt) => { sent.push(prompt); return true; } });
        browser = await launch();
        if (!browser) return;
        page = await browser.newPage({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
        page.on('pageerror', error => { throw error; });
        await page.goto(board.url);
        await page.waitForSelector('.spec-card');
        if (SHOTS) mkdirSync(SHOTS, { recursive: true });
    });

    after(async () => {
        await browser?.close();
        await board.close();
    });

    const shot = async (name) => { if (SHOTS && page) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false }); };
    const skipWithoutChrome = (t) => { if (!page) { t.skip('no Chrome to drive'); return true; } return false; };

    it('lists every spec and filters active ones by default', async (t) => {
        if (skipWithoutChrome(t)) return;
        assert.equal(await page.locator('#count-all').textContent(), '5');
        assert.equal(await page.locator('#count-active').textContent(), '3');
        assert.equal(await page.locator('.spec-card').count(), 3);
        await page.click('[data-filter="all"]');
        assert.equal(await page.locator('.spec-card').count(), 5);
        await shot('01-board-all');
    });

    it('opens a spec on its Overview with the viewer\'s dossier and document tabs', async (t) => {
        if (skipWithoutChrome(t)) return;
        await page.click('.spec-card[data-id="specs/041-profile-photo-upload"]');
        await page.waitForSelector('.tab[aria-selected="true"]:has-text("Overview")');
        assert.ok(await page.locator('.dossier .dossier-intent').count(), 'intent section rendered');
        const tabs = await page.locator('.tab').allTextContents();
        assert.deepEqual(tabs.map(t => t.replace(/\d.*$/, '').trim()).slice(0, 4), ['Overview', 'Spec', 'Plan', 'Tasks']);
        await shot('02-overview');
        await page.click('.tab:has-text("Tasks")');
        await page.waitForSelector('#markdown-content .task-item');
        assert.ok(await page.locator('#markdown-content .phase-header, #markdown-content h2').count(), 'task phases rendered');
        await shot('03-tasks');
    });

    it('shows the next step and sends its command to the chat', async (t) => {
        if (skipWithoutChrome(t)) return;
        await page.click('.spec-card[data-id="specs/_01_demo-planned"]');
        await page.waitForSelector('.next-title:has-text("Next: Tasks")');
        await page.click('.next .btn-primary');
        await page.waitForSelector('.toast.is-visible');
        assert.equal(sent.at(-1)?.split('\n')[0], '/speckit.companion.tasks specs/_01_demo-planned');
        assert.match(await page.locator('.toast').textContent(), /Sent to chat/);
        await shot('04-run-sent');
    });

    it('updates the open spec when a file changes on disk', async (t) => {
        if (skipWithoutChrome(t)) return;
        await page.click('.spec-card[data-id="specs/_02_demo-tasked"]');
        await page.waitForSelector('.tab:has-text("Tasks")');
        const tasksPath = join(root, 'specs/_02_demo-tasked/tasks.md');
        writeFileSync(tasksPath, readFileSync(tasksPath, 'utf8').replace('- [ ] **T001**', '- [x] **T001**'));
        await page.waitForFunction(() => document.querySelector('.spec-card[data-id="specs/_02_demo-tasked"] .card-tasks')?.textContent === '1/4', null, { timeout: 5000 });
        await page.waitForSelector('.tab:has-text("Tasks"):has-text("1/4")');
        await shot('05-live-update');
    });

    it('follows the agent when it focuses a spec', async (t) => {
        if (skipWithoutChrome(t)) return;
        board.focus('_03_demo-living');
        await page.waitForSelector('.spec-card[data-id="specs/_03_demo-living"][aria-current="true"]');
        await page.waitForSelector('.detail h2:has-text("Demo — Living Specs")');
    });

    it('collapses to one pane on a narrow panel and gets back to the list', async (t) => {
        if (skipWithoutChrome(t)) return;
        await page.setViewportSize({ width: 480, height: 860 });
        if (await page.getAttribute('#layout', 'data-view') === 'detail') await page.click('.back');
        await page.click('.spec-card[data-id="specs/_00_demo-specified"]');
        assert.equal(await page.getAttribute('#layout', 'data-view'), 'detail');
        await shot('06-narrow-detail');
        await page.click('.back');
        assert.equal(await page.getAttribute('#layout', 'data-view'), 'board');
        await shot('06b-narrow-board');
        await page.setViewportSize({ width: 1280, height: 860 });
    });

    it('reads in light mode', async (t) => {
        if (skipWithoutChrome(t)) return;
        await page.emulateMedia({ colorScheme: 'light' });
        await page.waitForFunction(() => document.body.classList.contains('vscode-light'));
        await page.click('[data-filter="all"]');
        await page.click('.spec-card[data-id="specs/041-profile-photo-upload"]');
        await page.waitForSelector('.dossier');
        await shot('07-light-overview');
        await page.emulateMedia({ colorScheme: 'dark' });
    });
});
