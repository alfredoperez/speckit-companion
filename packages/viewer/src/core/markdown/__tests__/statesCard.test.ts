import { parseFragment } from 'parse5';
import { registerBlockRenderer } from '../blockFences';
import { BOX_PAD_X, CELL_H, CHAR_W, parseStates, renderStatesCard } from '../statesCard';
import { renderMarkdown } from '../renderer';

type Node = { nodeName: string; value?: string; attrs?: { name: string; value: string }[]; childNodes?: Node[] };

const tree = (html: string): Node => parseFragment(html) as unknown as Node;
const all = (node: Node, out: Node[] = []): Node[] => {
    if (node.attrs) out.push(node);
    (node.childNodes ?? []).forEach((child) => all(child, out));
    return out;
};
const attrs = (node: Node): Record<string, string> => Object.fromEntries((node.attrs ?? []).map((a) => [a.name, a.value]));
const byClass = (html: string, name: string): Node[] =>
    all(tree(html)).filter((node) => (attrs(node).class ?? '').split(/\s+/).includes(name));
const text = (node: Node): string =>
    node.nodeName === '#text' ? node.value ?? '' : (node.childNodes ?? []).map(text).join('');

const BODY = [
    'Draft: Edited but not sent. (start)',
    'Sent: Waiting on the reviewer. shows review-screen',
    'Approved: Merged and done. (final)',
    'Held: Parked until someone picks it up. (proposed)',
    'Draft -> Sent: submit',
    'Sent -> Approved: approve',
    'Sent -> Held: park (proposed)',
    'Held -> Sent: resume (proposed)',
    'grid:',
    'Draft | Sent | Approved',
    '. | Held | .',
].join('\n');

const plan = (body: string, title = 'A review lifecycle', after = ''): string =>
    ['## States', '', '```states ' + title, body, '```', after].join('\n');

const ok = (body: string) => {
    const parsed = parseStates(body);
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed;
};
const error = (body: string): string => {
    const parsed = parseStates(body);
    return parsed.ok ? '' : parsed.error;
};

beforeEach(() => registerBlockRenderer('states', renderStatesCard));

describe('parseStates', () => {
    it('reads states, marks, arrows and the grid', () => {
        const parsed = ok(BODY);

        expect(parsed.states.map((s) => s.name)).toEqual(['Draft', 'Sent', 'Approved', 'Held']);
        expect(parsed.states.map((s) => [s.start, s.final, s.proposed])).toEqual([
            [true, false, false], [false, false, false], [false, true, false], [false, false, true],
        ]);
        expect(parsed.states[1].sentence).toBe('Waiting on the reviewer.');
        expect(parsed.arrows).toHaveLength(4);
        expect(parsed.arrows[2]).toEqual({ from: 1, to: 3, label: 'park', proposed: true });
        expect(parsed.grid).toEqual([[0, 1, 2], [-1, 3, -1]]);
        expect(parsed.start).toBe(0);
    });

    it('keeps the screen a state shows without drawing it', () => {
        expect(ok(BODY).states[1].shows).toBe('review-screen');
    });

    it('starts at the first state when none is marked', () => {
        expect(ok('A: one.\nB: two.\ngrid:\nA | B').start).toBe(0);
        expect(ok('A: one.\nB: two. (start)\ngrid:\nA | B').start).toBe(1);
    });

    it('splits grid cells on whitespace when no bar is used', () => {
        expect(ok('A: one.\nB: two.\ngrid:\nA . B').grid).toEqual([[0, -1, 1]]);
    });

    it.each([
        ['no states', 'grid:\n.', 'no states'],
        ['a duplicate state', 'A: one.\nA: two.\ngrid:\nA', 'twice'],
        ['a state with no sentence', 'A:\ngrid:\nA', 'no sentence'],
        ['a line with no colon', 'A one\ngrid:\nA', 'name: one sentence'],
        ['an arrow to an unknown state', 'A: one.\nA -> Z: go\ngrid:\nA', 'not listed'],
        ['no grid', 'A: one.', 'no grid'],
        ['a state missing from the grid', 'A: one.\nB: two.\ngrid:\nA', 'missing from the grid'],
        ['an unknown name in the grid', 'A: one.\ngrid:\nA | Q', 'not a state'],
        ['a state placed twice', 'A: one.\ngrid:\nA | A', 'twice'],
        ['two starts', 'A: one. (start)\nB: two. (start)\ngrid:\nA | B', 'one start'],
    ])('rejects %s', (_label, body, expected) => {
        expect(error(body)).toContain(expected);
    });

    it('rejects more than 8 states', () => {
        const names = 'ABCDEFGHI'.split('');
        const body = [...names.map((n) => `${n}: one.`), 'grid:', 'A B C D', 'E F G H', 'I'].join('\n');

        expect(error(body)).toContain('more than 8 states');
    });

    it('rejects a grid over 4 columns or 3 rows', () => {
        const five = ['A', 'B', 'C', 'D', 'E'];
        const wide = [...five.map((n) => `${n}: one.`), 'grid:', five.join(' ')].join('\n');
        const tall = ['A', 'B', 'C', 'D'].map((n) => `${n}: one.`).concat('grid:', 'A', 'B', 'C', 'D').join('\n');

        expect(error(wide)).toContain('4 grid columns');
        expect(error(tall)).toContain('3 grid rows');
    });
});

