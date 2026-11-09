import * as fs from 'fs';
import * as path from 'path';

const read = (file: string): string => fs.readFileSync(path.join(__dirname, '../../../styles/spec-viewer', file), 'utf8');
const rule = (css: string, selector: string): string => {
    const at = css.indexOf(`${selector} {`);
    if (at === -1) throw new Error(`no rule for ${selector}`);
    return css.slice(at, css.indexOf('}', at));
};

describe('reading column', () => {
    it('lets the content column shrink so wide blocks scroll inside it', () => {
        expect(rule(read('_content.css'), '#markdown-content')).toContain('min-width: 0');
        expect(rule(read('_tables.css'), '#markdown-content .table-scroll')).toContain('overflow-x: auto');
    });

    it('keeps a file chip on one line and truncates it', () => {
        const css = read('_code.css');
        expect(rule(css, '#markdown-content .file-ref')).toContain('white-space: nowrap');
        const code = rule(css, '#markdown-content .file-ref code');
        expect(code).toContain('overflow: hidden');
        expect(code).toContain('text-overflow: ellipsis');
        expect(code).toContain('white-space: nowrap');
    });

    it('draws links no dimmer than body text by leaning the accent toward primary ink', () => {
        expect(rule(read('_content.css'), '#markdown-content a')).toContain('color-mix(in srgb, var(--accent) 60%, var(--text-primary))');
    });
});
