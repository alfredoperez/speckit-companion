import { parseFragment } from 'parse5';
import type { BlockPin } from '../blockFences';
import { isCodeCardInfo, parseCode, parseCodeInfo, renderCodeCard } from '../codeCard';
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

const BODY = ['export function add(a: number, b: number) {', '    return a + b;', '}'];
const fence = (info: string, body: string[] = BODY, after: string[] = []): string =>
    ['## Design', '', '```' + info, ...body, '```', ...after].join('\n');
const plainBlock = (language: string, body: string[] = BODY): string =>
    `<pre class="code-block" data-language="${language}"><code class="language-${language}">${body.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
const pin = (line: number, note: string): BlockPin => ({ line, text: note, sourceLine: 0, source: `pin ${line}: ${note}` });

describe('parseCodeInfo', () => {
    it('reads a sketch', () => {
        expect(parseCodeInfo('sketch src/new.ts')).toEqual({ kind: 'sketch', file: 'src/new.ts', from: 1, to: null, hl: [] });
    });

    it('reads a citation with its range', () => {
        expect(parseCodeInfo('src/old.ts:40-44')).toEqual({ kind: 'cite', file: 'src/old.ts', from: 40, to: 44, hl: [] });
    });

    it('reads highlighted lines and ranges', () => {
        expect(parseCodeInfo('sketch a.ts hl=3,6-7')?.hl).toEqual([[3, 3], [6, 7]]);
    });

    it.each([
        ['no sketch or citation', 'title="x"'],
        ['a sketch with no file', 'sketch'],
        ['a sketch whose file is the highlight', 'sketch hl=2'],
        ['an unknown word after the file', 'sketch a.ts wide'],
        ['two highlight words', 'sketch a.ts hl=1 hl=2'],
        ['a highlight that is not numbers', 'sketch a.ts hl=one'],
        ['a backwards highlight range', 'sketch a.ts hl=7-6'],
        ['an absolute path', 'sketch /etc/passwd'],
        ['a drive path', 'C:\\x.ts:1-2'],
        ['a path that climbs out', 'sketch ../a.ts'],
        ['a range starting at zero', 'a.ts:0-2'],
        ['a backwards range', 'a.ts:9-2'],
        ['a single line with no range', 'a.ts:9'],
    ])('rejects %s', (_name, info) => {
        expect(parseCodeInfo(info)).toBeNull();
    });

    it('only asks for a card when the info starts with a sketch or a citation', () => {
        expect(isCodeCardInfo('sketch a.ts')).toBe(true);
        expect(isCodeCardInfo('a.ts:1-2 hl=1')).toBe(true);
        expect(isCodeCardInfo('title="a.ts:1-2"')).toBe(false);
        expect(isCodeCardInfo('sketchy a.ts')).toBe(false);
        expect(isCodeCardInfo('')).toBe(false);
    });
});

describe('parseCode', () => {
    const parse = (info: string, body: string[], pins: BlockPin[] = []) =>
        parseCode(body.join('\n'), parseCodeInfo(info)!, { firstLine: 10, pins });
    const error = (info: string, body: string[], pins: BlockPin[] = []): string => {
        const parsed = parse(info, body, pins);
        if (parsed.ok) throw new Error('expected an error');
        return parsed.error;
    };

    it('numbers a sketch from 1 and a citation from its first line', () => {
        const sketch = parse('sketch a.ts', BODY);
        const cite = parse('a.ts:40-42', BODY);

        expect(sketch.ok && sketch.lines.map((l) => [l.number, l.sourceLine])).toEqual([[1, 10], [2, 11], [3, 12]]);
        expect(cite.ok && cite.lines.map((l) => l.number)).toEqual([40, 41, 42]);
    });

    it('marks highlights and attaches pins by the shown number', () => {
        const parsed = parse('a.ts:40-42 hl=41', BODY, [pin(42, 'closes'), pin(42, 'again')]);

        expect(parsed.ok && parsed.lines.map((l) => [l.highlighted, l.pins.map((p) => p.text)])).toEqual([
            [false, []], [true, []], [false, ['closes', 'again']],
        ]);
    });

    it('counts a blank line as a line', () => {
        const parsed = parse('sketch a.ts', ['a', '', 'b']);

        expect(parsed.ok && parsed.lines.map((l) => l.number)).toEqual([1, 2, 3]);
    });

    it.each([
        ['an empty block', 'sketch a.ts', [''], []],
        ['the body is not as long as the cited range', 'a.ts:40-44', BODY, []],
        ['a highlight outside the lines', 'sketch a.ts hl=4', BODY, []],
        ['a highlight outside the lines', 'a.ts:40-42 hl=2', BODY, []],
        ['a pin outside the lines', 'a.ts:40-42', BODY, [pin(2, 'x')]],
        ['a pin with no text', 'sketch a.ts', BODY, [pin(2, '')]],
    ] as const)('reports %s', (message, info, body, pins) => {
        expect(error(info, [...body], [...pins])).toBe(message);
    });
});

describe('renderCodeCard: the card', () => {
    it('draws a sketch with a plain path and a quiet note', () => {
        const html = renderMarkdown(fence('ts sketch src/new.ts'));
        const card = byClass(html, 'code-card')[0];

        expect(classOf(card)).toContain('code-card--sketch');
        expect(attrs(card)['data-language']).toBe('ts');
        expect(text(byClass(html, 'code-badge')[0])).toBe('code');
        expect(text(byClass(html, 'code-file')[0])).toBe('src/new.ts');
        expect(text(byClass(html, 'code-kind')[0])).toBe('sketch');
        expect(byClass(html, 'file-ref')).toHaveLength(0);
        expect(html).not.toContain('<pre');
    });

    it('draws a citation with a link that opens at its first line', () => {
        const html = renderMarkdown(fence('ts src/old.ts:40-42'));
        const chip = byClass(html, 'file-ref')[0];

        expect(classOf(byClass(html, 'code-card')[0])).toContain('code-card--cite');
        expect(attrs(chip)).toMatchObject({ 'data-filename': 'src/old.ts', 'data-line': '40' });
        expect(text(chip)).toBe('src/old.ts');
        expect(text(byClass(html, 'code-kind')[0])).toBe('lines 40-42');
    });

    it('names a one-line citation as a line', () => {
        expect(text(byClass(renderMarkdown(fence('ts a.ts:7-7', ['x'])), 'code-kind')[0])).toBe('line 7');
    });

    it('prints a cited path that is not a known file type as text', () => {
        const html = renderMarkdown(fence('ts Makefile:1-3'));

        expect(byClass(html, 'file-ref')).toHaveLength(0);
        expect(text(byClass(html, 'code-file')[0])).toBe('Makefile');
    });

    it('numbers each line and prints the code as written', () => {
        const html = renderMarkdown(fence('ts src/old.ts:40-42'));

        expect(byClass(html, 'code-num').map(text)).toEqual(['40', '41', '42']);
        expect(byClass(html, 'code-text').map(text)).toEqual(BODY);
    });

    it('tints only the highlighted lines', () => {
        const html = renderMarkdown(fence('ts sketch a.ts hl=1,3', BODY));

        expect(byClass(html, 'code-row').map((row) => classOf(row).includes('code-row--hl'))).toEqual([true, false, true]);
    });

    it('puts each pin under its line and does not print it again', () => {
        const html = renderMarkdown(fence('ts sketch a.ts', BODY, ['pin 2: the sum', 'pin 2: no overflow check', 'after']));
        const order = all(tree(html)).filter((n) => classOf(n).includes('code-row') || classOf(n).includes('code-pin'));

        expect(order.map((n) => (classOf(n).includes('code-pin') ? 'pin' : 'row'))).toEqual(['row', 'row', 'pin', 'pin', 'row']);
        expect(byClass(html, 'code-pin-text').map(text)).toEqual(['the sum', 'no overflow check']);
        expect(classOf(byClass(html, 'code-row')[1])).toContain('code-row--pinned');
        expect(html.match(/the sum/g)).toHaveLength(2);
        expect(html).toContain('after');
    });

    it('reads pins after a blank line and stops at the first line that is not one', () => {
        const html = renderMarkdown(fence('ts sketch a.ts', BODY, ['', 'pin 1: opens', 'prose', 'pin 3: loose']));

        expect(byClass(html, 'code-pin-text').map(text)).toEqual(['opens']);
        expect(html).toContain('pin 3: loose');
    });

    it('reads a pin indented under a list item', () => {
        const html = renderMarkdown(fence('ts sketch a.ts', BODY, ['  pin 2: the sum']));

        expect(byClass(html, 'code-pin-text').map(text)).toEqual(['the sum']);
    });

    it('leaves a note: line after a code card as text', () => {
        const html = renderMarkdown(fence('ts sketch a.ts', BODY, ['note: not a calls block']));

        expect(byClass(html, 'code-card')).toHaveLength(1);
        expect(html).toContain('note: not a calls block');
    });

    it('makes each code row and each pin a commentable line at its plan line', () => {
        const html = renderMarkdown(fence('ts sketch a.ts', BODY, ['pin 2: the sum']));
        const lines = byClass(html, 'component-line');

        expect(lines.map((n) => attrs(n)['data-line'])).toEqual(['4', '5', '8', '6']);
        expect(byClass(html, 'line-add-btn')).toHaveLength(4);
    });

    it('keeps each line source as hidden element text for re-anchoring', () => {
        const html = renderMarkdown(fence('ts sketch a.ts', ['a'], ['pin 1: why']));
        const hidden = byClass(html, 'line-content');

        expect(hidden.map(text)).toEqual(['a', 'pin 1: why']);
        expect(hidden.every((n) => 'hidden' in attrs(n))).toBe(true);
    });

    it('draws two cards with their own pins', () => {
        const html = renderMarkdown([fence('ts sketch a.ts', ['a'], ['pin 1: one']), '', fence('py b.py:5-5', ['b'], ['pin 5: two'])].join('\n'));

        expect(byClass(html, 'code-card')).toHaveLength(2);
        expect(byClass(html, 'code-pin-text').map(text)).toEqual(['one', 'two']);
    });
});

describe('renderCodeCard: fallback', () => {
    it.each([
        ['a sketch with no file', 'ts sketch', BODY, []],
        ['an unknown word', 'ts sketch a.ts wide', BODY, []],
        ['a path outside the repo', 'ts sketch ../a.ts', BODY, []],
        ['a bad highlight', 'ts sketch a.ts hl=x', BODY, []],
        ['a highlight outside the lines', 'ts sketch a.ts hl=9', BODY, []],
        ['a pin outside the lines', 'ts sketch a.ts', BODY, ['pin 9: nowhere']],
        ['a pin with no text', 'ts sketch a.ts', BODY, ['pin 2:']],
        ['a body shorter than its range', 'ts a.ts:40-49', BODY, []],
    ] as const)('shows the plain code block for %s', (_name, info, body, after) => {
        const html = renderMarkdown(fence(info, [...body], [...after]));

        expect(html).toContain(plainBlock('ts'));
        expect(byClass(html, 'code-card')).toHaveLength(0);
        for (const line of after) expect(html).toContain(line);
    });

    it('shows a plain block for an unclosed fence', () => {
        const html = renderMarkdown('```ts sketch a.ts\nconst a = 1;');

        expect(byClass(html, 'code-card')).toHaveLength(0);
        expect(html).toContain('const a = 1;');
    });

    it('never draws a fence with no language', () => {
        expect(byClass(renderMarkdown('```sketch a.ts\nx\n```'), 'code-card')).toHaveLength(0);
    });

    it('returns nothing rather than throwing on a context it cannot use', () => {
        const info = { language: 'ts', title: '', options: new Map() };
        const context = { firstLine: 1, note: null, pins: [], rawTitle: 'nonsense', wrapLine: (html: string) => html };

        expect(renderCodeCard('x', info, context)).toBe('');
    });
});

