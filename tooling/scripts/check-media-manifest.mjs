#!/usr/bin/env node
/**
 * Validates media/manifest.json against the filesystem and against both READMEs.
 *
 *   node scripts/check-media-manifest.mjs
 *
 * Three questions, in order of how much a failure hurts:
 *
 *   1. Does every image the READMEs reference appear in the manifest, at its
 *      exact current path, with the alt text the README actually uses?
 *      A miss here is a publishing bug: the Marketplace resolves README images
 *      against current main, so a dropped or renamed file 404s the live listing.
 *   2. Does every published path in the manifest exist on disk?
 *   3. Which outputs the contract names have not been produced yet?
 *
 * Every web output (WebM, MP4 fallback, poster, 16:9 crop) is produced by
 * scripts/render-web-clips.mjs, so a clean tree exits 0. Pending outputs are
 * still reported separately from real breakage, because a fresh clone has no
 * gitignored renders and that is correct rather than a regression.
 *
 * Exit codes: 0 clean, 1 pending work only, 2 something is actually broken.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(REPO_ROOT, 'media', 'manifest.json');
const RAW_PREFIX = 'https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/';

const VIDEO_KEYS = ['canonicalMp4', 'webWebm', 'webMp4'];
const IMAGE_KEYS = ['poster', 'xCrop', 'readmeGif', 'docsStill'];

const c = process.stdout.isTTY
    ? { red: (s) => `\x1b[31m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` }
    : { red: (s) => s, yellow: (s) => s, green: (s) => s, dim: (s) => s, bold: (s) => s };

/** Where a path lives decides whether its absence is breakage or pending work. */
function bucket(path) {
    if (path.startsWith('media/web/')) return 'pending';
    if (path.includes('/renders/')) return 'render';
    return 'published';
}

/** Every image reference in a README, normalized to a repo-relative path. */
function readmeImages(file) {
    const text = readFileSync(join(REPO_ROOT, file), 'utf8');
    const found = [];

    for (const m of text.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) {
        found.push({ alt: m[1], src: m[2] });
    }
    for (const m of text.matchAll(/<img\b[^>]*>/g)) {
        const src = /src="([^"]+)"/.exec(m[0]);
        const alt = /alt="([^"]*)"/.exec(m[0]);
        if (src) found.push({ alt: alt ? alt[1] : '', src: src[1] });
    }

    return found
        .map((ref) => ({ ...ref, src: ref.src.startsWith(RAW_PREFIX) ? ref.src.slice(RAW_PREFIX.length) : ref.src }))
        .filter((ref) => !/^https?:\/\//.test(ref.src))
        .map((ref) => ({ ...ref, src: ref.src.replace(/^\.\//, '') }));
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

const broken = [];
const pending = [];
const local = [];

// Index every path the manifest owns, so README references can be checked against it.
const indexed = new Map(); // path -> { featureId, alt }

for (const f of manifest.features) {
    const paths = [];
    for (const key of [...VIDEO_KEYS, ...IMAGE_KEYS]) {
        if (f.outputs[key]) paths.push([key, f.outputs[key]]);
    }
    for (const p of f.outputs.extraStills ?? []) paths.push(['extraStills', p]);

    const missing = [];
    for (const [key, path] of paths) {
        indexed.set(path, { featureId: f.id, alt: (f.alt ?? {})[path] });
        if (!existsSync(join(REPO_ROOT, path))) missing.push({ key, path, where: bucket(path) });
    }

    if (f.composition && !existsSync(join(REPO_ROOT, f.composition))) {
        missing.push({ key: 'composition', path: f.composition, where: f.status === 'planned' ? 'pending' : 'published' });
    }

    for (const [key, path] of paths) {
        const alt = (f.alt ?? {})[path];
        const needsAlt = key !== 'canonicalMp4' && key !== 'webWebm' && key !== 'webMp4';
        if (needsAlt && (alt === undefined || alt === '')) {
            pending.push(`${f.id}: no alt text yet for ${path}`);
        }
    }

    if (missing.length) {
        console.log(`\n${c.bold(f.id)} ${c.dim(`(${f.kind}, ${f.status})`)}`);
        for (const m of missing) {
            const line = `  ${m.key.padEnd(14)} ${m.path}`;
            if (m.where === 'published') {
                console.log(`  ${c.red('MISSING ')}${line.trim()}`);
                broken.push(`${f.id}: published output missing on disk: ${m.path}`);
            } else if (m.where === 'render') {
                console.log(`  ${c.dim('not built')} ${line.trim()}`);
                local.push(`${f.id}: ${m.path}`);
            } else {
                console.log(`  ${c.yellow('pending ')}${line.trim()}`);
                pending.push(`${f.id}: ${m.key} not produced yet: ${m.path}`);
            }
        }
        if (f.unnormalized?.length) {
            console.log(`  ${c.yellow('pending ')}${f.unnormalized.length} timestamped render(s) still to collapse into the canonical name`);
        }
    }
}

// The load-bearing check: nothing a README shows may be absent from the manifest.
for (const file of ['README.md', 'speckit-extension/README.md']) {
    for (const ref of readmeImages(file)) {
        const entry = indexed.get(ref.src);
        if (!entry) {
            broken.push(`${file} references ${ref.src}, which is not in media/manifest.json`);
            continue;
        }
        if (!existsSync(join(REPO_ROOT, ref.src))) {
            broken.push(`${file} references ${ref.src}, which does not exist on disk`);
        }
        if (entry.alt !== undefined && entry.alt !== ref.alt) {
            broken.push(`${file}: alt text for ${ref.src} has drifted from the manifest`);
        }
        const claimed = manifest.features.find((f) => f.id === entry.featureId)?.referencedBy?.[ref.src] ?? [];
        if (!claimed.includes(file)) {
            broken.push(`${entry.featureId}: referencedBy does not list ${file} for ${ref.src}`);
        }
    }
}

// And the reverse: no manifest entry may claim a README reference that is gone.
for (const f of manifest.features) {
    for (const [path, files] of Object.entries(f.referencedBy ?? {})) {
        for (const file of files) {
            const refs = readmeImages(file).map((r) => r.src);
            if (!refs.includes(path)) {
                broken.push(`${f.id}: manifest says ${file} references ${path}, but it does not`);
            }
        }
    }
}

console.log(`\n${c.bold('Summary')}`);
console.log(`  features          ${manifest.features.length}`);
console.log(`  broken            ${broken.length}`);
console.log(`  pending outputs   ${pending.length}`);
console.log(`  not built locally ${local.length}`);

if (local.length) {
    console.log(`\n${c.dim('Not built locally: media/feature-clips/*/renders/ is gitignored (media/.gitignore). These rebuild with `npm run render` in the composition directory, and a fresh clone will always list them.')}`);
}

if (pending.length) {
    console.log(`\n${c.yellow('Pending')} ${c.dim('(named in the contract, not produced yet: run npm run clips:render)')}`);
    for (const p of pending) console.log(`  ${p}`);
}

if (broken.length) {
    console.log(`\n${c.red('Broken')} ${c.dim('(fix these: they affect a published surface)')}`);
    for (const b of broken) console.log(`  ${b}`);
    console.log(`\n${c.red('FAIL')} something a README depends on is wrong.`);
    process.exit(2);
}

if (pending.length) {
    console.log(`\n${c.yellow('INCOMPLETE')} nothing is broken. The outputs above have not been produced yet, so this run exits non-zero on purpose. It will exit 0 once the web render branch (T5) and the composition normalization (T6) land.`);
    process.exit(1);
}

console.log(`\n${c.green('OK')} every output in the manifest exists and both READMEs agree with it.`);
