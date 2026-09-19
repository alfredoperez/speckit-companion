#!/usr/bin/env node
/**
 * Start a new feature clip.
 *
 *   npm run clips:new -- <id> "Human readable name"
 *
 * Copies media/feature-clips/_template into a new composition, substitutes the
 * id and name through every file that carries one, adds a CLIP_CAPTURES stub to
 * scripts/capture-docs-images.mjs, and registers the feature in
 * media/manifest.json.
 *
 * The point is that a new clip inherits the CURRENT caption, scrim and pacing
 * rules instead of whichever neighbouring composition happened to get copied.
 * Every one of those lives in the template's :root block and its BEATS comment,
 * so they travel automatically.
 *
 * It writes a working clip: the template renders as-is against a placeholder
 * capture, so `npm run render` in the new directory succeeds before you have
 * shot anything. Replace the capture, measure real rects, and the clip is real.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS = path.join(ROOT, 'media', 'feature-clips');
const TEMPLATE = path.join(CLIPS, '_template');
const CAPTURES = path.join(ROOT, 'scripts', 'capture-docs-images.mjs');
const MANIFEST = path.join(ROOT, 'media', 'manifest.json');

const fail = (msg) => {
  console.error(`new-clip: ${msg}`);
  process.exit(1);
};

const [, , id, ...nameParts] = process.argv;

if (!id || id.startsWith('-')) {
  fail('usage: npm run clips:new -- <id> "Human readable name"');
}
if (!/^[a-z][a-z0-9-]*$/.test(id)) {
  fail(`id "${id}" must be lower-case letters, digits and hyphens, starting with a letter`);
}
if (id.startsWith('_')) fail('an underscore prefix marks scaffolding, not a clip');

const name = nameParts.join(' ') || id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const dest = path.join(CLIPS, id);

if (!fs.existsSync(TEMPLATE)) fail(`${path.relative(ROOT, TEMPLATE)} is missing`);
if (fs.existsSync(dest)) fail(`media/feature-clips/${id} already exists`);

// ------------------------------------------------------------------ copy

const substitute = (text) => text.split('__ID__').join(id).split('__NAME__').join(name);
const TEXT = new Set(['.html', '.json', '.md']);

const copy = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const out = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copy(src, out);
    } else if (TEXT.has(path.extname(entry.name))) {
      fs.writeFileSync(out, substitute(fs.readFileSync(src, 'utf8')));
    } else {
      fs.copyFileSync(src, out);
    }
  }
};

copy(TEMPLATE, dest);

// ------------------------------------------------- capture-docs-images stub

// The list is what `npm run clips:capture -- --clips <id>` reads. Without an
// entry the composition has no reproducible way back to its own pixels, which
// is the failure that left ten clips reading ad-hoc captures.
let captureNote = 'added a CLIP_CAPTURES stub';
const capturesSrc = fs.readFileSync(CAPTURES, 'utf8');
const anchor = 'const CLIP_CAPTURES = [\n';
if (!capturesSrc.includes(anchor)) {
  captureNote = 'COULD NOT add a CLIP_CAPTURES stub: the array was not found';
} else {
  const stub =
    anchor +
    `    // ${id}: replace the story ids below with the real capture stories, then\n` +
    `    // shoot them with: npm run clips:capture -- --clips ${id}\n` +
    `    { clip: '${id}', story: 'REPLACE-ME--story-id', out: 'placeholder.png' },\n\n`;
  fs.writeFileSync(CAPTURES, capturesSrc.replace(anchor, stub));
}

// ------------------------------------------------------------- manifest

let manifestNote = 'registered in media/manifest.json';
try {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (manifest.features.some((f) => f.id === id)) {
    manifestNote = 'already present in media/manifest.json, left alone';
  } else {
    manifest.features.push({
      id,
      name,
      kind: 'clip',
      status: 'draft',
      composition: `media/feature-clips/${id}`,
      films: 'TODO: one sentence on what this clip shows, in order.',
      claim: '',
      outputs: {
        canonicalMp4: `media/feature-clips/${id}/renders/${id}.mp4`,
        webWebm: `media/web/${id}.webm`,
        webMp4: `media/web/${id}.mp4`,
        poster: `media/web/${id}-poster.png`,
        xCrop: `media/web/${id}-x16x9.png`,
      },
      unnormalized: [],
      alt: {},
      referencedBy: {},
      notes: 'Created from _template. Replace the placeholder capture before publishing.',
    });
    fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  }
} catch (err) {
  manifestNote = `COULD NOT register in media/manifest.json: ${err.message}`;
}

// ------------------------------------------------------------------ report

console.log(`\nCreated media/feature-clips/${id}  ("${name}")`);
console.log(`  ${captureNote}`);
console.log(`  ${manifestNote}`);
console.log(`
Next, in order:

  1. Write the capture stories, then point the CLIP_CAPTURES stub at them:
       scripts/capture-docs-images.mjs
  2. Shoot them:
       npm run clips:capture -- --clips ${id}
  3. Measure each region you want to name. Rects are real getBoundingClientRect
     boxes in the capture's own CSS pixels, and the capture is DPR 2, so a
     2448x1552 file is 1224x776 here. Put them in BEATS in index.html.
  4. Write the beats into STORYBOARD.md so the two agree, then:
       npm run clips:check
  5. Render and encode:
       (cd media/feature-clips/${id} && npm run render)
       npm run clips:render -- ${id}
       npm run clips:sync
`);
