import { formatElapsed } from '../elapsedFormat';

describe('formatElapsed', () => {
    describe('under a minute → "Ns"', () => {
        it('formats 0ms as 0s', () => {
            expect(formatElapsed(0)).toBe('0s');
        });

        it('formats 999ms as 0s (rounds down)', () => {
            expect(formatElapsed(999)).toBe('0s');
        });

        it('formats 59s as 59s', () => {
            expect(formatElapsed(59_000)).toBe('59s');
        });

        it('clamps negative input to 0s', () => {
            expect(formatElapsed(-500)).toBe('0s');
        });
    });

    describe('one minute up to one hour → "Mm Ss"', () => {
        it('formats 60s as 1m 00s', () => {
            expect(formatElapsed(60_000)).toBe('1m 00s');
        });

        it('formats 3m 22s as 3m 22s', () => {
            expect(formatElapsed(3 * 60_000 + 22_000)).toBe('3m 22s');
        });

        it('zero-pads seconds', () => {
            expect(formatElapsed(5 * 60_000 + 7_000)).toBe('5m 07s');
        });

        it('formats 59m 59s as 59m 59s', () => {
            expect(formatElapsed(59 * 60_000 + 59_000)).toBe('59m 59s');
        });
    });

    describe('one hour and above → "Hh Mm"', () => {
        it('formats 60m as 1h 00m', () => {
            expect(formatElapsed(60 * 60_000)).toBe('1h 00m');
        });

        it('formats 1h 7m as 1h 07m', () => {
            expect(formatElapsed(60 * 60_000 + 7 * 60_000)).toBe('1h 07m');
        });

        it('formats 2h 30m as 2h 30m', () => {
            expect(formatElapsed(2 * 60 * 60_000 + 30 * 60_000)).toBe('2h 30m');
        });
    });
});
