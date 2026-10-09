import { parseFragment } from 'parse5';
import { registerBlockRenderer } from '../blockFences';
import { parseCalls, renderCallsCard } from '../callsCard';
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

const EXAMPLE = [
    '  session.idle @ apps/copilot-canvas/extension.mjs:153',
    '~   settle() @ apps/copilot-canvas/server.mjs:187',
    '      reviewRuns() @ apps/copilot-canvas/server.mjs:117',
    '~     didStep() @ apps/copilot-canvas/server.mjs:114',
    '+     writeRecord() @ apps/copilot-canvas/server.mjs:160',
    '+       recordStep() **new** @ apps/copilot-canvas/run-record.mjs',
].join('\n');

const plan = (body: string, title = 'A finished step lands', after = ''): string =>
    ['## Call paths', '', '```calls ' + title, body, '```', after].join('\n');

beforeEach(() => registerBlockRenderer('calls', renderCallsCard));

describe('parseCalls', () => {
    const rows = (body: string) => {
        const parsed = parseCalls(body, 1);
        if (!parsed.ok) throw new Error(parsed.error);
        return parsed.rows;
    };
    const error = (body: string): string => {
        const parsed = parseCalls(body, 1);
        if (parsed.ok) throw new Error('expected an error');
        return parsed.error;
    };

    it('reads every mark, depth, name and location of the documented example', () => {
        expect(rows(EXAMPLE).map((r) => [r.mark, r.depth, r.name, r.path, r.line, r.isNew])).toEqual([
            [' ', 0, 'session.idle', 'apps/copilot-canvas/extension.mjs', 153, false],
            ['~', 1, 'settle()', 'apps/copilot-canvas/server.mjs', 187, false],
            [' ', 2, 'reviewRuns()', 'apps/copilot-canvas/server.mjs', 117, false],
            ['~', 2, 'didStep()', 'apps/copilot-canvas/server.mjs', 114, false],
            ['+', 2, 'writeRecord()', 'apps/copilot-canvas/server.mjs', 160, false],
            ['+', 3, 'recordStep()', 'apps/copilot-canvas/run-record.mjs', null, true],
        ]);
    });

    it('reads a removed row', () => {
        expect(rows('  a @ a.ts:1\n-   b @ b.ts:2').map((r) => r.mark)).toEqual([' ', '-']);
    });

    it('computes tree guides from depth and sibling order', () => {
        expect(rows(EXAMPLE).map((r) => r.guide)).toEqual(['', '└─ ', '   ├─ ', '   ├─ ', '   └─ ', '      └─ ']);
    });

    it('keeps a vertical guide while an ancestor still has a later sibling', () => {
        const guides = rows('  a @ a.ts:1\n    b @ b.ts:1\n      c @ c.ts:1\n    d @ d.ts:1').map((r) => r.guide);

        expect(guides).toEqual(['', '├─ ', '│  └─ ', '└─ ']);
    });

    it('gives each row the file line it has in the document', () => {
        const parsed = parseCalls('  a @ a.ts:1\n\n    b @ b.ts:1', 40);

        expect(parsed.ok && parsed.rows.map((r) => r.sourceLine)).toEqual([40, 42]);
    });

    it('reads a location without a line', () => {
        expect(rows('  a @ docs/a.md')[0]).toMatchObject({ path: 'docs/a.md', line: null });
    });

    it.each([
        ['no mark column', 'a @ a.ts:1'],
        ['an unknown mark', '*  a @ a.ts:1'],
        ['no space after the mark', '+a @ a.ts:1'],
        ['an odd indent', '  a @ a.ts:1\n+  b @ b.ts:1'],
        ['a tab', '  a @ a.ts:1\n+\tb @ b.ts:1'],
        ['a skipped level', '  a @ a.ts:1\n+     b @ b.ts:1'],
        ['a second entry point', '  a @ a.ts:1\n  b @ b.ts:1'],
        ['an indented first line', '    a @ a.ts:1'],
        ['no location', '  a'],
        ['no name', '  @ a.ts:1'],
        ['new on a changed row', '  a @ a.ts:1\n~   b **new** @ b.ts'],
        ['new with a line', '  a @ a.ts:1\n+   b **new** @ b.ts:3'],
        ['an absolute path', '  a @ /etc/passwd:1'],
        ['a path leaving the repo', '  a @ ../x.ts:1'],
        ['an empty body', ''],
        ['a blank body', '\n  \n'],
    ])('rejects %s', (_name, body) => {
        expect(error(body)).not.toBe('');
    });
});

