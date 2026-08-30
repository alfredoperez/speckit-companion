#!/usr/bin/env node
/**
 * Render the published README GIFs from the clip renders.
 *
 *   npm run clips:gifs            every published GIF
 *   npm run clips:gifs -- overview
 *
 * These used to be a three-command ffmpeg incantation copied out of each
 * composition's STORYBOARD by hand, which meant a re-theme silently left the
 * README showing the old palette. The settings below are those recorded
 * commands, not new ones.
 *
 * FILENAMES ARE LOAD-BEARING. The Marketplace serves the last published README
 * but resolves images against current main, so renaming or deleting one of
 * these retroactively 404s the live listing. Overwrite in place, always.
 *
 * Requires gifsicle on PATH.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS = path.join(ROOT, 'media', 'feature-clips');
const OUT = path.join(ROOT, 'docs', 'screenshots', 'generated');

/*
  Standard is 960px at 14fps, lossy 30. `overview` and `run-in-flight` step down
  to 880/12 at lossy 45: almost every frame in those two is a camera move, so
  nothing between beats compresses away and the standard settings overshoot the
  4 MB target. Both exceptions are recorded in their own STORYBOARDs.
*/
const STANDARD = { width: 960, fps: 14, lossy: 30 };
const HEAVY = { width: 880, fps: 12, lossy: 45 };

const GIFS = [
  { id: 'overview', ...HEAVY },
  { id: 'run-in-flight', ...HEAVY },
  { id: 'overview-engine', ...STANDARD },
  { id: 'make-it-yours', ...STANDARD },
  { id: 'spec-viewer', ...STANDARD },
  { id: 'inline-comments', ...STANDARD },
  { id: 'specs-sidebar', ...STANDARD },
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

try {
  await run('gifsicle', ['--version']);
} catch {
  console.error('gifsicle is not on PATH. brew install gifsicle');
  process.exit(1);
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const wanted = only.length ? GIFS.filter((g) => only.includes(g.id)) : GIFS;
if (!wanted.length) {
  console.error(`no such clip. known: ${GIFS.map((g) => g.id).join(', ')}`);
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-gifs-'));
let failed = 0;

for (const gif of wanted) {
  const src = newestRender(gif.id);
  if (!src) {
    console.error(`skip  ${gif.id.padEnd(18)} no render. Run npm run render in its directory.`);
    failed++;
    continue;
  }

  const pal = path.join(tmp, `${gif.id}-pal.png`);
  const raw = path.join(tmp, `${gif.id}-raw.gif`);
  const dest = path.join(OUT, `${gif.id}.gif`);
  const chain = `fps=${gif.fps},scale=${gif.width}:-1:flags=lanczos`;

  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', src,
    '-vf', `${chain},palettegen=stats_mode=diff:max_colors=128`,
    pal,
  ]);
  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', src, '-i', pal,
    '-lavfi', `${chain}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`,
    raw,
  ]);
  await run('gifsicle', ['-O3', `--lossy=${gif.lossy}`, '--loop', raw, '-o', dest]);

  const mb = (fs.statSync(dest).size / 1024 / 1024).toFixed(2);
  const over = Number(mb) > 4 ? '  OVER the 4 MB target' : '';
  console.log(
    `ok    ${gif.id.padEnd(18)} ${gif.width}px ${gif.fps}fps lossy ${gif.lossy}  ${mb} MB${over}`,
  );
}

fs.rmSync(tmp, { recursive: true, force: true });
process.exitCode = failed ? 1 : 0;
