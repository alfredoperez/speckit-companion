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

/** Read a tier document, tolerating missing files. */
export async function readLivingDoc(filePath: string): Promise<string> {
    try {
        return await fs.promises.readFile(filePath, 'utf-8');
    } catch {
        return '';
    }
}
