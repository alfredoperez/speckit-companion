import { specTitleOf } from '../specTitle';

describe('specTitleOf', () => {
    it('reads the first H1 and strips its kind prefix and inline marks', () => {
        expect(specTitleOf('---\nx: 1\n---\n# Feature Specification: Starred `todos`\n\n## A')).toBe('Starred todos');
    });

    it('is null for a document with no H1', () => {
        expect(specTitleOf('> See [spec](./spec.md#approach)\n')).toBeNull();
    });
});
