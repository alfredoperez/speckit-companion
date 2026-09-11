/**
 * Living-spec document helpers for the viewer's stepper-less mode.
 *
 * A capability's living spec comes in up to three tier files that follow the
 * resolver's naming convention (see speckit-extension/scripts/resolve-spec-paths.py):
 *   centralized  capabilities/<name>/spec.md            → spec.rules.md / spec.coverage.md
 *   colocated    <anywhere>/<stem>.spec.md              → <stem>.rules.md / <stem>.coverage.md
 * The tiers become the viewer's tab strip; there is no workflow, no phases,
 * and no `.spec-context.json` involved.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SpecDocument, DocumentType } from './types';

export type LivingTier = 'spec' | 'rules' | 'coverage';

const TIER_LABELS: Record<LivingTier, string> = {
    spec: 'Spec',
    rules: 'Rules',
    coverage: 'Coverage',
};

/** Tier of a living-spec file, by name. */
export function livingTierType(fileName: string): LivingTier {
    if (fileName.endsWith('.coverage.md')) return 'coverage';
    if (fileName.endsWith('.rules.md')) return 'rules';
    return 'spec';
}

/**
 * The capability's display name: folder name for the centralized layout
 * (`capabilities/todos/spec.md` → `todos`), file stem for colocated
 * (`src/store/todos.spec.md` → `todos`).
 */
export function livingCapabilityName(sourcePath: string): string {
    const name = path.basename(sourcePath);
    const stem = name
        .replace(/\.spec\.md$/, '')
        .replace(/\.rules\.md$/, '')
        .replace(/\.arch\.md$/, '')
        .replace(/\.coverage\.md$/, '')
        .replace(/\.md$/, '');
    if (stem === 'spec' || stem === '') {
        return path.basename(path.dirname(sourcePath));
    }
    return stem;
}

/** Trailing "— Living Spec" on a title, across dash and casing variants. */
const LIVING_SPEC_SUFFIX = /\s*[—–-]\s*living\s+spec\s*$/i;

/**
 * The document's own H1 with any trailing "— Living Spec" removed, or `null`
 * when it has no usable one. The single derivation behind both the displayed
 * title and the flag that tells the header to skip its slug capitalization.
 */
