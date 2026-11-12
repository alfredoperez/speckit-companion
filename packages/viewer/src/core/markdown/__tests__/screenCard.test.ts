import { parseFragment } from 'parse5';
import { registerBlockRenderer } from '../blockFences';
import { buildScreen, parseNote, parseScreen, renderScreenBlock, renderScreenByName } from '../screenCard';
import { renderMarkdown } from '../renderer';

type Node = { nodeName: string; value?: string; attrs?: { name: string; value: string }[]; childNodes?: Node[] };

const tree = (html: string): Node => parseFragment(html) as unknown as Node;
const all = (node: Node, out: Node[] = []): Node[] => {
    if (node.attrs) out.push(node);
    (node.childNodes ?? []).forEach((child) => all(child, out));
    return out;
};
const attrs = (node: Node): Record<string, string> => Object.fromEntries((node.attrs ?? []).map((a) => [a.name, a.value]));
const classOf = (node: Node): string[] => (attrs(node).class ?? '').split(/\s+/);
const byClass = (html: string, name: string): Node[] => all(tree(html)).filter((node) => classOf(node).includes(name));
const text = (node: Node): string =>
    node.nodeName === '#text' ? node.value ?? '' : (node.childNodes ?? []).map(text).join('');

const BODY = [
    'title: Settings',
    'row:',
    '  field: Name (changed) (1)',
    '  button: Save (new) (2)',
    'chip: Draft',
    'text: Changes apply on save.',
    'list: General | Account | Billing',
].join('\n');
const NOTES = ['1: Name is editable. It was read only.', '2: Save is new. It writes the record.'];

const plan = (body = BODY, notes = NOTES, head = 'settings The settings page'): string =>
    ['## Screens', '', '```screen ' + head, body, '```', ...notes].join('\n');

beforeEach(() => registerBlockRenderer('screen', renderScreenBlock));

describe('parseScreen', () => {
    const parts = (body: string) => {
        const parsed = parseScreen(body);
        if (!parsed.ok) throw new Error(parsed.error);
        return parsed;
    };
    const error = (body: string): string => {
        const parsed = parseScreen(body);
        if (parsed.ok) throw new Error('expected an error');
        return parsed.error;
    };

    it('reads kinds, nesting, marks and dots of the documented example', () => {
        const parsed = parts(BODY);

        expect(parsed.parts.map((p) => [p.kind, p.text, p.mark, p.dot, p.children.length])).toEqual([
            ['title', 'Settings', null, null, 0],
            ['row', '', null, null, 2],
            ['chip', 'Draft', null, null, 0],
            ['text', 'Changes apply on save.', null, null, 0],
            ['list', 'General | Account | Billing', null, null, 0],
        ]);
        expect(parsed.parts[1].children.map((c) => [c.kind, c.text, c.mark, c.dot])).toEqual([
            ['field', 'Name', 'changed', 1],
            ['button', 'Save', 'new', 2],
        ]);
        expect(parsed.dots).toEqual([1, 2]);
        expect(parsed.parts[4].items).toEqual(['General', 'Account', 'Billing']);
    });

    it('reads a mark and a dot in either order', () => {
        const [part] = parts('button: Go (1) (new)').parts;

        expect([part.text, part.mark, part.dot]).toEqual(['Go', 'new', 1]);
    });

    it('lets a row carry a mark and a dot', () => {
        const [row] = parts('row: (changed) (1)\n  text: a').parts;

        expect([row.kind, row.mark, row.dot]).toEqual(['row', 'changed', 1]);
    });

    it('nests a row inside a row', () => {
        expect(parts('row:\n  row:\n    text: deep').parts[0].children[0].children[0].text).toBe('deep');
    });

    it.each([
        ['an unknown part', 'image: logo.png'],
        ['a line with no kind', 'just words'],
        ['a tab', 'row:\n\ttext: a'],
        ['an odd indent', 'row:\n   text: a'],
        ['a skipped level', 'row:\n    text: a'],
        ['an indented first line', '  text: a'],
        ['a child under a part that is not a row', 'text: a\n  text: b'],
        ['a row with text', 'row: side by side\n  text: a'],
        ['a row with nothing in it', 'row:'],
        ['a part with no text', 'button:'],
        ['an empty list item', 'list: a | | b'],
        ['two dots on a part', 'text: a (1) (2)'],
        ['two marks on a part', 'text: a (new) (changed)'],
        ['the same dot twice', 'text: a (1)\ntext: b (1)'],
        ['a zero dot', 'text: a (0)'],
        ['an empty body', ''],
        ['a blank body', '\n  \n'],
    ])('rejects %s', (_name, body) => {
        expect(error(body)).not.toBe('');
    });

    it('allows 14 parts and refuses 15', () => {
        const lines = (n: number) => Array.from({ length: n }, (_, i) => `text: part ${i}`).join('\n');

        expect(parseScreen(lines(14)).ok).toBe(true);
        expect(error(lines(15))).toMatch(/14/);
    });

    it('counts rows and nested parts toward the 14', () => {
        const nested = 'row:\n' + Array.from({ length: 14 }, (_, i) => `  text: part ${i}`).join('\n');

        expect(error(nested)).toMatch(/14/);
    });

    it('allows 5 dots and refuses 6', () => {
        const dotted = (n: number) => Array.from({ length: n }, (_, i) => `text: part ${i} (${i + 1})`).join('\n');

        expect(parseScreen(dotted(5)).ok).toBe(true);
        expect(error(dotted(6))).toMatch(/5/);
    });
});

