#!/usr/bin/env node
/**
 * Render the favicon PNGs from favicon.svg.
 *
 *   npm run favicons
 *
 * The two PNGs used to be made by hand, so a change to the mark left them
 * showing the old one. They are derived now: edit public/favicon.svg, then run
 * this.
 *
 * favicon.svg is the SMALL CUT of the logo, not the full mark. The full mark
 * lives in website/src/components/LogoMark.astro and is never the source here:
 * its checkmark is gone by 32px and the whole thing is a blob by 16. Keep the
 * two in the same family by hand, and re-measure at real pixels after a change
 * rather than shrinking a big render.
 *
 * Both sizes are opaque. The pale chevron on a transparent icon would take the
 * colour of whatever tab bar the browser painted, which is white as often as
 * it is dark.
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
