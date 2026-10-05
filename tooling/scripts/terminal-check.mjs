#!/usr/bin/env node
// Drives a real Claude Code session in tmux with the SpecKit Companion mod and a throwaway Spec Kit project, and saves the screen as text and as a picture per step.
// usage: node tooling/scripts/terminal-check.mjs [--mode replay|run] [--recipe claude-mod-stock|claude-mod] [--look plain|site] [--out <dir>] [--only <step,step>] [--keep]
import { execFile, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { LOOKS, gridHtml, gridText, parseAnsi } from './lib/terminal/ansi.mjs';
import { bandRow, dialog, focusedControl, isWorking, paneHasKeyboard, paneRows, paneText, promptBox } from './lib/terminal/screen.mjs';
import { outsideEnv, sleep, startSession } from './lib/terminal/tmux.mjs';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > -1 ? process.argv[at + 1] : fallback;
};
const MODE = arg('mode', 'replay');
const RECIPE = arg('recipe', 'claude-mod-stock');
const OUT = resolve(arg('out', join(REPO, '.terminal-check', `${RECIPE}-${MODE}`)));
const ONLY = arg('only', '').split(',').filter(Boolean);
const KEEP = process.argv.includes('--keep');
// How the pictures are drawn; what a step reads off the screen is the same in every look.
const LOOK = arg('look', 'plain');
const WINDOW_TITLE = 'claude — speckit-tracker';
const COLS = 200;
const ROWS = 50;
const STEP_TIMEOUT_MS = 15 * 60 * 1000;
const FEATURE = 'Let me clear all completed todos with one button';
const DEMOS = ['_02_demo-tasked', '_03_demo-living'];
const RECIPES = {
    'claude-mod-stock': { companion: false, prefix: '/speckit-' },
    'claude-mod': { companion: true, prefix: '/speckit-companion-' },
};

const fail = (message) => {
    console.error(message);
    process.exit(2);
};
if (!RECIPES[RECIPE]) fail(`Unknown --recipe "${RECIPE}". Use claude-mod-stock or claude-mod.`);
if (!Object.hasOwn(LOOKS, LOOK)) fail(`Unknown --look "${LOOK}". Use ${Object.keys(LOOKS).join(' or ')}.`);
if (!['replay', 'run'].includes(MODE)) fail(`Unknown --mode "${MODE}". Use replay or run.`);
for (const [bin, flag] of [['tmux', '-V'], ['claude', '--version']]) {
    try {
        execFileSync(bin, [flag], { stdio: 'ignore' });
    } catch {
        fail(`${bin} is not on PATH. The terminal check needs tmux and the claude CLI.`);
    }
}

const require = createRequire(join(REPO, 'package.json'));
const { chromium } = require('playwright-core');

/** What a Spec Kit run needs inside the throwaway project, and nothing outside it. */
function settingsFor(project) {
    const scripts = ['.specify/scripts/bash/', './.specify/scripts/bash/', `${project}/.specify/scripts/bash/`];
    const capture = ['.specify/extensions/companion/scripts/', `${project}/.specify/extensions/companion/scripts/`];
    return {
        permissions: {
            defaultMode: 'acceptEdits',
            allow: [
                'Edit(/**)',
                'Skill(speckit-*)',
                ...scripts.flatMap(path => [`Bash(${path}*)`, `Bash(bash ${path}*)`]),
                ...capture.map(path => `Bash(python3 ${path}*)`),
                'Bash(python3 --version)',
                'Bash(git status *)',
                'Bash(git branch *)',
                'Bash(git checkout -b *)',
                'Bash(git switch -c *)',
                'Bash(git add *)',
                'Bash(git commit *)',
                'Bash(node --test *)',
                'Bash(node --check *)',
                'Bash(npm test *)',
                'Bash(npm run test *)',
                // A machine with the rtk hook has these commands rewritten to go through it.
                ...['ls', 'read', 'grep', 'find', 'git status', 'git branch', 'git add', 'git commit', 'npm test', 'test'].map(command => `Bash(rtk ${command} *)`),
            ],
        },
    };
}

