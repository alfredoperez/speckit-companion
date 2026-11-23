import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { cleanQuery, isPresetId, presetCommandLine, readSpecPresets } from '../specPresets';

function write(root: string, rel: string, text: string): void {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
}

function manifest(id: string, templates: string[]): string {
    return [
        'preset:', `  id: "${id}"`, `  name: "${id} name"`, '  version: "1.2.0"', '  description: "Does things"',
        'provides:', '  templates:', ...templates, '',
    ].join('\n');
}

const entry = (type: string, name: string, extra = ''): string =>
    `    - type: ${type}\n      name: ${name}\n      file: f.md${extra}`;

describe('readSpecPresets', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'presets-'));
        write(root, '.specify/extensions.yml',
            'hooks:\n  before_plan:\n    - extension: companion\n      command: speckit.companion.before-step\n');
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('reads id, name, version, source, enabled, priority and items', () => {
        write(root, '.specify/presets/lean/preset.yml', manifest('lean', [entry('template', 'spec-template', '\n      strategy: append')]));
        write(root, '.specify/presets/.registry', JSON.stringify({
            presets: { lean: { version: '1.2.0', source: { kind: 'catalog', catalog: 'community' }, enabled: false, priority: 3 } },
        }));
        const [preset] = readSpecPresets(root);
        expect(preset).toMatchObject({
            id: 'lean', name: 'lean name', version: '1.2.0', source: 'community', enabled: false, priority: 3,
        });
        expect(preset.items).toEqual([{
            type: 'template', name: 'spec-template', replaces: 'spec-template', strategy: 'append', file: 'f.md',
        }]);
    });

    it('lists a broken manifest by folder name with a problem', () => {
        write(root, '.specify/presets/broken/preset.yml', ': : not yaml [');
        const [preset] = readSpecPresets(root);
        expect(preset.id).toBe('broken');
        expect(preset.problem).toBeTruthy();
    });

    it('defaults to enabled with priority 10 when there is no registry', () => {
        write(root, '.specify/presets/lean/preset.yml', manifest('lean', []));
        expect(readSpecPresets(root)[0]).toMatchObject({ enabled: true, priority: 10, source: 'local' });
    });

    it('flags a command replacing a step Companion hooks', () => {
        write(root, '.specify/presets/x/preset.yml', manifest('x', [entry('command', 'speckit.plan')]));
        expect(readSpecPresets(root)[0].clashes).toEqual(['speckit.plan']);
    });

    it('does not flag a command on a step Companion does not hook', () => {
        write(root, '.specify/presets/x/preset.yml', manifest('x', [entry('command', 'speckit.tasks')]));
        expect(readSpecPresets(root)[0].clashes).toEqual([]);
    });

    it('flags a template replaced outright', () => {
        write(root, '.specify/presets/x/preset.yml', manifest('x', [entry('template', 'plan-template')]));
        expect(readSpecPresets(root)[0].clashes).toEqual(['plan-template']);
    });

    it('never flags companion-standard', () => {
        write(root, '.specify/presets/companion-standard/preset.yml', manifest('companion-standard', [entry('command', 'speckit.plan')]));
        expect(readSpecPresets(root)[0].clashes).toEqual([]);
    });

    it('treats append as no clash', () => {
        write(root, '.specify/presets/x/preset.yml', manifest('x', [
            entry('command', 'speckit.plan', '\n      strategy: append'),
            entry('template', 'plan-template', '\n      strategy: append'),
        ]));
        expect(readSpecPresets(root)[0].clashes).toEqual([]);
    });
});

describe('clash normalisation and strategies', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'presets-'));
        write(root, '.specify/extensions.yml',
            'hooks:\n  before_plan:\n    - extension: companion\n      command: speckit.companion.before-step\n');
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it.each(['speckit.plan', 'speckit-plan', 'plan'])('flags the command spelled %s', name => {
        write(root, '.specify/presets/x/preset.yml', manifest('x', [entry('command', name)]));
        expect(readSpecPresets(root)[0].clashes).toEqual(['speckit.plan']);
    });

    it.each(['plan-template', 'plan-template.md', 'plan', 'plan.md'])('flags the template spelled %s', name => {
        write(root, '.specify/presets/x/preset.yml', manifest('x', [entry('template', name)]));
        expect(readSpecPresets(root)[0].clashes).toEqual(['plan-template']);
    });

    it('flags wrap on a command and replace-section on a template, not prepend', () => {
        write(root, '.specify/presets/x/preset.yml', manifest('x', [
            entry('command', 'speckit.plan', '\n      strategy: wrap'),
            entry('template', 'spec-template', '\n      strategy: replace-section'),
            entry('template', 'tasks-template', '\n      strategy: prepend'),
            entry('command', 'speckit.plan', '\n      strategy: prepend'),
        ]));
        expect(readSpecPresets(root)[0].clashes).toEqual(['speckit.plan', 'spec-template']);
    });

    it('does not flag wrap on a template', () => {
        write(root, '.specify/presets/x/preset.yml', manifest('x', [entry('template', 'plan-template', '\n      strategy: wrap')]));
        expect(readSpecPresets(root)[0].clashes).toEqual([]);
    });

    it('skips dot folders and bad ids, and lists a registry entry whose folder is gone', () => {
        write(root, '.specify/presets/.cache/preset.yml', manifest('c', []));
        write(root, '.specify/presets/Bad_Name/preset.yml', manifest('b', []));
        write(root, '.specify/presets/real/preset.yml', manifest('real', []));
        write(root, '.specify/presets/.registry', JSON.stringify({ presets: { real: {}, ghost: { version: '1.0.0' } } }));
        const rows = readSpecPresets(root);
        expect(rows.map(r => r.id)).toEqual(['real', 'ghost']);
        expect(rows[1].problem).toBe('listed in .registry but its folder is gone');
    });
});

describe('preset arguments', () => {
    it('accepts only lowercase dashed ids', () => {
        expect(isPresetId('my-preset')).toBe(true);
        expect(isPresetId('Bad; rm')).toBe(false);
        expect(isPresetId('-x')).toBe(false);
    });

    it('cleans a safe query and refuses an unsafe one', () => {
        expect(cleanQuery('  lean spec ')).toBe('lean spec');
        expect(cleanQuery('a; rm -rf')).toBeNull();
        expect(cleanQuery('')).toBeNull();
    });

    it('builds the command line, or null for a bad argument', () => {
        expect(presetCommandLine('add', 'lean')).toBe('specify preset add lean');
        expect(presetCommandLine('search', 'lean spec')).toBe('specify preset search "lean spec"');
        expect(presetCommandLine('remove', '$(x)')).toBeNull();
    });
});
