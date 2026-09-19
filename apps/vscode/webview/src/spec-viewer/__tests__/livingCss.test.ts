import * as fs from 'fs';
import * as path from 'path';

const css = fs.readFileSync(path.join(__dirname, '../../../styles/spec-viewer/_living.css'), 'utf8');
const rule = (selector: string): string => {
    const at = css.indexOf(`${selector} {`);
    if (at === -1) throw new Error(`no rule for ${selector}`);
    return css.slice(at, css.indexOf('}', at));
};

describe('requirement card buttons', () => {
    it.each(['.living-req-approve', '.living-req-remove'])('%s has room and the bar font', (selector) => {
        const body = rule(`#markdown-content ${selector}`);
        expect(body).toContain('min-height: 24px');
        expect(body).toContain('padding: 2px 10px');
        expect(body).toContain('font-family: var(--font-family)');
    });

    it('keeps Remove neutral at rest and red only on hover', () => {
        expect(rule('#markdown-content .living-req-remove')).not.toContain('--error');
        expect(rule('#markdown-content .living-req-remove:hover')).toContain('color: var(--error)');
    });
});
