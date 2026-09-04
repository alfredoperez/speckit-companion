/**
 * visual-builder.mjs
 * ─────────────────────────────────────────────────────────────────────────
 * The Pipeline Builder panel, checked in a real browser.
 *
 * WHY THIS EXISTS
 * Every other test of this panel runs in jsdom, which has no layout engine: it
 * cannot see a node overflowing its lane, a control with no height, a hover
 * that shifts the page, or a CSS rule that lost a specificity fight. Four real
 * defects in this panel were found by opening Storybook and looking, and
 * nothing stopped them coming back.
 *
 * TWO MODES
 *   node scripts/visual-builder.mjs --layout    facts a layout engine can see
 *   node scripts/visual-builder.mjs             the same, plus pixel baselines
 *   node scripts/visual-builder.mjs --update    re-bless the baselines
 *
 * `--layout` asserts nothing about appearance, only about geometry, so it holds
 * across machines and is what CI runs. Pixels are compared locally, where the
 * baselines were made — font rasterisation differs between macOS and a Linux
 * runner, and a suite that cried wolf on every push would be turned off within
 * a week.
 *
 * NO STORY CHANGES
 * Determinism is injected here rather than declared per story: the same rules
 * captureFrame.tsx installs (no animation, no transition, no caret, no
 * scrollbars). Both viewports and both themes are reached through the URL. So
 * all 84 stories are covered without touching any of them.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import {
    REPO_ROOT, ensureStorybook, launchChrome, openStory, storyIndex,
} from './lib/storybook-browser.mjs';

// Its own Storybook, so a capture run and a visual run never fight over one.
// Set after the imports deliberately: the lib reads the port when it is asked,
// not when it is loaded, because an import is hoisted above every statement here.
process.env.SB_PORT ??= '6018';

const BASELINE_DIR = join(
    REPO_ROOT, 'webview', 'src', 'pipeline-builder', '__screenshots__');
const DIFF_DIR = join(REPO_ROOT, 'webview', 'src', 'pipeline-builder', '__screenshots__', 'diff');

/** Every story whose id starts with this belongs to the panel. */
const PREFIX = 'pipeline-builder-';

/** Pixel baselines cover the situation stories: whole panel, real states. */
const PIXEL_PREFIX = 'pipeline-builder-situations--';

/**
 * The panel docked wide, and squeezed into a side panel. The narrow one is
 * where the header overflow lived, and it is the width nobody develops at.
 */
const VIEWPORTS = [
    { name: 'wide', width: 1600, height: 1200 },
    { name: 'narrow', width: 380, height: 900 },
];

/**
 * Both named, neither defaulted. Storybook's default global is the capture
 * palette, which exists to be retimed and rethemed for screenshots — leaning on
 * it once already turned "dark" into a second light run without saying so, and
 * every baseline moved the day that palette changed. Naming both pins this
 * suite to what the panel has to survive rather than to what the docs images
 * happen to be shot in.
 */
const THEMES = [
    { name: 'dark', globals: { vscodeTheme: 'monokai-black' } },
    { name: 'light', globals: { vscodeTheme: 'vivid-light' } },
];

/** What captureFrame.tsx installs, applied from here so no story has to. */
const DETERMINISM_CSS = `
    *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
    }
    ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
    * { scrollbar-width: none !important; }
`;

/**
 * Facts about the rendered page that only a layout engine can answer.
 *
 * Every one of these is a defect somebody would otherwise have to notice by
 * eye. They are geometric rather than aesthetic on purpose: a machine cannot
 * tell you the panel looks wrong, but it can tell you a button is nought
 * pixels tall.
 */
function layoutProblems() {
    const problems = [];
    const root = document.querySelector('#storybook-root');
    if (!root || !root.firstElementChild) return ['the story rendered nothing'];

    // The panel shell hides its overflow and lets `.pb-board` do the scrolling,
    // so anything wider than the shell is content nothing can bring into view.
    // Measured on the shell rather than the document because the Storybook
    // catalog wrapper adds its own padding, which is not the panel's problem.
    const shell = root.querySelector('.builder') || root.firstElementChild;
    if (shell && shell.scrollWidth > shell.clientWidth + 1
        && getComputedStyle(shell).overflowX === 'hidden') {
        problems.push(`the panel is wider than its shell can show `
            + `(${shell.scrollWidth}px of content in ${shell.clientWidth}px)`);
    }

    // Anything drawn has to have been given a size. A zero-height control is
    // present to the DOM, invisible to a person, and passes every jsdom test.
    const drawn = '.pb-node, .pb-phase, .pb-hooks, .builder-action, .pb-action';
    for (const el of root.querySelectorAll(drawn)) {
        const box = el.getBoundingClientRect();
        if (getComputedStyle(el).display === 'none' || el.hidden) continue;
        if (box.width < 1 || box.height < 1) {
            problems.push(
                `${el.className || el.tagName} is ${Math.round(box.width)}×`
                + `${Math.round(box.height)} — drawn but not visible`);
        }
    }

    // A control whose box falls entirely outside a HIDDEN ancestor cannot be
    // reached at all. A scrollable ancestor is not the same thing — this panel
    // deliberately scrolls its lanes sideways rather than squeezing them, so
    // treating `auto` like `hidden` would report the whole board as broken.
    const scrolls = (s) => ['auto', 'scroll'].includes(s.overflowX)
        || ['auto', 'scroll'].includes(s.overflowY);
    const hides = (s) => ['hidden', 'clip'].includes(s.overflowX)
        || ['hidden', 'clip'].includes(s.overflowY);

    for (const el of root.querySelectorAll('button:not([disabled])')) {
        const box = el.getBoundingClientRect();
        if (box.width < 1 || box.height < 1) continue;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const style = getComputedStyle(p);
            // A scrollable ancestor can bring the element into its own view, so
            // whatever sits above it is no longer this element's problem.
            if (scrolls(style)) break;
            if (!hides(style)) continue;
            const clip = p.getBoundingClientRect();
            if (clip.width < 1 || clip.height < 1) continue;
            const outside = box.right <= clip.left || box.left >= clip.right
                || box.bottom <= clip.top || box.top >= clip.bottom;
            if (outside) {
                problems.push(
                    `"${(el.textContent || '').trim().slice(0, 30)}" is clipped out of view`);
                break;
            }
        }
    }
    return problems;
}

