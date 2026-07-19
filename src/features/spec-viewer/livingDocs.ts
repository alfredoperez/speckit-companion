/**
 * Living-spec document helpers for the viewer's stepper-less mode.
 *
 * A capability's living spec comes in up to three tier files that follow the
 * resolver's naming convention (see speckit-extension/scripts/resolve-spec-paths.py):
 *   centralized  capabilities/<name>/spec.md            → spec.arch.md / spec.coverage.md
 *   colocated    <anywhere>/<stem>.spec.md              → <stem>.arch.md / <stem>.coverage.md
 * The tiers become the viewer's tab strip; there is no workflow, no phases,
 * and no `.spec-context.json` involved.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SpecDocument, DocumentType } from './types';

export type LivingTier = 'spec' | 'arch' | 'coverage';

const TIER_LABELS: Record<LivingTier, string> = {
    spec: 'Spec',
    arch: 'Architecture',
    coverage: 'Coverage',
};

/** Tier of a living-spec file, by name. */
export function livingTierType(fileName: string): LivingTier {
    if (fileName.endsWith('.coverage.md')) return 'coverage';
    if (fileName.endsWith('.arch.md')) return 'arch';
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
    for (const tier of ['spec', 'arch', 'coverage'] as LivingTier[]) {
        const fileName = fileFor(tier);
        const filePath = path.join(dir, fileName);
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
const DRAFT_BANNER_LINE = /^\s*(?:>\s*)*(?:#{1,6}\s+)?(?:[*_]{1,3})?\s*\[draft\]/i;

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

/** Read a tier document, tolerating missing files. */
export async function readLivingDoc(filePath: string): Promise<string> {
    try {
        return await fs.promises.readFile(filePath, 'utf-8');
    } catch {
        return '';
    }
}
