/**
 * The image seam for the changelog.
 *
 * Releases are meant to get illustrated over time with Storybook captures. The
 * changelog text itself is parsed out of the two CHANGELOG.md files and is never
 * edited here, so images attach from the outside, by release key.
 *
 * HOW TO ATTACH AN IMAGE TO A RELEASE
 *
 *   1. Put the file in `apps/website/public/changelog/`, for example
 *      `apps/website/public/changelog/vscode-0.32.0-sample-spec.png`.
 *   2. Add one entry to RELEASE_MEDIA below. The key is
 *      `<product>@<version>`, where product is `vscode` for the VS Code
 *      extension or `speckit` for the Spec Kit extension, and version is the
 *      version exactly as it appears in that product's CHANGELOG.md heading:
 *
 *        'vscode@0.32.0': {
 *          src: '/changelog/vscode-0.32.0-sample-spec.png',
 *          alt: 'The Specs view empty state offering Open a live sample.',
 *          caption: 'The sample spec, opened from an empty workspace.',
 *        },
 *
 *   3. That is the whole change. The card renders the image in its own framed
 *      block under the release header, above the entries. `caption` is optional;
 *      `alt` is not.
 *
 * A key that matches no parsed release fails the build with a named error rather
 * than rendering nothing, so a typo or a version that later gets renamed is
 * caught at build time instead of shipping a silently missing illustration.
 */

import type { ProductId, Release } from './parseChangelog';

export interface ReleaseImage {
  src: string;
  alt: string;
  caption?: string;
}

export const RELEASE_MEDIA: Record<string, ReleaseImage> = {
  'vscode@0.33.0': {
    src: '/changelog/vscode-0.33.0-pipeline-builder.png',
    alt: 'The Pipeline Builder panel, showing the specify and plan steps as columns of phases and nodes with an attached hook.',
    caption: 'The Pipeline Builder, the release this version shipped it in.',
  },
  'vscode@0.29.0': {
    src: '/changelog/vscode-0.29.0-overview.png',
    alt: 'The spec viewer Overview, annotated: intent, expectations, verified checks, decisions and coverage.',
    caption: 'The Overview, redesigned in this release from an activity feed into a durable-context dossier.',
  },
};

export function mediaKey(product: ProductId, version: string | null): string {
  return `${product}@${version ?? 'unreleased'}`;
}

export function imageFor(release: Release): ReleaseImage | undefined {
  return RELEASE_MEDIA[mediaKey(release.product, release.version)];
}

/** Build-time guard. Called once from the page. */
export function assertMediaKeysResolve(releases: Release[]): void {
  const known = new Set(releases.map((release) => mediaKey(release.product, release.version)));
  const orphans = Object.keys(RELEASE_MEDIA).filter((key) => !known.has(key));
  if (orphans.length > 0) {
    throw new Error(
      `releaseMedia.ts: no release matches ${orphans.join(', ')}. ` +
        'Keys are <product>@<version> with product one of vscode, speckit, and version ' +
        'written exactly as in that product CHANGELOG.md heading.'
    );
  }
}
