/**
 * Unit tests for parseInline — inline.ts
 *
 * Coverage:
 *  - Filename code spans are rendered as <button class="file-ref"> elements
 *  - Non-filename code spans are rendered as plain <code> elements
 *  - Paths with directory prefixes store the full path in data-filename
 *  - Multiple file extensions are recognised
 */

import { parseFragment } from 'parse5';
import { parseInline } from '../inline';

describe('parseInline', () => {
    // -------------------------------------------------------------------------
    // Filename detected → button emitted
    // -------------------------------------------------------------------------
    describe('filename code span → <button class="file-ref">', () => {
        it('wraps a simple .ts filename in a file-ref button', () => {
            // Arrange
            const input = '`card.component.ts`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain(
                '<button class="file-ref" data-filename="card.component.ts"><code>card.component.ts</code></button>'
            );
        });

        it('wraps a .css filename in a file-ref button', () => {
            // Arrange
            const input = '`styles.css`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain(
                '<button class="file-ref" data-filename="styles.css"><code>styles.css</code></button>'
            );
        });

        it('wraps a .json filename in a file-ref button', () => {
            // Arrange
            const input = '`config.json`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain(
                '<button class="file-ref" data-filename="config.json"><code>config.json</code></button>'
            );
        });

        it('wraps a multi-part extension filename (.component.ts) in a file-ref button', () => {
            // Arrange
            const input = '`app.module.ts`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain(
                '<button class="file-ref" data-filename="app.module.ts"><code>app.module.ts</code></button>'
            );
        });
    });

    // -------------------------------------------------------------------------
    // Non-filename code spans → plain <code>
    // -------------------------------------------------------------------------
    describe('non-filename code span → plain <code>', () => {
        it('renders a shell command as plain <code>, not a button', () => {
            // Arrange
            const input = '`npm install`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain('<code>npm install</code>');
            expect(result).not.toContain('file-ref');
            expect(result).not.toContain('<button');
        });

        it('renders an identifier expression as plain <code>, not a button', () => {
            // Arrange
            const input = '`const x = 1`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain('<code>const x = 1</code>');
            expect(result).not.toContain('file-ref');
            expect(result).not.toContain('<button');
        });

        it('renders a plain word without extension as plain <code>', () => {
            // Arrange
            const input = '`foobar`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain('<code>foobar</code>');
            expect(result).not.toContain('file-ref');
        });

        it('renders a dotted property accessor as plain <code>, not a button', () => {
            // Arrange
            const input = '`ctx.currentStep`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain('<code>ctx.currentStep</code>');
            expect(result).not.toContain('file-ref');
            expect(result).not.toContain('<button');
        });

        it('renders a process.env reference as plain <code>, not a button', () => {
            // Arrange
            const input = '`process.env`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain('<code>process.env</code>');
            expect(result).not.toContain('file-ref');
            expect(result).not.toContain('<button');
        });

        it('renders a multi-segment property chain as plain <code>, not a button', () => {
            // Arrange
            const input = '`instance.panel.visible`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain('<code>instance.panel.visible</code>');
            expect(result).not.toContain('file-ref');
            expect(result).not.toContain('<button');
        });

        it('renders an unknown extension as plain <code>, not a button', () => {
            // Arrange
            const input = '`weird.xyz`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain('<code>weird.xyz</code>');
            expect(result).not.toContain('file-ref');
            expect(result).not.toContain('<button');
        });
    });

    // -------------------------------------------------------------------------
    // Path with directory prefix → full path stored in data-filename
    // -------------------------------------------------------------------------
    describe('path with directory prefix → full path in data-filename', () => {
        it('displays basename and stores full path with title tooltip', () => {
            // Arrange
            const input = '`src/utils/helpers.ts`';

            // Act
            const result = parseInline(input);

            // Assert — full path preserved in data-filename, basename shown as text
            expect(result).toContain('data-filename="src/utils/helpers.ts"');
            expect(result).toContain('title="src/utils/helpers.ts"');
            expect(result).toContain('<code>helpers.ts</code>');
            expect(result).toContain('<button class="file-ref"');
        });

        it('displays basename for deeply nested path with title tooltip', () => {
            // Arrange
            const input = '`webview/src/spec-viewer/markdown/inline.ts`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain(
                'data-filename="webview/src/spec-viewer/markdown/inline.ts"'
            );
            expect(result).toContain('title="webview/src/spec-viewer/markdown/inline.ts"');
            expect(result).toContain('<code>inline.ts</code>');
            expect(result).toContain('<button class="file-ref"');
        });

        it('does not add title attribute for simple filenames without directory', () => {
            // Arrange
            const input = '`helpers.ts`';

            // Act
            const result = parseInline(input);

            // Assert — no directory means no title tooltip
            expect(result).toContain('data-filename="helpers.ts"');
            expect(result).toContain('<code>helpers.ts</code>');
            expect(result).not.toContain('title=');
        });
    });

    // -------------------------------------------------------------------------
    // Edge cases
    // -------------------------------------------------------------------------
    describe('a link target is someone else\'s text', () => {
        it('a quote in the target cannot close the attribute', () => {
            const html = parseInline('[go](" onmouseover="alert(1))');
            expect(html).not.toContain('onmouseover="alert(1)"');
            expect(html).toContain('&quot;');
        });

        it('a script scheme does not survive as a target', () => {
            expect(parseInline('[go](javascript:alert(1))')).toContain('href="#"');
        });

        it('an image target is held to the same rule', () => {
            expect(parseInline('![x](javascript:alert(1))')).toContain('src="#"');
        });

        it('an ordinary link still works', () => {
            expect(parseInline('[docs](https://example.com/a?b=1)'))
                .toContain('href="https://example.com/a?b=1"');
        });

        it('a relative path still works', () => {
            expect(parseInline('[spec](./spec.md)')).toContain('href="./spec.md"');
        });
    });

    describe('edge cases', () => {
        it('returns an empty string for empty input', () => {
            expect(parseInline('')).toBe('');
        });

        it('leaves plain text (no backticks) unchanged', () => {
            const input = 'Hello world';
            expect(parseInline(input)).toBe('Hello world');
        });

        it('handles multiple code spans in a single line correctly', () => {
            // Arrange
            const input = 'Run `npm install` then edit `app.component.ts`';

            // Act
            const result = parseInline(input);

            // Assert
            expect(result).toContain('<code>npm install</code>');
            expect(result).not.toContain('file-ref" data-filename="npm install"');
            expect(result).toContain(
                '<button class="file-ref" data-filename="app.component.ts"><code>app.component.ts</code></button>'
            );
        });
    });

    // -------------------------------------------------------------------------
    // A quote in a code span must not escape the attribute it lands in
    // -------------------------------------------------------------------------
    describe('attribute safety', () => {
        it('escapes a double quote inside a file reference', () => {
            // The earlier pass escapes &, < and > but not ", so a quote here
            // closed data-filename and whatever followed became real markup.
            const result = parseInline('`a" data-x="b.ts`');

            // The whole thing stays one attribute value; the injected text
            // survives only as inert characters inside it.
            expect(result).toBe(
                '<button class="file-ref" data-filename="a&quot; data-x=&quot;b.ts">'
                + '<code>a" data-x="b.ts</code></button>'
            );
        });

        it('escapes a quote in the title attribute of a path reference', () => {
            const result = parseInline('`src/a" onmouseover="x/b.ts`');

            expect(result).toBe(
                '<button class="file-ref" data-filename="src/a&quot; onmouseover=&quot;x/b.ts"'
                + ' title="src/a&quot; onmouseover=&quot;x/b.ts"><code>b.ts</code></button>'
            );
        });

        it('leaves an ordinary path untouched', () => {
            const result = parseInline('`src/app/main.ts`');

            expect(result).toContain('data-filename="src/app/main.ts"');
            expect(result).toContain('title="src/app/main.ts"');
        });
    });
});

