/**
 * Whether the built commands are still the ones the configuration describes.
 *
 * The check compared `companion.yml` alone, and a build reads much more than
 * that: a node you rewrote, a workflow you switched to, a fragment, a template.
 * So the panel could report `current` while the assistant read commands built
 * before your edit — and the one edit this panel makes easiest, rewriting a
 * node, writes no `companion.yml` at all, which read as `unconfigured`.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readPipelineBuildState } from '../../../src/features/specs/pipelineBuild';

function project(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'build-state-'));
    fs.mkdirSync(path.join(root, '.specify', 'extensions', 'companion', 'commands'),
        { recursive: true });
    return root;
}

/** Write a file, `ms` milliseconds after the epoch of this test's clock. */
function write(root: string, rel: string, at: number): void {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'x');
    fs.utimesSync(file, at / 1000, at / 1000);
}

const EARLY = Date.now() - 60_000;
const LATE = Date.now();

describe('whether the built pipeline is still the one described', () => {
    it('is unconfigured when the project has changed nothing at all', () => {
        expect(readPipelineBuildState(project()).kind).toBe('unconfigured');
    });

    it('counts a rewritten node as a configuration, though it writes no yml', () => {
        const root = project();
        write(root, '.specify/companion/nodes/specify/draft-spec.md', EARLY);
        expect(readPipelineBuildState(root).kind).toBe('never-built');
    });

    it('is current when the build came after every input', () => {
        const root = project();
        write(root, '.specify/companion.yml', EARLY);
        write(root, '.specify/companion/nodes/specify/draft-spec.md', EARLY);
        write(root, '.specify/extensions/companion/commands/speckit.companion.specify.md', LATE);
        expect(readPipelineBuildState(root).kind).toBe('current');
    });

    // The one that was wrong: the configuration is older than the build, so the
    // old check said `current` and the assistant kept reading the previous text.
    it('is stale when a node was rewritten after the build', () => {
        const root = project();
        write(root, '.specify/companion.yml', EARLY);
        write(root, '.specify/extensions/companion/commands/speckit.companion.specify.md', EARLY);
        write(root, '.specify/companion/nodes/specify/draft-spec.md', LATE);
        expect(readPipelineBuildState(root).kind).toBe('stale');
    });

    it('is stale when the workflow it is running was edited after the build', () => {
        const root = project();
        write(root, '.specify/companion.yml', EARLY);
        write(root, '.specify/extensions/companion/commands/speckit.companion.specify.md', EARLY);
        write(root, '.specify/companion/workflows/bugfix.yml', LATE);
        expect(readPipelineBuildState(root).kind).toBe('stale');
    });

    it('is stale when a fragment or a template moved under it', () => {
        for (const rel of [
            '.specify/companion/fragments/ears-requirements.md',
            '.specify/companion/templates/spec-template.md',
        ]) {
            const root = project();
            write(root, '.specify/companion.yml', EARLY);
            write(root, '.specify/extensions/companion/commands/speckit.companion.specify.md',
                EARLY);
            write(root, rel, LATE);
            expect(readPipelineBuildState(root).kind).toBe('stale');
        }
    });
});
