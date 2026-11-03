import { createHash } from 'crypto';

export type Freshness = 'current' | 'stale' | 'unknown';

const HASH_KEY = /sha256:([0-9a-f]{8,64})(?![0-9a-z])/i;
const SAME_INSTANT_MS = 2000;
const STAMP_KEY = /(\d{4}-\d{2}-\d{2})(T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?/;

/** SHA-256 of the assessment with line endings and outer blank space normalised, so a fresh clone hashes the same. */
export function assessmentHash(text: string): string {
    return createHash('sha256').update(text.replace(/\r\n/g, '\n').trim()).digest('hex');
}

/**
 * Whether a fix or test report was written for the assessment as it stands.
 * The report's Assessment reference has to carry a key: a `sha256:` hash of the assessment, or the assessment's Created stamp.
 * A day-only Created stamp that matches proves nothing, because a same-day re-assessment keeps it.
 */
export function referenceFreshness(
    reference: string | undefined,
    assessmentText: string | undefined,
    assessmentCreated: string | undefined,
): Freshness {
    if (!reference || assessmentText === undefined) return 'unknown';
    const hash = HASH_KEY.exec(reference);
    if (hash) return assessmentHash(assessmentText).startsWith(hash[1].toLowerCase()) ? 'current' : 'stale';

    const named = STAMP_KEY.exec(reference);
    const actual = assessmentCreated ? STAMP_KEY.exec(assessmentCreated) : null;
    if (!named || !actual) return 'unknown';
    if (named[2] && actual[2]) {
        const a = Date.parse(named[0]);
        const b = Date.parse(actual[0]);
        if (Number.isNaN(a) || Number.isNaN(b)) return 'unknown';
        return Math.abs(a - b) < SAME_INSTANT_MS ? 'current' : 'stale';
    }
    return named[1] !== actual[1] ? 'stale' : 'unknown';
}

const RANK: Record<Freshness, number> = { current: 0, unknown: 1, stale: 2 };

/** The test describes the fix it checked, so it is as old as the older of the two. */
export function worstFreshness(...values: Freshness[]): Freshness {
    return values.reduce((worst, value) => (RANK[value] > RANK[worst] ? value : worst), 'current' as Freshness);
}