describe('renderStatesCard', () => {
    const html = renderMarkdown(plan(BODY));

    it('draws a card with the title and a legend counting states and proposed', () => {
        expect(byClass(html, 'states-card')).toHaveLength(1);
        expect(text(byClass(html, 'states-title')[0])).toBe('A review lifecycle');
        expect(text(byClass(html, 'states-legend')[0])).toBe('4 states · 1 proposed');
    });

    it('leaves the proposed count out when nothing is proposed', () => {
        const quiet = renderMarkdown(plan('A: one.\nB: two.\nA -> B: go\ngrid:\nA | B'));

        expect(text(byClass(quiet, 'states-legend')[0])).toBe('2 states');
    });

    it('puts the hint under the header, not inside it', () => {
        const hint = byClass(html, 'states-hint');

        expect(hint).toHaveLength(1);
        expect(text(hint[0])).toBe('Pick a state to read what it means');
        expect(byClass(html, 'states-top')[0].childNodes?.some((n) => text(n).includes('Pick a state to read'))).toBe(false);
    });

    it('makes every state a real button, with the start state selected', () => {
        const buttons = byClass(html, 'states-state');

        expect(buttons).toHaveLength(4);
        expect(buttons.every((b) => b.nodeName === 'button' && attrs(b).type === 'button')).toBe(true);
        expect(buttons.map((b) => attrs(b)['aria-pressed'])).toEqual(['true', 'false', 'false', 'false']);
        expect(byClass(html, 'is-selected')).toHaveLength(1);
    });

    it('shows the start state name and sentence in the caption', () => {
        const caption = byClass(html, 'states-caption')[0];

        expect(text(caption)).toBe('Draft: Edited but not sent.');
        expect(caption.childNodes?.[0].nodeName).toBe('strong');
        expect(text(caption.childNodes![0])).toBe('Draft');
    });

    it('tags the start and final states under their names', () => {
        const tags = byClass(html, 'states-tag').map(text);

        expect(tags).toEqual(['start', 'final']);
    });

    it('scales the diagram down with a viewBox and a max width', () => {
        const stage = byClass(html, 'states-stage')[0];

        expect(attrs(stage).style).toContain('max-width:');
        expect(html).toContain('viewBox="0 0 ');
    });

    it('offsets two opposing arrows to opposite sides with a label on each', () => {
        const pair = renderMarkdown(plan('A: one.\nB: two.\nA -> B: go\nB -> A: back\ngrid:\nA | B'));
        const paths = byClass(pair, 'states-arrow').map((n) => attrs(n).d.match(/-?[\d.]+/g)!.map(Number));
        const labels = byClass(pair, 'states-label').map((n) => Number(attrs(n).y));
        const centre = 36 + 27;

        expect(Math.sign(paths[0][1] - centre) * Math.sign(paths[1][1] - centre)).toBe(-1);
        expect(Math.sign(labels[0] - centre)).toBe(Math.sign(paths[0][1] - centre));
        expect(Math.sign(labels[1] - centre)).toBe(Math.sign(paths[1][1] - centre));
        expect(labels[0]).not.toBe(labels[1]);
        expect(Math.abs(labels[0] - labels[1])).toBeGreaterThan(20);
    });

    it('leaves a single arrow on the centre line', () => {
        const lone = renderMarkdown(plan('A: one.\nB: two.\nA -> B: go\ngrid:\nA | B'));
        const d = attrs(byClass(lone, 'states-arrow')[0]).d.match(/-?[\d.]+/g)!.map(Number);

        expect(d[1]).toBe(d[3]);
    });

    it('lists every sentence for a surface with no click', () => {
        const items = byClass(html, 'states-sentence').map(text);

        expect(items).toEqual(['Edited but not sent.', 'Waiting on the reviewer.', 'Merged and done.', 'Parked until someone picks it up.']);
    });

    it('marks proposed states and proposed arrows dashed', () => {
        expect(byClass(html, 'states-state--proposed')).toHaveLength(1);
        expect(byClass(html, 'states-arrow--proposed')).toHaveLength(2);
        expect(byClass(html, 'states-arrow')).toHaveLength(4);
    });

    it('labels every arrow', () => {
        expect(byClass(html, 'states-label').map(text)).toEqual(['submit', 'approve', 'park', 'resume']);
    });

    it('draws the diagram as an svg it built, with no model markup', () => {
        const hostile = renderMarkdown(plan('A: <img src=x onerror=alert(1)>.\nB: two.\nA -> B: <b>go</b>\ngrid:\nA | B'));

        expect(hostile).not.toContain('<img');
        expect(hostile).not.toContain('<b>go');
        expect(hostile).toContain('&lt;b&gt;go&lt;/b&gt;');
        expect(hostile).toContain('<svg');
    });

    it('carries no user text in an attribute', () => {
        const quoted = renderMarkdown(plan('A "x": one.\nB: two.\ngrid:\nA "x" | B'));

        expect(all(tree(quoted)).some((n) => Object.values(attrs(n)).some((v) => v.includes('"x"')))).toBe(false);
    });

    it('wraps the whole block as one commentable line', () => {
        const lines = byClass(html, 'component-line');

        expect(lines).toHaveLength(1);
        expect(attrs(lines[0])['data-line']).toBe('4');
        expect(text(byClass(html, 'line-content')[0])).toContain('Draft -> Sent: submit');
    });

    it('shows a note under the card', () => {
        const noted = renderMarkdown(plan(BODY, 'x', 'note: only the review lifecycle.'));

        expect(text(byClass(noted, 'states-note')[0])).toBe('only the review lifecycle.');
    });
});

