#!/usr/bin/env node
// Drives a real VS Code window with this extension and a throwaway project (or an existing one, --sandbox), and saves a screenshot per step.
// usage: node tooling/scripts/desktop-check.mjs [--extension <checkout>] [--out <dir>] [--theme light|dark] [--only <step,step>] [--sandbox <project folder>] [--shots <dir>] [--sheet]
// --shots also saves named crops for the docs and the changelog, and runs the capture-only steps.
// --sheet also writes every picture of the run onto one reduced sheet (_sheet.png), the file to look at first.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTeamboardRun } from './lib/teamboard-run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > -1 ? process.argv[at + 1] : fallback;
};
const EXTENSION = resolve(arg('extension', join(HERE, '..', '..')));
const OUT = resolve(arg('out', join(EXTENSION, '.desktop-check')));
const THEME = arg('theme', 'light');
const ONLY = arg('only', '').split(',').filter(Boolean);
const SANDBOX = arg('sandbox') ? resolve(arg('sandbox')) : undefined;
const SHOTS = arg('shots') ? resolve(arg('shots')) : undefined;
const SHEET = process.argv.includes('--sheet');
// A crop is read in a docs column about 650px wide, so the capture window is kept small enough for its text to survive that.
const SHOT_WINDOW = { width: 1240, height: 800 };
const CHECK_WINDOW = { width: 1680, height: 1050 };
const LIVING_SIDEBAR = 336;
const CODE = process.env.VSCODE_BIN ?? '/Applications/Visual Studio Code.app/Contents/MacOS/Code';

if (!existsSync(join(EXTENSION, 'dist', 'extension.js'))) {
    console.error(`No build in ${EXTENSION}/dist. Run "npm run compile && npm run compile-web" there first.`);
    process.exit(2);
}
if (SANDBOX && !existsSync(join(SANDBOX, 'specs')) && !existsSync(join(SANDBOX, '.specify'))) {
    console.error(`${SANDBOX} has no specs/ or .specify/ folder, so it is not a Spec Kit project.`);
    process.exit(2);
}
if (!existsSync(CODE)) {
    console.error(`VS Code not found at ${CODE}. Set VSCODE_BIN.`);
    process.exit(2);
}

const require = createRequire(join(EXTENSION, 'package.json'));
const { _electron } = require('playwright-core');

const DRIFTED_REQUIREMENT = 'Oversized uploads are rejected before the body is read';
// The files a Photo Storage requirement is about. A requirement is marked Drifted only when it names the file that moved.
const PHOTO_STORAGE_TOUCHES = {
    'A replacement photo never leaves the member without an avatar': 'src/services/photoStorage/**',
    [DRIFTED_REQUIREMENT]: 'src/api/photos/**',
    'Variants are derived on the server, never in the browser': 'src/jobs/variants/**',
};
const SOURCE_FILES = [
    'src/features/directory-search/search.ts', 'src/features/directory-search/filters.ts', 'src/features/directory-search/ranking.ts',
    'src/features/directory-search/index.ts', 'src/features/directory-search/types.ts',
    'src/components/Avatar/Avatar.tsx', 'src/components/Avatar/initials.ts', 'src/components/PhotoUploader/PhotoUploader.tsx',
    'src/services/photoStorage/store.ts', 'src/services/photoStorage/replace.ts', 'src/api/photos/upload.ts', 'src/jobs/variants/derive.ts',
    'src/features/profile/ProfilePage.tsx', 'src/api/members/update.ts', 'src/features/invites/InviteForm.tsx', 'src/api/invites/create.ts',
];

