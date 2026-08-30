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
 *   node scripts/capture-docs-images.mjs                        documentation images
 *   node scripts/capture-docs-images.mjs --clips                every clip state
 *   node scripts/capture-docs-images.mjs --clips living-specs   one composition
 *
 * `--clips` runs the CLIP_CAPTURES list instead, writing each PNG into the
 * composition that reads it (`media/feature-clips/<clip>/assets/captures/`)
 * rather than into docs/screenshots/generated/. Those captures are gitignored,
 * so this list is the only thing that can bring them back: every PNG any
 * composition under media/feature-clips/ reads is named here, and a retheme in
 * .storybook/capture-theme.ts reaches the clips by re-running this list.
 * (`make-it-yours` is the one composition with no entries — it is typographic
 * and reads no capture at all.) Nothing published points at these files.
 *
 * A CLIP CAPTURE'S PIXEL SIZE IS A CONTRACT
 * Every rect in a composition's BEATS array (and in the `R` tables the two
 * Overview clips inline) is a real element box measured in the capture's own
 * CSS pixels. A capture that comes back a different size silently aims every
 * camera move in that clip at the wrong element, with nothing to fail on. So
 * the story behind each entry declares the size the composition expects, and
 * changing one means re-measuring that composition's rects.
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
        // The og:image. Not referenced by either README: it is read from the
        // site's <head>, so it is the one generated still whose consumer is a
        // link preview rather than a page (ReadmeCapture.stories.tsx C7).
        story: 'video-capture-readme-composites--c-7-social-card',
        out: 'og-card.png',
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

// ── The clip-state list (`--clips`). Not documentation images. ────────────
// These write into a composition's OWN `assets/captures/`, which media/
// .gitignore excludes: a clip capture belongs to the composition that reads
// it, not to docs/screenshots/generated/, whose filenames are load-bearing for
// the published Marketplace README.
//
// clip:  directory name under media/feature-clips/
// story: the Storybook story id (see http://localhost:6017/index.json)
// out:   filename under media/feature-clips/<clip>/assets/captures/
//
// Every story of one clip declares the same `parameters.capture` size, because
// the composition measures its beat rects in the capture's own CSS pixels.
// Sources: webview/src/spec-viewer/__stories__/ClipCapture.stories.tsx (the
// D–H state pairs), VideoCapture.stories.tsx (the A* Teamboard lifecycle) and
// SidebarCapture.stories.tsx (the B* sidebar recreation).
const CLIP_CAPTURES = [
    // D · review (1224 x 776): the review loop on one document.
    { clip: 'review', story: 'video-capture-clip-states--d-1-no-comments', out: 'cm-clean.png' },
    { clip: 'review', story: 'video-capture-clip-states--d-2-pending', out: 'cm-pending.png' },
    { clip: 'review', story: 'video-capture-clip-states--d-3-opened', out: 'cm-open.png' },
    { clip: 'review', story: 'video-capture-clip-states--d-4-applied', out: 'cm-applied.png' },
    // The closing shot: the same document with the Specs view open beside it,
    // so the clip ends where you would go looking for that spec later.
    { clip: 'review', story: 'video-capture-clip-states--d-5-sidebar', out: 'cm-sidebar.png' },

    // E · living-specs (1564 x 992): the Living Specs work tree, a click on one
    // capability row, and that capability's spec open in the viewer.
    { clip: 'living-specs', story: 'video-capture-clip-states--e-1-work-tree', out: 'ls-tree.png' },
    { clip: 'living-specs', story: 'video-capture-clip-states--e-2-row-clicked', out: 'ls-click.png' },
    { clip: 'living-specs', story: 'video-capture-clip-states--e-3-capability-open', out: 'ls-capability.png' },

    // F · workflow-documents (1224 x 776). These stories were written to shoot the
    // footer's Other actions menu, but the footer falls outside this capture box and
    // F1 and F2 render identically, so the menu was never captured. See that
    // composition's STORYBOARD for what it films instead and what would unblock the
    // custom-command clip.
    { clip: 'workflow-documents', story: 'video-capture-clip-states--f-1-menu-closed', out: 'cc-closed.png' },
    { clip: 'workflow-documents', story: 'video-capture-clip-states--f-2-menu-open', out: 'cc-open-plan.png' },
    { clip: 'workflow-documents', story: 'video-capture-clip-states--f-3-menu-open-tasks', out: 'cc-open-tasks.png' },

    // G · own-workflow (1224 x 776): Create Spec, then the rail it built.
    { clip: 'own-workflow', story: 'video-capture-clip-states--g-1-workflow-choice', out: 'ow-choice.png' },
    { clip: 'own-workflow', story: 'video-capture-clip-states--g-2-custom-picked', out: 'ow-picked.png' },
    { clip: 'own-workflow', story: 'video-capture-clip-states--g-3-step-rail', out: 'ow-rail.png' },

    // H · inline-comments (918 x 594): one comment card, closed and open.
    { clip: 'inline-comments', story: 'video-capture-clip-states--h-1-comments-collapsed', out: 'ic-collapsed.png' },
    { clip: 'inline-comments', story: 'video-capture-clip-states--h-2-comment-expanded', out: 'ic-expanded.png' },

    // ── The clips built on the Teamboard lifecycle walk (A*) and the sidebar
    // recreation (B*). These compositions came first and read their captures
    // straight from those stories, so they name A/B ids rather than clip-state
    // ones. Several read the SAME shot: it is written once per composition,
    // because a composition owns everything under its own assets/.

    // step-rail + run-in-flight (1224 x 776): specified -> planned -> tasks ->
    // implementing, the four states the step rail moves through.
    { clip: 'step-rail', story: 'video-capture-episode-1-·-teamboard--a-1-spec-just-specified', out: 'step-a1.png' },
    { clip: 'step-rail', story: 'video-capture-episode-1-·-teamboard--a-3-planned-footer-reads-tasks', out: 'step-a3.png' },
    { clip: 'step-rail', story: 'video-capture-episode-1-·-teamboard--a-4-tasks-none-checked', out: 'step-a4.png' },
    { clip: 'step-rail', story: 'video-capture-episode-1-·-teamboard--a-5-implementing-three-of-six', out: 'step-a5.png' },
    { clip: 'run-in-flight', story: 'video-capture-episode-1-·-teamboard--a-1-spec-just-specified', out: 'step-a1.png' },
    { clip: 'run-in-flight', story: 'video-capture-episode-1-·-teamboard--a-3-planned-footer-reads-tasks', out: 'step-a3.png' },
    { clip: 'run-in-flight', story: 'video-capture-episode-1-·-teamboard--a-4-tasks-none-checked', out: 'step-a4.png' },
    { clip: 'run-in-flight', story: 'video-capture-episode-1-·-teamboard--a-5-implementing-three-of-six', out: 'step-a5.png' },
    // run-in-flight's last beat lands on the finished run's timing row, which
    // is the top of the same completed Overview.
    { clip: 'run-in-flight', story: 'video-capture-episode-1-·-teamboard--a-6-completed-overview', out: 'overview-top.png' },

    // coverage (1224 x 776): the same Overview, scrolled onto the coverage
    // table. A6b is A6 with the reading column parked, nothing else.
    { clip: 'coverage', story: 'video-capture-episode-1-·-teamboard--a-6-b-overview-coverage', out: 'overview-coverage.png' },

    // overview + overview-readme + overview-engine (1224 x 2430): ONE tall shot
    // of the whole dossier that all three clips pan a camera down. The rect
    // tables inlined in the three index.html files are measured in this exact
    // space, so the 2430 height is a contract for all of them.
    { clip: 'overview', story: 'video-capture-episode-1-·-teamboard--a-6-c-overview-whole-dossier', out: 'overview-tall.png' },
    { clip: 'overview-readme', story: 'video-capture-episode-1-·-teamboard--a-6-c-overview-whole-dossier', out: 'overview-tall.png' },
    { clip: 'overview-engine', story: 'video-capture-episode-1-·-teamboard--a-6-c-overview-whole-dossier', out: 'overview-tall.png' },

    // spec-viewer (1224 x 776): the finished spec document, parked on the
    // requirements block its first beat names.
    { clip: 'spec-viewer', story: 'video-capture-episode-1-·-teamboard--a-7-b-completed-spec-requirements', out: 'spec-a7.png' },

    // specs-sidebar (340 x 776): the sidebar recreation, all three sections open.
    { clip: 'specs-sidebar', story: 'video-capture-specs-sidebar-recreation--b-4-full-sidebar', out: 'sb-b4.png' },
];

