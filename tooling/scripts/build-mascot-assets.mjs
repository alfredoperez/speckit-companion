#!/usr/bin/env node
// Derives the web-ready mascot poses the marketing site serves.
//
// Source of truth is assets/mascot/poses/, eight 2048x2048 PNGs with real alpha.
// Those files are read and never written: the guard below refuses to run if the
// output directory resolves anywhere inside assets/.
//
// For each pose this writes a WebP and a PNG fallback at 512, 256 and 128 px on
// the long edge, cropped first to the character's own alpha bounding box so no
// dead transparent margin is paid for at every size. The crop threshold drops
// the faint firefly specks scattered across the source canvas; at alpha 0 the
// box is the whole 2048 square on five of the eight poses, which is the bug
// this threshold exists to avoid.
//
// Poses keep their aspect ratio, so their pixel dimensions differ. manifest.json
// records the exact width and height of every derivative, and the site reads it
// to set width and height on the <img> and reserve the layout box before the
// bytes land.
//
// Idempotent: the encoders are deterministic and a file is only written when its
// bytes actually change, so a second run touches nothing.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(REPO_ROOT, 'assets', 'mascot', 'poses');
const PROTECTED_DIR = path.join(REPO_ROOT, 'assets');
const OUT_DIR = path.join(REPO_ROOT, 'website', 'public', 'mascot');

// The long edge of each derivative. 512 covers the hero at 2x, 256 the soon and
// 404 art, 128 the small inline placements.
const SIZES = [512, 256, 128];

// Alpha at or above this counts as the character. Below it is the dust.
const ALPHA_THRESHOLD = 16;

// sharp is a dependency of the website, not of the repo root, so it resolves
// from there rather than being added to the root manifest.
const require = createRequire(path.join(REPO_ROOT, 'website', 'package.json'));
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('sharp is missing. Run npm install in website/ first.');
  process.exit(1);
}

function assertOutputIsSafe() {
  const out = path.resolve(OUT_DIR);
  const protectedRoot = path.resolve(PROTECTED_DIR);
  if (out === protectedRoot || out.startsWith(protectedRoot + path.sep)) {
    console.error(`Refusing to write into ${protectedRoot}. It is the source of truth.`);
    process.exit(1);
  }
}

// Poses are named mascot-<pose>-<timestamp>.png. The timestamp is noise; the
// pose is the key the site addresses the file by.
function poseNameOf(filename) {
  const match = /^mascot-([a-z]+)-\d+\.png$/.exec(filename);
  return match ? match[1] : null;
}

async function alphaBoundingBox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * channels + 3] < ALPHA_THRESHOLD) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < 0) throw new Error(`${path.basename(file)} has no pixels above the alpha threshold.`);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

// A file is rewritten only when its bytes differ, so repeat runs leave mtimes
// alone and a diff of the output directory stays empty.
function writeIfChanged(file, buffer) {
  if (fs.existsSync(file) && fs.readFileSync(file).equals(buffer)) {
    return { written: false, bytes: buffer.length };
  }
  fs.writeFileSync(file, buffer);
  return { written: true, bytes: buffer.length };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  assertOutputIsSafe();

  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`No source directory at ${SOURCE_DIR}.`);
    process.exit(1);
  }

  const sources = fs
    .readdirSync(SOURCE_DIR)
    .filter((name) => name.endsWith('.png'))
    .map((name) => ({ name, pose: poseNameOf(name) }))
    .filter((entry) => entry.pose)
    .sort((a, b) => a.pose.localeCompare(b.pose));

  if (sources.length === 0) {
    console.error(`No mascot-<pose>-<timestamp>.png files in ${SOURCE_DIR}.`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest = {};
  let totalBytes = 0;
  let writtenCount = 0;

  for (const { name, pose } of sources) {
    const file = path.join(SOURCE_DIR, name);
    const box = await alphaBoundingBox(file);
    const cropped = sharp(file).extract(box);
    const variants = {};

    for (const size of SIZES) {
      const resized = cropped
        .clone()
        .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' });

      const webp = await resized
        .clone()
        .webp({ quality: 82, alphaQuality: 90, effort: 6 })
        .toBuffer({ resolveWithObject: true });
      const png = await resized
        .clone()
        .png({ compressionLevel: 9, effort: 10, palette: true, quality: 90, dither: 1 })
        .toBuffer({ resolveWithObject: true });

      const webpFile = path.join(OUT_DIR, `${pose}-${size}.webp`);
      const pngFile = path.join(OUT_DIR, `${pose}-${size}.png`);
      const webpResult = writeIfChanged(webpFile, webp.data);
      const pngResult = writeIfChanged(pngFile, png.data);

      totalBytes += webpResult.bytes + pngResult.bytes;
      writtenCount += Number(webpResult.written) + Number(pngResult.written);

      variants[size] = {
        width: webp.info.width,
        height: webp.info.height,
        webp: `/mascot/${pose}-${size}.webp`,
        png: `/mascot/${pose}-${size}.png`,
        webpBytes: webpResult.bytes,
        pngBytes: pngResult.bytes,
      };
    }

    manifest[pose] = { source: box, sizes: variants };

    const largest = variants[SIZES[0]];
    console.log(
      `${pose.padEnd(12)} crop ${String(box.width).padStart(4)}x${String(box.height).padStart(4)}` +
        `  ->  ${largest.width}x${largest.height} at ${SIZES[0]}` +
        `  webp ${formatBytes(largest.webpBytes).padStart(8)}  png ${formatBytes(largest.pngBytes).padStart(8)}`,
    );
  }

  const manifestFile = path.join(OUT_DIR, 'manifest.json');
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestResult = writeIfChanged(manifestFile, manifestBuffer);
  totalBytes += manifestResult.bytes;
  writtenCount += Number(manifestResult.written);

  const fileCount = sources.length * SIZES.length * 2 + 1;
  console.log('');
  console.log(`${fileCount} files in ${path.relative(REPO_ROOT, OUT_DIR)}, ${formatBytes(totalBytes)} total.`);
  console.log(writtenCount === 0 ? 'Nothing changed.' : `${writtenCount} file(s) written.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