async function buildProject() {
    const root = mkdtempSync(join(tmpdir(), 'speckit-terminal-'));
    const { stdout } = await run('bash', ['-c', '. .claude/sandboxes-env.sh && echo "$SANDBOXES_REPO"'], { cwd: REPO });
    const sandboxes = stdout.trim().split('\n').at(-1);
    const setup = join(sandboxes, 'recipes', RECIPE, 'setup.sh');
    if (!existsSync(setup)) throw new Error(`no recipe at ${setup}`);
    await run(setup, [join(root, 'project')], { env: outsideEnv(), maxBuffer: 16 << 20 });
    // The resolved path is the one Claude Code shows and the one an absolute allow rule has to name.
    const project = realpathSync(join(root, 'project'));
    if (MODE === 'replay') {
        for (const demo of DEMOS) {
            cpSync(join(REPO, 'specs', demo), join(project, 'specs', demo), { recursive: true });
            if (!RECIPES[RECIPE].companion) rmSync(join(project, 'specs', demo, '.spec-context.json'), { force: true });
        }
    }
    mkdirSync(join(project, '.claude'), { recursive: true });
    writeFileSync(join(project, '.claude', 'settings.json'), JSON.stringify(settingsFor(project), null, 2));
    // A stand-in `code` that only writes down what it was asked to open, so no editor window opens during the check.
    mkdirSync(join(root, 'bin'));
    writeFileSync(join(root, 'bin', 'code'), `#!/bin/sh\necho "$@" >> "${join(root, 'editor.log')}"\n`);
    chmodSync(join(root, 'bin', 'code'), 0o755);
    return { root, project };
}

const results = [];
const findings = [];
let session;
let browser;
let page;
let current = 'start';
let specNames = MODE === 'replay' ? DEMOS : [];

async function render(html, file) {
    browser ??= await chromium.launch({ channel: 'chrome' });
    page ??= await browser.newPage({ deviceScaleFactor: 2, viewport: LOOK === 'plain' ? { width: 1800, height: 1000 } : { width: 2200, height: 1400 } });
    await page.setContent(html);
    // The site look leaves the margin around its frame transparent, so the shadow falls on whatever page the picture sits on.
    await page.locator('#screen').screenshot({ path: file, omitBackground: LOOK !== 'plain' });
    return file;
}

/** The whole screen as text and as a picture, plus the band line and the pane on their own. */
async function shot(name) {
    const grid = parseAnsi(await session.capture());
    writeFileSync(join(OUT, `${name}.txt`), gridText(grid) + '\n');
    const pane = paneRows(grid);
    const file = await render(gridHtml(grid, { to: COLS, look: LOOK, title: WINDOW_TITLE, pane }), join(OUT, `${name}.png`));
    const band = bandRow(grid, specNames);
    const crop = { look: LOOK, frame: 'card' };
    if (band) await render(gridHtml(grid, { ...crop, to: pane?.col ?? COLS, rowFrom: band.row, rowTo: band.row + 1 }), join(OUT, `${name}.band.png`));
    if (pane) {
        const used = pane.lines.findLastIndex(line => line.trim()) + 2;
        await render(gridHtml(grid, { ...crop, from: pane.col + 1, to: COLS, rowFrom: pane.top, rowTo: Math.min(pane.bottom, pane.top + used) }), join(OUT, `${name}.pane.png`));
    }
    return file;
}

