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
    'config_write.py',        // saves a reorder back to companion.yml
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
        expect(shipped.has('speckit-extension/presets/_parts/**')).toBe(true);
    });

    it('every packed script exists on disk', () => {
        for (const script of REQUIRED_SCRIPTS) {
            const file = path.join(repoRoot, 'speckit-extension', 'scripts', script);
            expect(fs.existsSync(file)).toBe(true);
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
