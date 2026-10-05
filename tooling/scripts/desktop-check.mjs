#!/usr/bin/env node
// Drives a real VS Code window with this extension and a throwaway project, and saves a screenshot per step.
// usage: node tooling/scripts/desktop-check.mjs [--extension <checkout>] [--out <dir>] [--theme light|dark] [--only <step,step>]
import { createRequire } from 'node:module';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > -1 ? process.argv[at + 1] : fallback;
};
const EXTENSION = resolve(arg('extension', join(HERE, '..', '..')));
const OUT = resolve(arg('out', join(EXTENSION, '.desktop-check')));
const THEME = arg('theme', 'light');
const ONLY = arg('only', '').split(',').filter(Boolean);
const CODE = process.env.VSCODE_BIN ?? '/Applications/Visual Studio Code.app/Contents/MacOS/Code';

if (!existsSync(join(EXTENSION, 'dist', 'extension.js'))) {
    console.error(`No build in ${EXTENSION}/dist. Run "npm run compile && npm run compile-web" there first.`);
    process.exit(2);
}
if (!existsSync(CODE)) {
    console.error(`VS Code not found at ${CODE}. Set VSCODE_BIN.`);
    process.exit(2);
}

const require = createRequire(join(EXTENSION, 'package.json'));
const { _electron } = require('playwright-core');

function buildProject() {
    const root = mkdtempSync(join(tmpdir(), 'speckit-desktop-'));
    const project = join(root, 'project');
    const fixtures = join(EXTENSION, 'apps', 'vscode', 'tests', 'fixtures');
    mkdirSync(join(project, '.specify'), { recursive: true });
    for (const set of ['bug-reports', 'report-pages', 'idea-reports']) {
        const from = join(fixtures, set, '.specify');
        if (existsSync(from)) cpSync(from, join(project, '.specify'), { recursive: true });
    }
    for (const extension of ['bug', 'assess']) mkdirSync(join(project, '.specify', 'extensions', extension), { recursive: true });
    for (const spec of ['_00_demo-specified', '_02_demo-tasked', '627-bugs-ideas-panes']) {
        cpSync(join(EXTENSION, 'specs', spec), join(project, 'specs', spec), { recursive: true });
    }
    // Whatever a step sends goes to this stand-in, so nothing real runs and the terminal shows what was sent.
    const bin = join(root, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'claude'), '#!/bin/sh\nprintf "[sent to assistant] %s\\n" "$*"\n');
    chmodSync(join(bin, 'claude'), 0o755);
    const zdotdir = join(root, 'zsh');
    mkdirSync(zdotdir);
    writeFileSync(join(zdotdir, '.zshrc'), `export PATH="${bin}:/usr/bin:/bin"\nPROMPT='$ '\n`);
    const user = join(root, 'user');
    mkdirSync(join(user, 'User'), { recursive: true });
    writeFileSync(join(user, 'User', 'settings.json'), JSON.stringify({
        'workbench.colorTheme': THEME === 'dark' ? 'Default Dark Modern' : 'Quiet Light',
        'workbench.startupEditor': 'none',
        'workbench.secondarySideBar.defaultVisibility': 'hidden',
        'chat.commandCenter.enabled': false,
        'security.workspace.trust.enabled': false,
        'telemetry.telemetryLevel': 'off',
        'update.mode': 'none',
        'extensions.autoUpdate': false,
        'window.dialogStyle': 'custom',
        'window.menuStyle': 'custom',
        // A shell that reads only this profile, so nothing puts a real assistant ahead of the stand-in on PATH.
        'terminal.integrated.profiles.osx': { check: { path: '/bin/zsh' } },
        'terminal.integrated.defaultProfile.osx': 'check',
        'terminal.integrated.profiles.linux': { check: { path: '/bin/zsh' } },
        'terminal.integrated.defaultProfile.linux': 'check',
        'terminal.integrated.env.osx': { ZDOTDIR: zdotdir },
        'terminal.integrated.env.linux': { ZDOTDIR: zdotdir },
        // The DOM renderer keeps the terminal's text readable from the page.
        'terminal.integrated.gpuAcceleration': 'off',
        'speckit.aiProvider': 'claude',
        'speckit.views.steering.visible': false,
        'speckit.views.settings.visible': false,
    }, null, 2));
    return { root, project, user };
}

const results = [];
let page;

async function shot(name) {
    const file = join(OUT, `${name}.${THEME}.png`);
    await page.screenshot({ path: file });
    return file;
}

/** The document inside the newest webview: VS Code nests the page in two iframes. */
function webview() {
    return page.frameLocator('iframe.webview.ready').last().frameLocator('iframe#active-frame');
}

function pane(title) {
    return page.locator('.pane', { has: page.locator(`.pane-header h3.title:text-is("${title}")`) });
}

async function row(paneTitle, text) {
    const item = pane(paneTitle).locator('.monaco-list-row', { hasText: text }).first();
    await item.waitFor({ timeout: 15000 });
    return item;
}