/** Living specs on: five capabilities (three central, two beside their code), coverage files, a finished run that used two of them, and a git history in which two capabilities' code moved after their spec was committed. */
function addLivingSpecs(project, fixtures) {
    const teamboard = join(EXTENSION, 'apps', 'vscode', 'webview', 'src', 'spec-viewer', '__fixtures__', 'teamboard');
    cpSync(join(fixtures, 'living-specs'), project, { recursive: true });
    const photoStorage = readFileSync(join(teamboard, 'photo-storage.spec.md'), 'utf8')
        .replace(/^### (.+)$/gm, (line, heading) => (PHOTO_STORAGE_TOUCHES[heading] ? `${line}\n<!-- touches: ${PHOTO_STORAGE_TOUCHES[heading]} -->` : line));
    writeFileSync(join(project, 'capabilities', 'photo-storage', 'photo-storage.spec.md'), photoStorage);

    // The Living Specs pane lists capabilities only with the Companion spec-kit extension in the project. Its standard commands are marked present, so opening the folder installs nothing.
    const companion = join(project, '.specify', 'extensions', 'companion');
    mkdirSync(companion, { recursive: true });
    cpSync(join(EXTENSION, 'apps', 'speckit-extension', 'extension.yml'), join(companion, 'extension.yml'));
    mkdirSync(join(project, '.specify', 'presets', 'companion-standard'), { recursive: true });

    const run = join(project, 'specs', '041-profile-photo-upload');
    cpSync(join(teamboard, '041-profile-photo-upload'), run, { recursive: true, filter: from => !/spec-context\.\w+\.json$/.test(from) });
    const context = JSON.parse(readFileSync(join(teamboard, '041-profile-photo-upload', 'spec-context.completed.json'), 'utf8'));
    context.livingSpecs = { loaded: ['member-profiles', 'photo-storage'], synced: ['member-profiles'] };
    writeFileSync(join(run, '.spec-context.json'), JSON.stringify(context, null, 2));

    // Every test a coverage file names exists, so a requirement's card reads "1 test" and not "0/1 tests".
    const tests = [];
    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) walk(join(dir, entry.name));
            else if (entry.name.endsWith('.coverage.md')) tests.push(...[...readFileSync(join(dir, entry.name), 'utf8').matchAll(/`([^`]+)`/g)].map(match => match[1]));
        }
    };
    walk(join(project, 'capabilities'));
    walk(join(project, 'src'));
    for (const file of [...SOURCE_FILES, ...tests]) {
        mkdirSync(dirname(join(project, file)), { recursive: true });
        writeFileSync(join(project, file), 'export {};\n');
    }

    // Drift is read from git: a capability drifted when a file it covers changed after its spec's last commit.
    const git = (...args) => execFileSync('git', ['-c', 'user.name=Desktop Check', '-c', 'user.email=check@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', '-c', 'init.defaultBranch=main', ...args], { cwd: project, stdio: 'ignore' });
    git('init');
    git('add', '-A');
    git('commit', '-m', 'Teamboard with its living specs');
    for (const file of ['src/api/photos/upload.ts', 'src/components/Avatar/Avatar.tsx']) appendFileSync(join(project, file), 'export const changedSinceTheSpec = true;\n');
    git('add', '-A');
    git('commit', '-m', 'Change the upload limit and the avatar by hand');
}

function buildProject({ provider = 'claude' } = {}) {
    const root = mkdtempSync(join(tmpdir(), 'speckit-desktop-'));
    const project = SANDBOX ?? join(root, 'project');
    if (!SANDBOX) {
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
        addLivingSpecs(project, fixtures);
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
        // The fixture is a git repository only so drift can be read; the window stays as it was without one.
        'git.enabled': false,
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
        ...(provider ? { 'speckit.aiProvider': provider } : {}),
        'speckit.views.steering.visible': false,
        'speckit.views.settings.visible': false,
        // A walked run would raise a step-complete toast over the crop.
        ...(SHOTS ? { 'speckit.notifications.stepComplete': false } : {}),
    }, null, 2));
    return { root, project, user, bin };
}

const results = [];
let app;
let page;

async function launch({ root, project, user, bin }) {
    app = await _electron.launch({
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
            ...(SHOTS ? ['--force-device-scale-factor=2'] : []),
        ],
        // In a sandbox, keep `specify` off the extension's PATH so opening the folder cannot reinstall presets into it.
        ...(SANDBOX ? { env: { ...process.env, PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin` } } : {}),
        timeout: 60000,
    });
    page = await app.firstWindow();
    await page.waitForSelector('.monaco-workbench', { timeout: 60000 });
    if (SHOTS) await resize(SHOT_WINDOW);
}

async function resize({ width, height }) {
    await app.evaluate(({ BrowserWindow }, size) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (window.isMaximized()) window.unmaximize();
        window.setSize(size.width, size.height);
    }, { width, height });
    await page.waitForTimeout(500);
}

/**
 * Under --shots, saves <dir>/<name>.png at device scale factor 2; without the flag it does nothing.
 * target: 'window', 'editor', 'sidebar', 'panel', a locator, or a list of locators whose boxes are joined.
 * ratio crops the box to width / ratio, keeping its top (or its bottom with anchor: 'bottom').
 */
async function capture(name, { target = 'window', padding = 0, ratio, anchor = 'top', keepPointer = false } = {}) {
    if (!SHOTS) return;
    // The install prompt sits over the top of a spec's Overview; dismissing it is remembered for the rest of the run.
    const dismiss = webview().locator('#install-banner [data-action="dismissInstallBanner"]');
    if (await dismiss.first().isVisible().catch(() => false)) {
        await dismiss.first().click();
        await webview().locator('#install-banner').waitFor({ state: 'detached', timeout: 5000 });
    }
    if (!keepPointer) await page.mouse.move(2, 2);
    await page.waitForTimeout(400);
    const path = join(SHOTS, `${name}.png`);
    if (target === 'window') return void (await page.screenshot({ path }));
    const parts = { editor: '.part.editor', sidebar: '.part.sidebar', panel: '.part.panel' };
    const locators = (Array.isArray(target) ? target : [target]).map(one => (typeof one === 'string' ? page.locator(parts[one]) : one));
    const boxes = [];
    for (const locator of locators) {
        const box = await locator.first().boundingBox();
        if (!box) throw new Error(`nothing on screen to capture for "${name}"`);
        boxes.push(box);
    }
    const view = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    const left = Math.max(0, Math.min(...boxes.map(box => box.x)) - padding);
    let top = Math.max(0, Math.min(...boxes.map(box => box.y)) - padding);
    const right = Math.min(view.width, Math.max(...boxes.map(box => box.x + box.width)) + padding);
    let bottom = Math.min(view.height, Math.max(...boxes.map(box => box.y + box.height)) + padding);
    if (ratio && bottom - top > (right - left) / ratio) {
        if (anchor === 'bottom') top = bottom - (right - left) / ratio;
        else bottom = top + (right - left) / ratio;
    }
    await page.screenshot({ path, clip: { x: Math.round(left), y: Math.round(top), width: Math.round(right - left), height: Math.round(bottom - top) } });
}

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
    // The capture window wraps a long command across rows, so it is read at the check's own width.
    if (SHOTS) await resize(CHECK_WINDOW);
    try {
        for (let tries = 0; tries < 40; tries++) {
            const text = (await rows.innerText()).replace(/\s+/g, ' ');
            if (pattern.test(text)) return text.match(/\[sent to assistant\][^❯$]*/)?.[0].trim().slice(0, 240) ?? text.slice(0, 240);
            await page.waitForTimeout(500);
        }
        throw new Error(`the terminal never showed ${pattern}`);
    } finally {
        if (SHOTS) await resize(SHOT_WINDOW);
    }
}

