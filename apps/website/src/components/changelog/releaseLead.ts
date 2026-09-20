/**
 * The one-line summary shown in a release card's header, before the card is
 * expanded. The card's body sits inside a collapsed `<details>`, so without
 * this line a reader scanning the page sees only a version and a date.
 *
 * Nothing here invents a claim. The lead is either a hand-written override
 * below, for a release whose first line doesn't stand alone, or the plain
 * text of the release's own first bullet — most releases already lead each
 * bullet with a bold plain-sentence summary, which is exactly this line.
 *
 * HOW TO OVERRIDE A RELEASE'S LEAD
 *
 *   Add one entry to LEAD_OVERRIDES below, keyed the same way releaseMedia.ts
 *   keys RELEASE_MEDIA: `<product>@<version>`, product one of `vscode` or
 *   `speckit`, version written exactly as in that product's CHANGELOG.md
 *   heading (or the literal `unreleased`).
 */

import type { Release } from './parseChangelog';
import { mediaKey } from './releaseMedia';

export const LEAD_OVERRIDES: Record<string, string> = {
  // 'vscode@0.1.0': 'The first release: a visual tree for specs, steering, agents, hooks and MCP servers.',
};

const BOLD_LEAD = /^-\s+\*\*(.+?)\*\*/m;
const FIRST_BULLET = /^-\s+(.+)$/m;
const FIRST_PARAGRAPH = /^(?!#|-|\s*$)(.+)$/m;

/** Strips inline markdown so the result reads as plain text. */
function toPlainText(value: string): string {
  return value
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\([^)]+\)/g, '$1')
    .trim();
}

function withFullStop(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

/**
 * A line written for whoever wrote it rather than for a reader: an issue or PR
 * number, or a sentence that is mostly code. Older releases predate the rule
 * that a changelog entry leads with a plain sentence, so their first line is
 * often one of these. Showing it is worse than showing nothing.
 */
function isInternal(line: string): boolean {
  if (/(^|\s)(PR|#)\s?\d+/.test(line)) return true;
  const backticked = (line.match(/`[^`]+`/g) ?? []).join('').length;
  return backticked > line.length / 3;
}

/** The plain-text lead a release's own markdown already gives us, or null. */
function derivedLeadOf(release: Release): string | null {
  for (const section of release.sections) {
    // The release's own FIRST line, not the first bold one anywhere in the
    // section: a bold bullet further down is not what the release leads with.
    const first = section.markdown.split('\n').find(l => l.trim().length > 0 && !l.startsWith('#'));
    if (!first) continue;

    const bold = first.match(BOLD_LEAD);
    const bullet = first.match(FIRST_BULLET);
    const paragraph = first.match(FIRST_PARAGRAPH);
    const raw = bold?.[1] ?? bullet?.[1] ?? paragraph?.[1];
    if (!raw) continue;

    const lead = toPlainText(raw);
    if (isInternal(lead)) return null;
    return withFullStop(lead);
  }
  return null;
}

export function leadFor(release: Release): string {
  const override = LEAD_OVERRIDES[mediaKey(release.product, release.version)];
  if (override) return override;
  return derivedLeadOf(release) ?? 'See what changed below.';
}
