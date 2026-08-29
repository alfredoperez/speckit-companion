#!/usr/bin/env node
// Copies the web-facing clip outputs named by media/manifest.json into
// website/public/media, so the site can serve them from /media.
//
// The manifest is the only source of truth. Nothing is discovered by globbing
// media/web, and nothing is copied that the manifest does not name.
//
// Which files that means is derived, not hardcoded:
//   1. take every surface whose id starts with "site-"
//   2. union the output keys those surfaces read
//   3. keep the keys whose declared path sits under manifest.site.sourceDir
//
// Today that resolves to webWebm, webMp4 and poster. The full-size canonical
// MP4s under media/feature-clips/<id>/renders/ are read by no site surface and
// live outside sourceDir, so they can never enter the set. Neither can xCrop,
// which only the social-x surface reads.
//
// Usage:
//   node scripts/sync-media.mjs            copy, prune, report
//   node scripts/sync-media.mjs --check    report only, write nothing
//   node scripts/sync-media.mjs --quiet    only the summary and any problems

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const websiteDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(websiteDir, '..');
const manifestPath = path.join(repoRoot, 'media', 'manifest.json');

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const quiet = args.has('--quiet');

const log = (line) => {
  if (!quiet) console.log(line);
};

/** Repo-relative POSIX path -> absolute path, with a containment check. */
function resolveInRepo(relPosix) {
  const abs = path.resolve(repoRoot, relPosix.split('/').join(path.sep));
  if (abs !== repoRoot && !abs.startsWith(repoRoot + path.sep)) {
    throw new Error(`Manifest path escapes the repo: ${relPosix}`);
  }
  return abs;
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// Never copyable, whatever a surface claims to read. These are the full-size
// canonical renders; they are big, they live outside sourceDir, and no page
// should ever fetch one.
const FORBIDDEN_KEYS = new Set(['canonicalMp4']);

/**
 * The output keys the site is allowed to copy, derived from the manifest's own
 * surface declarations rather than written down here.
 *
 * A key qualifies when a site-* surface reads it AND every path any feature
 * declares for it sits under manifest.site.sourceDir. That is what keeps
 * docsStill (docs/screenshots/generated) and canonicalMp4 (feature-clips
 * renders) out, and it does not depend on the webNaming key spellings, which
 * differ from the output key spellings.
 */
function webFacingKeys(manifest) {
  const sourceDir = manifest.site?.sourceDir;
  if (!sourceDir) throw new Error('manifest.site.sourceDir is missing');

  const readKeys = new Set();
  for (const [surfaceId, surface] of Object.entries(manifest.surfaces ?? {})) {
    if (!surfaceId.startsWith('site-')) continue;
    for (const key of surface.reads ?? []) readKeys.add(key);
  }

  const keys = [...readKeys].filter((key) => {
    if (FORBIDDEN_KEYS.has(key)) return false;
    const declared = (manifest.features ?? [])
      .map((feature) => feature.outputs?.[key])
      .filter((rel) => typeof rel === 'string' && rel.length > 0);
    return declared.length > 0 && declared.every((rel) => rel.startsWith(`${sourceDir}/`));
  });

  if (keys.length === 0) {
    throw new Error('No web-facing output keys resolved from the manifest');
  }
  return { keys: keys.sort(), sourceDir };
}

/** Every file the manifest names for the site, as {featureId, key, rel}. */
function plannedFiles(manifest, keys, sourceDir) {
  const planned = [];
  const seen = new Map();

  for (const feature of manifest.features ?? []) {
    for (const key of keys) {
      const rel = feature.outputs?.[key];
      if (!rel) continue;

      if (!rel.startsWith(`${sourceDir}/`)) {
        throw new Error(
          `${feature.id}.outputs.${key} is "${rel}", outside ${sourceDir}/ — refusing to copy`
        );
      }
      const name = path.posix.basename(rel);
      if (name.includes('/') || name === '' || name.startsWith('.')) {
        throw new Error(`${feature.id}.outputs.${key} has an unusable filename: ${rel}`);
      }
      const prior = seen.get(name);
      if (prior && prior !== rel) {
        throw new Error(`Two features declare different sources for ${name}: ${prior} and ${rel}`);
      }
      seen.set(name, rel);

      planned.push({ featureId: feature.id, key, rel, name });
    }
  }
  return planned;
}

async function main() {
  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const { keys, sourceDir } = webFacingKeys(manifest);

  const publicRel = manifest.site?.publicDir;
  if (publicRel !== 'website/public/media') {
    throw new Error(`Unexpected manifest.site.publicDir: ${publicRel}`);
  }
  const publicDir = resolveInRepo(publicRel);

  const planned = plannedFiles(manifest, keys, sourceDir);

  log(`manifest   ${path.relative(repoRoot, manifestPath)}`);
  log(`source     ${sourceDir}`);
  log(`target     ${publicRel}`);
  log(`keys       ${keys.join(', ')}`);
  log('');

  if (!checkOnly) await mkdir(publicDir, { recursive: true });

  const copied = [];
  const unchanged = [];
  const missing = [];
  const expected = new Set();

  for (const item of planned) {
    const src = resolveInRepo(item.rel);
    const dest = path.join(publicDir, item.name);
    expected.add(item.name);

    if (!existsSync(src)) {
      missing.push(item);
      continue;
    }

    const srcStat = await stat(src);
    let identical = false;
    if (existsSync(dest)) {
      const destStat = await stat(dest);
      identical = destStat.size === srcStat.size && (await sha256(dest)) === (await sha256(src));
    }

    if (identical) {
      unchanged.push({ ...item, bytes: srcStat.size });
      continue;
    }

    if (!checkOnly) await copyFile(src, dest);
    copied.push({ ...item, bytes: srcStat.size });
  }

  // The target directory is generated, so anything the manifest stopped naming
  // is stale and goes. Missing sources do not prune: a file still named but not
  // yet rendered keeps whatever copy is already there.
  const stale = [];
  if (existsSync(publicDir)) {
    for (const entry of await readdir(publicDir, { withFileTypes: true })) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue;
      if (expected.has(entry.name)) continue;
      stale.push(entry.name);
      if (!checkOnly) await rm(path.join(publicDir, entry.name));
    }
  }

  for (const item of copied) log(`copy       ${item.name}  ${formatBytes(item.bytes)}`);
  for (const item of unchanged) log(`unchanged  ${item.name}`);
  for (const name of stale) log(`prune      ${name}`);
  for (const item of missing) {
    console.log(`skip       ${item.rel} is not on disk yet (${item.featureId}.${item.key})`);
  }

  let landedBytes = 0;
  let landedCount = 0;
  if (existsSync(publicDir)) {
    for (const entry of await readdir(publicDir, { withFileTypes: true })) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue;
      landedCount += 1;
      landedBytes += (await stat(path.join(publicDir, entry.name))).size;
    }
  }

  console.log('');
  console.log(
    `${checkOnly ? 'would sync' : 'synced'} ${planned.length} named files: ` +
      `${copied.length} copied, ${unchanged.length} unchanged, ` +
      `${stale.length} pruned, ${missing.length} not rendered yet`
  );
  console.log(`${publicRel}: ${landedCount} files, ${landedBytes} bytes (${formatBytes(landedBytes)})`);
}

main().catch((error) => {
  console.error(`sync-media failed: ${error.message}`);
  process.exit(1);
});
