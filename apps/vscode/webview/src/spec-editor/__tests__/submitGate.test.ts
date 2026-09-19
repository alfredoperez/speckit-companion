import {
    canSubmit,
    isOverLimit,
    shouldShowCharCount,
    isMacPlatform,
    MAX_CHARS,
} from '../submitGate';

describe('submitGate', () => {
    describe('canSubmit', () => {
        it('blocks an empty description', () => {
            expect(canSubmit('')).toBe(false);
        });

        it('blocks a whitespace-only description', () => {
            expect(canSubmit('   \n\t  ')).toBe(false);
        });

        it('allows a non-empty description within the limit', () => {
            expect(canSubmit('Build a thing')).toBe(true);
        });

        it('blocks a description over the character limit', () => {
            expect(canSubmit('x'.repeat(MAX_CHARS + 1))).toBe(false);
        });

        it('allows a description exactly at the limit', () => {
            expect(canSubmit('x'.repeat(MAX_CHARS))).toBe(true);
        });
    });

    describe('isOverLimit', () => {
        it('is false at the limit and true one past it', () => {
            expect(isOverLimit('x'.repeat(MAX_CHARS))).toBe(false);
            expect(isOverLimit('x'.repeat(MAX_CHARS + 1))).toBe(true);
        });
    });

    describe('shouldShowCharCount', () => {
        it('hides the counter below ~90% of the limit', () => {
            expect(shouldShowCharCount(0)).toBe(false);
            expect(shouldShowCharCount(Math.floor(MAX_CHARS * 0.5))).toBe(false);
        });

        it('shows the counter at and above the 90% threshold', () => {
            expect(shouldShowCharCount(Math.floor(MAX_CHARS * 0.9))).toBe(true);
            expect(shouldShowCharCount(MAX_CHARS + 100)).toBe(true);
        });
    });

    describe('isMacPlatform', () => {
        it('detects Mac from navigator.platform', () => {
            expect(isMacPlatform('MacIntel', '')).toBe(true);
        });

        it('detects Mac from userAgent when platform is empty', () => {
            expect(isMacPlatform('', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)')).toBe(true);
        });

        it('returns false on Windows/Linux', () => {
            expect(isMacPlatform('Win32', 'Mozilla/5.0 (Windows NT 10.0)')).toBe(false);
            expect(isMacPlatform('Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64)')).toBe(false);
        });
    });
});
