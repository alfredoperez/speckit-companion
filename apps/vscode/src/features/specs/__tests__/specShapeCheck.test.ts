import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { checkLivingSpec, checkFeatureDeltas, Finding } from '../specShapeCheck';

/**
 * The TypeScript half of a shape check that has to exist twice.
 *
 * The editor cannot assume the spec-kit scripts are installed and must not put
 * a subprocess in the save path, so the checks exist here too. The risk is
 * divergence, not duplication: these are the same fixtures
 * `speckit-extension/tests/test_living_validate.py` reads, and the drift guard
 * there fails the build when either side skips one.
 */

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const FIXTURES = path.join(REPO, 'speckit-extension', 'tests', 'fixtures', 'spec-shape');

const read = (name: string): string =>
    fs.readFileSync(path.join(FIXTURES, name), 'utf-8');

interface Expected {
    kind: 'living' | 'feature';
    target?: string;
    /** Where an unmarked delta block belongs, as the fold would route it. */
    default?: string;
    findings: { severity: string; code: string; line: number }[];
}

const manifest: Record<string, Expected> = JSON.parse(read('expected.json'));

// The universe a `touches` marker is matched against. Tracked files plus the
// directories holding them, which is what the Python half indexes too.
const paths: string[] = (() => {
    // Tracked AND untracked-but-not-ignored, matching what the Python half
    // indexes. Tracked alone would have made the two disagree on a marker
    // naming a file a branch just added.
    const files = execFileSync(
        'git', ['-C', REPO, 'ls-files', '--cached', '--others', '--exclude-standard'],
        { encoding: 'utf-8' },
    ).split('\n').filter(Boolean);
    const all = new Set(files);
    for (const f of files) {
        const parts = f.split('/');
        for (let i = 1; i < parts.length; i++) all.add(parts.slice(0, i).join('/'));
    }
    return [...all];
})();

const marks = (findings: Finding[]) =>
    findings.map(f => ({ severity: f.severity, code: f.code, line: f.line }));

function run(name: string, expected: Expected): Finding[] {
    const text = read(name);
    if (expected.kind === 'living') {
        return checkLivingSpec(text, name, { root: REPO, paths });
    }
    return checkFeatureDeltas(text, name, {
        knownCapabilities: ['spec-shape-target'],
        targetTexts: { 'spec-shape-target': read(expected.target!) },
        defaultCapability: expected.default,
    });
}

describe('the spec shape check, against the shared fixtures (#672 Wave 2)', () => {
    for (const [name, expected] of Object.entries(manifest)) {
        it(`produces exactly the expected findings for ${name}`, () => {
            expect(marks(run(name, expected))).toEqual(expected.findings);
        });
    }

    it('gives every finding a path, a message and a fix', () => {
        for (const [name, expected] of Object.entries(manifest)) {
            for (const f of run(name, expected)) {
                expect(f.path).toBe(name);
                expect(f.message.trim()).not.toBe('');
                expect(f.fix.trim()).not.toBe('');
            }
        }
    });
});

describe('the drift guard', () => {
    it('the manifest names every fixture on disk', () => {
        const onDisk = fs.readdirSync(FIXTURES)
            .filter(f => f.endsWith('.md') && f !== 'README.md')
            .sort();
        expect(Object.keys(manifest).sort()).toEqual(onDisk);
    });

    it('the Python suite iterates the manifest rather than a list', () => {
        // Asserting the twin merely mentions the directory would pass even if it
        // had stopped reading the manifest entirely. What makes the fixtures a
        // contract is that the twin loops over the manifest's own keys.
        const twin = fs.readFileSync(
            path.join(REPO, 'speckit-extension', 'tests', 'test_living_validate.py'), 'utf-8');
        expect(twin).toContain('for name, expected in manifest().items()');
        for (const name of Object.keys(manifest)) {
            expect(twin).not.toContain(`"${name}"`);
        }
    });
});

describe('the check never throws on odd input', () => {
    it('returns nothing for an empty document', () => {
        expect(checkLivingSpec('', 'empty.md', { root: REPO, paths })).toEqual([]);
    });

    it('returns nothing for a document with no requirements section', () => {
        expect(checkLivingSpec('# Title\n\nProse.\n', 'x.md', { root: REPO, paths })).toEqual([]);
    });

    it('returns nothing for a feature spec with no delta blocks', () => {
        expect(checkFeatureDeltas('# Title\n\nProse.\n', 'x.md', {
            knownCapabilities: [], targetTexts: {},
        })).toEqual([]);
    });
});
