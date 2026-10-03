import { coerceProviderType } from '../aiProvider';
import { AIProviders } from '../../core/constants';

describe('coerceProviderType', () => {
    it('returns every known provider id unchanged', () => {
        for (const id of Object.values(AIProviders)) {
            expect(coerceProviderType(id)).toBe(id);
        }
    });

    it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf'])(
        'rejects the prototype key %s',
        key => {
            expect(coerceProviderType(key)).toBeUndefined();
        }
    );

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['a number', 42],
        ['a boolean', true],
        ['an object', { id: AIProviders.CLAUDE }],
        ['an array holding a known id', [AIProviders.CLAUDE]],
    ])('rejects %s', (_label, value) => {
        expect(coerceProviderType(value)).toBeUndefined();
    });

    it('rejects an id that was renamed or never existed', () => {
        expect(coerceProviderType('claude-code-legacy')).toBeUndefined();
    });

    it('rejects a display name in place of an id', () => {
        expect(coerceProviderType('Claude Code')).toBeUndefined();
    });

    it('rejects a known id with different casing or padding', () => {
        expect(coerceProviderType(AIProviders.CLAUDE.toUpperCase())).toBeUndefined();
        expect(coerceProviderType(` ${AIProviders.CLAUDE} `)).toBeUndefined();
        expect(coerceProviderType('')).toBeUndefined();
    });
});