const DATES = [
    'NoDate: No due date set. (start)', 'Upcoming: Due later.', 'DueToday: Due today.', 'Overdue: Past due. (proposed)', 'Done: Finished. (final)',
    'NoDate -> Upcoming: set date', 'Upcoming -> DueToday: day arrives', 'DueToday -> Overdue: day passes', 'Overdue -> Done: mark done',
    'grid:', 'NoDate | Upcoming | DueToday | Overdue', '. | . | Done | .',
].join('\n');
const LONG = 'A: one. (start)\nAVeryLongStateNameThatKeepsGoing: two. (final)\nA -> AVeryLongStateNameThatKeepsGoing: go\ngrid:\nA | AVeryLongStateNameThatKeepsGoing';

describe('box geometry', () => {
    it.each([['the 5-state block', DATES], ['a block with one long name', LONG]])('fits every name and tag inside its box in %s', (_label, body) => {
        const html = renderMarkdown(plan(body));
        const viewBox = html.match(/<svg class="states-svg[^"]*" viewBox="-?[\d.]+ -?[\d.]+ ([\d.]+) ([\d.]+)"/)!;
        const [width, height] = [Number(viewBox[1]), Number(viewBox[2])];
        const buttons = byClass(html, 'states-state');
        const widths = buttons.map((b) => Number(attrs(b).style.match(/width:([\d.]+)%/)![1]) / 100 * width);

        expect(new Set(widths.map((w) => Math.round(w))).size).toBe(1);
        buttons.forEach((b, i) => {
            const name = text(b.childNodes![0]);
            expect(name.length * CHAR_W + 20).toBeLessThanOrEqual(widths[i]);
            const tag = b.childNodes!.slice(1).map(text).join('');
            expect(tag.length * 6 + 20).toBeLessThanOrEqual(widths[i]);
            const boxH = Number(attrs(b).style.match(/height:([\d.]+)%/)![1]) / 100 * height;
            expect(boxH).toBeCloseTo(CELL_H, 0);
            expect(13 * 1.2 + 12).toBeLessThanOrEqual(boxH);
            expect(BOX_PAD_X).toBeGreaterThanOrEqual(10);
        });
    });

    it('truncates a name past the widest box and keeps the full name in a title', () => {
        const html = renderMarkdown(plan(LONG));
        const long = byClass(html, 'states-state')[1];

        expect(text(long)).toContain('…');
        expect(attrs(long).title).toBe('AVeryLongStateNameThatKeepsGoing');
        expect(attrs(byClass(html, 'states-state')[0]).title).toBeUndefined();
    });

    it('scales the text with the box through one unit', () => {
        expect(attrs(byClass(renderMarkdown(plan(DATES)), 'states-stage')[0]).style).toMatch(/--w:\d+/);
    });
});

describe('the fallback', () => {
    it('keeps a block that does not parse as a plain code block', () => {
        const html = renderMarkdown(plan('A: one.\nA -> Z: go\ngrid:\nA'));

        expect(html).not.toContain('states-card');
        expect(html).toContain('A -&gt; Z: go');
    });

    it('keeps a block over the limits as a plain code block', () => {
        const names = 'ABCDEFGHI'.split('');
        const html = renderMarkdown(plan([...names.map((n) => `${n}: one.`), 'grid:', 'A B C D', 'E F G H', 'I'].join('\n')));

        expect(html).not.toContain('states-card');
    });

    it('stays plain when no renderer is registered', () => {
        registerBlockRenderer('states', undefined);

        expect(renderMarkdown(plan(BODY))).not.toContain('states-card');
    });
});
