import { deriveSpecName } from '../../features/specs/specContextManager';

/**
 * Resolve the readable display name for a spec, by preference:
 * recorded name → document heading (living specs) → humanized slug.
 *
 * Presentation-only: the directory slug stays the stable identifier.
 * Empty or whitespace-only inputs are treated as absent so a blank
 * label never wins over the humanized-slug fallback.
 */
export function resolveSpecDisplayName(
    specName: string | undefined | null,
    specDir: string,
    heading?: string | null
): string {
    const recorded = specName?.trim();
    if (recorded) {
        return recorded;
    }
    const docHeading = heading?.trim();
    if (docHeading) {
        return docHeading;
    }
    return deriveSpecName(specDir);
}
