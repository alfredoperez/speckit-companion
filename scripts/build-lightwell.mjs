#!/usr/bin/env node
/**
 * Paint the light the product frames sit in front of.
 *
 *   npm run lightwell
 *
 * A "lightwell" is a focal core of light directly behind the TOP EDGE of a
 * product frame, spilling upward into a haze with stars in it. It is not a wash
 * over a section: the page around it stays black, and that contrast is the
 * whole effect.
 *
 * WHY THIS IS A RENDERED ASSET AND NOT CSS, in order of how much each matters:
 *
 *   1. A large low-alpha radial-gradient over near-black BANDS. The steps in an
 *      8-bit ramp are further apart than the gradient's own increments, so the
 *      falloff renders as visible rings on most displays. A rasterized asset
 *      gets dithered on the way out and stays smooth.
 *   2. Stars have to be individual points. The page already has a CSS particle
 *      field and it is 21 dots that are `display: none` at rest, so a visitor
 *      with reduced motion sees a flat page. Baking the stars in fixes that:
 *      the light is there whether anything animates or not.
 *   3. A stack of CSS glow gradients is the tell the design linter calls slop,
 *      and it is right. Painting the light properly is the answer, not
 *      suppressing the rule.
 *
 * DETERMINISM. Star placement runs off a seeded PRNG, so two runs of this
 * script produce byte-identical files and a re-theme is a diff you can read.
 * Nothing here reads the clock or the environment.
 *
 * RETHEMING. Everything is in VARIANTS and STAR below. The colours are the
 * site's own accent ramp; change them here and re-run.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'media', 'web');

// sharp is a dependency of the website, not of the repo root.
const require = createRequire(path.join(ROOT, 'website', 'package.json'));
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('sharp is missing. Run npm install in website/ first.');
  process.exit(1);
}

/*
  The canvas is wide and short: the light lives in the band above a frame, so
  height beyond that band is wasted bytes. 2400x1000 covers a 1200px-wide frame
  at 2x with room for the haze to fall off before the edge.
*/
const W = 2400;
const H = 1000;

/*
  The core sits at the BOTTOM of the canvas, centred. In use the asset is
  positioned so this point lands on the frame's top edge, which is what makes
  the light read as coming from behind the frame rather than floating above it.
*/
const CORE_X = W / 2;
const CORE_Y = H;

/*
  How much wider than tall the light is. A round glow behind a wide frame reads
  as a bubble; a squashed one reads as light spilling along the frame's top
  edge, which is the shape in the reference. Radii below are the VERTICAL reach;
  the horizontal reach is this multiple of it.
*/
const SQUASH = 2.3;

const VARIANTS = [
  {
    id: 'hero',
    // Pale violet running to near-white at the centre. This is the brightest
    // thing on the page and it is allowed to be.
    core: '#e9e2ff',
    coreAlpha: 1,
    mid: '#8b5cf6',
    midAlpha: 0.62,
    coreRadius: 340,
    hazeRadius: 900,
    stars: 210,
  },
  {
    id: 'section',
    // The demo section's light answers the hero's rather than competing with
    // it: same shape, two thirds the reach, and it never reaches white.
    core: '#cdbdfb',
    coreAlpha: 0.86,
    mid: '#8b5cf6',
    midAlpha: 0.5,
    coreRadius: 270,
    hazeRadius: 740,
    stars: 150,
  },
];

const STAR = {
  // Stars cluster toward the light and thin out into the dark, the way they do
  // in the reference. A uniform scatter reads as noise laid over a gradient;
  // this reads as one thing.
  minRadius: 0.9,
  maxRadius: 2.2,
  minAlpha: 0.18,
  maxAlpha: 0.95,
  colour: '#f2ecff',
  // No star inside this distance of the core, measured in the squashed space:
  // they would be invisible against the bright centre and only muddy it.
  clearance: 165,
};

/** mulberry32 — small, fast, and seeded, so the field never moves between runs. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v) => Math.round(v * 10) / 10;

/*
  A gradient that ramps linearly to zero at a fixed radius leaves a VISIBLE ARC
  where it stops: the opacity is continuous there but its slope is not, and the
  eye reads that discontinuity as an edge. That is what made the first pass look
  like a circle pasted on the page.

  These stops follow (1 - t)^EASE instead, so the light is asymptotic — most of
  it is spent in the first third of the radius and the tail is too shallow to
  find. There is no terminus to see.

  Two curves, not one. The haze needs the steeper one because it is the layer
  whose edge would show; the core needs a gentler one or the bright centre
  collapses to a dot and the whole thing goes flat.
*/
const HAZE_EASE = 2.9;
const CORE_EASE = 1.7;

