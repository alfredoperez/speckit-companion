import { clarificationsIn } from '../clarifications';

describe('clarificationsIn', () => {
    it('lists the questions in the order the document asks them', () => {
        const text = '# Bug\n\nThe cause is known. [NEEDS CLARIFICATION: since when?]\n\n- [NEEDS CLARIFICATION: Who asked?]\n- [needs clarification: what prompted it]\n';

        expect(clarificationsIn(text)).toEqual(['since when?', 'Who asked?', 'what prompted it']);
    });

    it('trims a question and joins one wrapped over two lines', () => {
        expect(clarificationsIn('[NEEDS CLARIFICATION:   same device\n  or two?  ]')).toEqual(['same device or two?']);
    });

    it('skips a marker with no question', () => {
        expect(clarificationsIn('[NEEDS CLARIFICATION] and [NEEDS CLARIFICATION: ]')).toEqual([]);
    });

    it('ignores a marker inside a code fence or a code span', () => {
        const text = [
            '```md',
            '- [NEEDS CLARIFICATION: in a fence]',
            '```',
            '~~~',
            '[NEEDS CLARIFICATION: in a tilde fence]',
            '~~~',
            'Write `[NEEDS CLARIFICATION: in a span]` when unsure.',
            '- [NEEDS CLARIFICATION: Is `qty` ever zero?]',
        ].join('\n');

        expect(clarificationsIn(text)).toEqual(['Is `qty` ever zero?']);
    });

    it('returns nothing for a document with no marker', () => {
        expect(clarificationsIn('# Bug\n\nAll settled.\n')).toEqual([]);
    });
});
