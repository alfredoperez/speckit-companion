#!/usr/bin/env node
// Web video branch of the clip pipeline.
//
// Reads the MP4 hyperframes already rendered into media/feature-clips/<id>/renders/
// and writes, per composition, a VP9 WebM, an H.264 MP4 fallback for Safari, and a
// poster PNG lifted from frame zero of the WebM. Encode settings and the reasoning
// behind them live in media/WEB-RENDERS.md.
//
// The GIF path is untouched: nothing here reads, writes, or deletes a .gif, and
// nothing here writes into renders/.
//
//   node scripts/render-web-clips.mjs                 # every composition
//   node scripts/render-web-clips.mjs overview        # one composition
//   node scripts/render-web-clips.mjs --list          # what would be encoded
//   node scripts/render-web-clips.mjs --verify-only   # re-check existing outputs

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS_DIR = path.join(ROOT, 'media', 'feature-clips');

// Width first, quantizer second. The site paints these into 864 CSS px, which
// is 1728 device px on a 2x display, so a 960px encode was upscaled almost 2x
// on top of an already 1.9x downscale from the 1836px composition. The clips
// are behind preload="none" and only play on a tab click, so the page's
// critical path is the posters, not the video bytes.
const DEFAULTS = {
  width: 1440,
  vp9Crf: 40,
  h264Crf: 26,
  out: path.join('media', 'web'),
  jobs: Math.max(1, Math.min(4, Math.floor(os.cpus().length / 3) || 1)),
};

// ---------------------------------------------------------------- encode specs

// Shared scale. Native frame rate is preserved deliberately: the sources are 30 fps
// and resampling to 24 would land on a 1.25 ratio, which judders on smooth pans.
const videoFilter = (width) => `scale=${width}:-2:flags=lanczos,setsar=1`;

// -an on both: no audio track at all, which is the strongest form of
// muted-autoplay friendly. The page still needs muted + playsinline on the element.
const vp9Args = (crf, pass, logPrefix) => [
  '-c:v', 'libvpx-vp9',
  '-b:v', '0',
  '-crf', String(crf),
  '-row-mt', '1',
  '-tile-columns', '2',
  '-g', '240',
  '-auto-alt-ref', '6',
  '-lag-in-frames', '25',
  '-deadline', 'good',
  '-cpu-used', '2',
  '-pix_fmt', 'yuv420p',
  '-pass', String(pass),
  '-passlogfile', logPrefix,
];

const h264Args = (crf) => [
  '-c:v', 'libx264',
  '-crf', String(crf),
  '-preset', 'veryslow',
  '-profile:v', 'main',
  '-level', '4.0',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
];

const posterArgs = ['-frames:v', '1', '-c:v', 'png', '-compression_level', '100', '-pred', 'mixed'];

