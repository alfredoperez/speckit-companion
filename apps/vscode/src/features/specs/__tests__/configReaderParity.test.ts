import { unsupportedForRuntime } from '../livingSpecsModel';

/**
 * The runtime reads these files with a narrow parser and the editor with js-yaml.
 * When they disagree the user is told two different things about one file — a
 * healthy tree in the sidebar, a rejection in the terminal (#608). These cases are
 * the shared contract; the Python side asserts the same set.
 */
describe('config reader parity with the runtime', () => {
    describe('accepts what the runtime accepts', () => {
        it.each([
            ['a plain mapping', 'livingSpecs:\n  enabled: true\n'],
            ['a shell redirect in a value', 'commands:\n  run: "a && b 2>&1"\n'],
            ['an unquoted glob', 'exempt:\n  - *.min.js\n'],
            ['an alias-shaped token with no anchor', 'commands:\n  plan: *bundle\n'],
            ['a hash inside a quoted value', 'spec: "specs/my file #1.md"\n'],
        ])('%s', (_name, text) => {
            expect(unsupportedForRuntime(text)).toBeNull();
        });
    });

    describe('rejects what the runtime rejects, naming the line', () => {
        it.each([
            ['an anchor', 'a: &shared {}\nb: *shared\n'],
            ['a dotted anchor name', 'a: &shared.spec {}\n'],
            ['tab indentation', 'commands:\n\timplement: 1\n'],
            ['a document separator', 'a: 1\n---\nb: 2\n'],
            ['a block scalar', 'note: |\n  first\n  second\n'],
        ])('%s', (_name, text) => {
            const reason = unsupportedForRuntime(text);
            expect(reason).not.toBeNull();
            expect(reason).toMatch(/^line \d+:/);
        });
    });

    it('says why, not just that it refused', () => {
        expect(unsupportedForRuntime('a: &shared {}\n')).toContain('anchors and aliases');
        expect(unsupportedForRuntime('commands:\n\tx: 1\n')).toContain('tab indentation');
        expect(unsupportedForRuntime('note: |\n  x\n')).toContain('block scalars');
    });
});