describe('parseInline: a code span inside a link target or image alt', () => {
    it('leaves the link as text rather than putting the span in the attribute', () => {
        const html = parseInline('[x](`" style="position:fixed" onmouseover="alert(1)`)');
        expect(html).not.toContain('<a ');
        expect(html).not.toMatch(/href="[^"]*"\s+style=/);
    });

    it('leaves the image as text when its alt holds a code span', () => {
        const html = parseInline('![`" onerror="x`](a.png)');
        expect(html).not.toContain('<img');
    });

    it('still links plain targets', () => {
        expect(parseInline('[docs](https://example.com)')).toContain('<a href="https://example.com"');
    });
});

describe('parseInline: an image next to a link', () => {
    type Node = { nodeName: string; attrs?: { name: string; value: string }[]; childNodes?: Node[] };

    const elements = (source: string): Node[] => {
        const found: Node[] = [];
        const walk = (node: Node): void => {
            if (node.attrs) found.push(node);
            (node.childNodes ?? []).forEach(walk);
        };
        walk(parseFragment(parseInline(source)) as unknown as Node);
        return found;
    };
    const names = (node: Node): string[] => (node.attrs ?? []).map((a) => a.name).sort();

    it.each([
        ['a link written across an image', '![[t](u)](x onmouseover=alert y=)'],
        ['an image written as a link target', '[t](![a](b onmouseover=alert c=))'],
    ])('adds no attribute for %s', (_name, source) => {
        for (const node of elements(source)) {
            expect(names(node)).toEqual(node.nodeName === 'img' ? ['alt', 'src'] : ['href', 'target']);
        }
    });

    it('keeps an image that is the text of a link', () => {
        const [link, image] = elements('[![build](badge.svg)](https://example.com)');

        expect(link.attrs).toEqual([{ name: 'href', value: 'https://example.com' }, { name: 'target', value: '_blank' }]);
        expect(image.attrs).toEqual([{ name: 'src', value: 'badge.svg' }, { name: 'alt', value: 'build' }]);
    });
});