async function command(title) {
    // Focus the workbench first: a key pressed while a webview has focus does not always reach it.
    await page.locator('.part.titlebar').click({ position: { x: 200, y: 8 } });
    await page.keyboard.press('F1');
    await page.locator('.quick-input-widget input').fill(`>${title}`);
    const first = page.locator('.quick-input-list .monaco-list-row').first();
    await first.waitFor();
    const label = (await first.innerText()).split('\n')[0];
    if (!label.includes(title)) throw new Error(`no command named "${title}", the palette offered "${label}"`);
    await page.keyboard.press('Enter');
}

/** One editor and no terminal, so the next step's webview is the only one. */
async function clear() {
    await command('View: Close All Editors');
    await command('Terminal: Kill All Terminals');
    await page.waitForTimeout(400);
}

async function terminalText(pattern) {
    const rows = page.locator('.xterm-rows').last();
    await rows.waitFor({ timeout: 15000 });
    for (let tries = 0; tries < 40; tries++) {
        const text = (await rows.innerText()).replace(/\s+/g, ' ');
        if (pattern.test(text)) return text.match(/\[sent to assistant\][^❯$]*/)?.[0].trim().slice(0, 240) ?? text.slice(0, 240);
        await page.waitForTimeout(500);
    }
    throw new Error(`the terminal never showed ${pattern}`);
}

