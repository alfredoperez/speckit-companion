/**
 * Parses a Keep a Changelog style markdown file into release records.
 *
 * The two CHANGELOG.md files in this repo are the only source of truth for the
 * /changelog page. Nothing here rewrites their text: the parser slices the file
 * into releases and sections and hands the raw markdown of each section on to
 * the markdown processor, so the rendered page cannot drift from the files.
 *
 * Shapes this has to survive, because both real files contain all of them:
 *   - `## [Unreleased]` with no date
 *   - `## [0.32.0] - 2026-08-26`
 *   - bullets that sit before the first `###` heading in a release
 *   - the same `###` heading twice inside one release
 *   - bullets with indented continuation paragraphs and fenced code blocks
 *   - plain paragraphs between headings
 */

export type ProductId = 'vscode' | 'speckit';

export interface ChangelogSection {
  /** The `###` heading this block sat under, or null when it sat under none. */
  title: string | null;
  /** Raw markdown, dedented to column zero, rendered later by Astro's processor. */
  markdown: string;
}

export interface Release {
  /** Stable anchor, unique across both products. */
  id: string;
  product: ProductId;
  productLabel: string;
  /** Version string as written in the heading, or null for an unreleased block. */
  version: string | null;
  date: string | null;
  unreleased: boolean;
  sections: ChangelogSection[];
}

const RELEASE_HEADING = /^##\s+(.+?)\s*$/;
const SECTION_HEADING = /^###\s+(.+?)\s*$/;
const VERSION_IN_BRACKETS = /\[([^\]]+)\]/;
const ISO_DATE = /(\d{4}-\d{2}-\d{2})/;
/** Link reference definitions at the foot of a Keep a Changelog file. */
const LINK_DEFINITION = /^\[[^\]]+\]:\s+\S+/;

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function toSection(title: string | null, lines: string[]): ChangelogSection | null {
  const markdown = lines.join('\n').replace(/^\s*\n+/, '').replace(/\s+$/, '');
  if (!markdown) return null;
  return { title, markdown };
}

export function parseChangelog(
  source: string,
  product: ProductId,
  productLabel: string
): Release[] {
  const lines = source.split(/\r?\n/);
  const releases: Release[] = [];

  let current: Release | null = null;
  let sectionTitle: string | null = null;
  let buffer: string[] = [];
  let inFence = false;

  const flushSection = () => {
    if (!current) {
      buffer = [];
      return;
    }
    const section = toSection(sectionTitle, buffer);
    if (section) {
      // Both files repeat a heading inside one release (`### Fixed` twice in a
      // row). Adjacent blocks under the same heading join, so the page shows one
      // heading rather than two. Non-adjacent repeats stay separate, in order.
      const previous = current.sections[current.sections.length - 1];
      if (previous && previous.title === section.title) {
        previous.markdown = `${previous.markdown}\n\n${section.markdown}`;
      } else {
        current.sections.push(section);
      }
    }
    buffer = [];
  };

  for (const line of lines) {
    // A fence opened inside a bullet's continuation is indented, so trim first.
    if (/^\s*```/.test(line)) inFence = !inFence;

    if (!inFence) {
      const releaseMatch = line.match(RELEASE_HEADING);
      if (releaseMatch) {
        flushSection();
        const heading = releaseMatch[1];
        const bracketed = heading.match(VERSION_IN_BRACKETS);
        const label = (bracketed ? bracketed[1] : heading.split(/\s+[-–—]\s+/)[0]).trim();
        const unreleased = /^unreleased$/i.test(label);
        const dateMatch = heading.match(ISO_DATE);
        current = {
          id: `${product}-${slugify(unreleased ? 'unreleased' : label)}`,
          product,
          productLabel,
          version: unreleased ? null : label,
          date: dateMatch ? dateMatch[1] : null,
          unreleased,
          sections: [],
        };
        releases.push(current);
        sectionTitle = null;
        continue;
      }

      const sectionMatch = line.match(SECTION_HEADING);
      if (sectionMatch) {
        flushSection();
        sectionTitle = sectionMatch[1];
        continue;
      }

      // Skip the file's own title and its preamble, plus link definitions.
      if (!current && /^#\s+/.test(line)) continue;
      if (LINK_DEFINITION.test(line)) continue;
    }

    if (current) buffer.push(line);
  }

  flushSection();

  return releases.filter((release) => release.sections.length > 0);
}

/**
 * Merges both products into one reverse chronological list.
 *
 * Sorted on the date in the heading. Two releases dated the same day keep a
 * deterministic order: newer version first within a product, VS Code extension
 * first across products. A release with no date sorts to the end rather than
 * being dropped, so a malformed heading upstream shows up on the page instead
 * of silently disappearing.
 */
export function mergeReleases(streams: Release[][]): Release[] {
  const productRank: Record<ProductId, number> = { vscode: 0, speckit: 1 };
  const all = streams.flat().filter((release) => !release.unreleased);

  return all.sort((a, b) => {
    const aTime = a.date ? Date.parse(a.date) : Number.NEGATIVE_INFINITY;
    const bTime = b.date ? Date.parse(b.date) : Number.NEGATIVE_INFINITY;
    if (aTime !== bTime) return bTime - aTime;
    if (a.product !== b.product) return productRank[a.product] - productRank[b.product];
    return compareVersionsDesc(a.version, b.version);
  });
}

export function unreleasedOf(streams: Release[][]): Release[] {
  return streams.flat().filter((release) => release.unreleased);
}

function compareVersionsDesc(a: string | null, b: string | null): number {
  const partsOf = (value: string | null) =>
    (value ?? '').split(/[.\-+]/).map((part) => (/^\d+$/.test(part) ? Number(part) : part));
  const left = partsOf(a);
  const right = partsOf(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = left[i];
    const r = right[i];
    if (l === r) continue;
    if (typeof l === 'number' && typeof r === 'number') return r - l;
    return String(r ?? '').localeCompare(String(l ?? ''));
  }
  return 0;
}
