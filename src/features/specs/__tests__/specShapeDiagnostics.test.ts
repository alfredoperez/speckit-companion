import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findingsFor, deltaFindingsFor } from '../specShapeDiagnostics';

/**
 * The gate and the mapping, not the listener wiring.
 *
 * What is worth pinning is which files get checked and which do not: a save
 * listener that checks the wrong things is the way this feature becomes noise.
 */

function workspace(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-shape-'));
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body, 'utf-8');
    }
    return root;
}

const REGISTRY = [
    'enabled: true',
    'capabilities:',
    '  - name: todos',
    '    match: ["src/todos/**"]',
    '    spec: src/todos/todos.spec.md',
    '',
].join('\n');

const BROKEN_SPEC = [
    '## Purpose',
    '',
    'Why this exists.',
    '',
    '## Requirements',
    '',
    '### A rule',
    '',
    'It MUST do the thing.',
    '',
    '#### Scenario: no outcome',
    '- **WHEN** asked',
    '',
].join('\n');

const SOUND_SPEC = BROKEN_SPEC.replace('- **WHEN** asked\n', '- **WHEN** asked\n- **THEN** it happens\n');

describe('what the editor checks on save (#672 Wave 2)', () => {
    it('reports a broken scenario on its own line', () => {
        const root = workspace({
            'living-specs.yml': REGISTRY,
            'src/todos/todos.spec.md': BROKEN_SPEC,
        });
        const found = findingsFor(root, path.join(root, 'src/todos/todos.spec.md'), BROKEN_SPEC);
        expect(found).toHaveLength(1);
        expect(found[0].code).toBe('scenario-missing-half');
        expect(found[0].line).toBe(11);
        expect(found[0].capability).toBe('todos');
    });

    it('reports nothing once the problem is fixed', () => {
        const root = workspace({
            'living-specs.yml': REGISTRY,
            'src/todos/todos.spec.md': SOUND_SPEC,
        });
        expect(findingsFor(root, path.join(root, 'src/todos/todos.spec.md'), SOUND_SPEC))
            .toEqual([]);
    });

    it('checks nothing for a file that is not a spec file', () => {
        const root = workspace({ 'living-specs.yml': REGISTRY, 'src/todos/list.ts': 'x' });
        expect(findingsFor(root, path.join(root, 'src/todos/list.ts'), BROKEN_SPEC))
            .toEqual([]);
    });

    it('checks nothing when living specs are off for the project', () => {
        const root = workspace({
            'living-specs.yml': REGISTRY.replace('enabled: true', 'enabled: false'),
            'src/todos/todos.spec.md': BROKEN_SPEC,
        });
        expect(findingsFor(root, path.join(root, 'src/todos/todos.spec.md'), BROKEN_SPEC))
            .toEqual([]);
    });

    it('checks nothing when there is no registry at all', () => {
        const root = workspace({ 'src/todos/todos.spec.md': BROKEN_SPEC });
        expect(findingsFor(root, path.join(root, 'src/todos/todos.spec.md'), BROKEN_SPEC))
            .toEqual([]);
    });

    it('still checks a spec file the registry does not claim, without a capability', () => {
        const root = workspace({
            'living-specs.yml': REGISTRY,
            'src/other/other.spec.md': BROKEN_SPEC,
        });
        const found = findingsFor(root, path.join(root, 'src/other/other.spec.md'), BROKEN_SPEC);
        expect(found).toHaveLength(1);
        expect(found[0].capability).toBeUndefined();
    });
});

describe('what the editor checks in a feature spec (#672 Wave 2)', () => {
    const DELTA = [
        '# Feature',
        '',
        '## MODIFIED Requirements',
        '',
        '<!-- capability: todos -->',
        '',
        '### A rule that is not there',
        '',
        '#### Scenario: s',
        '- **WHEN** asked',
        '- **THEN** it happens',
        '',
    ].join('\n');

    it('reports a delta naming a heading the target does not carry', () => {
        const root = workspace({
            'living-specs.yml': REGISTRY,
            'src/todos/todos.spec.md': SOUND_SPEC,
            'specs/001-x/spec.md': DELTA,
        });
        const found = deltaFindingsFor(root, path.join(root, 'specs/001-x/spec.md'), DELTA);
        expect(found).toHaveLength(1);
        expect(found[0].code).toBe('delta-heading-not-found');
        expect(found[0].line).toBe(7);
    });

    it('checks nothing for a spec.md outside the specs directory', () => {
        const root = workspace({
            'living-specs.yml': REGISTRY,
            'src/todos/todos.spec.md': SOUND_SPEC,
            'elsewhere/spec.md': DELTA,
        });
        expect(deltaFindingsFor(root, path.join(root, 'elsewhere/spec.md'), DELTA)).toEqual([]);
    });
});
