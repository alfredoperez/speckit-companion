#!/usr/bin/env node
/**
 * clip-boxes.mjs: fail when a demo clip's highlight box has moved off its element.
 *
 *   node tooling/scripts/clip-boxes.mjs [--check]        re-measure every registered box
 *   node tooling/scripts/clip-boxes.mjs --update [clip]  record the current measurement as the baseline
 *
 * A clip's BEATS rects are measured once and then drawn onto a still, so a layout change
 * leaves the ring on empty space and nothing says so. `content/media/feature-clips/boxes.json`
 * names, per clip and beat, the element that beat highlights and the rect it measured when
 * the box was last checked by eye, plus the BEATS rect it was recorded against (`drawn`), so
 * editing a ring without re-recording fails too. This script opens the story that beat is drawn over,
 * measures that element again with getBoundingClientRect (the way capture-docs-images.mjs
 * measures its annotation target) and fails when any edge moved more than 4 CSS pixels.
 *
 * It needs Storybook and Chrome, so it is not part of the fast `clips:check`; run it as
 * `npm run clips:check:boxes`. It reuses a Storybook already on :6017 or boots its own.
 * After an intended layout change, look at the clip, fix the BEATS rect, then `--update`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureStorybook, launchChrome, openStory, storyIndex } from './lib/storybook-browser.mjs';
import { CLIP_CAPTURES } from './capture-docs-images.mjs';
import { describeAim, describeDrift, describeEdited, readComposition, shotAtBeat } from './lib/clip-boxes.mjs';

const CLIPS_DIR = join(REPO_ROOT, 'content', 'media', 'feature-clips');
const BOXES_FILE = join(CLIPS_DIR, 'boxes.json');

/** Rect of the nth match for a selector, relative to the capture box, in the capture's CSS pixels. */
async function measure(page, selector, nth) {
    return page.evaluate(({ selector, nth }) => {
        const shell = document.querySelector('#storybook-root > div');
        const el = shell?.querySelectorAll(selector)[nth];
        if (!shell || !el) return null;
        const s = shell.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return [r.left - s.left, r.top - s.top, r.width, r.height];
    }, { selector, nth });
}

/** A story that scrolls itself into place can still be moving after settle(), so read until two reads agree. */
async function measureStable(page, selector, nth) {
    let last = await measure(page, selector, nth);
    for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(250);
        const next = await measure(page, selector, nth);
        if (JSON.stringify(next) === JSON.stringify(last)) return next;
        last = next;
    }
    return last;
}

/** Every registered box with the story it is drawn over, the beat's label and its stored rect. */
function plan(registry, only) {
    const storyOf = new Map(CLIP_CAPTURES.map((c) => [`${c.clip}/${c.out}`, c.story]));
    const jobs = [];
    const problems = [];
    for (const [clip, boxes] of Object.entries(registry)) {
        if (only && clip !== only) continue;
        let comp;
        try {
            comp = readComposition(readFileSync(join(CLIPS_DIR, clip, 'index.html'), 'utf8'));
        } catch (err) {
            problems.push(`${clip}: cannot read its BEATS (${err.message.split('\n')[0]})`);
            continue;
        }
        if (!comp) {
            problems.push(`${clip}: boxes.json lists it but its index.html has no BEATS array`);
            continue;
        }
        for (const box of boxes) {
            const beat = comp.beats[box.beat];
            if (!beat?.r) {
                problems.push(`${clip} beat ${box.beat + 1}: boxes.json names a beat that has no rect`);
                continue;
            }
            const file = comp.shots[shotAtBeat(beat, comp.cuts)];
            const story = storyOf.get(`${clip}/${file}`);
            if (!story) {
                problems.push(`${clip} beat ${box.beat + 1}: capture ${file} is not in CLIP_CAPTURES`);
                continue;
            }
            jobs.push({ clip, box, story, label: beat.label ?? null, drawn: beat.r });
        }
    }
    return { jobs, problems };
}

