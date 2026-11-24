#!/usr/bin/env node
/**
 * Build the landing page's still images.
 *
 *   npm run clips:stills
 *   npm run clips:stills -- --only panel-read,panel-review
 *
 * Two sets, same rule behind both: **crop to the content, never show a whole
 * IDE window.** A full window shrunk into a 600px column is unreadable, which is
 * how the hero ended up as a wall of words and the feature panels ended up
 * showing nothing you could actually read.
 *
 *   hero-*    the stills the hero shows where it has no loop to play
 *   panel-*   the figure beside each row of the feature accordion
 *
 * Sources are the clip compositions' own captures and renders, so a palette
 * change is a re-shoot plus a re-run of this script and the stills can never
 * drift away from what the clips show.
 *
 * A crop's x/y/w are in the SOURCE's own pixels. Captures are shot at DPR 2, so
 * those numbers are twice the CSS values you would measure in a browser. Height
 * comes from the aspect so a set can never disagree with itself.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLIPS = path.join(ROOT, 'content', 'media', 'feature-clips');
const OUT = path.join(ROOT, 'content', 'media', 'web');

const PNG = ['-frames:v', '1', '-c:v', 'png', '-compression_level', '100', '-pred', 'mixed'];

/* One aspect everywhere: the composition frame's own 1836:1164. The drawn panels
   ARE that frame, so anything else would letterbox them, and the captured crops
   sit in the same figure and must not disagree with it. */
const ASPECT = 1836 / 1164;

const STILLS = [
  // ---------------------------------------------------------------- hero
  // The hero plays loops now, supplied by hand, so no hero still is cut here.
  // An entry with `fromFile` or `parts` would cut one from real-window shots.

  // ------------------------------------------------------- accordion panels
  // Captures are the clip-* steps of desktop-check.mjs: whole VS Code windows at
  // 1728 x 1084 CSS px, shot at DPR 3, so every crop below is the measured CSS box
  // times 3. Each crop keeps to the editor's content, never the whole window.
  {
    // The Overview's content column only: intent, run overview, approach and
    // working area, down into the expectations fence.
    id: 'panel-read',
    from: 'overview/assets/captures/clip-overview-intent.png',
    crop: { x: 2190, y: 480, w: 2490 },
    aspect: ASPECT,
    width: 1500,
  },
  {
    // One comment open under its plan line, whole note visible with its
    // Refine / Edit / Delete row, and the plan around it.
    id: 'panel-review',
    from: 'inline-comments/assets/captures/clip-inline-open.png',
    crop: { x: 1680, y: 900, w: 2550 },
    aspect: ASPECT,
    width: 1500,
  },
  {
    // The step rail of a finished run, every step ticked and Tasks open, with
    // the task list beside it. Cut from the capture, so no clip chrome.
    id: 'panel-step-rail',
    from: 'workflow-documents/assets/captures/clip-workflow-documents.png',
    crop: { x: 1035, y: 420, w: 3000 },
    aspect: ASPECT,
    width: 1500,
  },
  {
    // A workflow written by hand in the workspace settings: its name, its
    // description and the steps a run will take.
    id: 'panel-bend',
    from: 'make-it-yours/assets/captures/clip-make-settings.png',
    crop: { x: 1200, y: 290, w: 2280 },
    aspect: ASPECT,
    width: 1500,
  },
];

function newestRender(id) {
  const dir = path.join(CLIPS, id, 'renders');
  if (!fs.existsSync(dir)) return null;
  const mp4s = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mp4'))
    .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  return mp4s.length ? path.join(dir, mp4s[0].f) : null;
}

function sourceFor(still) {
  if (still.parts) {
    const paths = still.parts.map((part) => path.join(ROOT, part.fromFile));
    return paths.every((p) => fs.existsSync(p)) ? paths : null;
  }
  if (still.fromFile) {
    const p = path.join(ROOT, still.fromFile);
    return fs.existsSync(p) ? p : null;
  }
  if (still.from) {
    const p = path.join(CLIPS, still.from);
    return fs.existsSync(p) ? p : null;
  }
  return newestRender(still.fromRender);
}

// --only builds a subset, so one still can be recut without every other
// still's gitignored capture or render being on disk.
const onlyAt = process.argv.indexOf('--only');
const only = onlyAt > -1 ? new Set((process.argv[onlyAt + 1] || '').split(',')) : null;
const wanted = only ? STILLS.filter((s) => only.has(s.id)) : STILLS;

const missing = wanted.filter((s) => !sourceFor(s));
if (missing.length) {
  console.error('build-stills: sources are missing.\n');
  for (const s of missing) {
    console.error(`  ${s.id.padEnd(20)} ${s.parts?.map((part) => part.fromFile).join(' + ') || s.fromFile || s.from || `${s.fromRender} (no render yet)`}`);
  }
  console.error(
    '\n  Captures:  npm run clips:capture -- --clips overview,review' +
      '\n  Renders:   npm run render, inside the composition directory' +
      '\n\n  Both are gitignored, so a fresh clone always needs this.',
  );
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

for (const still of wanted) {
  const src = sourceFor(still);
  const dest = path.join(OUT, `${still.id}.png`);

  if (still.parts) {
    // Each part is scaled to the still's height; the last one takes whatever
    // width is left, and the ground between them is the page's own.
    const outW = still.width;
    const outH = Math.round(outW / still.aspect / 2) * 2;
    const gap = still.gap ?? 0;
    const args = ['-y', '-v', 'error'];
    for (const p of src) args.push('-i', p);
    let used = 0;
    const chains = still.parts.map((part, i) => {
      const { x, y, w, h } = part.crop;
      const last = i === still.parts.length - 1;
      const partW = last ? outW - used : Math.round((w * outH) / h / 2) * 2;
      used += partW + gap;
      return `[${i}:v]crop=${w}:${h}:${x}:${y},scale=${partW}:${outH}:flags=lanczos${last ? '' : `,pad=${partW + gap}:${outH}:0:0:color=0x0a0912`}[p${i}]`;
    });
    const stack = `${still.parts.map((_, i) => `[p${i}]`).join('')}hstack=inputs=${still.parts.length}`;
    args.push('-filter_complex', `${chains.join(';')};${stack}`, ...PNG, dest);
    await run('ffmpeg', args);
    const kb = (fs.statSync(dest).size / 1024).toFixed(0);
    console.log(`${still.id.padEnd(20)} ${src.map((p) => path.basename(p)).join(' + ')}  ->  ${outW}x${outH}  ${kb} KB`);
    continue;
  }
  const { x, y, w } = still.crop;
  const h = Math.round(w / still.aspect / 2) * 2;
  const outW = still.width;
  const outH = Math.round(outW / still.aspect / 2) * 2;

  const args = ['-y', '-v', 'error'];
  if (still.at != null) args.push('-ss', String(still.at));
  args.push(
    '-i', src,
    '-vf', `crop=${w}:${h}:${x}:${y},scale=${outW}:${outH}:flags=lanczos`,
    ...PNG,
    dest,
  );
  await run('ffmpeg', args);

  const kb = (fs.statSync(dest).size / 1024).toFixed(0);
  console.log(
    `${still.id.padEnd(20)} ${w}x${h} from ${path.basename(src)}` +
      `${still.at != null ? ` @${still.at}s` : ''}  ->  ${outW}x${outH}  ${kb} KB`,
  );
}

console.log('\nCopy them to the site with: npm run clips:sync');
