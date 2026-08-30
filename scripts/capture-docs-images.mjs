/**
 * capture-docs-images.mjs
 * ─────────────────────────────────────────────────────────────────────────
 * Regenerates the README screenshots in `docs/screenshots/generated/` from
 * the Storybook capture stories, so a documentation image is one command away
 * from the current UI instead of a hand-driven VS Code screenshot.
 *
 * WHAT IT DOES
 * For every entry in STORIES below it renders the story in headless Chrome
 * (playwright-core, `channel: 'chrome'`, so it drives the installed Google
 * Chrome and needs no separate browser download), screenshots the story's
 * exact-pixel capture box at device pixel ratio 2, and writes the PNG to
 * `docs/screenshots/generated/<out>`. Entries with an `annotate` block also
 * write a second `-annotated` variant: the named element is measured with
 * getBoundingClientRect and a single callout box plus label is drawn from the
 * measured rect, never from eyeballed coordinates.
 *
 * Each story must declare `parameters.capture = { width, height }` (see
 * .storybook/preview.tsx), which is what gives it the exact-pixel box. The
 * capture stories freeze the clock and disable animations (captureFrame.tsx),
 * so two runs of this script produce byte-identical files.
 *
 * HOW TO RUN
 *   node scripts/capture-docs-images.mjs
 *
 * Uses a Storybook already listening on http://localhost:6017 if there is
 * one; otherwise boots `npx storybook dev -p 6017` itself and shuts it down
 * when it is done. Exits nonzero if any story fails to render or any
 * annotation target is missing.
 *
 * The browser and Storybook plumbing is shared with the Pipeline Builder's
 * visual tests — see scripts/lib/storybook-browser.mjs.
 *
 * DO NOT HAND-EDIT THE OUTPUT
 * Everything in `docs/screenshots/generated/` is regenerable by this script.
 * A manual touch-up is lost on the next run; change the story (or this list)
 * instead.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    REPO_ROOT, ensureStorybook, launchChrome, openStory, storyIndex,
} from './lib/storybook-browser.mjs';

// ── The image list. Adding a documentation image is one line here. ────────
// story: the Storybook story id (see http://localhost:6017/index.json)
// out:   filename under docs/screenshots/generated/
// annotate (optional): { selector, label, out } draws one measured callout
//   box around `selector` with a short label, into a second file.
const STORIES = [
    {
        story: 'video-capture-episode-1-·-teamboard--a-1-b-requirements',
        out: 'spec-viewer.png',
    },
    {
        story: 'viewer-inlinecomment--several-on-one-document',
        out: 'inline-comments.png',
    },
    {
        story: 'video-capture-episode-1-·-teamboard--a-6-completed-overview',
        out: 'overview.png',
        annotate: {
            selector: '.dossier-timing',
            label: 'Honest per-phase timing',
            out: 'overview-annotated.png',
        },
    },
    {
        story: 'video-capture-specs-sidebar-recreation--b-4-full-sidebar',
        out: 'specs-sidebar.png',
    },
    {
        // The landscape three-panel sidebar explainer the README embeds
        // (Specs / Steering / Living Specs as captioned cards).
        story: 'video-capture-specs-sidebar-recreation--b-5-readme-triptych',
        out: 'sidebar-triptych.png',
    },
    {
        // The root README hero: sidebar + viewer on one dark ground, mid-plan,
        // with the tagline set above (ReadmeCapture.stories.tsx C1).
        story: 'video-capture-readme-composites--c-1-readme-hero',
        out: 'hero.png',
    },
    {
        // The benchmark stat strip under "Pick a pipeline once, run it end to
        // end" (ReadmeCapture.stories.tsx C2). Numbers quoted from
        // docs/configuration.md#workflow-choice; change them there first.
        story: 'video-capture-readme-composites--c-2-pipeline-stats',
        out: 'pipeline-stats.png',
    },
    {
        // The Living Specs pair for both READMEs (ReadmeCapture.stories.tsx
        // C3): the sidebar's Living Specs view beside the viewer's real living
        // mode, both on the photo-storage fixture capability. Also the
        // storyboard seed for the future Living Specs GIF.
        story: 'video-capture-readme-composites--c-3-living-specs-pair',
        out: 'living-specs-pair.png',
    },
    {
        // The four-benefit sub-hero under the extension README's "What you
        // get" (ReadmeCapture.stories.tsx C4): Traceability, Customization,
        // Fast path, and Living Specs, each panel a fixture-fed product
        // surface (run strip + verified rows, the companion.yml hooks shape,
        // the size verdict, the living header).
        story: 'video-capture-readme-composites--c-4-benefits-strip',
        out: 'benefits-strip.png',
    },
    {
        // Cross-promo banner in the ROOT README: "Install the other half",
        // inviting the Spec Kit engine extension (ReadmeCapture.stories.tsx
        // C5). Type over the mascot art from speckit-extension/assets.
        story: 'video-capture-readme-composites--c-5-banner-install-engine',
        out: 'banner-install-engine.png',
    },
    {
        // Cross-promo banner in speckit-extension/README.md: same frame,
        // inviting the VS Code extension (ReadmeCapture.stories.tsx C6).
        story: 'video-capture-readme-composites--c-6-banner-install-vscode',
        out: 'banner-install-vscode.png',
    },
];

const OUT_DIR = join(REPO_ROOT, 'docs', 'screenshots', 'generated');

/**
 * Draw the one-callout annotation: a box on the measured rect of `selector`
 * plus a short label chip, appended inside the capture box so the screenshot
 * picks it up. Returns false if the target element does not exist.
 */
