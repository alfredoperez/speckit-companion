/** A document heading's leading kind ("Feature Specification: X" reads "X"). */
export const TITLE_PREFIX = /^(?:Phase \d+ )?(?:Feature Specification|Implementation Plan|Specification|Spec|Research|Tasks|Plan)\s*:\s*/i;

/** The spec's own title: its first H1 as plain text, kind prefix stripped, or null. */
export function specTitleOf(markdown: string): string | null {
    const match = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(markdown);
    if (!match) return null;
    const text = match[1]!
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[`*_]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(TITLE_PREFIX, '')
        .trim();
    return text || null;
}