describe('renderCallsCard: the card', () => {
    const card = (body = EXAMPLE, title = 'A finished step lands', after = ''): string => renderMarkdown(plan(body, title, after));

    it('draws a header with the badge, the title and the counts', () => {
        const html = card();

        expect(text(byClass(html, 'calls-badge')[0])).toBe('calls');
        expect(text(byClass(html, 'calls-title')[0])).toBe('A finished step lands');
        expect(text(byClass(html, 'calls-counts')[0]).replace(/\s+/g, ' ').trim()).toBe('+2 −0 ~2 · 1 entrypoint');
    });

    it('counts a removed row and pluralises nothing it should not', () => {
        const html = card('  a @ a.ts:1\n-   b @ b.ts:2\n-   c @ c.ts:2');

        expect(text(byClass(html, 'calls-counts')[0]).replace(/\s+/g, ' ').trim()).toBe('+0 −2 ~0 · 1 entrypoint');
    });

    it('draws one row per call, tinted by mark', () => {
        const html = card();

        expect(byClass(html, 'calls-row').map((row) => classOf(row).filter((c) => c.startsWith('calls-row--')))).toEqual([
            ['calls-row--same'], ['calls-row--chg'], ['calls-row--same'], ['calls-row--chg'], ['calls-row--add'], ['calls-row--add'],
        ]);
    });

    it('makes each row a commentable line at its source line', () => {
        const html = card();
        const lines = all(tree(html)).filter((n) => classOf(n).includes('component-line') && attrs(n)['data-line']);

        expect(lines.map((n) => attrs(n)['data-line'])).toEqual(['4', '5', '6', '7', '8', '9']);
        expect(byClass(html, 'line-add-btn')).toHaveLength(6);
    });

    it('draws a clickable chip for an existing file and plain text for a new one', () => {
        const html = card();
        const chips = byClass(html, 'file-ref');

        expect(chips).toHaveLength(5);
        expect(attrs(chips[1])).toEqual({
            class: 'file-ref',
            'data-filename': 'apps/copilot-canvas/server.mjs',
            'data-line': '187',
            title: 'apps/copilot-canvas/server.mjs',
        });
        const last = byClass(html, 'calls-row')[5];
        expect(text(last)).toContain('apps/copilot-canvas/run-record.mjs');
        expect(all(last).some((n) => classOf(n).includes('file-ref'))).toBe(false);
        expect(text(byClass(html, 'calls-new')[0])).toBe('new file');
    });

    it('offers a strike button only on a marked row', () => {
        const strikes = byClass(card(), 'calls-strike');

        expect(strikes).toHaveLength(4);
        expect(attrs(strikes[0])).toMatchObject({ 'aria-label': 'Strike this call from the plan', type: 'button' });
    });

    it('moves the note into the card and does not print it again', () => {
        const html = card(EXAMPLE, 'T', '\nnote: only a board run is written.\n\nafter text');

        expect(text(byClass(html, 'calls-note')[0])).toBe('only a board run is written.');
        expect(html.match(/only a board run is written/g)).toHaveLength(1);
        expect(html).toContain('after text');
    });

    it('keeps a bare note: line as text', () => {
        const html = card(EXAMPLE, 'T', 'note:');

        expect(byClass(html, 'calls-note')).toHaveLength(0);
        expect(html).toContain('note:');
    });

    it('draws two cards with a note each', () => {
        const md = [plan('  a @ a.ts:1', 'One', 'note: first'), '', plan('  b @ b.ts:1', 'Two', 'note: second')].join('\n');
        const html = renderMarkdown(md);

        expect(byClass(html, 'calls-card')).toHaveLength(2);
        expect(byClass(html, 'calls-note').map(text)).toEqual(['first', 'second']);
    });

    it('takes a title option over the words after the language', () => {
        const html = renderMarkdown('```calls title="Quoted"\n  a @ a.ts:1\n```\n');

        expect(text(byClass(html, 'calls-title')[0])).toBe('Quoted');
    });

    it('leaves the note as text when the block falls back', () => {
        const html = renderMarkdown('```calls T\nnot a row\n```\nnote: kept');

        expect(byClass(html, 'calls-card')).toHaveLength(0);
        expect(html).toContain('note: kept');
    });
});