/** Answers a dialog so nothing waits for a person: trust the throwaway folder, allow one command once, take a question's first option. */
async function answer(found, grid) {
    const at = found.options.findIndex(o => o.selected);
    if (found.kind === 'trust') {
        const yes = found.options.findIndex(o => o.label === 'Yes, I trust this folder');
        for (let i = at; i !== yes; i += Math.sign(yes - at)) await session.keys(yes > at ? 'Down' : 'Up');
        await session.keys('Enter');
        return;
    }
    const n = findings.length + 1;
    writeFileSync(join(OUT, `prompt-${n}.txt`), gridText(grid) + '\n');
    await render(gridHtml(grid, { to: COLS, look: LOOK, title: WINDOW_TITLE }), join(OUT, `prompt-${n}.png`)).catch(() => undefined);
    if (found.kind === 'permission') {
        const offered = found.options.find(o => /don.t ask again/.test(o.label))?.label.replace(/^.*?don.t ask again for:?\s*/, '') ?? null;
        findings.push({ step: current, kind: 'needs an allow rule', tool: found.title, asked: found.asked.slice(0, 600), why: found.why, offered, shot: `prompt-${n}.png` });
        console.log(`     permission prompt during ${current}: ${found.title}: ${found.asked.slice(0, 160)}`);
        // Option 1 is "Yes", this time only; the options that save a rule or change the mode are never taken.
        await session.keys(found.options[at].label === 'Yes' ? 'Enter' : '1');
        return;
    }
    findings.push({ step: current, kind: 'asked a question', asked: found.asked, answered: found.options[at].label, shot: `prompt-${n}.png` });
    console.log(`     question during ${current}: ${found.asked.slice(0, 160)} (answered "${found.options[at].label}")`);
    await session.keys('Enter');
}

/** The screen as a grid, after answering whatever dialog was on it. */
async function look() {
    for (let tries = 0; tries < 20; tries++) {
        const grid = parseAnsi(await session.capture());
        const found = dialog(grid);
        if (!found) return grid;
        await answer(found, grid);
        await sleep(1200);
    }
    throw new Error('a dialog would not go away');
}

async function waitFor(what, test, timeout = 15000) {
    const until = Date.now() + timeout;
    let grid;
    for (;;) {
        grid = await look();
        const value = test(grid);
        if (value) return value;
        if (Date.now() > until) break;
        await sleep(400);
    }
    const pane = paneText(grid).split('\n').slice(0, 14).join(' / ');
    throw new Error(`${what}. The band read "${bandRow(grid, specNames)?.text ?? ''}" and the pane read "${pane}"`);
}

// The tab in view carries a ▸ marker, and section headings are drawn in capitals.
const TABS = /1: Run\s+▸?2: Overview\s+▸?3: Specs/;
const pane = grid => paneText(grid);
const band = grid => bandRow(grid, specNames)?.text ?? '';
const paneShows = (pattern, what, timeout) => waitFor(what ?? `the pane never showed ${pattern}`, grid => pane(grid).match(pattern)?.[0], timeout);
const bandShows = (pattern, what, timeout) => waitFor(what ?? `the band never showed ${pattern}`, grid => band(grid).match(pattern)?.[0], timeout);

// Keys that worked in Claude Code 2.1.289 at 200 columns:
//   Ctrl+X then Tab moves the keyboard from the prompt into the pane; /speckit-tracker does the same as it opens the pane.
//   The pane's border turns from dim to the accent colour while it has the keyboard, which is how paneHasKeyboard() tells.
//   In the pane, Down and Tab walk the controls in drawing order (1: Run, 2: Overview, 3: Specs, then each step and document), Up walks back.
//   The focused control is drawn in reverse video, which is how focusedControl() finds it; right after a redraw no control has it.
//   1, 2, 3 and b are hotkeys and work from any control in the pane; Enter presses the focused one; Esc gives the keyboard back to the prompt.
//   A key the pane has no control for is typed into the prompt and takes the keyboard there with it.
async function toPrompt() {
    for (let tries = 0; tries < 3; tries++) {
        if (!paneHasKeyboard(await look())) break;
        await session.keys('Escape');
        await sleep(400);
    }
    if (promptBox(await look())?.text) await session.keys('C-u');
}

async function toPane() {
    if (paneHasKeyboard(await look())) return;
    await toPrompt();
    await session.keys('C-x', 'Tab');
    await waitFor('Ctrl+X then Tab did not move the keyboard into the pane', paneHasKeyboard, 5000);
}