export function livingSpecHeading(content: string): string | null {
    if (!content) return null;

    let lines = content.split(/\r?\n/);
    if (lines[0]?.trim() === '---') {
        const close = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
        if (close > 0) lines = lines.slice(close + 1);
    }

    let inFence = false;
    for (const line of lines) {
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;

        const heading = /^#\s+(.*)$/.exec(line);
        if (!heading) continue;

        const title = heading[1]
            .replace(/\s+#+\s*$/, '')
            .replace(LIVING_SPEC_SUFFIX, '')
            .replace(/^\s*[*_]{1,3}\s*/, '')
            .replace(/\s*[*_]{1,3}\s*$/, '')
            .trim();
        return title === '' ? null : title;
    }
    return null;
}

/**
 * A living spec's display title: the document's own H1 when it has one, else
 * the location-derived name. The H1 is the only place a human writes the
 * capability's real name — a slug cannot round-trip casing like "SpecKit".
 */
export function livingSpecTitle(content: string, fallback: string): string {
    return livingSpecHeading(content) ?? fallback;
}

/**
 * The tier documents for the capability that owns `sourcePath`, in tab order.
 * Only the spec tier is guaranteed; arch/coverage appear when their files exist.
 */
export function livingTierDocuments(sourcePath: string): SpecDocument[] {
    const dir = path.dirname(sourcePath);
    const name = path.basename(sourcePath);

    // Normalize to the tier-file stem: '' means the centralized `spec.*` family.
    let stem = name
        .replace(/\.coverage\.md$/, '')
        .replace(/\.rules\.md$/, '')
        .replace(/\.arch\.md$/, '')
        .replace(/\.spec\.md$/, '')
        .replace(/\.md$/, '');
    if (stem === 'spec') stem = '';

    const fileFor = (tier: LivingTier): string => {
        if (stem === '') {
            return tier === 'spec' ? 'spec.md' : `spec.${tier}.md`;
        }
        return tier === 'spec' ? `${stem}.spec.md` : `${stem}.${tier}.md`;
    };

    const docs: SpecDocument[] = [];
    for (const tier of ['spec', 'rules', 'coverage'] as LivingTier[]) {
        let fileName = fileFor(tier);
        let filePath = path.join(dir, fileName);
        // The rules tier was `.arch.md`. A project written before the rename
        // still has that file, and it is still the rules tier.
        if (tier === 'rules') {
            try {
                if (!fs.existsSync(filePath)) {
                    const legacy = stem === '' ? 'spec.arch.md' : `${stem}.arch.md`;
                    if (fs.existsSync(path.join(dir, legacy))) {
                        fileName = legacy;
                        filePath = path.join(dir, legacy);
                    }
                }
            } catch { /* unreadable dir — fall through to the new name */ }
        }
        let exists = false;
        try {
            exists = fs.existsSync(filePath);
        } catch { /* treat as missing */ }
        if (tier === 'spec' || exists) {
            docs.push({
                type: tier as DocumentType,
                label: TIER_LABELS[tier],
                fileName,
                filePath,
                exists,
                category: 'core',
            } as SpecDocument);
        }
    }
    return docs;
}

/**
 * How many body lines (after any YAML frontmatter) can carry the draft banner.
 * `/speckit.companion.living-adopt` writes it immediately under the title, so a small
 * window is enough — and it keeps the word "draft" in prose from counting.
 */
const DRAFT_BANNER_SCAN_LINES = 10;

/**
 * The banner line itself: an optional blockquote/heading/emphasis wrapper
 * around a leading `[DRAFT]` marker. Matches
 * `> [DRAFT] Surface-first draft from existing code — review before trusting.`
 * and the plain-line variants of it.
 */
export const DRAFT_BANNER_LINE = /^\s*(?:>\s*)*(?:#{1,6}\s+)?(?:[*_]{1,3})?\s*\[draft\]/i;

/**
 * True when a living spec's markdown declares itself a draft.
 *
 * `/speckit.companion.living-adopt` drafts surface-first specs and marks them with a
 * `[DRAFT]` banner near the top; the viewer badges those DRAFT instead of
 * LIVING. Only the banner window is inspected, so a requirement that merely
 * says "draft" deeper in the document does not demote the spec.
 */
export function isLivingDraft(content: string): boolean {
    if (!content) return false;

    let lines = content.split(/\r?\n/);

    // Skip YAML frontmatter so the window covers the body, not the metadata.
    if (lines[0]?.trim() === '---') {
        const close = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
        if (close > 0) lines = lines.slice(close + 1);
    }

    return lines
        .slice(0, DRAFT_BANNER_SCAN_LINES)
        .some(line => DRAFT_BANNER_LINE.test(line));
}

/** The body of `## Purpose`, verbatim, or '' when the spec has none. */
export function livingPurposeBody(content: string): string {
    const lines = content.split(/\r?\n/);
    const start = lines.findIndex(line => /^##\s+Purpose\s*$/.test(line));
    if (start === -1) return '';
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        if (/^##(?!#)\s+/.test(lines[i])) { end = i; break; }
    }
    return lines.slice(start + 1, end).join('\n').trim();
}

const ADOPTED_MARKER = /^\s*<!--\s*adopted:\s*.+?\s*-->\s*$/;
const INFERRED_TAG = /\s*\[inferred\]\s*/gi;

/** A heading as the card keys it: tag-stripped, whitespace-trimmed. */
function cardHeading(text: string): string {
    return text.replace(INFERRED_TAG, ' ').trim();
}

/** Drop the `adopted` marker on one requirement (by heading) or all, then the `[DRAFT]` banner once none remain; null when nothing changed. */
export function approveLivingText(content: string, heading?: string): string | null {
    const lines = content.split(/\r?\n/);
    const wanted = heading === undefined ? undefined : cardHeading(heading);
    let inFence = false;
    let inTarget = wanted === undefined;
    let removed = false;
    const kept: string[] = [];
    for (const line of lines) {
        if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
        if (!inFence && wanted !== undefined) {
            const head = /^###(?!#)\s+(.+?)\s*$/.exec(line);
            if (head) inTarget = cardHeading(head[1]) === wanted;
            else if (/^##(?!#)\s+/.test(line)) inTarget = false;
        }
        if (!inFence && inTarget && ADOPTED_MARKER.test(line)) {
            removed = true;
            continue;
        }
        kept.push(line);
    }
    if (!removed) return null;
    if (!kept.some(line => ADOPTED_MARKER.test(line))) {
        let from = 0;
        if (kept[0]?.trim() === '---') {
            const close = kept.findIndex((line, i) => i > 0 && line.trim() === '---');
            if (close > 0) from = close + 1;
        }
        const banner = kept.findIndex((line, i) => i >= from && i < from + DRAFT_BANNER_SCAN_LINES && DRAFT_BANNER_LINE.test(line));
        if (banner !== -1) {
            kept.splice(banner, kept[banner + 1]?.trim() === '' ? 2 : 1);
        }
    }
    return kept.join('\n');
}

/**
 * Cut one requirement, heading to the next heading or section, out of a living spec.
 * Null when no requirement carries that heading.
 */
export function removeLivingRequirement(content: string, heading: string): string | null {
    const lines = content.split(/\r?\n/);
    const wanted = cardHeading(heading);
    let inFence = false;
    let inTarget = false;
    let removed = false;
    const kept: string[] = [];
    for (const line of lines) {
        if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
        if (!inFence) {
            const head = /^###(?!#)\s+(.+?)\s*$/.exec(line);
            if (head) inTarget = cardHeading(head[1]) === wanted;
            else if (/^##(?!#)\s+/.test(line)) inTarget = false;
        }
        if (inTarget) {
            removed = true;
            continue;
        }
        kept.push(line);
    }
    return removed ? kept.join('\n').replace(/\n{3,}/g, '\n\n') : null;
}

/** Every `<!-- aligns: cap#Heading -->` in a spec text, as `cap#Heading` strings. */
export function alignsIn(content: string): string[] {
    return [...content.matchAll(/<!--\s*aligns:\s*(.+?)\s*-->/g)]
        .flatMap(m => m[1].split(',').map(s => s.trim()).filter(Boolean));
}

/** Read a tier document, tolerating missing files. */
export async function readLivingDoc(filePath: string): Promise<string> {
    try {
        return await fs.promises.readFile(filePath, 'utf-8');
    } catch {
        return '';
    }
}
