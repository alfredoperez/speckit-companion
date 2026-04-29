import { formatRelativeTime } from '../relativeTime';

const NOW = new Date('2026-04-29T12:00:00Z');

function past(ms: number): string {
    return new Date(NOW.getTime() - ms).toISOString();
}

describe('formatRelativeTime', () => {
    describe('"just now" (<60s)', () => {
        it('formats a 0s delta as "just now"', () => {
            expect(formatRelativeTime(past(0), NOW)).toBe('just now');
        });
        it('formats 59s as "just now"', () => {
            expect(formatRelativeTime(past(59 * 1000), NOW)).toBe('just now');
        });
    });

    describe('"Xm ago" (<60min)', () => {
        it('formats 60s as "1m ago"', () => {
            expect(formatRelativeTime(past(60 * 1000), NOW)).toBe('1m ago');
        });
        it('formats 3599s as "59m ago"', () => {
            expect(formatRelativeTime(past(3599 * 1000), NOW)).toBe('59m ago');
        });
    });

    describe('"Xh ago" (<24h)', () => {
        it('formats 3600s as "1h ago"', () => {
            expect(formatRelativeTime(past(3600 * 1000), NOW)).toBe('1h ago');
        });
        it('formats 23h59m as "23h ago"', () => {
            expect(formatRelativeTime(past((23 * 60 + 59) * 60 * 1000), NOW)).toBe('23h ago');
        });
    });

    describe('"Xd ago" (>=1d)', () => {
        it('formats 24h as "1d ago"', () => {
            expect(formatRelativeTime(past(24 * 60 * 60 * 1000), NOW)).toBe('1d ago');
        });
        it('formats 7d as "7d ago"', () => {
            expect(formatRelativeTime(past(7 * 24 * 60 * 60 * 1000), NOW)).toBe('7d ago');
        });
    });

    describe('edge cases', () => {
        it('returns "unknown" for invalid ISO strings', () => {
            expect(formatRelativeTime('not-a-date', NOW)).toBe('unknown');
        });
        it('returns "unknown" for empty input', () => {
            expect(formatRelativeTime('', NOW)).toBe('unknown');
        });
        it('returns "just now" for future timestamps (clock skew)', () => {
            const future = new Date(NOW.getTime() + 5000).toISOString();
            expect(formatRelativeTime(future, NOW)).toBe('just now');
        });
    });
});