async function focusOn(label) {
    await toPane();
    for (let presses = 0; presses < 60; presses++) {
        if (focusedControl(await look()) === label) return;
        await session.keys(presses < 20 ? 'Down' : 'Up');
        await sleep(150);
    }
    throw new Error(`no control named "${label}" took the focus`);
}

async function slash(command) {
    await toPrompt();
    await session.type(command);
    await sleep(500);
    await session.keys('Enter');
}

/** Waits for a turn to end: the spinner gone and the prompt empty for 8 seconds in a row, after the turn was seen to start. */
async function turnEnds(name) {
    const started = Date.now();
    let seenWorking = false;
    let quietSince = null;
    let running = false;
    for (;;) {
        if (!(await session.alive())) throw new Error('Claude Code exited');
        const grid = await look();
        const working = isWorking(grid);
        seenWorking ||= working;
        const idle = !working && promptBox(grid)?.text === '';
        quietSince = idle ? (quietSince ?? Date.now()) : null;
        if (working && !running && Date.now() - started > 30000) {
            running = true;
            await shot(`${name}.running`).catch(() => undefined);
        }
        if (quietSince && Date.now() - quietSince >= 8000 && (seenWorking || Date.now() - started > 45000)) return Math.round((Date.now() - started) / 1000);
        if (Date.now() - started > STEP_TIMEOUT_MS) {
            throw new Error(`the turn was still running after 15 minutes. The last lines read "${gridText(grid).split('\n').filter(l => l.trim()).slice(-8).join(' / ').slice(0, 600)}"`);
        }
        await sleep(1000);
    }
}

