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

describe('extractBlock inside a calls fence', () => {
    const doc = [
        '## Call paths',
        '',
        '```calls A finished step lands',
        '  session.idle @ a.ts:1',
        '~   settle() @ b.ts:2',
        '+     write() @ c.ts:3',
        '```',
        'note: kept apart',
    ];

    it('anchors a row to that single line', () => {
        expect(extractBlock(doc, 5)).toEqual({
            startLine: 5, endLine: 5, text: '~   settle() @ b.ts:2', heading: 'Call paths',
        });
    });

    it('anchors the first and the last row alike', () => {
        expect(extractBlock(doc, 4)).toMatchObject({ startLine: 4, endLine: 4, text: '  session.idle @ a.ts:1' });
        expect(extractBlock(doc, 6)).toMatchObject({ startLine: 6, endLine: 6, text: '+     write() @ c.ts:3' });
    });

    it('leaves another fence as one block', () => {
        const other = ['## H', '```ts', 'const a = 1;', 'const b = 2;', '```'];

        expect(extractBlock(other, 3)).toMatchObject({ startLine: 2, endLine: 5, text: '```ts\nconst a = 1;\nconst b = 2;\n```' });
    });

    it('finds the row in a second calls block after a closed one', () => {
        const two = ['# H', '```calls A', '  a @ a.ts:1', '```', '', '## Two', '```calls B', '  b @ b.ts:1', '+   c @ c.ts:2', '```'];

        expect(extractBlock(two, 9)).toEqual({ startLine: 9, endLine: 9, text: '+   c @ c.ts:2', heading: 'Two' });
    });
});

describe('extractBlock inside a code card fence', () => {
    const doc = [
        '## Design',
        '',
        '```ts src/a.ts:40-42 hl=41',
        'function add(a, b) {',
        '    return a + b;',
        '}',
        '```',
        '',
        'pin 41: the sum',
        'pin 42: closes',
        'prose after',
    ];

    it('anchors a code line to that single line', () => {
        expect(extractBlock(doc, 5)).toEqual({ startLine: 5, endLine: 5, text: '    return a + b;', heading: 'Design' });
    });

    it('anchors a line of a sketch the same way', () => {
        expect(extractBlock(['```ts sketch a.ts', 'a', 'b', '```'], 3)).toEqual({ startLine: 3, endLine: 3, text: 'b', heading: null });
    });

    it('anchors a pin to that single line', () => {
        expect(extractBlock(doc, 10)).toEqual({ startLine: 10, endLine: 10, text: 'pin 42: closes', heading: 'Design' });
    });

    it('treats the line after the pins as an ordinary paragraph', () => {
        expect(extractBlock(doc, 11)?.startLine).toBe(9);
    });

    it('leaves a pin-shaped line with no fence above it in its paragraph', () => {
        expect(extractBlock(['intro', 'pin 1: loose', 'more'], 2)).toMatchObject({ startLine: 1, endLine: 3 });
    });

    it('leaves a line inside an ordinary fence in its paragraph', () => {
        expect(extractBlock(['```ts', 'a', 'b', '```'], 2)).toMatchObject({ startLine: 1, endLine: 4 });
    });
});
