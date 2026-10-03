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
 *
 * On top of the raw sections, each release is split into the shape the page
 * shows: a plain lead paragraph under the version heading, the `####` blocks
 * under `### Highlights` with their site-only comment, and one Entry per
 * bullet everywhere else, carrying its trailing PR links and area tag.
 */

import { AREAS, areaFromKeywords, isArea } from './changelogAreas';

export type ProductId = 'vscode' | 'speckit';

export interface ChangelogSection {
  /** The `###` heading this block sat under, or null when it sat under none. */
  title: string | null;
  /** Raw markdown, dedented to column zero, rendered later by Astro's processor. */
  markdown: string;
}

export interface PrLink {
  number: number;
  url: string;
}

/** A `#### Title` block under a release's `### Highlights` heading. */
export interface Highlight {
  id: string;
  title: string;
  /** The explanation, with the site-only comment taken out. */
  markdown: string;
  area: string;
  /** True when the comment named no area and the keyword map chose one. */
  areaGuessed: boolean;
  prs: PrLink[];
  media: string[];
}

/** One bullet (or stray paragraph) under Added, Fixed, Changed and the rest. */
export interface Entry {
  /** Added, Fixed, Changed, Security, Removed, Docs or Breaking. */
  type: string;
  /** The one line shown on the page: the bold lead, or the first sentence. */
  lead: string;
  /** Whatever the entry says after its lead, or an empty string. */
  rest: string;
  area: string;
  areaGuessed: boolean;
  prs: PrLink[];
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
  /** A plain paragraph written straight under the version heading, used as the lead. */
  intro: string | null;
  highlights: Highlight[];
  entries: Entry[];
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
          intro: null,
          highlights: [],
          entries: [],
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

  const kept = releases.filter((release) => release.sections.length > 0);
  for (const release of kept) structure(release);
  return kept;
}

/** Splits a release's sections into its intro, its highlights and its small entries. */
function structure(release: Release): void {
  for (const section of release.sections) {
    if (section.title && /^highlights$/i.test(section.title)) {
      release.highlights.push(...parseHighlights(section.markdown, release));
      continue;
    }
    const type = normalizeType(section.title);
    for (const block of splitBlocks(section.markdown)) {
      const isBullet = /^[-*]\s+/.test(block);
      if (!isBullet && section.title === null && release.intro === null && release.entries.length === 0) {
        release.intro = block.replace(/\s+/g, ' ').trim();
        continue;
      }
      release.entries.push(toEntry(block, type, release));
    }
  }
}