/** `needs` marks a step that holds only with a run record ('record') or only without one ('files'). */
async function step(name, what, body, { needs } = {}) {
    if (ONLY.length && !ONLY.includes(name)) return;
    const recorded = RECIPES[RECIPE].companion;
    if (needs && (needs === 'record') !== recorded) {
        const note = `skipped: needs a project ${needs === 'record' ? 'with' : 'without'} a run record`;
        results.push({ name, what, ok: true, skipped: true, note });
        console.log(`skip ${name}: ${what} (${note})`);
        return;
    }
    current = name;
    const result = { name, what, ok: false };
    const started = Date.now();
    const before = findings.length;
    try {
        result.note = (await body()) ?? '';
        result.ok = true;
    } catch (error) {
        result.note = String(error?.message ?? error).split('\n')[0];
    }
    result.seconds = Math.round((Date.now() - started) / 1000);
    result.prompts = findings.slice(before);
    result.shot = await shot(name).catch(() => undefined);
    results.push(result);
    console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${name}: ${what}${result.note ? ` (${result.note})` : ''}${MODE === 'run' ? ` [${result.seconds}s]` : ''}`);
    return result.ok;
}

const firstHeading = file => readFileSync(file, 'utf8').split('\n').find(line => line.startsWith('# ')).replace(/^#\s+/, '');
const specFolders = project => (existsSync(join(project, 'specs')) ? readdirSync(join(project, 'specs'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name) : []);

async function replaySteps(project, root) {
    let first = '';
    await step('band', 'The band above the prompt names a spec', async () => {
        const text = await bandShows(/^_0\d_demo-\w+ · .+/, 'no band line that starts with a spec name', 20000);
        first = bandRow(await look(), specNames).name;
        return text;
    });

    await step('pane-docked', 'In a 200-column terminal the pane opens beside the transcript by itself', async () => {
        await paneShows(TABS, 'no pane with the three tabs beside the transcript');
        return `left border at column ${paneRows(await look()).col}`;
    });

    await step('tracker-opens', '/speckit-tracker opens the pane on its Specs tab with the spec list', async () => {
        await slash('/speckit-tracker');
        await paneShows(/Pick the spec this pane and the band follow\./);
        for (const demo of DEMOS) await paneShows(new RegExp(`^${demo} · `, 'm'), `the spec list has no ${demo}`);
        await waitFor('the pane did not take the keyboard', paneHasKeyboard, 5000);
        return 'the pane has the keyboard';
    });

    const other = DEMOS.find(demo => demo !== first) ?? DEMOS[1];
    await step('tracker-name', '/speckit-tracker <name> follows that spec', async () => {
        const query = other.replace(/^_\d+_/, '');
        await slash(`/speckit-tracker ${query}`);
        return bandShows(new RegExp(`^${other}\\b.*`), `the band did not move to ${other}`);
    });

    await step('tracker-auto', '/speckit-tracker auto goes back to the most recently active spec', async () => {
        await slash('/speckit-tracker auto');
        return bandShows(new RegExp(`^${first}\\b.*`), `the band did not go back to ${first}`);
    });

    await step('tab-run', 'Pressing 1 shows the Run tab: the four steps and the Documents block', async () => {
        await slash('/speckit-tracker demo-tasked');
        await bandShows(/^_02_demo-tasked\b/);
        await toPane();
        await session.keys('1');
        for (const label of ['Specify', 'Plan', 'Tasks', 'Implement']) await paneShows(new RegExp(`^[✓●○] ${label}\\b`, 'm'), `the Run tab has no ${label} step`);
        await paneShows(/^DOCUMENTS$/m, 'the Run tab has no Documents heading');
        await paneShows(/^[✓●○] Plan\b.*↵ read$/m, 'the Plan step does not say Enter reads it');
        await paneShows(/^plan\b.*↵ read$/m, 'the plan document does not say Enter reads it');
        await paneShows(/↵\s+Read\s+o\s+Editor/, 'the foot of the pane does not list Enter and o');
        return paneShows(/^Phase 1.*\d+\/\d+$/m, 'the Run tab has no task phase with a count');
    });

    await step('steps-written', 'Without a run record each step says when its file was written, and a footnote says nothing was recorded', async () => {
        for (const label of ['Specify', 'Plan', 'Tasks']) await paneShows(new RegExp(`^✓ ${label}\\s+written \\d+:\\d\\d [AP]M`, 'm'), `${label} does not read "written <time>"`);
        await paneShows(/Nothing recorded this run\./);
        return paneShows(/^✓ Plan\s+written.*$/m);
    }, { needs: 'files' });

    await step('steps-timed', 'With a run record each finished step shows its measured time', async () => {
        for (const label of ['Specify', 'Plan', 'Tasks']) await paneShows(new RegExp(`^✓ ${label}\\s+\\d+[smh]`, 'm'), `${label} shows no measured time`);
        if (/written \d+:\d\d/.test(pane(await look()))) throw new Error('a recorded step shows a file time');
        return paneShows(/^Timing coverage: .*$/m);
    }, { needs: 'record' });

    await step('tab-overview', 'Pressing 2 shows the Overview tab', async () => {
        await toPane();
        await session.keys('2');
        const heading = await paneShows(/^(USER STORIES|INTENT|REQUIREMENTS.*|FUNCTIONAL REQUIREMENTS.*|PLAN SUMMARY|The run record has no overview details yet\.|Workflow: .*|Size: .*|From the spec files\..*)$/m, 'the Overview tab shows none of its headings or facts');
        if (/^[✓●○] Specify\b/m.test(pane(await look()))) throw new Error('the Run tab is still showing');
        return `shows "${heading}"`;
    });

    await step('overview-from-files', 'Without a run record the Overview is the spec\'s own summary and says it comes from the files', async () => {
        const spec = readFileSync(join(project, 'specs', '_02_demo-tasked', 'spec.md'), 'utf8');
        const summary = spec.split(/^## Summary\n+/m)[1].split('\n')[0].trim();
        await waitFor(`the Overview does not show the spec's summary "${summary}"`, grid => pane(grid).includes(summary));
        await paneShows(/From the spec files\./);
        return summary;
    }, { needs: 'files' });

    await step('overview-recorded', 'A recorded intent shows under Intent on the Overview tab', async () => {
        await slash('/speckit-tracker demo-living');
        await bandShows(/^_03_demo-living\b/);
        await toPane();
        await session.keys('2');
        await paneShows(/^INTENT$/m, 'the Overview has no Intent heading');
        return paneShows(/Demo fixture: a completed spec.*/);
    }, { needs: 'record' });

    await step('tab-specs', 'Pressing 3 shows the Specs tab with both specs', async () => {
        await toPane();
        await session.keys('3');
        await paneShows(/^Follow the latest/m);
        for (const demo of DEMOS) await paneShows(new RegExp(`^${demo} · `, 'm'), `the spec list has no ${demo}`);
        const lines = pane(await look()).split('\n');
        return `${lines.slice(lines.findIndex(line => line.startsWith('Follow the latest'))).filter(line => /^_\d+_demo/.test(line)).length} specs listed`;
    });

    const heading = firstHeading(join(project, 'specs', '_02_demo-tasked', 'plan.md'));
    await step('open-plan', 'Pressing the Plan step opens plan.md inside the pane', async () => {
        await slash('/speckit-tracker demo-tasked');
        await bandShows(/^_02_demo-tasked\b/);
        await focusOn('Plan');
        await session.keys('Enter');
        await paneShows(/^specs\/_02_demo-tasked\/plan\.md$/m, 'the first line does not name plan.md');
        await paneShows(/^b: Back\s+o: Open in editor$/m, 'no Back and Open in editor controls');
        await waitFor(`the pane does not show the plan's first heading "${heading}"`, grid => pane(grid).includes(heading));
        return heading;
    });

    await step('back', 'b goes back to the Run tab', async () => {
        await session.keys('b');
        await paneShows(/^[✓●○] Plan\b.*$/m, 'the steps did not come back');
        if (pane(await look()).includes('b: Back')) throw new Error('the document is still open');
    });

    await step('back-keeps-focus', 'After b the focus is on the step the document was opened from', async () => {
        await sleep(1000);
        const grid = await look();
        if (!paneHasKeyboard(grid)) throw new Error('the pane lost the keyboard');
        const focus = focusedControl(grid);
        if (focus !== 'Plan') throw new Error(focus ? `the focus is on "${focus}", not on Plan` : 'the pane has the keyboard but no control has the focus, so Enter does nothing and Down starts again from the first tab');
        return 'focus on "Plan"';
    });

    await step('open-editor', 'o opens the focused step\'s file with the editor command', async () => {
        await focusOn('Tasks');
        await session.keys('o');
        const log = join(root, 'editor.log');
        const file = join(project, 'specs', '_02_demo-tasked', 'tasks.md');
        await waitFor(`the editor command was not run with ${file}`, () => existsSync(log) && readFileSync(log, 'utf8').trim().split('\n').at(-1) === file, 8000);
        return `ran: code ${file.replace(project + '/', '')}`;
    });

    await step('escape', 'Esc gives the keyboard back to the prompt', async () => {
        await toPane();
        await session.keys('Escape');
        await waitFor('the pane still has the keyboard', grid => !paneHasKeyboard(grid), 5000);
        await session.type('x');
        const typed = await waitFor('a typed letter did not reach the prompt', grid => promptBox(grid)?.text, 5000);
        await session.keys('BSpace');
        return `the prompt took "${typed}"`;
    });

    await step('tick-task', 'Ticking a task in tasks.md from outside changes the count on screen within 10 seconds', async () => {
        await slash('/speckit-tracker demo-tasked');
        await paneShows(/^Phase 1.*\b0\/4$/m, 'the phase does not start at 0/4');
        const file = join(project, 'specs', '_02_demo-tasked', 'tasks.md');
        writeFileSync(file, readFileSync(file, 'utf8').replace('- [ ] **T001**', '- [x] **T001**'));
        const started = Date.now();
        const count = await paneShows(/^Phase 1.*\b1\/4$/m, 'the phase count did not move to 1/4 in 10 seconds', 10000);
        await paneShows(/^✓ T001\b/m, 'T001 is not ticked in the list', 3000);
        const text = await bandShows(/(Tasks|Implement) 1\/4.*/, 'the band did not count the ticked task', 5000);
        return `${count} after ${((Date.now() - started) / 1000).toFixed(1)}s; band: ${text}`;
    });
}