describe('parseNote', () => {
    it('splits a bold lead from the rest of the sentence', () => {
        expect(parseNote('1: Name is editable. It was read only.')).toEqual({ n: 1, lead: 'Name is editable.', rest: 'It was read only.' });
    });

    it('takes the whole text as the lead when there is one sentence or none', () => {
        expect(parseNote('2: Only this.')).toEqual({ n: 2, lead: 'Only this.', rest: '' });
        expect(parseNote('3: no full stop')).toEqual({ n: 3, lead: 'no full stop', rest: '' });
    });

    it('reads nothing from a line that is not a note', () => {
        expect(parseNote('note: hello')).toBeNull();
    });
});

describe('buildScreen: dots and notes pair up', () => {
    const build = (body: string, notes: string[], head = 'a A screen') => buildScreen(head, body, notes);

    it('builds when every dot has a note and every note a dot', () => {
        expect(build(BODY, NOTES)?.notes.map((n) => n.n)).toEqual([1, 2]);
    });

    it('refuses a dot with no note', () => {
        expect(build(BODY, [NOTES[0]])).toBeNull();
    });

    it('refuses a note with no dot', () => {
        expect(build('text: a (1)', NOTES)).toBeNull();
    });

    it('refuses the same note twice', () => {
        expect(build('text: a (1)', ['1: One. Two.', '1: Again. Two.'])).toBeNull();
    });

    it('builds a screen with no dots and no notes', () => {
        expect(build('text: a', [])?.notes).toEqual([]);
    });

    it('needs a one-word name, and gives the title the rest', () => {
        expect(buildScreen('', 'text: a', [])).toBeNull();
        expect(buildScreen('bad<name> x', 'text: a', [])).toBeNull();
        expect(buildScreen('home The home page', 'text: a', [])).toMatchObject({ name: 'home', title: 'The home page' });
    });
});

const card = (body = BODY, notes = NOTES, head = 'settings The settings page'): string => renderMarkdown(plan(body, notes, head));

describe('renderScreenBlock: note text', () => {
    const note = (line: string, body = 'text: a (1)'): Node => byClass(card(body, [line]), 'screen-note-text')[0];
    const strongs = (n: Node): string[] => all(n).filter((c) => c.nodeName === 'strong').map(text);

    it('renders **lead** as bold and never prints the markers', () => {
        const n = note('1: **The count.** Shows how many open todos are due today, and hides at zero.');
        expect(strongs(n)).toEqual(['The count.']);
        expect(text(n)).not.toContain('*');
    });

    it('bolds only the marked span when there is bold in the middle', () => {
        expect(strongs(note('1: **A date field.** Optional. Empty means no due date.'))).toEqual(['A date field.']);
    });

    it('bolds the first sentence when the note has no bold', () => {
        const n = note('1: A date field. Optional.');
        expect(strongs(n)).toEqual(['A date field.']);
        expect(text(n)).toBe('A date field. Optional.');
    });

    it('keeps typed markup as text', () => {
        const n = note('1: Has <b>bold</b> typed. Rest.');
        expect(all(n).some((c) => c.nodeName === 'b')).toBe(false);
        expect(text(n)).toContain('<b>bold</b>');
    });

    it('renders backticks as code', () => {
        const n = note('1: **Saves.** Calls `save()` once.');
        expect(all(n).filter((c) => c.nodeName === 'code').map(text)).toEqual(['save()']);
    });
});

