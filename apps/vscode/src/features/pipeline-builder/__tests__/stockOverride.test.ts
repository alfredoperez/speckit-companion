import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { makeOverride, removeOverride } from '../stockOverride';

const CORE = '.specify/templates/spec-template.md';
const OVERRIDE = '.specify/templates/overrides/spec-template.md';

function write(root: string, rel: string, body: string): void {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, 'utf8');
}

function project(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-override-'));
    write(root, CORE, '# Core spec\n');
    return root;
}

describe('making a template override', () => {
    it('creates the overrides folder and copies the file now in use', () => {
        const root = project();
        const result = makeOverride(root, CORE);

        expect(result).toEqual({ file: path.join(root, OVERRIDE) });
        expect(fs.readFileSync(path.join(root, OVERRIDE), 'utf8')).toBe('# Core spec\n');
    });

    function preset(root: string, strategy: string, body: string): string {
        write(root, '.specify/presets/.registry', JSON.stringify({ presets: { house: { priority: 1, enabled: true } } }));
        write(root, '.specify/presets/house/preset.yml', [
            'preset:', '  id: house', 'provides:', '  templates:', '    - type: template',
            '      name: spec-template', '      file: templates/spec-template.md',
            `      strategy: ${strategy}`, ''].join('\n'));
        write(root, '.specify/presets/house/templates/spec-template.md', body);
        return '.specify/presets/house/templates/spec-template.md';
    }
    const overrideText = (root: string) => fs.readFileSync(path.join(root, OVERRIDE), 'utf8');

    it('appends the preset after core, joined by a blank line', () => {
        const root = project();
        const top = preset(root, 'append', '## House rules\n');
        expect(makeOverride(root, top)).toEqual({ file: path.join(root, OVERRIDE) });
        expect(overrideText(root)).toBe('# Core spec\n\n\n## House rules\n');
    });

    it('prepends the preset before core', () => {
        const root = project();
        const top = preset(root, 'prepend', '## Banner\n');
        makeOverride(root, top);
        expect(overrideText(root)).toBe('## Banner\n\n\n# Core spec\n');
    });

    it('wraps core where the placeholder sits', () => {
        const root = project();
        const top = preset(root, 'wrap', 'before\n{CORE_TEMPLATE}\nafter\n');
        makeOverride(root, top);
        expect(overrideText(root)).toBe('before\n# Core spec\n\nafter\n');
    });

    it('refuses a wrap with no placeholder and writes nothing', () => {
        const root = project();
        const top = preset(root, 'wrap', 'no slot\n');
        expect(makeOverride(root, top)).toEqual({ error: expect.stringContaining('{CORE_TEMPLATE}') });
        expect(fs.existsSync(path.join(root, OVERRIDE))).toBe(false);
    });

    it('never writes a fragment for a section replacement', () => {
        const root = project();
        const top = preset(root, 'replace-section', '## Only this\n');
        expect(makeOverride(root, top)).toEqual({ error: expect.stringContaining('Open the preset file') });
        expect(fs.existsSync(path.join(root, OVERRIDE))).toBe(false);
    });

    it('refuses a path the board did not offer', () => {
        const root = project();
        expect(makeOverride(root, '../../etc/passwd')).toEqual({ error: expect.any(String) });
        expect(fs.existsSync(path.join(root, '.specify/templates/overrides'))).toBe(false);
    });
});

describe('removing a template override', () => {
    it('deletes nothing until the person confirms', async () => {
        const root = project();
        write(root, OVERRIDE, 'mine\n');
        const asked: string[] = [];

        const declined = await removeOverride(root, OVERRIDE, async file => { asked.push(file); return false; });
        expect(declined).toBeNull();
        expect(asked).toEqual([OVERRIDE]);
        expect(fs.existsSync(path.join(root, OVERRIDE))).toBe(true);

        const done = await removeOverride(root, OVERRIDE, async () => true);
        expect(done).toEqual({ file: path.join(root, OVERRIDE) });
        expect(fs.existsSync(path.join(root, OVERRIDE))).toBe(false);
        expect(fs.existsSync(path.join(root, CORE))).toBe(true);
    });

    it('never removes a layer that is not an override', async () => {
        const root = project();
        const result = await removeOverride(root, CORE, async () => true);
        expect(result).toEqual({ error: expect.any(String) });
        expect(fs.existsSync(path.join(root, CORE))).toBe(true);
    });
});