describe('parseInline: a file reference with a line', () => {
    const chip = (md: string): Element => {
        const frag = parseFragment(parseInline(md)) as any;
        return frag.childNodes.find((n: any) => n.nodeName === 'button');
    };
    const attr = (el: any, name: string): string | undefined =>
        el.attrs.find((a: any) => a.name === name)?.value;

    it('keeps the path clean and sets the line for path:line', () => {
        const el = chip('`src/a/util.ts:42`');
        expect(attr(el, 'data-filename')).toBe('src/a/util.ts');
        expect(attr(el, 'data-line')).toBe('42');
        expect(attr(el, 'title')).toBe('src/a/util.ts');
    });

    it('keeps the line in the label, so a reader still sees where it points', () => {
        const label = (code: string) => {
            const el: any = chip('`' + code + '`');
            return el.childNodes[0].childNodes[0].value;
        };
        expect(label('src/a/util.ts:42')).toBe('util.ts:42');
        expect(label('util.ts:10-20')).toBe('util.ts:10-20');
        expect(label('src/a/util.ts')).toBe('util.ts');
    });

    it('uses the first number of path:from-to', () => {
        const el = chip('`util.ts:10-20`');
        expect(attr(el, 'data-filename')).toBe('util.ts');
        expect(attr(el, 'data-line')).toBe('10');
    });

    it('uses the start when the range ends before it', () => {
        expect(attr(chip('`util.ts:20-10`'), 'data-line')).toBe('20');
    });

    it.each(['util.ts:0', 'util.ts:abc', 'util.ts:99999999999'])('sets no line for %s', (code) => {
        const el = chip('`' + code + '`');
        expect(el ? attr(el, 'data-line') : undefined).toBeUndefined();
        expect(parseInline('`' + code + '`')).not.toContain('data-line');
    });

    it('leaves an unknown extension as plain code', () => {
        const result = parseInline('`thing.xyz:12`');
        expect(result).toBe('<code>thing.xyz:12</code>');
    });
});