describe('renderScreenBlock: the card', () => {
    it('draws an outlined badge, the title and the note count', () => {
        const html = card();

        expect(text(byClass(html, 'screen-badge')[0])).toBe('screen');
        expect(text(byClass(html, 'screen-title')[0])).toBe('The settings page');
        expect(text(byClass(html, 'screen-count')[0])).toBe('1 new · 1 changed · 2 notes');
        expect(attrs(byClass(html, 'screen-count')[0])['aria-label']).toBe('1 new, 1 changed, 2 notes');
        expect(text(byClass(html, 'screen-count-new')[0])).toBe('1 new');
        expect(text(byClass(html, 'screen-count-changed')[0])).toBe('1 changed');
    });

    it('says "1 note" for one note and shows no count for none', () => {
        expect(text(byClass(card('text: a (1)', ['1: Only. One.']), 'screen-count')[0])).toBe('1 note');
        expect(byClass(card('text: a', []), 'screen-count')).toHaveLength(0);
    });

    it('falls back to the name when there is no title', () => {
        expect(text(byClass(card(BODY, NOTES, 'settings'), 'screen-title')[0])).toBe('settings');
    });

    it('draws each kind as its own part, in a dashed frame', () => {
        const html = card();

        expect(byClass(html, 'screen-frame')).toHaveLength(1);
        expect(['title', 'row', 'field', 'button', 'chip', 'text', 'list'].map((k) => byClass(html, `screen-part--${k}`).length)).toEqual([1, 1, 1, 1, 1, 1, 1]);
        expect(byClass(html, 'screen-items')[0].childNodes?.filter((n) => n.nodeName === 'li')).toHaveLength(3);
    });

    it('nests the children of a row inside it', () => {
        const [row] = byClass(card(), 'screen-part--row');

        expect(all(row).filter((n) => classOf(n).includes('screen-part')).length).toBe(3);
    });

    it('marks a new part and a changed part by class', () => {
        const html = card();

        expect(byClass(html, 'screen-part--new').map((n) => classOf(n).includes('screen-part--button'))).toEqual([true]);
        expect(byClass(html, 'screen-part--changed').map((n) => classOf(n).includes('screen-part--field'))).toEqual([true]);
    });

    it('omits a zero count', () => {
        expect(text(byClass(card('text: a (new) (1)', ['1: Only. One.']), 'screen-count')[0])).toBe('1 new · 1 note');
    });

    it('draws the notes as a numbered list with a bold lead', () => {
        const html = card();
        const notes = byClass(html, 'screen-note');

        expect(notes.map((n) => attrs(n)['data-n'])).toEqual(['1', '2']);
        expect(text(byClass(html, 'screen-note-text')[0])).toBe('Name is editable. It was read only.');
        expect(text(all(byClass(html, 'screen-note-text')[0]).find((n) => n.nodeName === 'strong')!)).toBe('Name is editable.');
        expect(all(tree(html)).some((n) => n.nodeName === 'ol')).toBe(true);
    });

    it('consumes the numbered lines instead of drawing them as a paragraph', () => {
        const html = renderMarkdown(plan() + '\n\nAfter the notes.');

        expect(html).not.toContain('Name is editable. It was read only.</p>');
        expect(html).toContain('After the notes.');
    });
});

describe('renderScreenBlock: dots', () => {
    const html = renderMarkdown(plan());
    const dots = byClass(html, 'screen-dot');

    it('draws a dot as a real button, inside the part it marks', () => {
        expect(dots.map((d) => d.nodeName)).toEqual(['button', 'button']);
        expect(dots.map((d) => attrs(d).type)).toEqual(['button', 'button']);
        expect(byClass(html, 'screen-part--field')[0].childNodes?.some((n) => classOf(n).includes('screen-dot'))).toBe(true);
    });

    it('shows the number and names the note in its label', () => {
        expect(dots.map((d) => text(d))).toEqual(['1', '2']);
        expect(dots.map((d) => attrs(d)['aria-label'])).toEqual(['Note 1: Name is editable.', 'Note 2: Save is new.']);
    });

    it('pairs each dot with the note of the same number', () => {
        const notes = byClass(html, 'screen-note').map((n) => attrs(n)['data-n']);

        expect(dots.map((d) => attrs(d)['data-n'])).toEqual(notes);
    });

    it('makes a note focusable', () => {
        expect(byClass(html, 'screen-note').map((n) => attrs(n).tabindex)).toEqual(['0', '0']);
    });

    it('speaks a mark to a screen reader', () => {
        expect(byClass(html, 'screen-sr').map(text)).toEqual([' (changed)', ' (new)']);
    });
});