async function runSteps(project) {
    const { prefix, companion } = RECIPES[RECIPE];
    let folder = '';
    let folded = false;
    const stage = async (name, command, what, check) => step(name, what, async () => {
        await slash(command);
        await waitFor(`the prompt never showed ${command.split(' ')[0]} as sent`, grid => gridText(grid).includes(command.split(' ')[0]) && promptBox(grid)?.text === '', 20000);
        const seconds = await turnEnds(name);
        specNames = specFolders(project);
        return `${await check()} (turn took ${seconds}s)`;
    });
    const done = label => paneShows(new RegExp(`^✓ ${label}\\b.*$`, 'm'), `${label} is not marked done in the pane`, 20000);
    const next = async (stepName) => {
        const line = await paneShows(/^Next: \S+.*$/m, 'the pane names no next command', 20000);
        if (!line.includes(`-${stepName}`)) throw new Error(`the pane says "${line}", not the ${stepName} command`);
        return line;
    };

    let openedItself = true;
    await stage('specify', `${prefix}specify ${FEATURE}`, 'After specify the band names the new spec and the pane marks Specify done', async () => {
        [folder] = specFolders(project);
        if (!folder) throw new Error('no folder under specs/ after the turn');
        const text = await bandShows(new RegExp(`^${folder}\\b.*`), `the band does not name ${folder}`, 20000);
        openedItself = await waitFor('', grid => paneRows(grid) !== null, 5000).catch(() => false);
        if (!openedItself) {
            await shot('specify.no-pane');
            await slash(`/speckit-tracker ${folder}`);
            await waitFor('/speckit-tracker did not open the pane', grid => paneRows(grid) !== null);
        }
        const row = await done('Specify');
        if (!companion && !/written/.test(row)) throw new Error(`Specify reads "${row}", not "written <time>"`);
        folded = /Tasks \d+\/\d+/.test(text) || /^✓ Tasks\b/m.test(pane(await look()));
        return `band: ${text}; ${row}; ${folded ? 'plan and tasks came with specify' : await next('plan')}`;
    });
    if (!folder && !ONLY.length) return;

    await step('pane-opens-itself', 'When a session\'s first spec appears, the pane opens beside the transcript by itself', async () => {
        if (!openedItself) throw new Error(`the band followed ${folder} but no pane opened in a 200-column terminal until /speckit-tracker was run`);
    });

    await step('specify-overview', 'The Overview tab summarises the new spec', async () => {
        await toPane();
        await session.keys('2');
        return `shows "${await paneShows(/^(USER STORIES|INTENT)$/m, 'the Overview has neither User stories nor Intent')}"`;
    });
    if (paneHasKeyboard(await look())) await session.keys('1');
    await toPrompt();

    if (folded) {
        for (const name of ['plan', 'tasks']) {
            results.push({ name, what: `${name} ran inside specify`, ok: true, skipped: true, note: 'skipped: the run folded plan and tasks into specify' });
            console.log(`skip ${name}: the run folded plan and tasks into specify`);
        }
    } else {
        await stage('plan', `${prefix}plan`, 'After plan the pane marks Plan done and names the tasks command', async () => `band: ${await bandShows(/.+/)}; ${await done('Plan')}; ${await next('tasks')}`);
        await stage('tasks', `${prefix}tasks`, 'After tasks the pane marks Tasks done, lists the tasks and names the implement command', async () => {
            const row = await done('Tasks');
            const phase = await paneShows(/^.*\b0\/\d+$/m, 'no phase with an unticked task count', 20000);
            return `band: ${await bandShows(/.+/)}; ${row}; ${phase}; ${await next('implement')}`;
        });
    }

    await stage('implement', `${prefix}implement`, 'After implement the pane and the band count the ticked tasks as tasks.md has them', async () => {
        const tasks = readFileSync(join(project, 'specs', folder, 'tasks.md'), 'utf8');
        const total = (tasks.match(/^\s*- \[[ xX]\]/gm) ?? []).length;
        const ticked = (tasks.match(/^\s*- \[[xX]\]/gm) ?? []).length;
        if (!ticked) throw new Error(`the turn ticked none of the ${total} tasks in tasks.md`);
        const text = await bandShows(new RegExp(`\\b${ticked}/${total}\\b.*`), `the band does not count ${ticked}/${total}`, 20000);
        // A model may leave a task it cannot do, such as a manual walkthrough, so the step holds the mod to the file, not the model to the list.
        const row = ticked === total ? await done('Implement') : await paneShows(/^● Implement\b.*$/m, 'Implement is not marked as under way', 20000);
        if (!companion && !row.includes(`${ticked} of ${total} tasks`)) throw new Error(`Implement reads "${row}", not "${ticked} of ${total} tasks"`);
        return `band: ${text}; ${row}${ticked < total ? `; the model left ${total - ticked} task(s) unticked` : ''}`;
    });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
console.log(`Building a ${RECIPE} project...`);
const { root, project } = await buildProject();
const cleanUp = () => {
    if (!KEEP) rmSync(root, { recursive: true, force: true });
};
session = await startSession({
    name: `speckit-qa-${process.pid}`,
    cols: COLS,
    rows: ROWS,
    cwd: project,
    command: ['claude', '--plugin-dir', join(REPO, 'apps', 'claude-mod')],
    // The mod runs $VISUAL first, so the stand-in is what `o` opens with.
    env: { VISUAL: join(root, 'bin', 'code'), EDITOR: '' },
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
        session.killNow();
        cleanUp();
        process.exit(130);
    });
}
console.log(`Project: ${project}\nWatch it live: ${session.watch}\n`);