describe('renderCodeCard: untrusted text', () => {
    const HOSTILE = '<img src=x onerror=alert(1)>';

    it('prints hostile code as text', () => {
        const html = renderMarkdown(fence('ts sketch a.ts', [HOSTILE]));

        expect(all(tree(html)).some((n) => n.nodeName === 'img')).toBe(false);
        expect(text(byClass(html, 'code-text')[0])).toBe(HOSTILE);
    });

    it('prints a hostile pin as text', () => {
        const html = renderMarkdown(fence('ts sketch a.ts', ['a'], [`pin 1: ${HOSTILE}`]));

        expect(all(tree(html)).some((n) => n.nodeName === 'img')).toBe(false);
        expect(text(byClass(html, 'code-pin-text')[0])).toBe(HOSTILE);
    });

    it('draws inline code in a pin and keeps typed markup as text', () => {
        const html = renderMarkdown(fence('ts sketch a.ts', ['a'], ['pin 1: `read` keeps <b>x</b>']));
        const note = byClass(html, 'code-pin-text')[0];

        expect(all(tree(html)).some((n) => n.nodeName === 'b')).toBe(false);
        expect(text(note)).toBe('read keeps <b>x</b>');
        expect(all(note).filter((n) => n.nodeName === 'code' || classOf(n).includes('file-ref')).length).toBeGreaterThan(0);
    });

    it('tags the kind after the path', () => {
        const html = renderMarkdown(fence('ts sketch a.ts'));
        const head = byClass(html, 'code-head')[0];

        expect((head.childNodes ?? []).filter((n) => n.attrs).map((n) => classOf(n)[0])).toEqual(['code-badge', 'code-file', 'code-kind']);
        expect(classOf(byClass(html, 'code-kind')[0])).toContain('code-kind--sketch');
    });

    it('prints a hostile sketch path as text', () => {
        const html = renderMarkdown(fence('ts sketch <b>x</b>.ts', ['a']));

        expect(all(tree(html)).some((n) => n.nodeName === 'b')).toBe(false);
        expect(text(byClass(html, 'code-file')[0])).toBe('<b>x</b>.ts');
    });

    it('keeps a hostile cited path from opening an attribute', () => {
        const html = renderMarkdown(fence('ts a"onmouseover="alert(1).ts:1-1', ['a']));
        const chip = byClass(html, 'file-ref')[0];

        expect(Object.keys(attrs(chip)).sort()).toEqual(['class', 'data-filename', 'data-line']);
        expect(attrs(chip)['data-filename']).toBe('a"onmouseover="alert(1).ts');
    });

    it('keeps a hostile language out of the markup', () => {
        const html = renderMarkdown('```"><script> sketch a.ts\nx\n```');

        expect(html).not.toContain('<script>');
        expect(byClass(html, 'code-card')).toHaveLength(0);
    });
});

describe('renderCodeCard: where a fence does not count', () => {
    it('leaves a code card fence inside an HTML comment alone', () => {
        expect(renderMarkdown('<!--\n```ts sketch a.ts\nx\n```\n-->\n')).not.toContain('code-card');
    });

    it('leaves a code card fence inside a template note as code', () => {
        const html = renderMarkdown('<details class="template-instructions">\n\n```ts sketch a.ts\nx\n```\n\n</details>\n');

        expect(html).not.toContain('code-card');
    });
});
