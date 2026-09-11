/**
 * SpecKit Companion - Living Spec Components
 *
 * String preprocessors that render the structures a living spec repeats — the
 * draft notice, purpose callout, requirement cards with confidence/coverage,
 * WHEN/THEN/AND scenario steps, and the uncovered-evidence summary — as
 * recognized HTML inside the existing markdown pipeline. Each runs only in
 * living-spec mode (gated by the renderer) and is wrapped in `safe()` so a
 * throwing component hands its region back to the base renderer unchanged
 * instead of blanking the page.
 */

import { parseInline, escapeHtml } from './inline';

const COMMENT_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 6h8m-4-4v8M6.099 19.5q-1.949-.192-2.927-1.172C2 17.157 2 15.271 2 11.5V11c0-3.771 0-5.657 1.172-6.828S6.229 3 10 3h1.5m-5 15c-.205 1.002-1.122 3.166-.184 3.865c.49.357 1.271-.024 2.834-.786c1.096-.535 2.206-1.148 3.405-1.424c.438-.1.885-.143 1.445-.155c3.771 0 5.657 0 6.828-1.172C21.947 17.21 21.998 15.44 22 12M8 14h6M8 9h3"/></svg>`;

/**
 * Per-region fallback wrapper: run `fn` over `region`; if it
 * throws, return `region` unchanged so the base renderer takes that region.
 */
export function safe(region: string, fn: (region: string) => string): string {
    try {
        return fn(region);
    } catch {
        return region;
    }
}

// Best-effort per-requirement coverage, keyed by the exact `###` heading text.
// Empty by default: coverage is omitted (never `0`) until the plumbing supplies
// it. Values are rendered verbatim as the tier label.
// Null-prototype store so record-sourced heading keys can't resolve through
// inherited names like `toString` / `__proto__` — only set headings match.
let livingCoverage: Record<string, string> = Object.create(null);

/** Inject best-effort per-requirement coverage labels keyed by exact heading. */
export function setLivingCoverage(map: Record<string, string> | null): void {
    livingCoverage = Object.assign(Object.create(null), map || {});
}

// Headings whose touched files drifted, as the extension computed them. Empty until health resolves.
let livingDrifted = new Set<string>();

/** Mark requirements drifted by exact heading. Returns whether the set changed. */
export function setLivingDrifted(headings: string[] | null | undefined): boolean {
    const next = new Set(headings ?? []);
    const changed = next.size !== livingDrifted.size || [...next].some((h) => !livingDrifted.has(h));
    livingDrifted = next;
    return changed;
}

