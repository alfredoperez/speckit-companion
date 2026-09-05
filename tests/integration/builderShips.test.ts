import * as fs from 'fs';
import * as path from 'path';

/**
 * The builder panel is only useful if the sources it reads travel with it.
 *
 * The panel resolves the pipeline by running scripts against the extension's own
 * node files. Ship the panel without them and it can do exactly one thing: say
 * it is unavailable — the "contributed but unreachable" failure this repository
 * has fixed more than once, most recently by deleting seven palette commands
 * that only wrote a log line.
 *
 * `.vscodeignore` excludes `speckit-extension/**` and re-includes what ships, so
 * this reads that list rather than trusting it.
 */
const repoRoot = path.join(__dirname, '..', '..');
const ignore = fs.readFileSync(path.join(repoRoot, '.vscodeignore'), 'utf8');

/** Paths the packing list re-includes after the blanket exclusion. */
const shipped = new Set(
    ignore
        .split('\n')
        .filter(line => line.startsWith('!'))
        .map(line => line.slice(1).trim()),
);

/** Every script the builder path needs at runtime, and why. */
const REQUIRED_SCRIPTS = [
    'build-pipeline.py',      // applies a project's configuration
    'pipeline-graph.py',      // the structure the panel draws
    'config_write.py',        // saves a reorder, a hook or a workflow switch
    'config_repair.py',       // the ways out of a configuration it cannot read
    'assemble-nodes.py',      // both of the above assemble through it
    '_command_parts.py',      // …which reads the node files through this
    'hook_render.py',         // hooks into the body
    'template_render.py',     // a reshaped template
    'decision_routes.py',     // where a verdict routes
    'manifest.py',            // what a run will produce
    'companion_config.py',    // reading companion.yml
    'instruction-budget.py',  // the count a build reports
];

describe('the pipeline builder ships with what it reads', () => {
    it.each(REQUIRED_SCRIPTS)('packs %s', script => {
        expect(shipped.has(`speckit-extension/scripts/${script}`)).toBe(true);
    });

    it('packs the node sources a build assembles from', () => {
        expect(shipped.has('speckit-extension/nodes/**')).toBe(true);
        expect(shipped.has('speckit-extension/extension.yml')).toBe(true);
        expect(shipped.has('speckit-extension/presets/_parts/**')).toBe(true);
    });

    /**
     * The blanket `speckit-extension/**` exclusion is silent: a new content
     * directory is simply absent from the .vsix, and only a real install shows
     * it — the panel offers a fragment or a preset that resolves to nothing.
     */
    it('packs the content the panel offers to pick from', () => {
        expect(shipped.has('speckit-extension/fragments/**')).toBe(true);
        expect(shipped.has('speckit-extension/workflows/presets/**')).toBe(true);
    });

    it('the picked-from directories are not empty', () => {
        for (const rel of [['fragments'], ['workflows', 'presets']]) {
            const dir = path.join(repoRoot, 'speckit-extension', ...rel);
            expect(fs.existsSync(dir)).toBe(true);
            expect(fs.readdirSync(dir).length).toBeGreaterThan(0);
        }
    });

    it('every packed script exists on disk', () => {
        for (const script of REQUIRED_SCRIPTS) {
            const file = path.join(repoRoot, 'speckit-extension', 'scripts', script);
            expect(fs.existsSync(file)).toBe(true);
        }
    });

    /**
     * The list above is written by hand, so it goes stale the ordinary way: a new
     * script is added, the panel resolves it, and nothing says it was left out of
     * the packing list. That is how the repair script shipped as an unreachable
     * file — every test green, and the button missing from a real install.
     *
     * So the requirement is read from the code instead. Every script the panel
     * reaches by swapping a filename onto the build script's path has to be
     * packed, whether or not anyone remembered to list it.
     */
    it('packs every script the panel resolves, including ones added since', () => {
        const source = fs.readFileSync(
            path.join(repoRoot, 'src', 'features', 'specs', 'pipelineGraph.ts'), 'utf8');
        const resolved = Array.from(
            source.matchAll(/build-pipeline\\?\.py\$\/,\s*'([\w.-]+\.py)'/g),
            match => match[1]);

        expect(resolved.length).toBeGreaterThan(0);
        for (const script of resolved) {
            expect(shipped.has(`speckit-extension/scripts/${script}`)).toBe(true);
            expect(fs.existsSync(
                path.join(repoRoot, 'speckit-extension', 'scripts', script))).toBe(true);
        }
    });

    it('the panel resolves its script beside the one the prompt preamble already ships', () => {
        // Both come from the same bundled directory. If that ever changes, the
        // builder's fallback path is wrong and only a real install would show it.
        const source = fs.readFileSync(
            path.join(repoRoot, 'src', 'features', 'specs', 'pipelineBuildCommands.ts'), 'utf8');
        expect(source).toContain("'speckit-extension', 'scripts', 'build-pipeline.py'");
    });
});

/**
 * The other direction: what must NOT ship. Three times a whole tree landed in
 * the package before anyone looked — `__screenshots__/**`, `website/**`, and
 * 494 MB of `media/**` renders — because every guard here asserts what must be
 * present and nothing asserted what must be absent. `vsce ls` would be the
 * direct check, but it runs the full webpack build, so this holds the same
 * property from the ignore list: a new top-level tree is either known to ship
 * or has an explicit exclusion, and a tree that is neither fails the build
 * until someone decides.
 */
const SHIPS_AT_TOP_LEVEL = new Set(['assets', 'capabilities', 'dist', 'speckit-extension', 'webview']);

const excludedTrees = new Set(
    ignore
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('!'))
        .filter(line => /^[^*/]+\/\*\*$/.test(line))
        .map(line => line.slice(0, -3)),
);

describe('every top-level tree is either known to ship or explicitly kept out', () => {
    const topLevelDirs = fs
        .readdirSync(repoRoot, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
        .map(d => d.name);

    it.each(topLevelDirs)('%s', dir => {
        expect(SHIPS_AT_TOP_LEVEL.has(dir) || excludedTrees.has(dir)).toBe(true);
    });

    it('keeps the documentation trees out', () => {
        for (const tree of ['media', 'docs', 'website', 'examples', 'specs', 'design']) {
            expect(excludedTrees.has(tree)).toBe(true);
        }
    });
});