async function injectAnnotation(page, selector, label) {
    return page.evaluate(
        ({ selector, label }) => {
            const shell = document.querySelector('#storybook-root > div');
            const target = shell?.querySelector(selector);
            if (!shell || !target) return false;
            const shellRect = shell.getBoundingClientRect();
            const r = target.getBoundingClientRect();
            const pad = 6;
            const box = document.createElement('div');
            box.className = 'docs-annotation';
            box.style.cssText = [
                'position: absolute',
                `left: ${r.left - shellRect.left - pad}px`,
                `top: ${r.top - shellRect.top - pad}px`,
                `width: ${r.width + pad * 2}px`,
                `height: ${r.height + pad * 2}px`,
                'border: 2px solid #78dce8',
                'border-radius: 6px',
                'pointer-events: none',
                'z-index: 9999',
                'box-sizing: border-box',
            ].join(';');
            const chip = document.createElement('div');
            chip.textContent = label;
            const chipTop = r.bottom - shellRect.top + pad + 6;
            chip.style.cssText = [
                'position: absolute',
                `left: ${r.left - shellRect.left - pad}px`,
                `top: ${chipTop}px`,
                'background: #78dce8',
                'color: #101416',
                'font: 600 15px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                'padding: 6px 10px',
                'border-radius: 4px',
                'pointer-events: none',
                'z-index: 9999',
            ].join(';');
            if (getComputedStyle(shell).position === 'static') {
                shell.style.position = 'relative';
            }
            shell.appendChild(box);
            shell.appendChild(chip);
            return true;
        },
        { selector, label },
    );
}

async function removeAnnotation(page) {
    await page.evaluate(() => {
        document.querySelectorAll('.docs-annotation').forEach((el) => el.remove());
        const chips = document.querySelectorAll('#storybook-root > div > div');
        chips.forEach((el) => {
            if (el.style.zIndex === '9999') el.remove();
        });
    });
}

async function main() {
    mkdirSync(OUT_DIR, { recursive: true });

    const spawned = await ensureStorybook();
    const known = new Set(Object.keys(await storyIndex()));

    const failures = [];
    const browser = await launchChrome();

    try {
        const context = await browser.newContext({
            viewport: { width: 1600, height: 1200 },
            deviceScaleFactor: 2,
            reducedMotion: 'reduce',
        });
        const page = await context.newPage();

        for (const entry of STORIES) {
            if (!known.has(entry.story)) {
                failures.push(`${entry.story}: not in Storybook index (renamed or deleted?)`);
                continue;
            }
            try {
                await openStory(page, entry.story);

                // The preview decorator gives capture stories an exact-pixel
                // box as the root child; screenshotting that element IS the
                // frame, at the size the story declares.
                const shell = page.locator('#storybook-root > div').first();
                const box = await shell.boundingBox();
                if (!box || box.width < 10 || box.height < 10) {
                    throw new Error('capture box missing or degenerate; does the story declare parameters.capture?');
                }

                const outPath = join(OUT_DIR, entry.out);
                await shell.screenshot({ path: outPath, animations: 'disabled' });
                console.log(`  ${entry.story} -> generated/${entry.out} (${box.width}x${box.height} css, @2x)`);

                if (entry.annotate) {
                    const ok = await injectAnnotation(page, entry.annotate.selector, entry.annotate.label);
                    if (!ok) throw new Error(`annotation target ${entry.annotate.selector} not found`);
                    const annPath = join(OUT_DIR, entry.annotate.out);
                    await shell.screenshot({ path: annPath, animations: 'disabled' });
                    await removeAnnotation(page);
                    console.log(`  ${entry.story} -> generated/${entry.annotate.out} (annotated: ${entry.annotate.selector})`);
                }
            } catch (err) {
                failures.push(`${entry.story}: ${err.message.split('\n')[0]}`);
            }
        }
    } finally {
        await browser.close();
        if (spawned) spawned.kill();
    }

    if (failures.length > 0) {
        console.error('\nFAILED:');
        for (const f of failures) console.error('  ' + f);
        process.exit(1);
    }
    console.log('\nAll documentation images regenerated.');
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
