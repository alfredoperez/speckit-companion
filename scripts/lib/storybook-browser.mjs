/**
 * storybook-browser.mjs
 * ─────────────────────────────────────────────────────────────────────────
 * Driving Storybook in a real browser: booting it, reaching a story, and
 * waiting until what is on screen is what the story means.
 *
 * Extracted from capture-docs-images.mjs when a second consumer arrived (the
 * Pipeline Builder's visual tests). Both need exactly the same four things and
 * getting any of them subtly different — a shorter settle, a missed error
 * screen — would mean the images and the tests disagree about what the UI
 * looks like, which is the one thing neither can afford.
 *
 * WHY playwright-core AND INSTALLED CHROME
 * `playwright-core` ships no browsers, so `channel: 'chrome'` drives the Google
 * Chrome already on the machine and nothing has to be downloaded. The pin is
 * exact on purpose — see docs/visual-assets.md, which also forbids swapping in
 * full `playwright`.
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

/** One port for every consumer, so a booted Storybook is reused rather than doubled. */
export const PORT = 6017;
export const BASE = `http://localhost:${PORT}`;
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** How long a cold `storybook dev` is given to answer. */
const BOOT_TIMEOUT_MS = 180_000;

export async function storybookIsUp() {
    try {
        const res = await fetch(`${BASE}/index.json`, { signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch {
        return false;
    }
}

/** Boot `storybook dev` and resolve once index.json answers. */
export async function bootStorybook() {
    console.log(`No Storybook on :${PORT}, booting one (first boot takes a minute)...`);
    const child = spawn('npx', ['storybook', 'dev', '-p', String(PORT), '--no-open'], {
        cwd: REPO_ROOT,
        stdio: 'ignore',
        detached: false,
    });
    const deadline = Date.now() + BOOT_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`storybook dev exited early with code ${child.exitCode}`);
        }
        if (await storybookIsUp()) return child;
        await new Promise((r) => setTimeout(r, 2000));
    }
    child.kill();
    throw new Error('Storybook did not come up on :' + PORT + ' within 180s');
}

/**
 * Make sure a Storybook is listening, booting one only if it has to.
 *
 * Returns the child process to kill afterwards, or null when it reused one
 * somebody else started — killing that would close the window they are working in.
 */
export async function ensureStorybook() {
    return (await storybookIsUp()) ? null : bootStorybook();
}

/** Every story id Storybook knows about. Checking against this makes a rename fail loudly. */
export async function storyIndex() {
    const index = await (await fetch(`${BASE}/index.json`)).json();
    return index.entries;
}

export async function launchChrome() {
    return chromium.launch({ channel: 'chrome' }).catch((err) => {
        throw new Error(
            'Could not launch Chrome via playwright-core (channel "chrome"). ' +
                'Install Google Chrome, or point the script at another channel. ' +
                `Original error: ${err.message}`,
        );
    });
}

/** Wait until the story is painted: fonts loaded, two frames settled. */
export async function settle(page) {
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    // Small fixed grace for story play() functions and layout of async content
    // (e.g. mermaid). Deterministic content means waiting longer never changes
    // the pixels, only guarantees they are all there.
    await page.waitForTimeout(500);
}

/**
 * Navigate to one story and wait for it, throwing if Storybook drew its error
 * screen — which renders as a perfectly valid page and would otherwise be
 * screenshotted, or asserted against, as though it were the story.
 *
 * `globals` sets Storybook globals through the URL (`{ vscodeTheme: 'vivid-light' }`),
 * which is how a story is put in another theme without touching the story.
 */
export async function openStory(page, id, globals = {}) {
    const params = new URLSearchParams({ id, viewMode: 'story' });
    const pairs = Object.entries(globals);
    if (pairs.length) {
        params.set('globals', pairs.map(([k, v]) => `${k}:${v}`).join(';'));
    }
    await page.goto(`${BASE}/iframe.html?${params}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#storybook-root > *', { timeout: 30_000 });
    const errored = await page.evaluate(() =>
        document.body.classList.contains('sb-show-errordisplay'),
    );
    if (errored) throw new Error('story rendered the Storybook error screen');
    await settle(page);
}