const SITE_COMMENT = /<!--([\s\S]*?)-->/;
const AREA_COMMENT = /<!--\s*area:\s*([\w-]+)\s*-->/;
/** A trailing `([#823](url))` or `([#1](url), [#2](url))` at the end of a line. */
const TRAILING_LINKS = /\s*\(((?:\[#\d+\]\([^)\s]+\)(?:,\s*)?)+)\)\s*$/;
const ONE_LINK = /\[#(\d+)\]\(([^)\s]+)\)/g;
const PR_URL = 'https://github.com/alfredoperez/speckit-companion/pull/';

export function normalizeType(title: string | null): string {
  if (!title) return 'Changed';
  if (/fix|bug/i.test(title)) return 'Fixed';
  if (/security/i.test(title)) return 'Security';
  if (/remov/i.test(title)) return 'Removed';
  if (/break/i.test(title)) return 'Breaking';
  if (/add|feature|initial/i.test(title)) return 'Added';
  if (/doc|example/i.test(title)) return 'Docs';
  return 'Changed';
}

/** Top-level blocks: each bullet with its continuation, and each loose paragraph. */
function splitBlocks(markdown: string): string[] {
  const blocks: string[][] = [];
  let current: string[] | null = null;
  let inFence = false;
  let previousBlank = true;
  for (const line of markdown.split('\n')) {
    const fence = /^\s*```/.test(line);
    const startsBullet = !inFence && /^[-*]\s+/.test(line);
    const startsParagraph = !inFence && previousBlank && /^\S/.test(line) && !startsBullet;
    if (startsBullet || startsParagraph || (!current && line.trim())) {
      current = [line];
      blocks.push(current);
    } else if (current) {
      current.push(line);
    }
    if (fence) inFence = !inFence;
    previousBlank = line.trim() === '';
  }
  return blocks.map((lines) => lines.join('\n').trim()).filter(Boolean);
}

function dedentBullet(block: string): string {
  const [first, ...rest] = block.split('\n');
  const body = rest.map((line) => line.replace(/^ {1,2}/, ''));
  return [first.replace(/^[-*]\s+/, ''), ...body].join('\n');
}

/** Pulls trailing PR links off the ends of lines, so they render as one link chip. */
function takePrLinks(text: string): { text: string; prs: PrLink[] } {
  const prs: PrLink[] = [];
  const lines = text.split('\n').map((line) => {
    const match = line.match(TRAILING_LINKS);
    if (!match) return line;
    for (const link of match[1].matchAll(ONE_LINK)) {
      prs.push({ number: Number(link[1]), url: link[2] });
    }
    return line.slice(0, match.index);
  });
  return { text: lines.join('\n').trim(), prs };
}

/**
 * Index just past the first sentence of a paragraph, or -1 when the paragraph
 * is one sentence. Skips stops inside code spans and link text.
 */
function firstSentenceEnd(paragraph: string, from = 0): number {
  let inCode = false;
  let depth = 0;
  for (let i = from; i < paragraph.length; i += 1) {
    const char = paragraph[i];
    if (char === '`') inCode = !inCode;
    if (inCode) continue;
    if (char === '[' || char === '(') depth += 1;
    if ((char === ']' || char === ')') && depth > 0) depth -= 1;
    if (depth > 0) continue;
    if (/[.!?]/.test(char) && /\s/.test(paragraph[i + 1] ?? '') && i > 20) return i + 1;
  }
  return -1;
}

function splitLead(text: string): { lead: string; rest: string } {
  const blankAt = text.search(/\n\s*\n/);
  const first = (blankAt === -1 ? text : text.slice(0, blankAt)).replace(/\s*\n\s*/g, ' ');
  const after = blankAt === -1 ? '' : text.slice(blankAt).trim();
  const join = (head: string) => [head.trim(), after].filter(Boolean).join('\n\n');

  const bold = first.match(/^\*\*(.+?)\*\*/);
  if (bold && /[.!?:]$/.test(bold[1].trim())) {
    return { lead: bold[1].trim().replace(/:$/, '.'), rest: join(first.slice(bold[0].length)) };
  }
  const end = firstSentenceEnd(first, bold ? bold[0].length : 0);
  if (end === -1) return { lead: first.trim(), rest: after };
  return { lead: first.slice(0, end).trim(), rest: join(first.slice(end)) };
}

function toEntry(block: string, type: string, release: Release): Entry {
  let text = /^[-*]\s+/.test(block) ? dedentBullet(block) : block;
  const tagged = text.match(AREA_COMMENT);
  text = text.replace(AREA_COMMENT, '').trim();
  const taken = takePrLinks(text);
  const { lead, rest } = splitLead(taken.text);
  const area = tagged ? tagged[1] : areaFromKeywords(lead, rest);
  if (tagged && !isArea(area)) {
    throw new Error(`${where(release)}: unknown area "${area}" on "${lead}". Known areas: ${AREAS.map((a) => a.id).join(', ')}.`);
  }
  return { type, lead, rest, area, areaGuessed: !tagged, prs: taken.prs };
}

function parseFields(comment: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of comment.split(';')) {
    const [key, ...value] = part.split(':');
    if (key.trim()) fields[key.trim().toLowerCase()] = value.join(':').trim();
  }
  return fields;
}

function where(release: Release): string {
  return `${release.product}@${release.version ?? 'unreleased'}`;
}

function parseHighlights(markdown: string, release: Release): Highlight[] {
  const highlights: Highlight[] = [];
  let title: string | null = null;
  let body: string[] = [];
  const flush = () => {
    if (title === null) return;
    const text = body.join('\n');
    const comment = text.match(SITE_COMMENT);
    const fields = comment ? parseFields(comment[1]) : {};
    const prose = text.replace(SITE_COMMENT, '').trim();
    const named = fields.area;
    if (named && !isArea(named)) {
      throw new Error(`${where(release)}: unknown area "${named}" on highlight "${title}". Known areas: ${AREAS.map((a) => a.id).join(', ')}.`);
    }
    const prs = (fields.pr ?? '')
      .split(',')
      .map((value) => value.trim().replace(/^#/, ''))
      .filter(Boolean)
      .map((value) => {
        if (!/^\d+$/.test(value)) throw new Error(`${where(release)}: highlight "${title}" has a pr that is not a number: "${value}".`);
        return { number: Number(value), url: `${PR_URL}${value}` };
      });
    highlights.push({
      id: `${release.id}-${slugify(title)}`,
      title,
      markdown: prose,
      area: named ?? areaFromKeywords(title, prose),
      areaGuessed: !named,
      prs,
      media: (fields.media ?? '').split(',').map((id) => id.trim()).filter(Boolean),
    });
  };
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const heading = !inFence && line.match(/^####\s+(.+?)\s*$/);
    if (heading) {
      flush();
      title = heading[1];
      body = [];
    } else if (title !== null) {
      body.push(line);
    } else if (line.trim()) {
      throw new Error(`${where(release)}: text under ### Highlights must sit inside a #### block: "${line.trim()}".`);
    }
  }
  flush();
  return highlights;
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
