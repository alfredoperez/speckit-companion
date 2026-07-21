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

const COMMENT_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24"><path fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 6h8m-4-4v8M6.099 19.5q-1.949-.192-2.927-1.172C2 17.157 2 15.271 2 11.5V11c0-3.771 0-5.657 1.172-6.828S6.229 3 10 3h1.5m-5 15c-.205 1.002-1.122 3.166-.184 3.865c.49.357 1.271-.024 2.834-.786c1.096-.535 2.206-1.148 3.405-1.424c.438-.1.885-.143 1.445-.155c3.771 0 5.657 0 6.828-1.172C21.947 17.21 21.998 15.44 22 12M8 14h6M8 9h3" color="currentColor"/></svg>`;

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

// How many top body lines can carry the draft banner — mirrors the extension's
// isLivingDraft window so the notice keys on the same marker other features do.
const DRAFT_BANNER_SCAN_LINES = 10;
const DRAFT_BANNER_LINE = /^\s*(?:>\s*)*(?:#{1,6}\s+)?(?:[*_]{1,3})?\s*\[draft\]/i;

/**
 * Draft notice: when a `[DRAFT]` marker sits in the top window, prepend
 * an announced trust-boundary banner. The authored banner line stays intact in
 * the flow — the notice is added, not a replacement.
 */
export function preprocessLivingDraftNotice(markdown: string): string {
    return safe(markdown, (md) => {
        const isDraft = md
            .split('\n')
            .slice(0, DRAFT_BANNER_SCAN_LINES)
            .some((line) => DRAFT_BANNER_LINE.test(line));
        if (!isDraft) return md;

        const notice =
            '<div class="living-draft-notice" role="note" aria-describedby="living-draft-desc">' +
            '<span class="living-draft-notice__label">Draft</span>' +
            '<span class="living-draft-notice__text">Surface-first draft — a starting point, not a verified record.</span>' +
            '<span id="living-draft-desc" class="sr-only">This living spec was adopted from existing code and has not been individually verified against tests. Review before trusting it.</span>' +
            '</div>';
        return `${notice}\n\n${md}`;
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
                `<button class="line-add-btn" data-line="${lineNum}" data-list-id="${listId}" title="Add comment">${COMMENT_ICON_SVG}</button>` +
                `<div class="line-content"><span class="living-scenario-kw">${s.kw}</span> ${rest}</div>` +
                `<div class="line-comment-slot"></div>` +
                `</li>`
            );
        })
        .join('');
    const titleHtml = title ? `<p class="living-scenario-title">${parseInline(title)}</p>` : '';
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

function buildRequirementCard(heading: string, blockLines: string[]): string[] {
    // Lift the `[inferred]` metadata tag out of the prose into a confidence
    // badge. An untagged requirement is observed and gets no badge.
    let inferred = false;
    const body = blockLines.map((line) => {
        if (/\[inferred\]/i.test(line)) {
            inferred = true;
            return line.replace(/\s*\[inferred\]\s*/gi, ' ').replace(/[ \t]+$/, '');
        }
        return line;
    });

    const badges: string[] = [];
    if (inferred) {
        badges.push('<span class="living-req-confidence living-req-confidence--inferred">inferred</span>');
    }
    // Coverage is best-effort: shown only when the plumbing supplies a tier, and
    // never rendered as `0` or a blank.
    const cov = livingCoverage[heading];
    if (cov != null && String(cov).trim() !== '' && String(cov).trim() !== '0') {
        badges.push(`<span class="living-req-coverage">${escapeHtml(String(cov))}</span>`);
    }
    const metaLine = badges.length
        ? [`<div class="living-req-meta">${badges.join('')}</div>`]
        : [];

    return [
        `<div class="living-req-card" data-req="${escapeHtml(heading)}">`,
        `### ${heading}`,
        ...metaLine,
        ...body,
        '</div>',
    ];
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

        let secEnd = lines.length;
        for (let i = secStart + 1; i < lines.length; i++) {
            if (/^##\s+/.test(lines[i])) {
                secEnd = i;
                break;
            }
        }

        const out: string[] = lines.slice(0, secStart + 1);
        let i = secStart + 1;
        while (i < secEnd) {
            const head = lines[i].match(/^###(?!#)\s+(.+)$/);
            if (!head) {
                out.push(lines[i]);
                i++;
                continue;
            }
            const heading = head[1];
            let j = i + 1;
            while (j < secEnd && !/^###(?!#)\s+/.test(lines[j])) j++;
            out.push(...buildRequirementCard(heading, lines.slice(i + 1, j)));
            i = j;
        }
        out.push(...lines.slice(secEnd));
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
    const scopeHtml = scope
        ? `<span class="living-uncovered-scope">${parseInline(scope)}</span>`
        : '';
    const groupsHtml = groups
        .map((g) => {
            const listId = `living-uncovered-${++uncoveredCounter}`;
            const files = g.files
                .map((f, idx) => {
                    const lineNum = idx + 1;
                    return (
                        `<li class="living-uncovered-file line" data-line="${lineNum}" data-list-id="${listId}">` +
                        `<button class="line-add-btn" data-line="${lineNum}" data-list-id="${listId}" title="Add comment">${COMMENT_ICON_SVG}</button>` +
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
        scopeHtml +
        `</div>` +
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
            component = `<div class="living-uncovered-none">${parseInline(text)}</div>`;
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