async function shoot(page, name, { update }) {
    mkdirSync(BASELINE_DIR, { recursive: true });
    const baseline = join(BASELINE_DIR, `${name}.png`);
    const shot = await page.screenshot({ animations: 'disabled' });

    if (update || !existsSync(baseline)) {
        writeFileSync(baseline, shot);
        return { status: update ? 'blessed' : 'new' };
    }

    const before = PNG.sync.read(readFileSync(baseline));
    const after = PNG.sync.read(shot);
    if (before.width !== after.width || before.height !== after.height) {
        return {
            status: 'changed',
            detail: `size ${before.width}×${before.height} -> ${after.width}×${after.height}`,
        };
    }
    const diff = new PNG({ width: before.width, height: before.height });
    const differing = pixelmatch(
        before.data, after.data, diff.data, before.width, before.height, { threshold: 0.1 });
    if (differing === 0) return { status: 'same' };

    mkdirSync(DIFF_DIR, { recursive: true });
    const diffPath = join(DIFF_DIR, `${name}.png`);
    writeFileSync(diffPath, PNG.sync.write(diff));
    return { status: 'changed', detail: `${differing} pixels differ; see ${diffPath}` };
}

async function main() {
    const args = new Set(process.argv.slice(2));
    const layoutOnly = args.has('--layout');
    const update = args.has('--update');

    const spawned = await ensureStorybook();
    const stories = Object.keys(await storyIndex()).filter((id) => id.startsWith(PREFIX));
    if (stories.length === 0) throw new Error(`no stories matched "${PREFIX}"`);
    console.log(`${stories.length} panel stories, `
        + `${layoutOnly ? 'layout only' : 'layout + pixels'}`);

    const failures = [];
    let checked = 0;
    let compared = 0;
    const browser = await launchChrome();

    try {
        for (const viewport of VIEWPORTS) {
            for (const theme of THEMES) {
                const context = await browser.newContext({
                    viewport: { width: viewport.width, height: viewport.height },
                    deviceScaleFactor: 1,
                    reducedMotion: 'reduce',
                });
                const page = await context.newPage();
                const noise = [];
                page.on('console', (msg) => {
                    if (msg.type() !== 'error' && msg.type() !== 'warning') return;
                    const text = msg.text();
                    // Storybook's preview pulls highlight.js from a CDN; a fetch
                    // that failed is the network's news, not the panel's.
                    if (text.includes('Failed to load resource')) return;
                    noise.push(text);
                });

                for (const id of stories) {
                    noise.length = 0;
                    const where = `${id} [${viewport.name}/${theme.name}]`;
                    try {
                        await openStory(page, id, theme.globals);
                        await page.addStyleTag({ content: DETERMINISM_CSS });

                        const problems = await page.evaluate(layoutProblems);
                        checked += 1;
                        for (const problem of problems) failures.push(`${where}: ${problem}`);
                        for (const line of noise) failures.push(`${where}: console — ${line}`);

                        // Pixels: one theme is enough to catch a visual change,
                        // and doubling the baselines would not catch it twice.
                        const wantPixels = !layoutOnly
                            && theme.name === 'dark'
                            && id.startsWith(PIXEL_PREFIX);
                        if (wantPixels) {
                            const name = `${id.slice(PIXEL_PREFIX.length)}--${viewport.name}`;
                            const result = await shoot(page, name, { update });
                            compared += 1;
                            if (result.status === 'changed') {
                                failures.push(`${where}: ${result.detail}`);
                            } else if (result.status === 'new') {
                                console.log(`  + baseline ${name}`);
                            }
                        }
                    } catch (err) {
                        failures.push(`${where}: ${err.message.split('\n')[0]}`);
                    }
                }
                await context.close();
            }
        }
    } finally {
        await browser.close();
        if (spawned) spawned.kill();
    }

    console.log(`\n${checked} renders checked`
        + (compared ? `, ${compared} compared against baselines` : ''));
    if (failures.length > 0) {
        console.error(`\n${failures.length} problem(s):`);
        for (const f of failures) console.error('  ' + f);
        if (!update) {
            console.error('\nIf a pixel change was intended, re-bless with --update.');
        }
        process.exit(1);
    }
    console.log('No layout problems.');
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