async function drag(from, to) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
}

/** Drags the side bar's edge so the side bar is this wide. */
async function sidebarWidth(width) {
    const box = await page.locator('.part.sidebar').boundingBox();
    const y = box.y + box.height / 2;
    await drag({ x: box.x + box.width, y }, { x: box.x + width, y });
}

/** Drags the top of the next pane up to just under this pane's last row, so no pane is mostly empty. */
async function fitPane(title, next) {
    const last = await pane(title).locator('.monaco-list-row').last().boundingBox();
    const below = await pane(next).boundingBox();
    const x = below.x + below.width / 2;
    await drag({ x, y: below.y }, { x, y: last.y + last.height + 10 });
}

/** Opens or closes side bar panes by their headers. */
async function setPanes(titles, open) {
    for (const title of titles) {
        const header = pane(title).locator('.pane-header');
        if ((await header.getAttribute('aria-expanded')) !== String(open)) await header.click();
    }
    await page.waitForTimeout(400);
}

/** The Living Specs pane alone in the side bar, with every folder in its tree open. */
async function showLivingSpecs() {
    await setPanes(['Specs', 'Bugs', 'Ideas'], false);
    await setPanes(['Living Specs'], true);
    await row('Living Specs', 'Photo Storage');
    // A folder holding no drift starts closed.
    for (let tries = 0; tries < 5; tries++) {
        const closed = pane('Living Specs').locator('.monaco-list-row[aria-expanded="false"]', { has: page.locator('.codicon-folder') });
        if (!(await closed.count())) break;
        await closed.first().click();
        await page.waitForTimeout(300);
    }
}

/** Opens a capability's spec from the Living Specs pane and waits for its coverage and drift to arrive. */
async function openLivingSpec(name, fact) {
    await clear();
    await showLivingSpecs();
    await (await row('Living Specs', name)).click();
    await webview().locator('.spec-header-living', { hasText: fact }).waitFor({ timeout: 15000 });
}

/** Scrolls the viewer's page so the element sits at the top ('start'), middle ('center') or bottom ('end') of it, then `lower` pixels further down the page. */
async function scrollTo(locator, block = 'start', lower = 0) {
    await locator.first().evaluate((element, [where, by]) => {
        element.scrollIntoView({ block: where, behavior: 'instant' });
        let scroller = element.parentElement;
        while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
        (scroller ?? document.scrollingElement).scrollBy({ top: -by, behavior: 'instant' });
    }, [block, lower]);
}

