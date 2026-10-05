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

// File events for fixtures written just before a server started land late and trigger one more scan; let that pass first.
const fileEventsToLand = () => new Promise(r => setTimeout(r, 450));

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
    let sessionUp = true;

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
        board = await createSpecServer({ root, send: async (prompt) => { sent.push(prompt); return sessionUp; } });
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
    const toastShown = () => page.waitForFunction(() => getComputedStyle(document.getElementById('toast')).opacity === '1');
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
        assert.equal(sent.at(-1)?.split('\n')[0], '/speckit.tasks specs/_01_demo-planned');
        assert.match(await page.locator('.command-hint').textContent(), /uses the Spec Kit workflow/);
        assert.equal((await page.locator('#toast-msg').textContent()).trim(), 'Sent /speckit.tasks to the chat');
        assert.equal(await page.locator('#toast-prompt').isVisible(), false, 'the full prompt stays folded away');
        const box = await page.locator('#toast').boundingBox();
        assert.ok(box.height < 60, `the sent notice is one line, got ${box.height}px`);
        await page.waitForSelector('.next .btn-primary:not(:disabled)');
        await toastShown();
        await shot('04-run-sent');
        await page.locator('#toast').waitFor({ state: 'hidden', timeout: 6000 });
    });

    it('keeps the short message that was sent, and its instruction file, one click away', async (t) => {
        if (skipWithoutChrome(t)) return;
        await page.click('.next .btn-primary');
        await page.waitForSelector('.toast.is-visible');
        await page.click('#toast-actions button:has-text("Show prompt")');
        const prompt = page.locator('#toast-prompt');
        assert.ok(await prompt.isVisible());
        assert.equal(await prompt.textContent(), sent.at(-1));
        assert.equal(await prompt.textContent(), '/speckit.tasks specs/_01_demo-planned\n\nBefore you start, read and follow the run instructions in `.speckit-companion/prompts/tasks-_01_demo-planned.md`.');
        assert.equal(await page.getAttribute('#toast-actions [aria-controls="toast-prompt"]', 'aria-expanded'), 'true');
        assert.equal(await page.locator('#toast-file code').textContent(), '.speckit-companion/prompts/tasks-_01_demo-planned.md');
        assert.equal(await page.locator('#toast-file button:has-text("Copy path")').count(), 1);
        assert.match(readFileSync(join(root, '.speckit-companion/prompts/tasks-_01_demo-planned.md'), 'utf8'), /<!-- speckit-companion:context-update -->/);
        const box = await page.locator('#toast').boundingBox();
        assert.ok(box.height < 860 * 0.4, `the open prompt stays compact, got ${box.height}px`);
        assert.ok(await prompt.evaluate(node => node.scrollHeight <= node.clientHeight), 'the short message fits without scrolling');
        await toastShown();
        await shot('04c-prompt-open');
        await page.click('#toast-actions [aria-label="Dismiss"]');
        await page.locator('#toast').waitFor({ state: 'hidden', timeout: 1000 });
    });

    it('keeps the prompt up to paste when there is no chat session to send to', async (t) => {
        if (skipWithoutChrome(t)) return;
        sessionUp = false;
        try {
            await page.click('.next .btn-primary');
            await page.waitForSelector('.toast.is-visible');
            assert.match(await page.locator('#toast-msg').textContent(), /^No chat session here\b.*paste it into the chat\.$/i);
            assert.ok(await page.locator('#toast-prompt').isVisible(), 'the prompt shows without a click');
            assert.equal(await page.locator('#toast-prompt').textContent(), sent.at(-1));
            assert.doesNotMatch(sent.at(-1), /context-update/);
            assert.ok(await page.locator('#toast-file').isVisible(), 'the instruction file is named beside it');
            assert.equal(await page.locator('#toast-actions button:has-text("Copy")').count(), 1);
            const box = await page.locator('#toast').boundingBox();
            assert.ok(box.height < 860 * 0.4, `the failure notice stays compact, got ${box.height}px`);
            await toastShown();
            await shot('04b-run-not-sent');
            await page.waitForTimeout(4500);
            assert.ok(await page.locator('#toast').isVisible(), 'the failure notice does not fade');
            await page.click('#toast-actions [aria-label="Dismiss"]');
            await page.locator('#toast').waitFor({ state: 'hidden', timeout: 1000 });
        } finally {
            sessionUp = true;
        }
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

    it('offers the workflow choice and sends the one picked', async (t) => {
        if (skipWithoutChrome(t)) return;
        await page.click('#new-spec-toggle');
        assert.equal(await page.locator('#new-spec-workflow button').count(), 3);
        assert.equal(await page.getAttribute('#new-spec-workflow [aria-checked="true"]', 'role'), 'radio');
        assert.equal((await page.locator('#new-spec-workflow [aria-checked="true"]').textContent()).trim(), 'Companion');
        await page.click('#new-spec-workflow button:has-text("Spec Kit")');
        await page.fill('#new-spec-text', 'Show a footer count');
        await shot('08-new-spec-workflow');
        await page.click('#new-spec button[type="submit"]');
        await page.waitForSelector('.toast.is-visible');
        assert.ok(sent.at(-1).startsWith('/speckit.specify Show a footer count'));
        const file = sent.at(-1).match(/run instructions in `(\.speckit-companion\/prompts\/specify-[^`]+\.md)`\.$/)?.[1];
        assert.ok(file, 'the message ends with the sentence naming the instruction file');
        assert.doesNotMatch(sent.at(-1), /SEED WRITE INSTRUCTIONS|"workflow"/);
        assert.match(readFileSync(join(root, file), 'utf8'), /"workflow": "speckit"/);
    });

    it('shows no install note where Companion is installed', async (t) => {
        if (skipWithoutChrome(t)) return;
        await page.click('#toast-actions [aria-label="Dismiss"]');
        await page.click('#new-spec-toggle');
        await page.waitForSelector('.next');
        assert.equal(await page.locator('.install-hint').count(), 0);
        assert.equal(await page.locator('#new-spec-install').isVisible(), false);
        await page.click('#new-spec-toggle');
    });

    it('disables Companion and Auto and says how to install it when the extension is not installed', async (t) => {
        if (skipWithoutChrome(t)) return;
        const stockRoot = mkdtempSync(join(tmpdir(), 'canvas-page-stock-'));
        mkdirSync(join(stockRoot, 'specs/001-starred-todos'), { recursive: true });
        writeFileSync(join(stockRoot, 'specs/001-starred-todos/spec.md'), '# Starred todos\n');
        const stockSent = [];
        const stock = await createSpecServer({ root: stockRoot, send: async (prompt) => { stockSent.push(prompt); return true; } });
        await fileEventsToLand();
        const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', permissions: ['clipboard-read', 'clipboard-write'] });
        const stockPage = await context.newPage();
        const line = 'SpecKit Companion is not installed in this project, so the standard Spec Kit commands run.';
        const command = 'specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force';
        try {
            await stockPage.goto(stock.url);
            await stockPage.waitForSelector('.next');
            await stockPage.click('#new-spec-toggle');
            const states = await stockPage.locator('#new-spec-workflow button').evaluateAll(buttons => buttons.map(b => [b.textContent.trim(), b.disabled, b.getAttribute('aria-disabled')]));
            assert.deepEqual(states, [['Companion', true, 'true'], ['Spec Kit', false, null], ['Auto', true, 'true']]);
            const looks = await stockPage.locator('#new-spec-workflow button').evaluateAll(buttons => buttons.map(b => [getComputedStyle(b).opacity, getComputedStyle(b).cursor]));
            assert.deepEqual(looks, [['0.6', 'not-allowed'], ['1', 'pointer'], ['0.6', 'not-allowed']]);
            const focusable = await stockPage.locator('#new-spec-workflow button').evaluateAll(buttons => buttons.map(b => { b.focus(); return document.activeElement === b; }));
            assert.deepEqual(focusable, [false, true, false], 'disabled choices take no focus');
            assert.equal((await stockPage.locator('#new-spec-workflow [aria-checked="true"]').textContent()).trim(), 'Spec Kit');

            const inForm = stockPage.locator('#new-spec .install-hint');
            const onCard = stockPage.locator('.next .install-hint');
            for (const hint of [inForm, onCard]) {
                assert.equal(await hint.count(), 1);
                assert.ok((await hint.locator('.install-hint__line').textContent()).startsWith(line));
                assert.equal(await hint.locator('.install-hint__how').count(), 0, 'the command stays folded away');
                const box = await hint.boundingBox();
                assert.ok(box.height < 30, `the note is one line, got ${box.height}px`);
            }
            if (SHOTS) await stockPage.screenshot({ path: join(SHOTS, '09-new-spec-stock.png') });

            await onCard.locator('.btn-link').click();
            assert.equal(await onCard.locator('.install-hint__how code').textContent(), command);
            assert.equal(await onCard.locator('.btn-link').getAttribute('aria-expanded'), 'true');
            await onCard.locator('.install-hint__how button:has-text("Copy")').click();
            await onCard.locator('.install-hint__how button:has-text("Copied")').waitFor();
            assert.equal(await stockPage.evaluate(() => navigator.clipboard.readText()), command);
            if (SHOTS) await stockPage.screenshot({ path: join(SHOTS, '10-install-hint-open.png') });

            await onCard.locator('button:has-text("Ask Copilot to install it")').click();
            await stockPage.waitForSelector('.toast.is-visible');
            assert.ok(stockSent.at(-1).startsWith(`Run \`${command}\` in this project, then commit the skill files it generates`));
            assert.equal((await stockPage.locator('#toast-msg').textContent()).trim(), 'Sent the install request to the chat');

            await inForm.locator('[aria-label="Dismiss the install note"]').click();
            assert.equal(await stockPage.locator('.install-hint').count(), 0, 'dismissing hides it in both places');
            assert.match(await stockPage.locator('#new-spec-hint').textContent(), /not installed/);
            assert.match(await stockPage.locator('.command-hint').textContent(), /Stock Spec Kit commands/);
            await stockPage.reload();
            await stockPage.waitForSelector('.next');
            assert.equal(await stockPage.locator('.install-hint').count(), 0, 'and it stays dismissed for the session');
        } finally {
            await context.close();
            await stock.close();
        }
    });

    it('keeps the nodes it has through a rescan that changed nothing, and a "Copied" through one that did', async (t) => {
        if (skipWithoutChrome(t)) return;
        const stockRoot = mkdtempSync(join(tmpdir(), 'canvas-page-redraw-'));
        mkdirSync(join(stockRoot, 'specs/001-starred-todos'), { recursive: true });
        writeFileSync(join(stockRoot, 'specs/001-starred-todos/spec.md'), '# Starred todos\n');
        const stock = await createSpecServer({ root: stockRoot, send: async () => true });
        const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', permissions: ['clipboard-read', 'clipboard-write'] });
        const stockPage = await context.newPage();
        try {
            await stockPage.goto(stock.url);
            await stockPage.waitForSelector('.next .install-hint');
            await stockPage.locator('.next .install-hint .btn-link').click();
            await stockPage.locator('.next .install-hint__how button:has-text("Copy")').click();
            await stockPage.locator('.next .install-hint__how button:has-text("Copied")').waitFor();
            await stockPage.evaluate(() => { window.kept = { rail: document.querySelector('.rail'), card: document.querySelector('.spec-card') }; });
            const scans = () => stockPage.evaluate(() => window.scans ?? 0);
            await stockPage.evaluate(() => { new EventSource(`/api/events${location.search}`).addEventListener('snapshot', () => { window.scans = (window.scans ?? 0) + 1; }); });
            await stockPage.waitForFunction(() => window.scans === 1);

            stock.rescan();
            await stockPage.waitForFunction(() => window.scans === 2);
            await stockPage.waitForTimeout(150);
            assert.deepEqual(await stockPage.evaluate(() => [document.querySelector('.rail') === window.kept.rail, document.querySelector('.spec-card') === window.kept.card]), [true, true], 'nothing was rebuilt');
            assert.equal(await stockPage.locator('.next .install-hint__how button:has-text("Copied")').count(), 1);

            writeFileSync(join(stockRoot, 'specs/001-starred-todos/plan.md'), '# Plan\n\nStore the flag.\n');
            stock.rescan();
            await stockPage.waitForSelector('.next-title:has-text("Next: Tasks")');
            assert.equal(await stockPage.evaluate(() => document.querySelector('.rail') === window.kept.rail), false, 'a real change redraws');
            assert.equal(await stockPage.locator('.next .install-hint__how button:has-text("Copied")').count(), 1, 'and the install line keeps its state');
            assert.equal(await scans() >= 3, true);
        } finally {
            await context.close();
            await stock.close();
        }
    });

    it('follows a stock run from the files: a record stuck on specifying, the dashed command, and the step it sent shown as running', async (t) => {
        if (skipWithoutChrome(t)) return;
        const stockRoot = mkdtempSync(join(tmpdir(), 'canvas-page-stock-run-'));
        const spec = join(stockRoot, 'specs/001-todo-stars');
        mkdirSync(spec, { recursive: true });
        for (const name of ['spec.md', 'plan.md']) writeFileSync(join(spec, name), `# Todo stars: ${name}\n`);
        writeFileSync(join(spec, '.spec-context.json'), JSON.stringify({
            workflow: 'speckit',
            specName: 'Todo Stars',
            currentStep: 'specify',
            status: 'specifying',
            history: [{ step: 'specify', substep: null, kind: 'start', by: 'extension', at: '2026-10-05T14:54:53.999Z' }],
        }));
        for (const step of ['specify', 'plan', 'tasks', 'implement']) {
            mkdirSync(join(stockRoot, '.github/skills', `speckit-${step}`), { recursive: true });
            writeFileSync(join(stockRoot, '.github/skills', `speckit-${step}`, 'SKILL.md'), `# ${step}\n`);
        }
        const stockSent = [];
        const stock = await createSpecServer({ root: stockRoot, checkoutWriter: null, send: async (prompt) => { stockSent.push(prompt); return true; } });
        const stockPage = await browser.newPage({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
        try {
            await stockPage.goto(stock.url);
            await stockPage.waitForSelector('.next-title:has-text("Next: Tasks")');
            assert.equal((await stockPage.locator('.spec-card .pill').textContent()).trim(), 'Planned');
            assert.deepEqual(await stockPage.locator('.rail .rail-state').allTextContents(), ['Done', 'Done', 'Not started', 'Not started']);
            assert.match(await stockPage.locator('.command-hint').textContent(), /Buttons send \/speckit-<step> specs\/001-todo-stars to the chat\./);
            if (SHOTS) await stockPage.screenshot({ path: join(SHOTS, '12-stock-run-from-files.png') });

            await stockPage.click('.next .btn-primary');
            await stockPage.waitForSelector('.next-title:has-text("Tasks is running")');
            assert.equal(stockSent.at(-1), '/speckit-tasks specs/001-todo-stars');
            assert.equal((await stockPage.locator('#toast-msg').textContent()).trim(), 'Sent /speckit-tasks to the chat');
            await stockPage.click('#toast-actions button:has-text("Show prompt")');
            assert.equal(await stockPage.locator('#toast-prompt').textContent(), '/speckit-tasks specs/001-todo-stars');
            assert.equal(await stockPage.locator('#toast-file').isVisible(), false, 'no instruction file for a stock run');
            assert.deepEqual(await stockPage.locator('.rail .rail-state').allTextContents(), ['Done', 'Done', 'Running', 'Not started']);
            assert.equal((await stockPage.locator('.spec-card .pill').textContent()).trim(), 'Tasking');
            if (SHOTS) await stockPage.screenshot({ path: join(SHOTS, '13-stock-run-step-running.png') });

            writeFileSync(join(spec, 'tasks.md'), '- [ ] T001 Add the star\n');
            stock.settle();
            await stockPage.waitForSelector('.next-title:has-text("Next: Implement")');
            assert.deepEqual(await stockPage.locator('.rail .rail-state').allTextContents(), ['Done', 'Done', 'Done', 'Not started']);
        } finally {
            await stockPage.close();
            await stock.close();
        }
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
