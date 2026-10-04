import { normaliseSlug, slugFromText } from '../processCreate';

describe('normalising a slug', () => {
    it.each([
        ['Login Timeout', 'login-timeout'],
        ['  cart_total  skips FIRST ', 'cart-total-skips-first'],
        ['../../etc/passwd', 'etc-passwd'],
        ['a"$(touch x)`b`', 'a-touch-x-b'],
        ['--already--kebab--', 'already-kebab'],
    ])('turns %p into %p', (typed, slug) => {
        expect(normaliseSlug(typed)).toBe(slug);
    });

    it.each(['/', '..', '   ', 'ñ日本', ''])('leaves nothing of %p', typed => {
        expect(normaliseSlug(typed)).toBe('');
    });

    it('keeps only letters, digits and dashes, and no more than forty characters', () => {
        const slug = normaliseSlug('x'.repeat(30) + ' ' + 'y'.repeat(30));
        expect(slug).toMatch(/^[a-z0-9-]+$/);
        expect(slug.length).toBeLessThanOrEqual(40);
        expect(slug.endsWith('-')).toBe(false);
    });
});

describe('suggesting a slug from what was typed', () => {
    it('uses the first four words', () => {
        expect(slugFromText('cartTotal skips the first cart item when the cart has two')).toBe('carttotal-skips-the-first');
    });

    it('is empty for text with nothing usable in it', () => {
        expect(slugFromText('?!')).toBe('');
    });

    it('only reads the start of a very long text', () => {
        expect(slugFromText('a '.repeat(50000))).toBe('a-a-a-a');
    });
});
