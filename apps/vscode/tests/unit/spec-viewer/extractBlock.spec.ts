import { extractBlock } from '../../../src/features/spec-viewer/extractBlock';

function lines(...rows: string[]): string[] {
    return rows;
}

describe('extractBlock', () => {
    it('returns null for an out-of-range line number', () => {
        expect(extractBlock(lines('# H', ''), 0)).toBeNull();
        expect(extractBlock(lines('# H', ''), 99)).toBeNull();
    });

    it('treats a heading line as its own block', () => {
        const src = lines('# Spec', '', 'body');
        const block = extractBlock(src, 1)!;

        expect(block).toEqual({
            startLine: 1,
            endLine: 1,
            text: '# Spec',
            heading: null,
        });
    });

    it('treats a blank line as its own block', () => {
        const src = lines('para', '', 'more');
        const block = extractBlock(src, 2)!;

        expect(block.startLine).toBe(2);
        expect(block.endLine).toBe(2);
        expect(block.text).toBe('');
    });

    it('captures the whole paragraph and the nearest heading', () => {
        const src = lines(
            '# Spec',
            '',
            '## Summary',
            '',
            'first line',
            'second line',
            'third line',
            '',
            'next paragraph',
        );

        const block = extractBlock(src, 6)!;

        expect(block.startLine).toBe(5);
        expect(block.endLine).toBe(7);
        expect(block.text).toBe('first line\nsecond line\nthird line');
        expect(block.heading).toBe('Summary');
    });

    it('captures only the clicked list item, not its siblings', () => {
        const src = lines(
            '## Requirements',
            '',
            '- first item',
            '- second item',
            '- third item',
        );

        const block = extractBlock(src, 4)!;

        expect(block.text).toBe('- second item');
        expect(block.startLine).toBe(4);
        expect(block.endLine).toBe(4);
        expect(block.heading).toBe('Requirements');
    });

    it('includes indented continuation lines under the clicked list item', () => {
        const src = lines(
            '## Requirements',
            '',
            '- first item',
            '  with a continuation',
            '  and another',
            '- second item',
        );

        const block = extractBlock(src, 3)!;

        expect(block.text).toBe('- first item\n  with a continuation\n  and another');
        expect(block.startLine).toBe(3);
        expect(block.endLine).toBe(5);
    });

    it('pulls the bullet in when clicking on a continuation line', () => {
        const src = lines(
            '- first item',
            '  continuation here',
            '',
            '- second item',
        );

        const block = extractBlock(src, 2)!;

        expect(block.text).toBe('- first item\n  continuation here');
        expect(block.startLine).toBe(1);
        expect(block.endLine).toBe(2);
    });

    it('returns null heading when no preceding heading exists', () => {
        const src = lines('plain paragraph');
        const block = extractBlock(src, 1)!;

        expect(block.heading).toBeNull();
    });
});