function stops(colour, peak, ease, count = 14) {
  const out = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const a = peak * Math.pow(1 - t, ease);
    out.push(`<stop offset="${n(t * 100) / 100}" stop-color="${colour}" stop-opacity="${a.toFixed(4)}"/>`);
  }
  return out.join('');
}

/*
  How far a point is from the canvas edge, 0 at the edge and 1 well inside it.
  Stars are multiplied by this so the field has no rectangular boundary — the
  other half of what made the first pass read as a pasted-on rectangle.
*/
function edgeFade(x, y) {
  const mx = Math.min(x, W - x) / (W * 0.16);
  const my = Math.min(y, H - y) / (H * 0.2);
  return Math.max(0, Math.min(1, mx)) * Math.max(0, Math.min(1, my));
}

function stars(count, seed, reach) {
  const rand = rng(seed);
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 60) {
    guard++;
    const x = rand() * W;
    // Bias upward: sqrt pulls the distribution toward the core's own row, so
    // the field thickens where the haze is brightest.
    const y = H - Math.sqrt(rand()) * H;

    // Measured in the same squashed space the haze uses, so the star field and
    // the light share one shape instead of a circle inside an ellipse.
    const d = Math.hypot((x - CORE_X) / SQUASH, y - CORE_Y);
    if (d < STAR.clearance) continue;

    const fade = edgeFade(x, y);
    if (fade <= 0.02) continue;

    const near = Math.max(0, 1 - d / reach);
    const alpha =
      (STAR.minAlpha + (STAR.maxAlpha - STAR.minAlpha) * near * (0.45 + rand() * 0.55)) * fade;
    if (alpha < 0.06) continue;

    const r = STAR.minRadius + (STAR.maxRadius - STAR.minRadius) * rand() * (0.4 + near * 0.6);
    out.push(
      `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${STAR.colour}" opacity="${n(alpha)}"/>`,
    );
  }
  return out.join('');
}

/*
  The light is a WIDE LOW DOME, not a circle. Scaling the gradient's x by SQUASH
  around the core spreads it along the frame's top edge, which is the shape in
  the reference and the shape a light source behind a wide object actually
  makes.
*/
function squash() {
  return `translate(${n(CORE_X)} ${n(CORE_Y)}) scale(${SQUASH} 1) translate(${n(-CORE_X)} ${n(-CORE_Y)})`;
}

/*
  The haze does not reach zero by the canvas's left and right edges — along the
  core's own row it is still a few percent when it runs out of image — so the
  asset terminated in a visible vertical line. Everything is masked to fade out
  before the boundary instead. Two masks rather than one because SVG has no
  two-axis gradient; nesting them multiplies.

  The bottom edge is not faded: that is where the core is, and the frame covers
  it.
*/
function edgeMasks() {
  return `<linearGradient id="fx" x1="0" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#000"/>
      <stop offset="0.14" stop-color="#fff"/>
      <stop offset="0.86" stop-color="#fff"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>
    <linearGradient id="fy" x1="0" y1="0" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#000"/>
      <stop offset="0.22" stop-color="#fff"/>
      <stop offset="1" stop-color="#fff"/>
    </linearGradient>
    <mask id="mx"><rect width="${W}" height="${H}" fill="url(#fx)"/></mask>
    <mask id="my"><rect width="${W}" height="${H}" fill="url(#fy)"/></mask>`;
}

function svg(v) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${edgeMasks()}
    <radialGradient id="haze" cx="${CORE_X}" cy="${CORE_Y}" r="${v.hazeRadius}" gradientUnits="userSpaceOnUse" gradientTransform="${squash()}">
      ${stops(v.mid, v.midAlpha, HAZE_EASE)}
    </radialGradient>
    <radialGradient id="core" cx="${CORE_X}" cy="${CORE_Y}" r="${v.coreRadius}" gradientUnits="userSpaceOnUse" gradientTransform="${squash()}">
      ${stops(v.core, v.coreAlpha, CORE_EASE)}
    </radialGradient>
  </defs>
  <g mask="url(#mx)"><g mask="url(#my)">
    <rect width="${W}" height="${H}" fill="url(#haze)"/>
    <g>${stars(v.stars, 0x5eed + v.id.length, v.hazeRadius * 0.9)}</g>
    <rect width="${W}" height="${H}" fill="url(#core)"/>
  </g></g>
</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });

for (const v of VARIANTS) {
  const dest = path.join(OUT, `lightwell-${v.id}.webp`);
  // Alpha is the point: this composites over whatever the page paints.
  await sharp(Buffer.from(svg(v)), { density: 96 })
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toFile(dest);
  const kb = (fs.statSync(dest).size / 1024).toFixed(0);
  console.log(`lightwell-${v.id.padEnd(10)} ${W}x${H}  ${v.stars} stars  ${kb} KB`);
}

console.log('\nCopy to the site with: npm run clips:sync');
