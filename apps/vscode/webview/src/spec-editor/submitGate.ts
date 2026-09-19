/**
 * Pure helpers for the Create Spec form — no DOM access, so they can be
 * unit-tested without a webview harness.
 */

export const MAX_CHARS = 50_000;

/** Fraction of the limit at which the character counter becomes visible. */
export const CHAR_COUNT_REVEAL_RATIO = 0.9;

/** True when the description is non-empty (ignoring whitespace) and within the limit. */
export function canSubmit(content: string, max: number = MAX_CHARS): boolean {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
        return false;
    }
    return content.length <= max;
}

export function isOverLimit(content: string, max: number = MAX_CHARS): boolean {
    return content.length > max;
}

/** True once the content reaches the reveal threshold (~90% of the limit). */
export function shouldShowCharCount(count: number, max: number = MAX_CHARS): boolean {
    return count >= Math.floor(max * CHAR_COUNT_REVEAL_RATIO);
}

/** Mac detection from the webview's navigator fields (platform preferred, userAgent fallback). */
export function isMacPlatform(platform: string, userAgent: string): boolean {
    const p = (platform || '').toLowerCase();
    if (p.includes('mac')) {
        return true;
    }
    const ua = (userAgent || '').toLowerCase();
    return ua.includes('macintosh') || ua.includes('mac os');
}
