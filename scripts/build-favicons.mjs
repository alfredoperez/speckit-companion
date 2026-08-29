#!/usr/bin/env node
/**
 * Render the favicon PNGs from favicon.svg.
 *
 *   npm run favicons
 *
 * The two PNGs used to be made by hand, so a change to the mark left them
 * showing the old one. They are derived now: edit MascotMark.astro, mirror the
 * body path into public/favicon.svg, then run this.
 *
 * Both sizes are opaque. The mark's eyes are holes in the body path, so on a
 * transparent icon they would take the colour of whatever tab bar the browser
 * painted, which is white as often as it is dark.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'website', 'public');
const SRC = path.join(PUBLIC, 'favicon.svg');

// sharp is a dependency of the website, not of the repo root.
const require = createRequire(path.join(ROOT, 'website', 'package.json'));
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('sharp is missing. Run npm install in website/ first.');
  process.exit(1);
}

if (!fs.existsSync(SRC)) {
  console.error(`${path.relative(ROOT, SRC)} is missing.`);
  process.exit(1);
}

const svg = fs.readFileSync(SRC);
const SIZES = [32, 180];

for (const size of SIZES) {
  const out = path.join(PUBLIC, `favicon-${size}.png`);
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toFile(out);
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`favicon-${size}.png  ${size}x${size}  ${kb} KB`);
}