async function step(name, what, run) {
    if (ONLY.length && !ONLY.includes(name)) return;
    const result = { name, what, ok: false };
    try {
        result.note = (await run()) ?? '';
        result.ok = true;
    } catch (error) {
        result.note = String(error?.message ?? error).split('\n')[0];
    }
    result.shot = await shot(name).catch(() => undefined);
    results.push(result);
    console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${name}: ${what}${result.note ? ` (${result.note})` : ''}`);
}

async function expectText(locator, pattern) {
    await locator.first().waitFor({ timeout: 15000 });
    const text = (await locator.first().innerText()).trim();
    if (!pattern.test(text)) throw new Error(`expected ${pattern}, saw "${text.slice(0, 80)}"`);
    return text;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const { root, project, user } = buildProject();
const app = await _electron.launch({
    executablePath: CODE,
    args: [
        project,
        `--extensionDevelopmentPath=${EXTENSION}`,
        `--user-data-dir=${user}`,
        `--extensions-dir=${join(root, 'extensions')}`,
        '--disable-workspace-trust',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-updates',
        '--window-size=1680,1050',
    ],
    timeout: 60000,
});

try {
    page = await app.firstWindow();
    await page.waitForSelector('.monaco-workbench', { timeout: 60000 });
    await page.locator('.activitybar a.action-label[aria-label^="SpecKit"]').first().click();

    await step('sidebar-panes', 'Specs, Bugs and Ideas each have a pane with rows', async () => {
        await row('Specs', 'Demo');
        await row('Bugs', 'cartTotal skips the first cart item');
        await row('Ideas', 'Saved filters');
        const groups = await pane('Bugs').locator('.monaco-list-row').allInnerTexts();
        return groups.filter(text => /\(\d+\)/.test(text)).map(text => text.trim().split('\n')[0]).join(', ');
    });

    await step('bug-story', 'A bug opens on its Story page', async () => {
        await (await row('Bugs', 'cartTotal skips the first cart item')).click();
        return expectText(webview().locator('.rp-lead'), /Fixed and verified\./);
    });

    await step('bug-report-tab', 'The Assessment tab shows the raw report', async () => {
        await webview().locator('.step-tab', { hasText: 'Assessment' }).click();
        await webview().locator('.rp-lead').waitFor({ state: 'detached', timeout: 15000 });
        return expectText(webview().locator('#markdown-content h2').first(), /Report|Symptom/);
    });

    await step('bug-test-failed', 'A bug whose test failed says the fix did not hold', async () => {
        await clear();
        await (await row('Bugs', 'promo code discount')).click();
        return expectText(webview().locator('.rp-lead'), /The fix did not hold\./);
    });

    await step('bug-next-step', 'Fix bug sends its command to the assistant', async () => {
        await webview().locator('footer.actions button', { hasText: /^Fix bug$/ }).click();
        return terminalText(/\[sent to assistant\].*speckit[-.]bug[-.]fix/);
    });

    await step('idea-decision', 'A decided idea opens on its decision page', async () => {
        await clear();
        await (await row('Ideas', 'Saved filters')).click();
        await expectText(webview().locator('.rp-lead'), /^Go\./);
        return `${await webview().locator('.rp-score > li').count()} scorecard rows`;
    });

    await step('idea-assessing', 'An idea still being assessed opens on its latest stage', async () => {
        await clear();
        await (await row('Ideas', 'Offline')).click();
        await webview().locator('.step-tab.current, .step-tab[aria-current]').first().waitFor({ timeout: 15000 });
        if (await webview().locator('.rp-lead').count()) throw new Error('a decision page showed for an undecided idea');
        return (await webview().locator('.step-tab[disabled]').count()) + ' stages disabled';
    });

    await step('new-bug', 'New Bug opens the create screen', async () => {
        await clear();
        await pane('Bugs').locator('.pane-header').hover();
        await pane('Bugs').locator('.pane-header a.action-label[aria-label^="New Bug"]').click();
        await webview().locator('textarea').first().waitFor({ timeout: 15000 });
        await webview().locator('textarea').first().fill('The export button does nothing on Safari.');
    });

    await step('tasks-other-actions', 'Other actions on the Tasks tab offers Create GitHub issues', async () => {
        await clear();
        await (await row('Specs', 'Demo — Tasked')).click();
        await webview().locator('.step-tab', { hasText: 'Tasks' }).click();
        await webview().locator('footer.actions button', { hasText: 'Other actions' }).click();
        return expectText(webview().locator('.action-menu'), /Create GitHub issues/);
    });

    await step('create-issues-confirm', 'Create GitHub issues asks before it sends', async () => {
        await webview().locator('.action-menu button', { hasText: 'Create GitHub issues' }).click();
        const text = await expectText(page.locator('.monaco-dialog-box'), /Create a GitHub issue for every task/);
        return text.split('\n')[0];
    });

    await step('create-issues-cancel', 'Cancel sends nothing', async () => {
        await page.locator('.monaco-dialog-box .monaco-button', { hasText: 'Cancel' }).click();
        await page.locator('.monaco-dialog-box').waitFor({ state: 'detached', timeout: 5000 });
    });

    await step('converge-button', 'A finished spec offers Converge in the footer', async () => {
        await clear();
        await (await row('Specs', 'Completed')).click();
        await (await row('Specs', 'Bugs And Ideas Panes')).click();
        return expectText(webview().locator('footer.actions button', { hasText: /^Converge$/ }), /Converge/);
    });

    await step('converge-sends', 'Converge sends the command and names the spec', async () => {
        await webview().locator('footer.actions button', { hasText: /^Converge$/ }).click();
        return terminalText(/\[sent to assistant\].*converge/i);
    });

    await step('joined-paragraph', 'A wrapped paragraph is one paragraph with one comment button', async () => {
        await clear();
        await (await row('Specs', 'Demo — Specified')).click();
        await webview().locator('.step-tab', { hasText: 'Specification' }).click();
        const joined = webview().locator('.line[data-line-end]');
        await joined.first().waitFor({ timeout: 15000 });
        return `${await joined.count()} joined paragraph(s)`;
    });

    await step('tasks-no-blank-band', 'A short document starts right under the outline', async () => {
        await clear();
        await (await row('Specs', 'Demo — Tasked')).click();
        await webview().locator('.step-tab', { hasText: 'Tasks' }).click();
        await webview().locator('.phase-header').first().waitFor({ timeout: 15000 });
        const gap = await webview().locator('#content-area').evaluate((area) => {
            const top = area.querySelector('.phase-header').getBoundingClientRect().top;
            return Math.round(top - area.getBoundingClientRect().top);
        });
        if (gap > 170) throw new Error(`the first phase starts ${gap}px down the page`);
        return `${gap}px from the top of the page`;
    });

    await step('report-header-line', 'A report tab opens with one line of facts, not a bullet list', async () => {
        await clear();
        await (await row('Bugs', 'cartTotal skips the first cart item')).click();
        await webview().locator('.step-tab', { hasText: 'Assessment' }).click();
        await webview().locator('.rp-lead').waitFor({ state: 'detached', timeout: 15000 });
        const line = await expectText(webview().locator('#markdown-content .rp-meta'), /Reported Oct 1, 2026 from pasted text · valid · high severity/);
        const body = await webview().locator('#markdown-content').innerText();
        if (/Slug\s*:/.test(body)) throw new Error('the slug bullet is still shown');
        return line;
    });

    await step('answer-open-question', 'An open question has an Answer button', async () => {
        const question = webview().locator('.rp-question').first();
        await question.scrollIntoViewIfNeeded();
        await expectText(question.locator('.rp-question__badge'), /Needs an answer/);
        await question.locator('.rp-question__answer').click();
        await webview().locator('textarea').first().fill('No. The wrong totals never reached an order: checkout recomputes them on the server.');
    });

    await step('answer-sends', 'Send answer hands the answer to the assistant with the assess command', async () => {
        await webview().locator('button', { hasText: 'Send answer' }).click();
        await expectText(webview().locator('.rp-question__sent'), /Sent to your assistant/);
        return terminalText(/\[sent to assistant\].*speckit[-.]bug[-.]assess slug=cart-total-skips-first/);
    });
} finally {
    writeFileSync(join(OUT, `results.${THEME}.json`), JSON.stringify(results, null, 2));
    await app.close().catch(() => undefined);
    rmSync(root, { recursive: true, force: true });
}

const failed = results.filter(result => !result.ok);
console.log(`\n${results.length - failed.length} of ${results.length} steps passed. Screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);