/** `needs: 'fixtures'` marks a step that reads the built-in project's own specs, bugs or ideas; --sandbox skips those. `shots: true` marks a capture-only step, which runs under --shots alone. */
async function step(name, what, run, { needs, shots } = {}) {
    if (ONLY.length && !ONLY.includes(name)) return;
    if (shots && !SHOTS) return;
    if (SANDBOX && needs === 'fixtures') {
        results.push({ name, what, ok: true, skipped: true, note: 'skipped: needs the built-in project' });
        console.log(`skip ${name}: ${what} (skipped: needs the built-in project)`);
        return;
    }
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
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// The first-start picker only opens with no provider set, so it gets a window of its own.
if (SHOTS && !SANDBOX && (!ONLY.length || ONLY.includes('provider-picker'))) {
    const first = buildProject({ provider: null });
    try {
        await launch(first);
        await step('provider-picker', 'With no provider set, the first start asks which assistant to use', async () => {
            const picker = page.locator('.quick-input-widget');
            await expectText(picker.locator('.quick-input-title'), /Choose AI Provider/);
            await picker.locator('.monaco-list-row').first().waitFor({ timeout: 15000 });
            await capture('provider-picker', { target: picker });
            return `${await picker.locator('.monaco-list-row').count()} assistants listed`;
        }, { shots: true });
    } finally {
        await app?.close().catch(() => undefined);
        rmSync(first.root, { recursive: true, force: true });
    }
}

const built = buildProject();
const { root } = built;

try {
    await launch(built);
    await page.locator('.activitybar a.action-label[aria-label^="SpecKit"]').first().click();

    await step('sidebar-panes', 'Specs, Bugs and Ideas each have a pane with rows', async () => {
        await row('Specs', 'Demo');
        await row('Bugs', 'cartTotal skips the first cart item');
        await row('Ideas', 'Saved filters');
        if (SHOTS) {
            const width = (await page.locator('.part.sidebar').boundingBox()).width;
            await sidebarWidth(540);
            await fitPane('Specs', 'Bugs');
            await fitPane('Bugs', 'Ideas');
            await capture('sidebar-panes', { target: [pane('Specs'), pane('Bugs'), pane('Ideas').locator('.monaco-list-row').last()] });
            await sidebarWidth(width);
        }
        const groups = await pane('Bugs').locator('.monaco-list-row').allInnerTexts();
        return groups.filter(text => /\(\d+\)/.test(text)).map(text => text.trim().split('\n')[0]).join(', ');
    }, { needs: 'fixtures' });

    await step('bug-story', 'A bug opens on its Story page', async () => {
        await (await row('Bugs', 'cartTotal skips the first cart item')).click();
        const lead = await expectText(webview().locator('.rp-lead'), /Fixed and verified\./);
        await capture('bug-story-verified', { target: 'editor', ratio: 3 / 2 });
        await capture('sidebar-and-story', { target: 'window' });
        return lead;
    }, { needs: 'fixtures' });

    await step('bug-report-tab', 'The Assessment tab shows the raw report', async () => {
        await webview().locator('.step-tab', { hasText: 'Assessment' }).click();
        await webview().locator('.rp-lead').waitFor({ state: 'detached', timeout: 15000 });
        return expectText(webview().locator('#markdown-content h2').first(), /Report|Symptom/);
    }, { needs: 'fixtures' });

    await step('bug-test-failed', 'A bug whose test failed says the fix did not hold', async () => {
        await clear();
        await (await row('Bugs', 'promo code discount')).click();
        const lead = await expectText(webview().locator('.rp-lead'), /The fix did not hold\./);
        await capture('bug-story-failed', { target: 'editor', ratio: 3 / 2 });
        if (SHOTS) {
            await scrollTo(webview().locator('.rp-step', { hasText: 'How it was verified' }));
            await capture('bug-story-failed-checks', { target: 'editor', ratio: 3 / 2 });
        }
        return lead;
    }, { needs: 'fixtures' });

    await step('bug-next-step', 'Fix bug sends its command to the assistant', async () => {
        await webview().locator('footer.actions button', { hasText: /^Fix bug$/ }).click();
        return terminalText(/\[sent to assistant\].*speckit[-.]bug[-.]fix/);
    }, { needs: 'fixtures' });

    await step('idea-decision', 'A decided idea opens on its decision page', async () => {
        await clear();
        await (await row('Ideas', 'Saved filters')).click();
        await expectText(webview().locator('.rp-lead'), /^Go\./);
        await capture('idea-decision', { target: 'editor', ratio: 3 / 2 });
        if (SHOTS) {
            await scrollTo(webview().locator('#markdown-content :is(h2, h3)', { hasText: 'Scorecard' }));
            await capture('idea-scorecard', { target: 'editor', ratio: 3 / 2 });
        }
        return `${await webview().locator('.rp-score > li').count()} scorecard rows`;
    }, { needs: 'fixtures' });

    await step('idea-assessing', 'An idea still being assessed opens on its latest stage', async () => {
        await clear();
        await (await row('Ideas', 'Offline')).click();
        await webview().locator('.step-tab.current, .step-tab[aria-current]').first().waitFor({ timeout: 15000 });
        if (await webview().locator('.rp-lead').count()) throw new Error('a decision page showed for an undecided idea');
        await capture('idea-assessing', { target: 'editor', ratio: 16 / 9 });
        return (await webview().locator('.step-tab[disabled]').count()) + ' stages disabled';
    }, { needs: 'fixtures' });

    await step('new-bug', 'New Bug opens the create screen', async () => {
        await clear();
        await pane('Bugs').locator('.pane-header').hover();
        await pane('Bugs').locator('.pane-header a.action-label[aria-label^="New Bug"]').click();
        await webview().locator('textarea').first().waitFor({ timeout: 15000 });
        await webview().locator('textarea').first().fill('The export button does nothing on Safari.');
        await capture('new-bug', { target: 'editor' });
    }, { needs: 'fixtures' });

    await step('tasks-other-actions', 'Other actions on the Tasks tab offers Create GitHub issues', async () => {
        await clear();
        await (await row('Specs', 'Demo — Tasked')).click();
        await webview().locator('.step-tab', { hasText: 'Tasks' }).click();
        await webview().locator('footer.actions button', { hasText: 'Other actions' }).click();
        const menu = await expectText(webview().locator('.action-menu'), /Create GitHub issues/);
        await capture('tasks-other-actions', { target: 'editor', ratio: 16 / 9, anchor: 'bottom' });
        await capture('other-actions-menu', { target: [webview().locator('.action-menu'), webview().locator('footer.actions')], padding: 16 });
        return menu;
    }, { needs: 'fixtures' });

    await step('create-issues-confirm', 'Create GitHub issues asks before it sends', async () => {
        await webview().locator('.action-menu button', { hasText: 'Create GitHub issues' }).click();
        const text = await expectText(page.locator('.monaco-dialog-box'), /Create a GitHub issue for every task/);
        await capture('create-issues-confirm', { target: page.locator('.monaco-dialog-box'), padding: 40 });
        return text.split('\n')[0];
    }, { needs: 'fixtures' });

    await step('create-issues-cancel', 'Cancel sends nothing', async () => {
        await page.locator('.monaco-dialog-box .monaco-button', { hasText: 'Cancel' }).click();
        await page.locator('.monaco-dialog-box').waitFor({ state: 'detached', timeout: 5000 });
    }, { needs: 'fixtures' });

    await step('converge-button', 'A finished spec offers Converge in the footer', async () => {
        await clear();
        await (await row('Specs', 'Completed')).click();
        await (await row('Specs', 'Bugs And Ideas Panes')).click();
        const button = await expectText(webview().locator('footer.actions button', { hasText: /^Converge$/ }), /Converge/);
        await capture('converge-footer', { target: 'editor', ratio: 16 / 9, anchor: 'bottom' });
        await capture('footer-converge', { target: webview().locator('footer.actions'), padding: 10 });
        return button;
    }, { needs: 'fixtures' });

    await step('converge-sends', 'Converge sends the command and names the spec', async () => {
        await webview().locator('footer.actions button', { hasText: /^Converge$/ }).click();
        const sent = await terminalText(/\[sent to assistant\].*converge/i);
        await capture('converge-terminal', { target: page.locator('.editor-group-container').last(), ratio: 16 / 9 });
        await capture('converge-sent', { target: 'editor', ratio: 16 / 9 });
        return sent;
    }, { needs: 'fixtures' });

    await step('joined-paragraph', 'A wrapped paragraph is one paragraph with one comment button', async () => {
        await clear();
        await (await row('Specs', 'Demo — Specified')).click();
        await webview().locator('.step-tab', { hasText: 'Specification' }).click();
        const joined = webview().locator('.line[data-line-end]');
        await joined.first().waitFor({ timeout: 15000 });
        if (SHOTS) {
            await scrollTo(joined, 'center');
            await joined.first().hover();
            await capture('joined-paragraph', { target: 'editor', ratio: 16 / 9, anchor: 'bottom', keepPointer: true });
        }
        return `${await joined.count()} joined paragraph(s)`;
    }, { needs: 'fixtures' });

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
    }, { needs: 'fixtures' });

    await step('report-header-line', 'A report tab opens with one line of facts, not a bullet list', async () => {
        await clear();
        await (await row('Bugs', 'cartTotal skips the first cart item')).click();
        await webview().locator('.step-tab', { hasText: 'Assessment' }).click();
        await webview().locator('.rp-lead').waitFor({ state: 'detached', timeout: 15000 });
        const line = await expectText(webview().locator('#markdown-content .rp-meta'), /Reported Oct 1, 2026 from pasted text · valid · high severity/);
        const body = await webview().locator('#markdown-content').innerText();
        if (/Slug\s*:/.test(body)) throw new Error('the slug bullet is still shown');
        await capture('report-header', { target: 'editor', ratio: 16 / 9 });
        return line;
    }, { needs: 'fixtures' });

    await step('answer-open-question', 'An open question has an Answer button', async () => {
        const question = webview().locator('.rp-question').first();
        await question.scrollIntoViewIfNeeded();
        await expectText(question.locator('.rp-question__badge'), /Needs an answer/);
        await question.locator('.rp-question__answer').click();
        await webview().locator('textarea').first().fill('No. The wrong totals never reached an order: checkout recomputes them on the server.');
        if (SHOTS) {
            await scrollTo(webview().locator('.rp-question'), 'center');
            await capture('answer-open-question', { target: 'editor' });
        }
    }, { needs: 'fixtures' });

    await step('answer-sends', 'Send answer hands the answer to the assistant with the assess command', async () => {
        await webview().locator('button', { hasText: 'Send answer' }).click();
        await expectText(webview().locator('.rp-question__sent'), /Sent to your assistant/);
        return terminalText(/\[sent to assistant\].*speckit[-.]bug[-.]assess slug=cart-total-skips-first/);
    }, { needs: 'fixtures' });

    for (const tab of ['Overview', 'Specification', 'Plan', 'Tasks']) {
        await step(`shot-tab-${tab.toLowerCase()}`, `The ${tab} tab of the tasked demo spec is on screen`, async () => {
            await clear();
            await (await row('Specs', 'Demo — Tasked')).click();
            const entry = webview().locator(tab === 'Overview' ? '.rail-overview' : '.step-tab', { hasText: tab }).first();
            await entry.click();
            await webview().locator('[aria-current="page"]', { hasText: tab }).first().waitFor({ timeout: 15000 });
            await page.waitForTimeout(1200);
            await capture(`tab-${tab.toLowerCase()}`, { target: 'editor', ratio: 16 / 9 });
        }, { needs: 'fixtures', shots: true });
    }

    await step('overview-living-specs', 'A finished run names the living specs it updated and the ones it only read', async () => {
        await clear();
        const completed = await row('Specs', 'Completed');
        if ((await completed.getAttribute('aria-expanded')) === 'false') await completed.click();
        await (await row('Specs', 'Profile photo upload')).click();
        await webview().locator('.rail-overview').first().click();
        const groups = webview().locator('.living-specs-group');
        const updated = await expectText(groups.filter({ hasText: 'Updated by this run' }), /Member Profiles/);
        const read = await expectText(groups.filter({ hasText: 'Read for context' }), /Photo Storage/);
        if (SHOTS) {
            await page.waitForTimeout(1200);
            await scrollTo(webview().locator('.living-specs-groups'), 'center');
            await capture('overview-living-specs', { target: 'editor', ratio: 3 / 2 });
            await capture('overview-living-specs-window', { target: 'window' });
        }
        return `${updated}; ${read}`.replace(/\s+/g, ' ');
    }, { needs: 'fixtures' });

    await step('living-tree', 'The Living Specs pane groups capabilities by folder, with coverage and drift on each row', async () => {
        await clear();
        await showLivingSpecs();
        await expectText(await row('Living Specs', 'Capabilities'), /1 drifted/);
        await expectText(await row('Living Specs', 'Member Profiles'), /9\/9 covered/);
        await expectText(await row('Living Specs', 'Photo Storage'), /7\/9 covered · drift/);
        await expectText(await row('Living Specs', 'Team Invites'), /4\/4 covered/);
        await expectText(await row('Living Specs', 'Directory Search'), /6\/6 covered/);
        await expectText(await row('Living Specs', 'Avatar Rendering'), /no coverage file · drift/);
        const rows = pane('Living Specs').locator('.monaco-list-row');
        if (SHOTS) {
            // The selected row is the one in drift, so its Update button is in the picture.
            await (await row('Living Specs', 'Photo Storage')).click();
            const width = (await page.locator('.part.sidebar').boundingBox()).width;
            await sidebarWidth(460);
            await capture('living-specs-pane', { target: [pane('Living Specs').locator('.pane-header'), rows.last()] });
            await sidebarWidth(width);
        }
        return (await rows.locator('.label-name').allInnerTexts()).join(', ');
    }, { needs: 'fixtures' });

    await step('living-spec', 'A capability opens as a page: its counts, the paths it covers, and each requirement with its scenario', async () => {
        await openLivingSpec('Photo Storage', /7\/9 covered/);
        const facts = await expectText(webview().locator('.spec-header-living'), /9 requirements[\s\S]*9 scenarios[\s\S]*7\/9 covered/);
        await expectText(webview().locator('.spec-header-covers'), /src\/services\/photoStorage\/\*\*/);
        await expectText(webview().locator('.spec-header-path'), /^capabilities\/photo-storage\/photo-storage\.spec\.md$/);
        const first = webview().locator('.living-req-card').first();
        await expectText(first, /WHEN[\s\S]*the upload of the new original completes[\s\S]*THEN/);
        await capture('living-spec', { target: 'editor', ratio: 16 / 9 });
        if (SHOTS) {
            // Wide enough for the longest row's labels.
            const width = (await page.locator('.part.sidebar').boundingBox()).width;
            await sidebarWidth(LIVING_SIDEBAR);
            // Lowered so the floating action bar lands between two requirements, not across a title.
            await scrollTo(webview().locator('#markdown-content :is(h2, h3)', { hasText: 'Requirements' }), 'start', 76);
            await capture('living-spec-requirement', { target: 'editor', ratio: 16 / 9 });
            await capture('living-specs-window', { target: 'window' });
            await sidebarWidth(width);
        }
        return facts.replace(/\s+/g, ' ');
    }, { needs: 'fixtures' });

    await step('living-spec-colocated', 'A spec kept beside its code says so, and opens from the same pane', async () => {
        await openLivingSpec('Directory Search', /6\/6 covered/);
        await expectText(webview().locator('.spec-header-location'), /Lives beside the code[\s\S]*src\/features\/directory-search\/directory-search\.spec\.md/i);
        await capture('living-spec-colocated', { target: 'editor', ratio: 16 / 9 });
    }, { needs: 'fixtures' });

    await step('living-drift', 'Code changed after the spec was committed marks the capability and the requirement that names the file', async () => {
        await openLivingSpec('Photo Storage', /1 drifted/);
        const drifted = webview().locator('.living-req-card[data-req-state="drifted"]');
        await drifted.first().waitFor({ timeout: 15000 });
        const names = await drifted.evaluateAll(cards => cards.map(card => card.dataset.req));
        if (names.length !== 1 || names[0] !== DRIFTED_REQUIREMENT) throw new Error(`expected only "${DRIFTED_REQUIREMENT}" drifted, saw ${JSON.stringify(names)}`);
        const why = await expectText(drifted.locator('.living-req-meta'), /Drifted[\s\S]*changed since the spec was last updated/);
        const update = (await row('Living Specs', 'Photo Storage')).locator('a.action-label[aria-label^="Update"]');
        if (!(await update.count())) throw new Error('the drifted row has no Update button');
        if (SHOTS) {
            const width = (await page.locator('.part.sidebar').boundingBox()).width;
            await sidebarWidth(LIVING_SIDEBAR);
            await scrollTo(drifted, 'start', 16);
            await capture('living-spec-drifted', { target: 'editor', ratio: 16 / 9 });
            await capture('living-drift-window', { target: 'window' });
            await sidebarWidth(width);
        }
        return why.replace(/\s+/g, ' ');
    }, { needs: 'fixtures' });

    if (!SANDBOX) {
        await clear();
        await setPanes(['Living Specs'], false);
        await setPanes(['Specs', 'Bugs', 'Ideas'], true);
    }

    // One spec walked through a run, a step at a time: each state is the picture on that step's docs page.
    const WALK = [
        { state: 'specified', tab: 'Specification', footer: /Next: Plan/, crop: 'footer-next-plan', page: 'step-specify' },
        { state: 'planned', tab: 'Plan', footer: /Next: Tasks/, crop: 'footer-next-tasks', page: 'step-plan' },
        { state: 'tasked', tab: 'Tasks', footer: /Next: Implement/, crop: 'footer-next-implement', page: 'step-tasks' },
        { state: 'implementing', tab: 'Tasks', footer: /Step running/, crop: 'footer-step-running', page: 'step-implement' },
    ];
    const walkFolder = join(built.project, 'specs', '042-profile-photo-upload');
    const openWalk = async (state, tab, options) => {
        await clear();
        writeTeamboardRun(EXTENSION, walkFolder, state, options);
        await page.waitForTimeout(2500);
        await (await row('Specs', 'Profile photo upload')).click();
        const entry = webview().locator('.step-tab', { hasText: tab }).first();
        await entry.click();
        await webview().locator('[aria-current="page"]', { hasText: tab }).first().waitFor({ timeout: 15000 });
        await page.waitForTimeout(1500);
    };
    for (const { state, tab, footer, crop, page: name } of WALK) {
        await step(`shot-${name}`, `A run at ${state} shows its ${tab} tab and what the footer offers next`, async () => {
            await openWalk(state, tab);
            await capture(`${name}-window`, { target: 'window' });
            await capture(name, { target: 'editor', ratio: 16 / 9 });
            await capture(`${name}-foot`, { target: 'editor', ratio: 16 / 9, anchor: 'bottom' });
            const text = await expectText(webview().locator('footer.actions'), footer);
            await capture(crop, { target: webview().locator('footer.actions'), padding: 10 });
            return text.replace(/\s+/g, ' ');
        }, { needs: 'fixtures', shots: true });
    }

    await step('shot-review-comments', 'A spec with one pending and one applied comment shows both cards and Refine (1) in the footer', async () => {
        const at = new Date(Date.now() - 60000).toISOString();
        const comment = (id, line, blockText, text, status) => ({ id, doc: 'spec', anchor: { heading: 'Why this exists', blockText, line }, comment: text, status, createdAt: at });
        await openWalk('specified', 'Specification', { comments: [
            comment('ref-walk-1', 9, 'Teamboard shows a grey placeholder where every face should be.', 'Say where: the directory, the profile page, or both.', 'applied'),
            comment('ref-walk-2', 11, 'Members want to put their own photo there, without filing a ticket.', 'Name who approves a photo, or say nobody does.', 'pending'),
        ] });
        await capture('review-comments-window', { target: 'window' });
        await capture('review-comments', { target: 'editor', ratio: 16 / 9 });
        const text = await expectText(webview().locator('#refine-submit-btn'), /Refine \(1\)/);
        await capture('footer-refine', { target: webview().locator('footer.actions'), padding: 10 });
        return text;
    }, { needs: 'fixtures', shots: true });

    await step('shot-new-spec', 'New Spec opens the create screen with the workflow, the brief, and Auto beside Create Spec', async () => {
        await clear();
        await pane('Specs').locator('.pane-header').hover();
        await pane('Specs').locator('.pane-header a.action-label[aria-label^="New Spec"]').click();
        await webview().locator('#specContent').waitFor({ timeout: 15000 });
        await webview().locator('#specContent').fill('Let a member upload a profile photo from their own profile page, and reject a file that is too large with the reason.');
        await page.waitForTimeout(800);
        await capture('new-spec-window', { target: 'window' });
        await capture('new-spec', { target: 'editor', ratio: 16 / 9 });
        const actions = webview().locator('footer.spec-editor-actions');
        const text = await expectText(actions, /Create Spec/);
        await capture('new-spec-actions', { target: actions, padding: 10 });
        return text.replace(/\s+/g, ' ');
    }, { needs: 'fixtures', shots: true });

    await step('shot-steering-constitution', 'With a written constitution, the Steering view lists it under SpecKit Project Files', async () => {
        await clear();
        const settings = join(built.user, 'User', 'settings.json');
        const before = readFileSync(settings, 'utf8');
        mkdirSync(join(built.project, '.specify', 'memory'), { recursive: true });
        writeFileSync(join(built.project, '.specify', 'memory', 'constitution.md'), [
            '# Teamboard Constitution', '', '## Core Principles', '',
            '### I. Tests come first', 'Every change ships with a test that fails without it.', '',
            '### II. Keep it simple', 'No new dependency when the standard library does the job.', '',
            '### III. Never lose a member\'s data', 'A write that replaces something keeps the old copy until the new one is confirmed.', '',
            '## Governance', '', 'A plan that breaks a principle says so and says why.', '',
            '**Version**: 1.0.0 | **Ratified**: 2026-05-12', '',
        ].join('\n'));
        writeFileSync(settings, JSON.stringify({ ...JSON.parse(before), 'speckit.views.steering.visible': true }, null, 2));
        try {
            await pane('Steering').waitFor({ timeout: 15000 });
            await setPanes(['Specs', 'Bugs', 'Ideas'], false);
            await setPanes(['Steering'], true);
            const constitution = await row('Steering', 'Constitution');
            await constitution.click();
            await page.waitForTimeout(1200);
            await capture('steering-constitution-window', { target: 'window' });
            await capture('steering-constitution', { target: [pane('Steering').locator('.pane-header'), pane('Steering').locator('.monaco-list-row').last()] });
            return (await pane('Steering').locator('.monaco-list-row .label-name').allInnerTexts()).join(', ');
        } finally {
            writeFileSync(settings, before);
            await page.waitForTimeout(800);
            await setPanes(['Specs', 'Bugs', 'Ideas'], true).catch(() => undefined);
        }
    }, { needs: 'fixtures', shots: true });

    await step('shot-settings', 'Settings filtered to the extension lists its settings, and speckit.aiProvider opens as one dropdown', async () => {
        await clear();
        // The picture shows the defaults, so the one setting this run turned off is put back while Settings is open.
        const settings = join(built.user, 'User', 'settings.json');
        const before = readFileSync(settings, 'utf8');
        const { 'speckit.notifications.stepComplete': _off, ...defaults } = JSON.parse(before);
        writeFileSync(settings, JSON.stringify(defaults, null, 2));
        await command('View: Toggle Primary Side Bar Visibility');
        try {
            await command('Preferences: Open Settings (UI)');
            const editor = page.locator('.settings-editor');
            await editor.locator('.setting-item-contents').first().waitFor({ timeout: 15000 });
            const search = async (query) => {
                await editor.locator('.suggest-input-container').first().click();
                await page.keyboard.press('ControlOrMeta+A');
                await page.keyboard.type(query);
                await page.waitForTimeout(2500);
            };
            await search('@ext:alfredoperez.speckit-companion');
            const provider = editor.locator('.setting-item-contents[data-key="speckit.aiProvider"]');
            await provider.first().waitFor({ timeout: 15000 });
            await capture('settings-list', { target: 'editor', ratio: 16 / 9 });
            await search('speckit.aiProvider');
            await provider.first().waitFor({ timeout: 15000 });
            await provider.first().locator('select').click();
            const list = page.locator('.monaco-select-box-dropdown-container');
            await list.first().waitFor({ timeout: 8000 });
            await page.waitForTimeout(600);
            await capture('settings-provider-window', { target: 'window', keepPointer: true });
            await capture('settings-provider', { target: [provider, list], padding: 16, keepPointer: true });
            const count = await list.locator('.monaco-list-row').count();
            await page.keyboard.press('Escape');
            return `${count} assistants in the dropdown`;
        } finally {
            await page.keyboard.press('Escape').catch(() => undefined);
            await command('View: Toggle Primary Side Bar Visibility');
            writeFileSync(settings, before);
        }
    }, { shots: true });

    await step('specs-pane', 'The sidebar shows the Specs pane', async () => {
        await clear();
        await pane('Specs').waitFor({ timeout: 15000 });
        await pane('Specs').locator('.monaco-list-row').first().waitFor({ timeout: 15000 });
        return `${await pane('Specs').locator('.monaco-list-row').count()} row(s)`;
    });

    let tabs = [];
    await step('first-spec', 'The first spec opens in the viewer', async () => {
        const specs = pane('Specs').locator('.monaco-list-row[aria-level="2"]');
        if (!(await specs.count())) {
            await pane('Specs').locator('.monaco-list-row[aria-level="1"][aria-expanded="false"]').first().click();
        }
        await specs.first().waitFor({ timeout: 15000 });
        const name = (await specs.first().locator('.label-name').first().innerText()).trim();
        await specs.first().click();
        await webview().locator('.step-tab').first().waitFor({ timeout: 15000 });
        tabs = await webview().locator('.step-tab:not([disabled]) .step-label').allInnerTexts();
        return `${name}: ${tabs.join(', ')}`;
    });

    let lastText = '';
    for (const tab of tabs) {
        const slug = tab.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await step(`doc-${slug}`, `The ${tab.trim()} tab renders without an error`, async () => {
            await webview().locator('.step-tab', { has: webview().locator(`.step-label:text-is("${tab.trim()}")`) }).first().click();
            const area = webview().locator('#content-area');
            await webview().locator('.step-tab[aria-current="page"]', { hasText: tab.trim() }).waitFor({ timeout: 15000 });
            // The tab turns current before its document arrives, so wait for the page to stop showing the last one.
            let text = '';
            for (let tries = 0; tries < 30; tries++) {
                text = (await area.locator('#markdown-content').innerText()).trim();
                if (text && (text !== lastText || tries >= 10)) break;
                await page.waitForTimeout(500);
            }
            lastText = text;
            const broken = area.locator('.empty-state:visible, .activity-error:visible');
            if (await broken.count()) throw new Error(`the page says "${(await broken.first().innerText()).trim().slice(0, 80)}"`);
            if (!text) throw new Error('the page is blank');
            return `${text.length} characters`;
        });
    }
} finally {
    writeFileSync(join(OUT, `results.${THEME}.json`), JSON.stringify(results, null, 2));
    await app.close().catch(() => undefined);
    rmSync(root, { recursive: true, force: true });
}

if (SHEET) {
    for (const dir of [OUT, SHOTS].filter(Boolean)) {
        try {
            execFileSync(process.execPath, [join(HERE, 'shots-sheet.mjs'), dir], { stdio: 'inherit' });
        } catch {
            console.error(`No sheet for ${dir}`);
        }
    }
}

const failed = results.filter(result => !result.ok);
const skipped = results.filter(result => result.skipped);
const ran = results.length - skipped.length;
console.log(`\n${ran - failed.length} of ${ran} steps passed${skipped.length ? `, ${skipped.length} skipped` : ''}. Screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);