let started = false;
try {
    started = await step('start', 'Claude Code starts with the mod and reaches an empty prompt', async () => {
        const until = Date.now() + 90000;
        for (;;) {
            if (!(await session.alive())) throw new Error('Claude Code exited before it reached its prompt');
            const grid = await look();
            if (promptBox(grid)?.text === '' && /Claude Code v/.test(gridText(grid))) return gridText(grid).match(/Claude Code v[\d.]+/)[0];
            if (Date.now() > until) throw new Error(`no prompt after 90 seconds. The screen read "${gridText(grid).split('\n').filter(l => l.trim()).slice(0, 12).join(' / ').slice(0, 600)}"`);
            await sleep(500);
        }
    });
    if (started || ONLY.length) await (MODE === 'run' ? runSteps(project) : replaySteps(project, root));
} finally {
    writeFileSync(join(OUT, 'results.json'), JSON.stringify({ recipe: RECIPE, mode: MODE, results, findings }, null, 2));
    await session.kill();
    await browser?.close().catch(() => undefined);
    cleanUp();
}

for (const finding of findings) {
    console.log(finding.kind === 'needs an allow rule'
        ? `needs an allow rule (${finding.step}): ${finding.tool}: ${finding.asked.slice(0, 200)}${finding.why ? ` (${finding.why})` : ''}${finding.offered ? ` [Claude Code offered: ${finding.offered}]` : ''}`
        : `asked a question (${finding.step}): ${finding.asked.slice(0, 200)}`);
}
const failed = results.filter(result => !result.ok);
const skipped = results.filter(result => result.skipped);
const ran = results.length - skipped.length;
console.log(`\n${ran - failed.length} of ${ran} steps passed${skipped.length ? `, ${skipped.length} skipped` : ''}${findings.length ? `, ${findings.length} prompt(s) answered` : ''}. Pictures: ${OUT}${KEEP ? `\nProject kept: ${project}` : ''}`);
process.exit(failed.length ? 1 : 0);