// How many top body lines can carry the draft banner — mirrors the extension's
// isLivingDraft window so the notice keys on the same marker other features do.
const DRAFT_BANNER_SCAN_LINES = 10;
const DRAFT_BANNER_LINE = /^\s*(?:>\s*)*(?:#{1,6}\s+)?(?:[*_]{1,3})?\s*\[draft\]/i;

/** The `[DRAFT]` banner feeds the header badge, not the prose: blank the line (kept, so comment anchors hold). */
export function stripLivingDraftBanner(markdown: string): string {
    return safe(markdown, (md) => {
        const lines = md.split('\n');
        const at = lines.findIndex((line, i) => i < DRAFT_BANNER_SCAN_LINES && DRAFT_BANNER_LINE.test(line));
        if (at === -1) return md;
        lines[at] = '';
        return lines.join('\n');
    });
}

/**
 * Purpose callout: wrap the `## Purpose` section in a prominent callout
 * so the reason the capability exists is read first. Rendered only when the
 * section exists; the authored heading and body stay inside as commentable
 * markdown lines (verbatim). A missing purpose is omitted, never a
 * placeholder.
 */
export function preprocessLivingPurpose(markdown: string): string {
    return safe(markdown, (md) => {
        const lines = md.split('\n');
        const start = lines.findIndex((line) => /^##\s+Purpose\s*$/.test(line));
        if (start === -1) return md;

        let end = lines.length;
        for (let i = start + 1; i < lines.length; i++) {
            if (/^##\s+/.test(lines[i])) {
                end = i;
                break;
            }
        }
        const out = [
            ...lines.slice(0, start),
            '<div class="living-purpose">',
            ...lines.slice(start, end),
            '</div>',
            ...lines.slice(end),
        ];
        return out.join('\n');
    });
}

// Local counters so each scenario's steps and each uncovered group's files get a
// unique list id (comment anchoring keys on data-line + data-list-id, mirroring
// parseAcceptanceScenarios).
let scenarioCounter = 0;
let uncoveredCounter = 0;

const STEP_CLASS: Record<string, string> = {
    WHEN: 'living-when',
    THEN: 'living-then',
    AND: 'living-and',
};

function buildScenario(title: string, steps: { kw: string; rest: string }[]): string {
    const listId = `living-scenario-${++scenarioCounter}`;
    const items = steps
        .map((s, idx) => {
            const lineNum = idx + 1;
            const rest = parseInline(s.rest.trim());
            return (
                `<li class="living-scenario-step line ${STEP_CLASS[s.kw]}" data-line="${lineNum}" data-list-id="${listId}">` +
                `<button class="line-add-btn" data-line="${lineNum}" data-list-id="${listId}" title="Add comment to scenario line ${lineNum}" aria-label="Add comment to scenario line ${lineNum}">${COMMENT_ICON_SVG}</button>` +
                `<div class="line-content"><span class="living-scenario-kw">${s.kw}</span> ${rest}</div>` +
                `<div class="line-comment-slot"></div>` +
                `</li>`
            );
        })
        .join('');
    // The authored `#### Scenario:` line stays commentable — its own line at
    // data-line 0 (steps are 1-based) under the scenario's list id.
    const titleHtml = title
        ? `<div class="living-scenario-title line" data-line="0" data-list-id="${listId}">` +
          `<button class="line-add-btn" data-line="0" data-list-id="${listId}" title="Add comment to scenario title" aria-label="Add comment to scenario title">${COMMENT_ICON_SVG}</button>` +
          `<div class="line-content">${parseInline(title.charAt(0).toUpperCase() + title.slice(1))}</div>` +
          `<div class="line-comment-slot"></div>` +
          `</div>`
        : '';
    return `<div class="living-scenario">${titleHtml}<ol class="living-scenario-steps" id="${listId}">${items}</ol></div>`;
}

/**
 * Living scenario steps: render `#### Scenario:` blocks whose
 * bullets are `- **WHEN/THEN/AND** …` so conditions (WHEN) are visually
 * separable from outcomes (THEN/AND), neither reordered nor reworded. Distinct
 * from the feature-spec `parseAcceptanceScenarios` (Given/When/Then). A scenario
 * heading with no recognized steps is left unchanged (defensive fallback).
 */
export function preprocessLivingScenarios(markdown: string): string {
    return safe(markdown, (md) => {
        scenarioCounter = 0;
        const lines = md.split('\n');
        const out: string[] = [];
        let i = 0;
        while (i < lines.length) {
            const m = lines[i].match(/^####\s+Scenario:\s*(.*)$/);
            if (!m) {
                out.push(lines[i]);
                i++;
                continue;
            }
            const title = m[1].trim();
            const steps: { kw: string; rest: string }[] = [];
            let j = i + 1;
            while (j < lines.length) {
                const step = lines[j].match(/^-\s+\*\*(WHEN|THEN|AND)\*\*\s*(.*)$/);
                if (step) {
                    steps.push({ kw: step[1].toUpperCase(), rest: step[2] });
                    j++;
                } else if (lines[j].trim() === '' && steps.length === 0) {
                    j++;
                } else {
                    break;
                }
            }
            if (steps.length === 0) {
                out.push(lines[i]);
                i++;
                continue;
            }
            out.push(buildScenario(title, steps));
            i = j;
        }
        return out.join('\n');
    });
}

// Stateless test (no `g` flag, so no shared lastIndex) + global strip.
const HAS_INFERRED = /\[inferred\]/i;
const STRIP_INFERRED = /\s*\[inferred\]\s*/gi;

/** `<!-- touches: a/**, b.ts -->` — the marker sits directly under the heading. */
const TOUCHES_LINE = /^\s*<!--\s*touches:\s*(.+?)\s*-->\s*$/;
/** `<!-- adopted: CLAUDE.md:18 -->` — adoption transcribed this and no run has confirmed it. */
const ADOPTED_LINE = /^\s*<!--\s*adopted:\s*(.+?)\s*-->\s*$/;

function buildRequirementCard(
    heading: string,
    blockLines: string[],
    index: number,
): string[] {
    const files = touchesCount(blockLines);
    // Lift the `[inferred]` metadata tag out of the prose into a confidence
    // badge. The tag can sit in the heading (`### Title [inferred]`) or a body
    // line; either way it's stripped from the visible text. An untagged
    // requirement is observed and gets no badge.
    let inferred = false;
    // Trailing whitespace is common on a markdown line and the heading regex
    // keeps it, so a card and its outline row would look coverage up under
    // different keys — the disagreement this single pass exists to prevent.
    let title = heading.trimEnd();
    if (HAS_INFERRED.test(heading)) {
        inferred = true;
        title = heading.replace(STRIP_INFERRED, ' ').replace(/[ \t]+$/, '').trim();
    }
    // Both markers sit at the top of the block, in either order. Only lines up
    // to the first ordinary one are considered: filtering the whole block would
    // delete a line further down that the outline's count, and both slicers,
    // still read as prose.
    let adoptedFrom = '';
    let markerLines = 0;
    for (const line of blockLines) {
        if (line.trim().length === 0) {
            markerLines++;
            continue;
        }
        const a = line.match(ADOPTED_LINE);
        if (!a && !TOUCHES_LINE.test(line)) {
            break;
        }
        if (a && !adoptedFrom) adoptedFrom = a[1];
        markerLines++;
    }
    const body = blockLines
        .filter((_line, i) => i >= markerLines)
        .map((line) => {
        if (HAS_INFERRED.test(line)) {
            inferred = true;
            return line.replace(STRIP_INFERRED, ' ').replace(/[ \t]+$/, '');
        }
        return line;
    });

    const badges: string[] = [];
    // Drifted wins the edge: it is the state that needs action first.
    const state = livingDrifted.has(title) ? 'drifted' : adoptedFrom ? 'adopted' : 'confirmed';
    // The source sits in the tooltip, never on the face: a line number rots on the next edit to that file.
    if (state !== 'confirmed') {
        const word = state === 'adopted' ? 'Adopted' : 'Drifted';
        const why = state === 'adopted'
            ? 'Written from the code by AI, not from a spec you approved. No run has confirmed it yet.'
            : 'Code this requirement touches changed since the spec was last updated.';
        badges.push(`<span class="living-req-pill living-req-pill--${state}">`
            + `<span class="living-req-pill-dot" aria-hidden="true"></span>${word}</span>`
            + `<span class="living-req-why">${why}</span>`);
    }
    if (inferred) {
        badges.push('<span class="living-req-confidence living-req-confidence--inferred">inferred</span>');
    }
    // Coverage is best-effort: shown only when the plumbing supplies a tier, and
    // never rendered as `0` or a blank. Keyed on the tag-stripped title so a
    // heading-level `[inferred]` doesn't defeat the lookup.
    const cov = livingCoverage[title];
    if (cov != null && String(cov).trim() !== '' && String(cov).trim() !== '0') {
        badges.push(`<span class="living-req-coverage">${escapeHtml(String(cov))}</span>`);
    }
    const metaLine = badges.length
        ? [`<div class="living-req-meta">${badges.join('')}</div>`]
        : [];

    // The coverage and the file count ride on the card as data. The outline is
    // the viewer's own table of contents, which reads them off the rendered
    // heading rather than parsing the markdown a second time.
    const covAttr = cov != null && String(cov).trim() !== '' && String(cov).trim() !== '0'
        ? ` data-req-coverage="${escapeHtml(String(cov))}"` : '';
    const filesAttr = files > 0 ? ` data-req-patterns="${files}"` : '';
    // A bare flag, never the source string: this is an attribute, and the
    // viewer's escapeHtml does not escape attribute quotes.
    const adoptedAttr = adoptedFrom ? ' data-req-adopted' : '';
    // Under the title: the files this requirement is about, and where adoption transcribed it from.
    const globs = touchesGlobs(blockLines);
    const fileBits = globs.map((g) =>
        `<button type="button" class="living-req-file" data-reveal-glob="${escapeAttr(g)}" title="Reveal in Explorer">${escapeHtml(g)}</button>`);
    if (adoptedFrom) {
        fileBits.push(`<span class="living-req-file living-req-file--source" title="Adopted from this file">from ${escapeHtml(adoptedFrom)}</span>`);
    }
    const filesLine = fileBits.length ? [`<div class="living-req-files">${fileBits.join('')}</div>`] : [];
    // Actions sit at the card's foot, left: Approve only while adopted, Remove always.
    const actions = [
        adoptedFrom
            ? '<button type="button" class="living-req-approve" data-req-approve title="Confirm this requirement: removes the Adopted mark, changes nothing else">'
                + '<span class="codicon codicon-check" aria-hidden="true"></span>Approve</button>'
            : '',
        `<button type="button" class="living-req-remove" data-req-remove title="Delete this requirement and its scenarios from the spec">`
            + '<span class="codicon codicon-trash" aria-hidden="true"></span>Remove</button>',
    ].join('');
    const actionsLine = [`<div class="living-req-actions">${actions}</div>`];
    return [
        `<div class="living-req-card" id="living-req-${index}" data-req-index="${index}"`
        + ` data-req="${escapeAttr(title)}" data-req-state="${state}"${covAttr}${filesAttr}${adoptedAttr}>`,
        '<div class="living-req-header">',
        ...metaLine,
        `### ${title}`,
        ...filesLine,
        ...actionsLine,
        '</div>',
        ...body,
        '</div>',
    ];
}

/** `escapeHtml` leaves quotes alone, so an attribute value needs them escaped too. */
function escapeAttr(value: string): string {
    return escapeHtml(value).replace(/"/g, '&quot;');
}

/** The path patterns a requirement's marker names, empty when unmarked. */
function touchesGlobs(blockLines: string[]): string[] {
    const m = blockLines.length > 0 ? blockLines[0].match(TOUCHES_LINE) : null;
    return m ? m[1].split(',').map((g) => g.trim()).filter(Boolean) : [];
}

/** How many path patterns a requirement's marker names, or 0 when unmarked. */
function touchesCount(blockLines: string[]): number {
    return touchesGlobs(blockLines).length;
}


/**
 * Requirement cards: wrap each `###` requirement under
 * `## Requirements` in a card keyed on its exact heading text (no trim /
 * normalize / re-case). The heading and body stay as individual markdown lines
 * so per-line comments survive; confidence/coverage badges ride alongside.
 */
export function preprocessLivingRequirements(markdown: string): string {
    return safe(markdown, (md) => {
        const lines = md.split('\n');
        const secStart = lines.findIndex((l) => /^##\s+Requirements\s*$/.test(l));
        if (secStart === -1) return md;

        // To the end of the document, not to the next `##`. Fold-back appends
        // past the uncovered-files section, so stopping there left every
        // requirement folded in after adoption rendered as bare markdown while
        // the coverage denominator still counted it. Lines that are not a
        // requirement heading pass through untouched, so the uncovered section
        // reaches its own pass exactly as before.
        const secEnd = lines.length;

        // A `###` inside a fenced block is an example, not a requirement. The
        // resolver's parser already ignores those, and the cards share the
        // coverage denominator's headings — a viewer that counted one more would
        // put a card on the page that no other reader believes exists.
        const fenced = new Set<number>();
        let inFence = false;
        for (let k = secStart + 1; k < secEnd; k++) {
            if (/^\s*(```|~~~)/.test(lines[k])) {
                inFence = !inFence;
                fenced.add(k);
                continue;
            }
            if (inFence) fenced.add(k);
        }
        const isHeading = (k: number): boolean =>
            !fenced.has(k) && /^###(?!#)\s+/.test(lines[k]);
        const isSection = (k: number): boolean =>
            !fenced.has(k) && /^##(?!#)\s+/.test(lines[k]);

        const cards: string[] = [];
        let i = secStart + 1;
        let index = 0;
        while (i < secEnd) {
            const head = isHeading(i) ? lines[i].match(/^###(?!#)\s+(.+)$/) : null;
            if (!head) {
                cards.push(lines[i]);
                i++;
                continue;
            }
            const heading = head[1];
            // A card ends at the next requirement OR the next section heading.
            // Without the second, the last requirement before `## Uncovered`
            // swallowed that whole section into its card.
            let j = i + 1;
            while (j < secEnd && !isHeading(j) && !isSection(j)) j++;
            const blockLines = lines.slice(i + 1, j);
            cards.push(...buildRequirementCard(heading, blockLines, index));
            index++;
            i = j;
        }
        const out: string[] = [
            ...lines.slice(0, secStart + 1),
            ...cards,
            ...lines.slice(secEnd),
        ];
        return out.join('\n');
    });
}

interface UncoveredGroup {
    reason: string;
    files: string[];
}

/**
 * Parse the recognized reason-grouped uncovered format: leading non-bullet
 * prose is the scope statement; then top-level `- **Reason**` bullets each own
 * indented `  - file` bullets. Returns null when the body does not match this
 * shape, so the caller can fall back to plain markdown.
 */
function parseUncoveredGroups(bodyLines: string[]): { scope: string; groups: UncoveredGroup[] } | null {
    const scopeParts: string[] = [];
    const groups: UncoveredGroup[] = [];
    let sawGroup = false;

    for (const raw of bodyLines) {
        if (raw.trim() === '') continue;
        const topBullet = raw.match(/^-\s+\*\*(.+?)\*\*\s*:?\s*$/);
        const fileBullet = raw.match(/^\s{1,}[-*]\s+(.+)$/);
        if (topBullet) {
            sawGroup = true;
            groups.push({ reason: topBullet[1].trim(), files: [] });
        } else if (fileBullet && groups.length > 0) {
            groups[groups.length - 1].files.push(fileBullet[1].trim());
        } else if (!sawGroup && !/^\s*[-*]\s+/.test(raw)) {
            scopeParts.push(raw.trim());
        } else {
            // A bullet we do not recognize (flat list, ungrouped file, …) — bail
            // so the section falls back to plain markdown rather than dropping it.
            return null;
        }
    }

    if (!groups.length || groups.some((g) => g.files.length === 0)) return null;
    return { scope: scopeParts.join(' '), groups };
}

function buildUncovered(scope: string, groups: UncoveredGroup[]): string {
    const count = groups.reduce((n, g) => n + g.files.length, 0);
    // The scope sentence is authored prose, so keep it a commentable line
    // (its own stable list id) rather than baking it into the summary blob.
    const scopeHtml = scope
        ? `<div class="living-uncovered-scope line" data-line="1" data-list-id="living-uncovered-scope">` +
          `<button class="line-add-btn" data-line="1" data-list-id="living-uncovered-scope" title="Add comment to uncovered scope" aria-label="Add comment to uncovered scope">${COMMENT_ICON_SVG}</button>` +
          `<div class="line-content">${parseInline(scope)}</div>` +
          `<div class="line-comment-slot"></div>` +
          `</div>`
        : '';
    const groupsHtml = groups
        .map((g) => {
            const listId = `living-uncovered-${++uncoveredCounter}`;
            const files = g.files
                .map((f, idx) => {
                    const lineNum = idx + 1;
                    return (
                        `<li class="living-uncovered-file line" data-line="${lineNum}" data-list-id="${listId}">` +
                        `<button class="line-add-btn" data-line="${lineNum}" data-list-id="${listId}" title="Add comment to uncovered file ${lineNum}" aria-label="Add comment to uncovered file ${lineNum}">${COMMENT_ICON_SVG}</button>` +
                        `<div class="line-content">${parseInline(f)}</div>` +
                        `<div class="line-comment-slot"></div>` +
                        `</li>`
                    );
                })
                .join('');
            return (
                `<details class="living-uncovered-group">` +
                `<summary>${parseInline(g.reason)} <span class="living-uncovered-group-count">${g.files.length}</span></summary>` +
                `<ul class="living-uncovered-files" id="${listId}">${files}</ul>` +
                `</details>`
            );
        })
        .join('');
    return (
        `<div class="living-uncovered">` +
        `<div class="living-uncovered-summary">` +
        `<span class="living-uncovered-count">${count} file${count === 1 ? '' : 's'} not fully read</span>` +
        `</div>` +
        scopeHtml +
        groupsHtml +
        `</div>`
    );
}

/**
 * Uncovered evidence: render the `## Uncovered` section as a
 * count + scope statement over reason-grouped disclosures (closed by default),
 * or a plain read-everything statement for the sentinel/empty case. Any body
 * shape the parser does not recognize falls back to plain markdown so no line
 * is dropped. The `## Uncovered` heading itself stays a normal line.
 */
export function preprocessLivingUncovered(markdown: string): string {
    return safe(markdown, (md) => {
        uncoveredCounter = 0;
        const lines = md.split('\n');
        const secStart = lines.findIndex((l) => /^##\s+Uncovered\s*$/.test(l));
        if (secStart === -1) return md;

        let secEnd = lines.length;
        for (let i = secStart + 1; i < lines.length; i++) {
            if (/^##\s+/.test(lines[i])) {
                secEnd = i;
                break;
            }
        }
        const body = lines.slice(secStart + 1, secEnd);
        const nonEmpty = body.filter((l) => l.trim() !== '');
        const firstLine = nonEmpty[0]?.trim() ?? '';

        let component: string;
        if (nonEmpty.length === 0 || /^_none\b/i.test(firstLine)) {
            // Read-everything: empty section or the `_None — …_` sentinel.
            const text = /^_none\b/i.test(firstLine)
                ? firstLine.replace(/^_+/, '').replace(/_+$/, '').trim()
                : 'Every file in the area was read.';
            // Keep the authored sentinel line commentable, like the scope line.
            component =
                `<div class="living-uncovered-none line" data-line="1" data-list-id="living-uncovered-none">` +
                `<button class="line-add-btn" data-line="1" data-list-id="living-uncovered-none" title="Add comment to uncovered summary" aria-label="Add comment to uncovered summary">${COMMENT_ICON_SVG}</button>` +
                `<div class="line-content">${parseInline(text)}</div>` +
                `<div class="line-comment-slot"></div>` +
                `</div>`;
        } else {
            const parsed = parseUncoveredGroups(body);
            if (!parsed) return md; // unrecognized structure → plain markdown fallback
            component = buildUncovered(parsed.scope, parsed.groups);
        }

        return [
            ...lines.slice(0, secStart + 1),
            component,
            ...lines.slice(secEnd),
        ].join('\n');
    });
}