// --------------------------------------------------------------------- helpers

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function haveBinary(name) {
  return spawnSync(name, ['-version'], { stdio: 'ignore' }).status === 0;
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${bin} exited ${code}\n${stderr.trim().split('\n').slice(-12).join('\n')}`));
    });
  });
}

// md5 of the decoded first frame as rgb24. Same pixel domain the browser paints in,
// so a match here means the poster and the clip's opening frame are the same picture.
function frameZeroHash(file) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    const hash = createHash('md5');
    let bytes = 0;
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      hash.update(chunk);
      bytes += chunk.length;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 || bytes === 0) reject(new Error(`frame extract failed for ${file}\n${stderr.trim()}`));
      else resolve({ md5: hash.digest('hex'), bytes });
    });
  });
}

// Worst-case per-channel difference between two clips' opening frames, 0..255.
function frameZeroMaxDiff(a, b) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-i', a, '-i', b,
      '-lavfi', '[0:v]trim=end_frame=1,format=rgb24[x];[1:v]trim=end_frame=1,format=rgb24[y];[x][y]blend=all_mode=difference',
      '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
    ];
    const child = spawn('ffmpeg', args);
    let max = 0;
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      for (const byte of chunk) if (byte > max) max = byte;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(max) : reject(new Error(stderr.trim()))));
  });
}

function probe(file) {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,nb_frames',
    '-show_entries', 'format=duration',
    '-of', 'json', file,
  ], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  const parsed = JSON.parse(result.stdout);
  const stream = parsed.streams?.[0] ?? {};
  const [num, den] = String(stream.r_frame_rate ?? '0/1').split('/').map(Number);
  return {
    width: stream.width,
    height: stream.height,
    fps: den ? num / den : 0,
    frames: Number(stream.nb_frames ?? 0),
    duration: Number(parsed.format?.duration ?? 0),
  };
}

// Source per composition: the MOST RECENTLY MODIFIED .mp4 in renders/, whatever
// it is called.
//
// This used to prefer the plain <id>.mp4 unconditionally, and that was a silent
// staleness trap. `npm run render` writes a NEW timestamped file and leaves the
// canonical one alone, so re-rendering a clip and then rebuilding the web set
// would quietly re-encode the previous take. It shipped once: a label rewrite
// landed in the composition, the clip was re-rendered, and the site kept serving
// the old labels because overview.mp4 was three renders behind.
//
// Recency is the only rule that cannot go stale. When a stale canonical file is
// what got skipped, say so out loud rather than choosing in silence, because the
// canonical name is what a reader assumes is current.
function sourceFor(id) {
  const rendersDir = path.join(CLIPS_DIR, id, 'renders');
  if (!fs.existsSync(rendersDir)) return { id, source: null, reason: 'no renders/ directory' };
  const mp4s = fs.readdirSync(rendersDir).filter((f) => f.endsWith('.mp4'));
  if (mp4s.length === 0) return { id, source: null, reason: 'no .mp4 in renders/' };

  const withTime = mp4s
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(rendersDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const chosen = withTime[0];
  const canonical = withTime.find((f) => f.name === `${id}.mp4`);
  const staleCanonical =
    canonical && canonical.name !== chosen.name && canonical.mtime < chosen.mtime
      ? canonical.name
      : null;

  return {
    id,
    source: path.join(rendersDir, chosen.name),
    picked: chosen.name,
    candidates: mp4s.length,
    staleCanonical,
  };
}

function compositions() {
  if (!fs.existsSync(CLIPS_DIR)) fail(`${CLIPS_DIR} does not exist`);
  // An underscore prefix marks scaffolding, not a clip: _template renders from
  // a placeholder capture and has no place in media/web or the manifest.
  return fs.readdirSync(CLIPS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .filter((e) => fs.existsSync(path.join(CLIPS_DIR, e.name, 'index.html')))
    .map((e) => e.name)
    .sort();
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

// ------------------------------------------------------------------ the encode

async function renderOne(entry, opts) {
  const { id, source } = entry;
  const outDir = path.resolve(ROOT, opts.out);
  const webm = path.join(outDir, `${id}.webm`);
  const mp4 = path.join(outDir, `${id}.mp4`);
  const poster = path.join(outDir, `${id}-poster.png`);
  const xCrop = path.join(outDir, `${id}-x16x9.png`);
  const logPrefix = path.join(outDir, `.pass-${id}`);
  const vf = videoFilter(opts.width);
  const common = ['-y', '-v', 'error', '-i', source, '-an', '-sn', '-dn', '-map_metadata', '-1', '-vf', vf];

  if (!opts.verifyOnly) {
    await run('ffmpeg', [...common, ...vp9Args(opts.vp9Crf, 1, logPrefix), '-f', 'null', os.devNull]);
    await run('ffmpeg', [...common, ...vp9Args(opts.vp9Crf, 2, logPrefix), webm]);
    for (const leftover of fs.readdirSync(outDir)) {
      if (leftover.startsWith(`.pass-${id}`)) fs.rmSync(path.join(outDir, leftover));
    }
    await run('ffmpeg', [...common, ...h264Args(opts.h264Crf), mp4]);
    // Poster comes out of the encoded WebM, not the source, so it is the picture the
    // player paints on its first decoded frame rather than a near miss.
    await run('ffmpeg', ['-y', '-v', 'error', '-i', webm, ...posterArgs, poster]);
    // The 16:9 crop is the social card. The composition frame is 1.577:1, so a
    // 16:9 card loses height, never width: a centred vertical crop keeps the
    // subject the camera was already framing and never cuts a rail in half.
    await run('ffmpeg', [
      '-y', '-v', 'error', '-i', poster,
      '-vf', 'crop=iw:floor(iw*9/16/2)*2:0:(ih-floor(iw*9/16/2)*2)/2',
      ...posterArgs, xCrop,
    ]);
  }

  for (const f of [webm, mp4, poster, xCrop]) {
    if (!fs.existsSync(f)) throw new Error(`${path.relative(ROOT, f)} is missing`);
  }

  const webmHash = await frameZeroHash(webm);
  const posterHash = await frameZeroHash(poster);
  const mp4Drift = await frameZeroMaxDiff(mp4, poster);

  return {
    id,
    source,
    sourceBytes: fs.statSync(source).size,
    webmBytes: fs.statSync(webm).size,
    mp4Bytes: fs.statSync(mp4).size,
    posterBytes: fs.statSync(poster).size,
    xCropBytes: fs.statSync(xCrop).size,
    posterExact: webmHash.md5 === posterHash.md5,
    posterHash: posterHash.md5,
    mp4Drift,
    out: probe(webm),
  };
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  }));
  return results;
}

// ------------------------------------------------------------------------ main

async function main() {
  const argv = process.argv.slice(2);
  const opts = { ...DEFAULTS, verifyOnly: false, list: false };
  const names = [];
  for (const arg of argv) {
    if (arg === '--list') opts.list = true;
    else if (arg === '--verify-only') opts.verifyOnly = true;
    else if (arg.startsWith('--width=')) opts.width = Number(arg.slice(8));
    else if (arg.startsWith('--vp9-crf=')) opts.vp9Crf = Number(arg.slice(10));
    else if (arg.startsWith('--h264-crf=')) opts.h264Crf = Number(arg.slice(11));
    else if (arg.startsWith('--out=')) opts.out = arg.slice(6);
    else if (arg.startsWith('--jobs=')) opts.jobs = Math.max(1, Number(arg.slice(7)));
    else if (arg.startsWith('--')) fail(`unknown flag ${arg}`);
    else names.push(arg);
  }

  if (!haveBinary('ffmpeg') || !haveBinary('ffprobe')) {
    fail('ffmpeg and ffprobe are required and were not found on PATH. Install them (brew install ffmpeg) and re-run. Nothing was written.');
  }

  const all = compositions();
  const wanted = names.length ? names : all;
  const unknown = wanted.filter((n) => !all.includes(n));
  if (unknown.length) fail(`no composition named ${unknown.join(', ')}. Known: ${all.join(', ')}`);

  const entries = wanted.map(sourceFor);
  const missing = entries.filter((e) => !e.source);
  const ready = entries.filter((e) => e.source);

  for (const m of missing) {
    console.log(`skip  ${m.id.padEnd(18)} ${m.reason}, nothing to encode from`);
  }

  if (opts.list) {
    for (const e of ready) {
      const info = probe(e.source);
      console.log(`${e.id.padEnd(18)} ${e.picked}  ${info ? `${info.width}x${info.height} ${info.fps.toFixed(0)}fps ${info.duration.toFixed(1)}s` : 'unprobeable'}  (${e.candidates} candidate${e.candidates === 1 ? '' : 's'})`);
    }
    return;
  }

  if (ready.length === 0) fail('no source MP4 found for any requested composition. Render the compositions first (npm run render in the composition directory).');

  // A canonical <id>.mp4 that is older than the take actually being encoded is
  // worth naming, because the canonical name is what everything else assumes is
  // current. Encoding proceeds from the newest either way.
  for (const e of ready.filter((entry) => entry.staleCanonical)) {
    console.log(`note  ${e.id.padEnd(18)} using ${e.picked}; ${e.staleCanonical} is older and was skipped`);
  }

  const outDir = path.resolve(ROOT, opts.out);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`${opts.verifyOnly ? 'Verifying' : 'Encoding'} ${ready.length} composition${ready.length === 1 ? '' : 's'} at ${opts.width}px wide, VP9 crf ${opts.vp9Crf}, H.264 crf ${opts.h264Crf}, ${opts.jobs} at a time.\n`);

  const started = Date.now();
  const rows = await pool(ready, opts.jobs, async (entry) => {
    const row = await renderOne(entry, opts);
    console.log(`  ${row.id.padEnd(18)} webm ${kb(row.webmBytes).padStart(7)}  mp4 ${kb(row.mp4Bytes).padStart(7)}  poster ${kb(row.posterBytes).padStart(7)}  ${row.posterExact ? 'poster == frame 0' : 'POSTER MISMATCH'}`);
    return row;
  });

  const sum = (key) => rows.reduce((n, r) => n + r[key], 0);
  const webmTotal = sum('webmBytes');
  const mp4Total = sum('mp4Bytes');
  const posterTotal = sum('posterBytes');
  const total = webmTotal + mp4Total + posterTotal;

  console.log('');
  console.log(`  WebM   ${mb(webmTotal).padStart(9)}`);
  console.log(`  MP4    ${mb(mp4Total).padStart(9)}`);
  console.log(`  Poster ${mb(posterTotal).padStart(9)}`);
  console.log(`  Total  ${mb(total).padStart(9)}  across ${rows.length} clips`);
  console.log(`  One visitor fetches posters plus one video format: ${mb(posterTotal + webmTotal)} on VP9 browsers, ${mb(posterTotal + mp4Total)} on Safari.`);
  console.log(`  Sources on disk were ${mb(sum('sourceBytes'))}. Took ${((Date.now() - started) / 1000).toFixed(0)}s.`);

  const drifted = rows.filter((r) => r.mp4Drift > 0);
  if (drifted.length) {
    const worst = Math.max(...drifted.map((r) => r.mp4Drift));
    console.log(`\n  Note: the H.264 fallback's own frame zero differs from the poster by up to ${worst}/255 per channel (a different lossy encoder, same picture). The poster is exact against the WebM, which is what non-Safari browsers play.`);
  }

  const bad = rows.filter((r) => !r.posterExact);
  if (bad.length) {
    console.error(`\nfail: poster is not frame zero for ${bad.map((r) => r.id).join(', ')}`);
    process.exit(1);
  }
}

main().catch((err) => fail(err.message));
