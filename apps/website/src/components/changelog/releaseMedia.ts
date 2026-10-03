/**
 * The screenshots on the changelog page.
 *
 * The changelog text is parsed out of the two CHANGELOG.md files. Screenshots
 * attach from the outside: a highlight's site-only comment names media ids
 * (`<!-- area: copilot-app; pr: 787; media: copilot-board, copilot-tasks -->`),
 * and `content/media/changelog.json` says what each id is, keyed by release:
 *
 *   "vscode@0.34.0": {
 *     "copilot-board": {
 *       "file": "apps/website/public/canvas/board.png",
 *       "alt": "What the image shows, for someone who cannot see it.",
 *       "caption": "One line under the image.",
 *       "highlight": { "x": 755, "y": 310, "w": 1625, "h": 510 }
 *     }
 *   }
 *
 * `file` is a repo-relative PNG under `apps/website/public/` (served as is) or
 * `docs/screenshots/generated/` (bundled by the build). `highlight` is optional
 * and is in the image's own pixels; the page dims everything outside it and
 * outlines it, so the source image stays clean. Every image sits in the same
 * 16:9 frame, letterboxed when its own shape differs.
 *
 * The build fails on a media id with no entry, a missing alt, a release key
 * that matches no release, a shot no highlight uses, a missing file, and a
 * highlight box that runs off the image.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import manifest from '../../../../../content/media/changelog.json';
import type { ProductId, Release } from './parseChangelog';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ShotSource {
  file: string;
  alt: string;
  caption?: string;
  highlight?: Box;
}

/** Percentages, relative to the 16:9 frame (image) or to the image (box). */
export interface Shot {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
  image: { left: number; top: number; width: number; height: number };
  box?: { left: number; top: number; width: number; height: number };
}

const FRAME = 16 / 9;
const MANIFEST = 'content/media/changelog.json';

const bundled = import.meta.glob('../../../../../docs/screenshots/generated/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const bundledByPath = new Map(
  Object.entries(bundled).map(([key, url]) => [key.replace(/^(\.\.\/)+/, ''), url])
);

export function mediaKey(product: ProductId, version: string | null): string {
  return `${product}@${version ?? 'unreleased'}`;
}

function repoRoot(): string {
  let dir = process.cwd();
  while (!(existsSync(join(dir, 'CHANGELOG.md')) && existsSync(join(dir, 'apps', 'website')))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`${MANIFEST}: cannot find the repository root from ${process.cwd()}.`);
    dir = parent;
  }
  return dir;
}

function pngSize(path: string): { width: number; height: number } {
  const head = readFileSync(path).subarray(0, 24);
  if (head.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${MANIFEST}: ${path} is not a PNG.`);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

const round = (value: number) => Math.round(value * 1000) / 1000;

function resolveShot(key: string, id: string, source: ShotSource, root: string): Shot {
  const label = `${MANIFEST} ${key} › ${id}`;
  if (!source.alt || !source.alt.trim()) throw new Error(`${label}: alt text is missing.`);
  if (!source.file) throw new Error(`${label}: file is missing.`);

  let src: string | undefined;
  if (source.file.startsWith('apps/website/public/')) {
    src = `/${source.file.slice('apps/website/public/'.length)}`;
  } else if (source.file.startsWith('docs/screenshots/generated/')) {
    src = bundledByPath.get(source.file);
  } else {
    throw new Error(`${label}: file must sit under apps/website/public/ or docs/screenshots/generated/, got ${source.file}.`);
  }
  const absolute = join(root, source.file);
  if (!src || !existsSync(absolute)) throw new Error(`${label}: ${source.file} does not exist.`);

  const { width, height } = pngSize(absolute);
  const aspect = width / height;
  const image =
    aspect >= FRAME
      ? { left: 0, width: 100, height: round((FRAME / aspect) * 100), top: 0 }
      : { top: 0, height: 100, width: round((aspect / FRAME) * 100), left: 0 };
  image.left = round((100 - image.width) / 2);
  image.top = round((100 - image.height) / 2);

  let box: Shot['box'];
  const h = source.highlight;
  if (h) {
    if ([h.x, h.y, h.w, h.h].some((n) => typeof n !== 'number' || n < 0) || h.w === 0 || h.h === 0) {
      throw new Error(`${label}: highlight needs x, y, w and h as positive numbers.`);
    }
    if (h.x + h.w > width || h.y + h.h > height) {
      throw new Error(`${label}: highlight ${JSON.stringify(h)} runs off the ${width}x${height} image.`);
    }
    box = {
      left: round((h.x / width) * 100),
      top: round((h.y / height) * 100),
      width: round((h.w / width) * 100),
      height: round((h.h / height) * 100),
    };
  }

  return { id, src, alt: source.alt.trim(), caption: source.caption, width, height, image, box };
}

/**
 * Validates the manifest against the parsed releases and returns, per release
 * key, the resolved shots by id. Called once from the page.
 */
export function resolveMedia(releases: Release[]): Map<string, Map<string, Shot>> {
  const root = repoRoot();
  const byKey = new Map(releases.map((release) => [mediaKey(release.product, release.version), release]));
  const resolved = new Map<string, Map<string, Shot>>();
  const entries = Object.entries(manifest as Record<string, Record<string, ShotSource> | string>);
  const sources = new Map(entries.filter(([key]) => !key.startsWith('_'))) as Map<string, Record<string, ShotSource>>;

  for (const release of releases) {
    const key = mediaKey(release.product, release.version);
    for (const highlight of release.highlights) {
      for (const id of highlight.media) {
        if (!sources.get(key)?.[id]) {
          throw new Error(
            `${key} highlight "${highlight.title}" names media "${id}", which ${MANIFEST} does not define under "${key}".`
          );
        }
      }
    }
  }

  for (const [key, shots] of entries) {
    if (key.startsWith('_')) continue;
    const release = byKey.get(key);
    if (!release) {
      throw new Error(
        `${MANIFEST}: no release matches "${key}". Keys are <product>@<version>, product one of vscode or speckit, version written exactly as in that CHANGELOG.md heading.`
      );
    }
    const used = new Set(release.highlights.flatMap((highlight) => highlight.media));
    const map = new Map<string, Shot>();
    for (const [id, source] of Object.entries(shots as Record<string, ShotSource>)) {
      if (!used.has(id)) {
        throw new Error(`${MANIFEST} ${key} › ${id}: no highlight in ${key} names this media id.`);
      }
      map.set(id, resolveShot(key, id, source, root));
    }
    resolved.set(key, map);
  }

  return resolved;
}
