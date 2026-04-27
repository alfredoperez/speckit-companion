import { isSpecGroupItem } from '../specExplorerProvider';

describe('isSpecGroupItem', () => {
    it('returns true for spec-group-active', () => {
        expect(isSpecGroupItem('spec-group-active')).toBe(true);
    });

    it('returns true for spec-group-completed', () => {
        expect(isSpecGroupItem('spec-group-completed')).toBe(true);
    });

    it('returns true for spec-group-archived', () => {
        expect(isSpecGroupItem('spec-group-archived')).toBe(true);
    });

    it('returns false for the legacy unscoped spec-group value', () => {
        expect(isSpecGroupItem('spec-group')).toBe(false);
    });

    it('returns false for per-spec lifecycle values', () => {
        expect(isSpecGroupItem('spec-active')).toBe(false);
        expect(isSpecGroupItem('spec-completed')).toBe(false);
        expect(isSpecGroupItem('spec-archived')).toBe(false);
        expect(isSpecGroupItem('spec-tasks-done')).toBe(false);
    });

    it('returns false for unrelated or missing context values', () => {
        expect(isSpecGroupItem('spec-document')).toBe(false);
        expect(isSpecGroupItem('')).toBe(false);
        expect(isSpecGroupItem(undefined)).toBe(false);
    });
});
