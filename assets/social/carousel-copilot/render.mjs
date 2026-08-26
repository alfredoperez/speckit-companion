/**
 * render.mjs — carousel slides → PNG
 * ─────────────────────────────────────────────────────────────────────────
 * Screenshots each `.slide` in `deck.html` at its exact 1080x1350 box and
 * writes `slides/slide-N.png`. Same engine as the docs capture script
 * (playwright-core driving the installed Google Chrome), so it needs no
 * separate browser download and two runs produce identical files.
 *
 *   node assets/social/carousel-copilot/render.mjs
 *
 * The slides compose REAL captured product images out of
 * docs/screenshots/generated/. Never hand-edit a slide PNG: change
 * deck.html and re-run. This directory is excluded from the .vsix.
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'slides');

const SLIDES = ['s1', 's2', 's3', 's4', 's5'];

async function main() {
    mkdirSync(outDir, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage({
        viewport: { width: 1080, height: 1350 },
        deviceScaleFactor: 2,
    });
    await page.goto(`file://${join(here, 'deck.html')}`, { waitUntil: 'networkidle' });

    let index = 0;
    for (const id of SLIDES) {
        index += 1;
        const el = await page.$(`#${id}`);
        if (!el) throw new Error(`slide #${id} not found in deck.html`);
        await el.screenshot({ path: join(outDir, `slide-${index}.png`) });
        console.log(`wrote slides/slide-${index}.png`);
    }

    await browser.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
