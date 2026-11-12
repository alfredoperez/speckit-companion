import { parseFenceInfo, mapOutsideFences } from '../fenceInfo';

describe('parseFenceInfo', () => {
    it('reads the language alone', () => {
        const info = parseFenceInfo('ts');
        expect(info.language).toBe('ts');
        expect(info.title).toBe('');
        expect(info.options.size).toBe(0);
    });

    it('reads a quoted title, a key=value option and a bare option', () => {
        const info = parseFenceInfo('calls title="Sign in flow" depth=2 compact');
        expect(info.language).toBe('calls');
        expect(info.title).toBe('Sign in flow');
        expect(info.options.get('depth')).toBe('2');
        expect(info.options.get('compact')).toBe(true);
        expect(info.options.has('title')).toBe(false);
    });

    it('reads an unquoted title word', () => {
        expect(parseFenceInfo('ts title=a.ts').title).toBe('a.ts');
    });

    it('lowercases the language and drops one that is not a plain name', () => {
        expect(parseFenceInfo('TS').language).toBe('ts');
        expect(parseFenceInfo('"><img src=x onerror=alert(1)>').language).toBe('');
        expect(parseFenceInfo('').language).toBe('');
    });

    it('reads options when the line has no language', () => {
        const info = parseFenceInfo('title="x"');
        expect(info.language).toBe('');
        expect(info.title).toBe('x');
    });

    it('does not treat a prototype key as a set option', () => {
        const info = parseFenceInfo('ts __proto__=x constructor');
        expect(info.options.get('constructor')).toBe(true);
        expect(({} as Record<string, unknown>).x).toBeUndefined();
    });

    it('keeps hostile text as data, never as language', () => {
        const info = parseFenceInfo('ts title="a" onmouseover="x()"');
        expect(info.language).toBe('ts');
        expect(info.title).toBe('a');
    });
});

describe('mapOutsideFences', () => {
    const upper = (s: string): string => s.toUpperCase();

    it('returns fn of the whole document when there is no fence', () => {
        expect(mapOutsideFences('a\nb', upper)).toBe('A\nB');
    });

    it('leaves a backtick fence untouched and maps the text around it', () => {
        expect(mapOutsideFences('a\n```js\nb\n```\nc', upper)).toBe('A\n```js\nb\n```\nC');
    });

    it('treats an indented fence as a fence', () => {
        expect(mapOutsideFences('a\n  ```\nb\n  ```\nc', upper)).toBe('A\n  ```\nb\n  ```\nC');
    });

    it('treats an unclosed fence as running to the end', () => {
        expect(mapOutsideFences('a\n```\nb\nc', upper)).toBe('A\n```\nb\nc');
    });

    it('does not treat a tilde fence as a fence', () => {
        expect(mapOutsideFences('a\n~~~\nb\n~~~', upper)).toBe('A\n~~~\nB\n~~~');
    });

    it('keeps the line count when the pass keeps it', () => {
        const src = 'a\n\n```\nx\n\n```\n\nb';
        expect(mapOutsideFences(src, upper).split('\n')).toHaveLength(src.split('\n').length);
    });
});
