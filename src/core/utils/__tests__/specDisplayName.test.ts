import { resolveSpecDisplayName } from '../specDisplayName';

describe('resolveSpecDisplayName', () => {
    it('prefers the recorded name over the slug', () => {
        expect(resolveSpecDisplayName('Readable Spec Names', '515-readable-spec-names'))
            .toBe('Readable Spec Names');
    });

    it('trims a recorded name with surrounding whitespace', () => {
        expect(resolveSpecDisplayName('  Readable Spec Names  ', '515-readable-spec-names'))
            .toBe('Readable Spec Names');
    });

    it('treats an empty or whitespace-only recorded name as absent', () => {
        expect(resolveSpecDisplayName('', '406-living-spec-components'))
            .toBe('Living Spec Components');
        expect(resolveSpecDisplayName('   ', '406-living-spec-components'))
            .toBe('Living Spec Components');
    });

    it('treats null/undefined recorded name as absent', () => {
        expect(resolveSpecDisplayName(undefined, '406-living-spec-components'))
            .toBe('Living Spec Components');
        expect(resolveSpecDisplayName(null, '406-living-spec-components'))
            .toBe('Living Spec Components');
    });

    it('humanizes the slug when no name is recorded: drops the number, replaces dashes, title-cases', () => {
        expect(resolveSpecDisplayName(undefined, '515-readable-spec-names'))
            .toBe('Readable Spec Names');
    });

    it('resolves the same slug from a full path via basename', () => {
        expect(resolveSpecDisplayName(undefined, 'specs/515-readable-spec-names'))
            .toBe('Readable Spec Names');
    });

    it('uses the document heading before the slug fallback when there is no recorded name', () => {
        expect(resolveSpecDisplayName(undefined, '406-living-spec-components', 'Auth Sessions'))
            .toBe('Auth Sessions');
    });

    it('still prefers the recorded name over a document heading', () => {
        expect(resolveSpecDisplayName('Recorded Name', '406-living-spec-components', 'Heading Name'))
            .toBe('Recorded Name');
    });

    it('ignores a whitespace-only heading', () => {
        expect(resolveSpecDisplayName(undefined, '406-living-spec-components', '   '))
            .toBe('Living Spec Components');
    });

    it('leaves a number-only slug unchanged rather than producing a blank label', () => {
        expect(resolveSpecDisplayName(undefined, '042')).toBe('042');
    });

    it('humanizes a slug that has no leading number', () => {
        expect(resolveSpecDisplayName(undefined, 'my-feature')).toBe('My Feature');
    });

    it('replaces underscores as well as dashes when humanizing the slug', () => {
        expect(resolveSpecDisplayName(undefined, 'my_feature')).toBe('My Feature');
        expect(resolveSpecDisplayName(undefined, '042_readable_spec_names'))
            .toBe('Readable Spec Names');
    });

    it('is stable / idempotent for the same inputs', () => {
        const a = resolveSpecDisplayName(undefined, '515-readable-spec-names');
        const b = resolveSpecDisplayName(undefined, '515-readable-spec-names');
        expect(a).toBe(b);
    });
});
