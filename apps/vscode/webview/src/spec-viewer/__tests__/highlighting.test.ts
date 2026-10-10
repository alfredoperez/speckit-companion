import { splitHighlighted } from '../highlighting';

describe('splitHighlighted', () => {
    it('closes and reopens a span that runs across lines', () => {
        const lines = splitHighlighted('<span class="hljs-comment">/* a\nb */</span>\nx');

        expect(lines).toEqual(['<span class="hljs-comment">/* a</span>', '<span class="hljs-comment">b */</span>', 'x']);
    });

    it('keeps nested spans balanced on every line', () => {
        const lines = splitHighlighted('<span class="a">1<span class="b">2\n3</span>4</span>');

        expect(lines).toEqual(['<span class="a">1<span class="b">2</span></span>', '<span class="a"><span class="b">3</span>4</span>']);
    });

    it('returns one line per line break plus one', () => {
        expect(splitHighlighted('a\n\nb')).toEqual(['a', '', 'b']);
    });
});
