import { formatRelativeTime, formatDuration, formatStepOffset } from '../relativeTime';

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

const T0 = '2026-04-29T00:00:00.000Z';
const t = (offsetMs: number) => new Date(new Date(T0).getTime() + offsetMs).toISOString();

describe('formatDuration', () => {
    it('returns "<1s" for sub-second deltas', () => {
        expect(formatDuration(T0, t(0))).toBe('<1s');
        expect(formatDuration(T0, t(999))).toBe('<1s');
    });

    it('formats whole seconds under a minute', () => {
        expect(formatDuration(T0, t(1000))).toBe('1s');
        expect(formatDuration(T0, t(59 * 1000))).toBe('59s');
    });

    it('formats minutes with seconds, omitting zero seconds', () => {
        expect(formatDuration(T0, t(60 * 1000))).toBe('1m');
        expect(formatDuration(T0, t(60 * 1000 + 500))).toBe('1m');
        expect(formatDuration(T0, t(90 * 1000))).toBe('1m 30s');
        expect(formatDuration(T0, t((59 * 60 + 59) * 1000))).toBe('59m 59s');
    });

    it('formats hours with minutes, omitting zero minutes', () => {
        expect(formatDuration(T0, t(60 * 60 * 1000))).toBe('1h');
        expect(formatDuration(T0, t((60 * 60 + 5 * 60) * 1000))).toBe('1h 5m');
        expect(formatDuration(T0, t((23 * 60 + 59) * 60 * 1000))).toBe('23h 59m');
    });

    it('formats days with hours, omitting zero hours', () => {
        expect(formatDuration(T0, t(24 * 60 * 60 * 1000))).toBe('1d');
        expect(formatDuration(T0, t((24 + 12) * 60 * 60 * 1000))).toBe('1d 12h');
        expect(formatDuration(T0, t(7 * 24 * 60 * 60 * 1000))).toBe('7d');
    });

    it('treats null endIso as "now" (live duration)', () => {
        const now = new Date(new Date(T0).getTime() + 90 * 1000);
        expect(formatDuration(T0, null, now)).toBe('1m 30s');
    });

    it('clamps negative deltas to <1s', () => {
        expect(formatDuration(t(5000), T0)).toBe('<1s');
    });

    it('returns "unknown" for invalid inputs', () => {
        expect(formatDuration('', t(0))).toBe('unknown');
        expect(formatDuration('not-a-date', t(0))).toBe('unknown');
        expect(formatDuration(T0, 'not-a-date')).toBe('unknown');
    });
});

describe('formatStepOffset', () => {
    it('renders "+0s" for the same instant', () => {
        expect(formatStepOffset(T0, T0)).toBe('+0s');
    });

    it('renders seconds under a minute', () => {
        expect(formatStepOffset(T0, t(5_000))).toBe('+5s');
        expect(formatStepOffset(T0, t(59_000))).toBe('+59s');
    });

    it('renders minutes with seconds', () => {
        expect(formatStepOffset(T0, t(60 * 1000))).toBe('+1m');
        expect(formatStepOffset(T0, t(90 * 1000))).toBe('+1m 30s');
    });

    it('renders hours with minutes', () => {
        expect(formatStepOffset(T0, t(60 * 60 * 1000))).toBe('+1h');
        expect(formatStepOffset(T0, t((60 * 60 + 5 * 60) * 1000))).toBe('+1h 5m');
    });

    it('clamps negative deltas to "+0s"', () => {
        expect(formatStepOffset(t(5000), T0)).toBe('+0s');
    });

    it('returns "unknown" for invalid inputs', () => {
        expect(formatStepOffset('', T0)).toBe('unknown');
        expect(formatStepOffset(T0, '')).toBe('unknown');
        expect(formatStepOffset('bogus', T0)).toBe('unknown');
    });
});