async function main() {
    const args = process.argv.slice(2);
    const update = args.includes('--update');
    const only = args.find((a) => !a.startsWith('--')) ?? null;
    const registry = JSON.parse(readFileSync(BOXES_FILE, 'utf8'));
    if (only && !registry[only]) {
        console.error(`No boxes registered for "${only}". Known: ${Object.keys(registry).join(', ')}`);
        return 1;
    }

    const { jobs, problems } = plan(registry, only);
    const byStory = new Map();
    for (const job of jobs) {
        if (!byStory.has(job.story)) byStory.set(job.story, []);
        byStory.get(job.story).push(job);
    }

    const spawned = await ensureStorybook();
    let browser = null;
    const drifted = [];
    const aims = [];
    let checked = 0;
    try {
        const known = new Set(Object.keys(await storyIndex()));
        browser = await launchChrome();
        const context = await browser.newContext({
            viewport: { width: 1600, height: 1200 },
            deviceScaleFactor: 2,
            reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        for (const [story, list] of byStory) {
            if (!known.has(story)) {
                problems.push(`${story}: not in the Storybook index (renamed or deleted?)`);
                continue;
            }
            await openStory(page, story);
            for (const job of list) {
                const { clip, box, label, drawn } = job;
                const named = { clip, beat: box.beat, label, selector: box.selector };
                const measured = await measureStable(page, box.selector, box.nth ?? 0);
                if (update) {
                    if (!measured) {
                        problems.push(`${clip} beat ${box.beat + 1} (${box.selector}): element not found`);
                        continue;
                    }
                    box.rect = measured.map((n) => Math.round(n * 10) / 10);
                    box.drawn = drawn;
                    const aim = describeAim({ ...named, drawn, measured });
                    if (aim) aims.push(aim);
                    continue;
                }
                checked++;
                if (!box.rect) {
                    problems.push(`${clip} beat ${box.beat + 1} (${box.selector}): no baseline, run --update ${clip}`);
                    continue;
                }
                const moved = describeDrift({ ...named, stored: box.rect, measured });
                if (moved) drifted.push(moved);
                const edited = describeEdited({ ...named, drawn, baseline: box.drawn });
                if (edited) drifted.push(edited);
            }
        }
    } finally {
        if (browser) await browser.close();
        if (spawned) spawned.kill();
    }

    if (update) {
        if (problems.length === 0) {
            const text = JSON.stringify(registry, null, 2)
                .replace(/\[\s+([-\d.,\s]+?)\s+\]/g, (_, nums) => `[${nums.replace(/\s+/g, ' ')}]`);
            writeFileSync(BOXES_FILE, text + '\n');
            console.log(`Recorded ${jobs.length} box baselines in content/media/feature-clips/boxes.json.`);
            if (aims.length > 0) {
                console.log(`\n${aims.length} drawn ring${aims.length === 1 ? ' is' : 's are'} far from the element they name; fix the BEATS rect, then --update again:`);
                for (const line of aims) console.log('  ' + line);
            }
            return 0;
        }
        console.error('Nothing was written: fix the problems below and run --update again.');
    } else if (drifted.length === 0 && problems.length === 0) {
        console.log(`clip boxes: all ${checked} highlight boxes are where they were measured.`);
        return 0;
    }

    console.error(`clip boxes: ${drifted.length + problems.length} problem${drifted.length + problems.length === 1 ? '' : 's'}`);
    for (const line of [...drifted, ...problems]) console.error('  ' + line);
    if (drifted.length > 0) {
        console.error('\nA box that moved is ringing the wrong place. Look at the clip, fix that beat\'s rect in index.html,');
        console.error('then `npm run clips:check:boxes -- --update <clip>` to record the new measurement.');
    }
    return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().then((code) => process.exit(code), (err) => {
        console.error(err.message);
        process.exit(1);
    });
}
