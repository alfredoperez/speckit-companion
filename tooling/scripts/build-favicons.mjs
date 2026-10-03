#!/usr/bin/env node
/**
 * Build the site's favicons from the moss mascot.
 *
 *   npm run favicons
 *
 * Sources live in assets/icons/, outputs in apps/website/public/:
 *
 *   favicon.svg      copy of moss-16.svg with a title, what current browsers pick
 *   favicon-32.png   moss-16.svg at 32px, the fallback (and the 2x tab icon)
 *   favicon-180.png  the full moss.svg on the site ground, the iOS home-screen icon
 *
 * moss-16.svg is the simplified cut: at 16px the full mascot's face closes into a
 * green blob, so the small sizes never shrink moss.svg. The 180 has room for the
 * real artwork, and it is opaque because iOS paints a transparent icon black.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC = path.join(ROOT, 'apps', 'website', 'public');
const SMALL = path.join(ROOT, 'assets', 'icons', 'moss-16.svg');
const FULL = path.join(ROOT, 'assets', 'icons', 'moss.svg');
const GROUND = '#0a0913';

// sharp is a dependency of the website, not of the repo root.
const require = createRequire(path.join(ROOT, 'apps', 'website', 'package.json'));
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('sharp is missing. Run npm install in apps/website/ first.');
  process.exit(1);
}

for (const src of [SMALL, FULL]) {
  if (!fs.existsSync(src)) {
    console.error(`${path.relative(ROOT, src)} is missing.`);
    process.exit(1);
  }
}

const report = (file, size) => {
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`${path.basename(file)}  ${size}  ${kb} KB`);
};

const small = fs.readFileSync(SMALL, 'utf8');
const faviconSvg = path.join(PUBLIC, 'favicon.svg');
fs.writeFileSync(
  faviconSvg,
  small
    .replace(/\n *<!--[\s\S]*?-->/g, '')
    .replace(/<svg([^>]*)>/, '<svg$1 role="img" aria-label="SpecKit Companion">\n  <title>SpecKit Companion</title>'),
);
report(faviconSvg, 'svg');

const png32 = path.join(PUBLIC, 'favicon-32.png');
await sharp(Buffer.from(small), { density: 384 })
  .resize(32, 32, { fit: 'contain' })
  .png({ compressionLevel: 9 })
  .toFile(png32);
report(png32, '32x32');

const png180 = path.join(PUBLIC, 'favicon-180.png');
const art = await sharp(fs.readFileSync(FULL), { density: 900 })
  .resize(150, 150, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: GROUND } })
  .composite([{ input: art, left: 15, top: 6 }])
  .png({ compressionLevel: 9 })
  .toFile(png180);
report(png180, '180x180');