const OUT_DIR = join(REPO_ROOT, 'docs', 'screenshots', 'generated');
const CLIPS_MODE = process.argv.includes('--clips');
/**
 * Optional composition filter for `--clips`, so re-shooting one clip does not
 * rewrite every other composition's captures. Documentation mode ignores it.
 */
const ONLY_CLIP = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? null;

/** Where one entry's PNG goes, and the label the log prints for it. */
function targetFor(entry) {
    if (!entry.clip) return { dir: OUT_DIR, label: `generated/${entry.out}` };
    return {
        dir: join(REPO_ROOT, 'media', 'feature-clips', entry.clip, 'assets', 'captures'),
        label: `${entry.clip}/assets/captures/${entry.out}`,
    };
}

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
    let work = CLIPS_MODE ? CLIP_CAPTURES : STORIES;
    if (CLIPS_MODE && ONLY_CLIP) {
        work = work.filter((e) => e.clip === ONLY_CLIP);
        if (work.length === 0) {
            const known = [...new Set(CLIP_CAPTURES.map((e) => e.clip))].sort().join(', ');
            throw new Error(`No clip captures for "${ONLY_CLIP}". Known: ${known}`);
        }
    }
    for (const entry of work) {
        mkdirSync(targetFor(entry).dir, { recursive: true });
    }

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

        for (const entry of work) {
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

                const target = targetFor(entry);
                const outPath = join(target.dir, entry.out);
                await shell.screenshot({ path: outPath, animations: 'disabled' });
                console.log(`  ${entry.story} -> ${target.label} (${box.width}x${box.height} css, @2x)`);

                if (entry.annotate) {
                    const ok = await injectAnnotation(page, entry.annotate.selector, entry.annotate.label);
                    if (!ok) throw new Error(`annotation target ${entry.annotate.selector} not found`);
                    const annPath = join(target.dir, entry.annotate.out);
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
    console.log(
        CLIPS_MODE
            ? `\nCaptured ${work.length} clip state${work.length === 1 ? '' : 's'}` +
                  (ONLY_CLIP ? ` into ${ONLY_CLIP}.` : ' into their compositions.')
            : '\nAll documentation images regenerated.',
    );
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