describe('renderCallsCard: fallback', () => {
    it.each([
        ['no mark column', 'a @ a.ts:1'],
        ['an odd indent', '  a @ a.ts:1\n+  b @ b.ts:1'],
        ['a second entry point', '  a @ a.ts:1\n  b @ b.ts:1'],
        ['an empty body', ''],
    ])('shows the plain code block for %s', (_name, body) => {
        const html = renderMarkdown(plan(body));

        expect(byClass(html, 'calls-card')).toHaveLength(0);
        expect(html).toContain('<pre class="code-block" data-language="calls">');
    });

    it('shows the plain code block for an unclosed fence', () => {
        const html = renderMarkdown('```calls T\n  a @ a.ts:1\n');

        expect(byClass(html, 'calls-card')).toHaveLength(0);
    });

    it('never throws', () => {
        expect(() => renderCallsCard('\u0000\n+', { language: 'calls', title: '', options: new Map() }, {
            firstLine: 1, note: null, rawTitle: '', wrapLine: (html) => html,
        })).not.toThrow();
    });
});

describe('renderCallsCard: untrusted text', () => {
    const evil = '<img src=x onerror=alert(1)> "q" \'s\' &amp;';

    it('prints a hostile name as text', () => {
        const html = renderMarkdown(plan(`  ${evil} @ a.ts:1`));

        expect(all(tree(html)).map((n) => n.nodeName)).not.toContain('img');
        expect(text(byClass(html, 'calls-name')[0])).toBe(evil);
    });

    it('prints a hostile title as text', () => {
        const html = renderMarkdown(plan('  a @ a.ts:1', '<script>alert(1)</script> "x"'));

        expect(all(tree(html)).map((n) => n.nodeName)).not.toContain('script');
        expect(text(byClass(html, 'calls-title')[0])).toBe('<script>alert(1)</script> "x"');
    });

    it('keeps a hostile path from opening an attribute', () => {
        const html = renderMarkdown(plan('  a @ x"onmouseover="alert(1)/a.ts:7'));
        const [chip] = byClass(html, 'file-ref');

        expect(Object.keys(attrs(chip)).sort()).toEqual(['class', 'data-filename', 'data-line', 'title']);
        expect(attrs(chip)['data-filename']).toBe('x"onmouseover="alert(1)/a.ts');
    });

    it('prints a hostile new-file path as text', () => {
        const html = renderMarkdown(plan('  a @ a.ts:1\n+   b **new** @ <b>x</b>.ts'));

        expect(all(tree(html)).map((n) => n.nodeName)).not.toContain('b');
        expect(html).toContain('&lt;b&gt;x&lt;/b&gt;.ts');
    });

    it('prints a path that is not a known file type as text', () => {
        const html = renderMarkdown(plan('  a @ Makefile:3'));

        expect(byClass(html, 'file-ref')).toHaveLength(0);
        expect(text(byClass(html, 'calls-where')[0])).toBe('Makefile:3');
    });
});

describe('renderCallsCard: where a fence does not count', () => {
    it('leaves a calls fence inside an HTML comment alone', () => {
        const html = renderMarkdown('<!--\n```calls T\n  a @ a.ts:1\n```\n-->\n\nafter');

        expect(byClass(html, 'calls-card')).toHaveLength(0);
    });

    it('leaves a calls fence inside another fence as code', () => {
        const html = renderMarkdown('````md\n```calls T\n  a @ a.ts:1\n```\n````\n');

        expect(byClass(html, 'calls-card')).toHaveLength(0);
    });
});

describe('renderCallsCard: row text for re-anchoring', () => {
    it('keeps each row source as hidden element text, never in an attribute', () => {
        const html = renderMarkdown(plan('  a @ a.ts:1\n+   b() **new** @ "q".ts'));
        const texts = byClass(html, 'line-content').map((n) => text(n));

        expect(texts).toEqual(['  a @ a.ts:1'.trim(), '+   b() **new** @ "q".ts']);
        expect(byClass(html, 'line-content').every((n) => 'hidden' in attrs(n))).toBe(true);
        expect(html).not.toContain('data-source');
    });
});