describe('renderScreenBlock: text, never markup', () => {
    const attack = '<img src=x onerror=alert(1)>';

    it('shows every string as text', () => {
        const html = renderMarkdown(plan(`title: ${attack}\nbutton: ${attack} (1)\nlist: ${attack} | b`, [`1: ${attack}. ${attack}`], `x ${attack}`));

        expect(html).not.toContain('<img');
        expect(all(tree(html)).some((n) => n.nodeName === 'img')).toBe(false);
        expect(html).toContain('&lt;img');
    });

    it('keeps a quote in a note from breaking out of the label attribute', () => {
        const html = renderMarkdown(plan('button: Go (1)', ['1: Say "hi" onclick="boom". Rest.']));
        const [dot] = byClass(html, 'screen-dot');

        expect(attrs(dot).onclick).toBeUndefined();
        expect(attrs(dot)['aria-label']).toBe('Note 1: Say "hi" onclick="boom".');
    });

    it('refuses a name with markup, so it never reaches an attribute', () => {
        const html = renderMarkdown(plan(BODY, NOTES, 'a"onload="x Title'));

        expect(html).not.toContain('screen-card');
    });
});

describe('renderScreenBlock: fallback', () => {
    it.each([
        ['an unknown part', 'image: logo.png', []],
        ['a bad indent', 'row:\n   text: a', []],
        ['a dot with no note', 'text: a (1)', []],
        ['a note with no dot', 'text: a', ['1: Lonely. Note.']],
        ['an over-budget block', Array.from({ length: 15 }, (_, i) => `text: ${i}`).join('\n'), []],
    ])('keeps %s as the plain code block', (_name, body, notes) => {
        const html = renderMarkdown(plan(body, notes));

        expect(html).not.toContain('screen-card');
        expect(html).toContain('<pre');
    });

    it('leaves the numbered lines alone when it falls back', () => {
        const html = renderMarkdown(plan('text: a', ['1: Lonely. Note.']));

        expect(html).toContain('Lonely. Note.');
    });

    it('keeps the plain code block when no renderer is registered', () => {
        registerBlockRenderer('screen', undefined);

        expect(renderMarkdown(plan())).not.toContain('screen-card');
    });
});

describe('renderScreenBlock: line comments', () => {
    it('makes the whole block one commentable line at its first body line', () => {
        const html = renderMarkdown(plan());
        const lines = all(tree(html)).filter((n) => classOf(n).includes('component-line') && attrs(n)['data-line']);

        expect(lines.map((n) => attrs(n)['data-line'])).toEqual(['4']);
        expect(byClass(html, 'line-add-btn')).toHaveLength(1);
    });

    it('quotes the fence header for the comment', () => {
        const html = renderMarkdown(plan());

        expect(text(byClass(html, 'line-content')[0])).toBe('screen settings The settings page');
    });
});

describe('renderScreenByName', () => {
    it('draws a screen from the same document by its name, even from before it', () => {
        renderMarkdown(['Before.', '', plan()].join('\n'));

        const html = renderScreenByName('settings')!;

        expect(text(byClass(html, 'screen-title')[0])).toBe('The settings page');
        expect(byClass(html, 'screen-dot')).toHaveLength(2);
        expect(byClass(html, 'component-line')).toHaveLength(0);
    });

    it('knows nothing of a name the document does not hold, or one that fell back', () => {
        renderMarkdown(plan('image: x', []));

        expect(renderScreenByName('settings')).toBeNull();
        expect(renderScreenByName('nope')).toBeNull();
    });

    it('forgets the screens of the previous document', () => {
        renderMarkdown(plan());
        renderMarkdown('Nothing here.');

        expect(renderScreenByName('settings')).toBeNull();
    });

    it('keeps the first of two screens with the same name', () => {
        renderMarkdown([plan('text: first', [], 'dup First'), '', plan('text: second', [], 'dup Second')].join('\n'));

        expect(text(byClass(renderScreenByName('dup')!, 'screen-title')[0])).toBe('First');
    });
});

describe('renderScreenBlock: a list in a row', () => {
    it('draws inline when its parent is a row', () => {
        const html = card('row:\n  text: Conduit\n  list: Home | Settings', []);
        const [list] = byClass(html, 'screen-part--list');

        expect(attrs(list).class).toContain('screen-part--inline');
    });

    it('keeps the vertical stack at the top level', () => {
        const html = card('list: Home | Settings', []);

        expect(attrs(byClass(html, 'screen-part--list')[0]).class).not.toContain('screen-part--inline');
        expect(byClass(html, 'screen-part--inline')).toHaveLength(0);
    });
});
