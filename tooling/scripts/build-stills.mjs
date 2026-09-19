#!/usr/bin/env node
/**
 * Build the landing page's still images.
 *
 *   npm run clips:stills
 *
 * Two sets, same rule behind both: **crop to the content, never show a whole
 * IDE window.** A full window shrunk into a 600px column is unreadable, which is
 * how the hero ended up as a wall of words and the feature panels ended up
 * showing nothing you could actually read.
 *
 *   hero-*    the three surfaces the hero cycles through
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
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS = path.join(ROOT, 'media', 'feature-clips');
const OUT = path.join(ROOT, 'media', 'web');

const PNG = ['-frames:v', '1', '-c:v', 'png', '-compression_level', '100', '-pred', 'mixed'];

/* One aspect everywhere: the composition frame's own 1836:1164. The drawn panels
   ARE that frame, so anything else would letterbox them, and the captured crops
   sit in the same figure and must not disagree with it. */
const ASPECT = 1836 / 1164;

const STILLS = [
  // ---------------------------------------------------------------- hero
  {
    id: 'hero-overview',
    from: 'overview/assets/captures/overview-tall.png',
    crop: { x: 0, y: 0, w: 2448 },
    aspect: ASPECT,
    width: 1600,
  },
  {
    id: 'hero-living-specs',
    from: 'living-specs/assets/captures/ls-tree.png',
    crop: { x: 0, y: 0, w: 1500 },
    aspect: ASPECT,
    width: 1600,
  },
  {
    id: 'hero-review',
    from: 'review/assets/captures/cm-open.png',
    crop: { x: 435, y: 163, w: 1415 },
    aspect: ASPECT,
    width: 1600,
  },

  // ------------------------------------------------------- accordion panels
  {
    // The Overview's content column only: no sidebar, no title bar. Runs from
    // INTENT through the expectations fence, which is the part of the page the
    // row's copy is actually describing.
    id: 'panel-read',
    from: 'overview/assets/captures/overview-tall.png',
    crop: { x: 612, y: 280, w: 1728 },
    aspect: ASPECT,
    width: 1500,
  },
  {
    // One comment open, whole note visible, with its Refine / Edit / Delete row
    // and enough requirements around it to show what it is attached to.
    id: 'panel-review',
    from: 'review/assets/captures/cm-open.png',
    crop: { x: 430, y: 186, w: 1470 },
    aspect: ASPECT,
    width: 1500,
  },
  {
    // Drawn, not captured: the two-up payoff of the explainer clip, held at the
    // moment both placements are on screen with their coverage and drift. The
    // crop stops above the caption band — a band sized to be read as video is
    // enormous as a figure, and the sentence is already in the row's copy.
    id: 'panel-living',
    fromRender: 'living-specs-explained',
    at: 17.5,
    crop: { x: 156, y: 0, w: 1522 },
    aspect: ASPECT,
    width: 1500,
  },
  {
    // The step rail with every earlier step ticked. Cut from the CAPTURE, not
    // the render: step-rail and run-in-flight open on the same shot, so their
    // frame-zero posters are byte-identical and one picture was serving two
    // docs pages. A later frame of the render is no good either — it carries
    // the clip's scrim and caption band, which are clip chrome, not docs
    // imagery.
    id: 'panel-step-rail',
    from: 'step-rail/assets/captures/step-a4.png',
    crop: { x: 0, y: 0, w: 2448 },
    aspect: ASPECT,
    width: 1500,
  },
  {
    // The workflow card sequence, held on the step list rather than frame zero.
    id: 'panel-bend',
    fromRender: 'make-it-yours',
    at: 8.6,
    crop: { x: 118, y: 30, w: 1600 },
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
  if (still.from) {
    const p = path.join(CLIPS, still.from);
    return fs.existsSync(p) ? p : null;
  }
  return newestRender(still.fromRender);
}

const missing = STILLS.filter((s) => !sourceFor(s));
if (missing.length) {
  console.error('build-stills: sources are missing.\n');
  for (const s of missing) {
    console.error(`  ${s.id.padEnd(20)} ${s.from || `${s.fromRender} (no render yet)`}`);
  }
  console.error(
    '\n  Captures:  npm run clips:capture -- --clips overview,living-specs,review' +
      '\n  Renders:   npm run render, inside the composition directory' +
      '\n\n  Both are gitignored, so a fresh clone always needs this.',
  );
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

for (const still of STILLS) {
  const src = sourceFor(still);
  const dest = path.join(OUT, `${still.id}.png`);
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
