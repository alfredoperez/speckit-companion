/**
 * The seam between the panel and the spec-kit half.
 *
 * Everything the builder knows comes back through here, and everything it
 * changes goes out through here — as command-line arguments to a Python script
 * and a line of output read back. Two things are worth pinning down.
 *
 * The first is the arguments. A misspelled flag is not an error anywhere: the
 * script ignores what it does not recognise, reports success, and the edit
 * quietly does not happen.
 *
 * The second is that a failure has to arrive as something the panel can draw.
 * The builder is most useful when the configuration is broken, so it must never
 * be the thing that fails to open — no Python, no script, unreadable output,
 * all of it comes back as an error shaped like a graph.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    applyRepair,
    createWorkflow,
    readPipelineGraph,
    removeHook,
    resolveConfigRepairScript,
    resolveConfigWriteScript,
    resolveGraphScript,
    writeHook,
    writeNodeOrder,
    writePhases,
    writeWorkflow,
} from '../../../src/features/specs/pipelineGraph';

jest.mock('child_process');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execFile } = require('child_process') as { execFile: jest.Mock };

const SCRIPT = '/ext/scripts/config_write.py';
const ROOT = '/work';

/** The next run succeeds, saying nothing. */
function succeeds(): void {
    execFile.mockImplementationOnce((_bin, _args, _opts, done) => done(null, '', ''));
}

/** The next run fails, with what Python put on each stream. */
function fails(err: Error, stdout = '', stderr = ''): void {
    execFile.mockImplementationOnce((_bin, _args, _opts, done) => done(err, stdout, stderr));
}

/** The arguments the last run was given, after the script and the project. */
function lastArgs(): string[] {
    return execFile.mock.calls.at(-1)![1].slice(3);
}

beforeEach(() => { execFile.mockReset(); });

describe('finding the scripts', () => {
    let workspace: string;
    let extensionPath: string;

    /** Put build-pipeline.py somewhere, since every other script is found beside it. */
    function plant(base: string, ...rel: string[]): void {
        const file = path.join(base, ...rel, 'build-pipeline.py');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '', 'utf8');
    }

    beforeEach(() => {
        workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-ws-'));
        extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-ext-'));
    });

    afterEach(() => {
        fs.rmSync(workspace, { recursive: true, force: true });
        fs.rmSync(extensionPath, { recursive: true, force: true });
    });

    it('finds each script beside the build, so one install answers for all of them', () => {
        plant(extensionPath, 'speckit-extension', 'scripts');
        const dir = path.join(extensionPath, 'speckit-extension', 'scripts');

        expect(resolveGraphScript(workspace, extensionPath))
            .toBe(path.join(dir, 'pipeline-graph.py'));
        expect(resolveConfigWriteScript(workspace, extensionPath))
            .toBe(path.join(dir, 'config_write.py'));
        expect(resolveConfigRepairScript(workspace, extensionPath))
            .toBe(path.join(dir, 'config_repair.py'));
    });

    it('prefers the copy installed in the project over the bundled one', () => {
        plant(extensionPath, 'speckit-extension', 'scripts');
        plant(workspace, '.specify', 'extensions', 'companion', 'scripts');

        expect(resolveGraphScript(workspace, extensionPath))
            .toBe(path.join(workspace, '.specify', 'extensions', 'companion', 'scripts',
                'pipeline-graph.py'));
    });

    it('finds nothing when the spec-kit half is not installed at all', () => {
        expect(resolveGraphScript(workspace, extensionPath)).toBeNull();
        expect(resolveConfigWriteScript(workspace, extensionPath)).toBeNull();
        expect(resolveConfigRepairScript(workspace, extensionPath)).toBeNull();
    });
});

describe('every write names the script and the project', () => {
    it('runs the script it was given, against the project it was given', async () => {
        succeeds();
        await writeWorkflow(SCRIPT, ROOT, 'ours');
        const [bin, args, options] = execFile.mock.calls[0];
        expect(bin).toBe('python3');
        expect(args.slice(0, 3)).toEqual([SCRIPT, '--project', ROOT]);
        expect(options).toMatchObject({ cwd: ROOT });
    });

    it('gives up rather than hanging forever on a script that never returns', async () => {
        succeeds();
        await writeWorkflow(SCRIPT, ROOT, 'ours');
        expect(execFile.mock.calls[0][2].timeout).toBeGreaterThan(0);
    });
});

describe('what each write asks for', () => {
    it('sends a node order as one comma-separated list', async () => {
        succeeds();
        await writeNodeOrder(SCRIPT, ROOT, 'specify', ['research', 'draft', 'handoff']);
        expect(lastArgs()).toEqual(
            ['--command', 'specify', '--nodes', 'research,draft,handoff']);
    });

    it('sends the phases as JSON, so a phase name may contain anything', async () => {
        succeeds();
        await writePhases(SCRIPT, ROOT, 'plan', [{ name: 'gather, then read', nodes: ['a'] }]);
        const args = lastArgs();
        expect(JSON.parse(args[args.indexOf('--phases') + 1]))
            .toEqual([{ name: 'gather, then read', nodes: ['a'] }]);
    });

    it('sends a rename alongside the grouping, so hooks follow the phase', async () => {
        succeeds();
        await writePhases(SCRIPT, ROOT, 'plan', [], { from: 'old', to: 'new' });
        expect(lastArgs()).toEqual(expect.arrayContaining(['--renamed', 'old', 'new']));
    });

    it('says nothing about renaming when nothing was renamed', async () => {
        succeeds();
        await writePhases(SCRIPT, ROOT, 'plan', []);
        expect(lastArgs()).not.toContain('--renamed');
    });

    it('sends a hook with its type, side and anchor', async () => {
        succeeds();
        await writeHook(SCRIPT, ROOT, 'plan', {
            type: 'skill', when: 'before', anchor: 'draft', ref: 'house-check',
        });
        expect(lastArgs()).toEqual(expect.arrayContaining([
            '--command', 'plan', '--hook', 'skill', '--when', 'before',
            '--anchor', 'draft', '--ref', 'house-check',
        ]));
    });

    it('passes the unused fields as empty rather than leaving them out', async () => {
        // The script reads them positionally by flag; a missing one would take
        // the next flag as its value.
        succeeds();
        await writeHook(SCRIPT, ROOT, 'plan', {
            type: 'command', when: 'after', anchor: 'draft', run: './check.sh',
        });
        const args = lastArgs();
        expect(args[args.indexOf('--run') + 1]).toBe('./check.sh');
        expect(args[args.indexOf('--ref') + 1]).toBe('');
        expect(args[args.indexOf('--text') + 1]).toBe('');
    });

    it('sends the index only when a hook is being replaced', async () => {
        succeeds();
        await writeHook(SCRIPT, ROOT, 'plan',
            { type: 'prompt', when: 'after', anchor: 'draft', text: 'x' });
        expect(lastArgs()).not.toContain('--edit-index');

        succeeds();
        await writeHook(SCRIPT, ROOT, 'plan',
            { type: 'prompt', when: 'after', anchor: 'draft', text: 'x', editIndex: 0 });
        expect(lastArgs()).toEqual(expect.arrayContaining(['--edit-index', '0']));
    });

    it('sends the first hook\'s index, which is not the same as sending none', async () => {
        succeeds();
        await writeHook(SCRIPT, ROOT, 'plan',
            { type: 'prompt', when: 'after', anchor: 'draft', text: 'x', editIndex: 0 });
        const args = lastArgs();
        expect(args[args.indexOf('--edit-index') + 1]).toBe('0');
    });

    it('removes a hook by its whole address', async () => {
        succeeds();
        await removeHook(SCRIPT, ROOT, 'plan', 'after', 'draft', 2);
        expect(lastArgs()).toEqual([
            '--command', 'plan', '--when', 'after', '--anchor', 'draft',
            '--remove-index', '2',
        ]);
    });

    it('creates a workflow saying what it is seeded from', async () => {
        succeeds();
        await createWorkflow(SCRIPT, ROOT, 'ours', 'shipped');
        expect(lastArgs()).toEqual(['--new-workflow', 'ours', '--seed-from', 'shipped']);
    });

    it('applies a repair by its id', async () => {
        succeeds();
        await applyRepair(SCRIPT, ROOT, 'drop-empty-phases:tasks');
        expect(lastArgs()).toEqual(['--apply', 'drop-empty-phases:tasks']);
    });
});

describe('what a write reports back', () => {
    it('says nothing at all when it worked', async () => {
        succeeds();
        await expect(writeWorkflow(SCRIPT, ROOT, 'ours')).resolves.toBeNull();
    });

    it('hands back the reason the script gave, not the exit code', async () => {
        fails(new Error('exited 1'), "[config] 'handoff' has to run last.\n");
        await expect(writeNodeOrder(SCRIPT, ROOT, 'specify', ['handoff']))
            .resolves.toBe("'handoff' has to run last.");
    });

    it('reads the reason off the error stream when that is where it went', async () => {
        fails(new Error('exited 1'), '', 'no such phase: gather\n');
        await expect(writePhases(SCRIPT, ROOT, 'plan', []))
            .resolves.toBe('no such phase: gather');
    });

    it('falls back to saying something when the script failed silently', async () => {
        fails(new Error('python3 ENOENT'));
        await expect(writeWorkflow(SCRIPT, ROOT, 'ours'))
            .resolves.toBe('companion.yml could not be written: python3 ENOENT');
    });
});

describe('reading the pipeline', () => {
    it('parses the structure the script printed', async () => {
        execFile.mockImplementationOnce((_bin, _args, _opts, done) =>
            done(null, JSON.stringify({ steps: [], counts: { steps: 0 } }), ''));
        await expect(readPipelineGraph(SCRIPT, ROOT))
            .resolves.toEqual({ steps: [], counts: { steps: 0 } });
    });

    it('reads a configuration error as the error it is, not as a crash', async () => {
        // The script reports a broken configuration on stdout and exits non-zero;
        // the payload is the point, so the exit code must not discard it.
        const broken = JSON.stringify({ error: 'phase gather is empty', repairs: [] });
        execFile.mockImplementationOnce((_bin, _args, _opts, done) =>
            done(new Error('exited 1'), broken, ''));
        await expect(readPipelineGraph(SCRIPT, ROOT))
            .resolves.toEqual({ error: 'phase gather is empty', repairs: [] });
    });

    it('shapes a script that would not run at all as something drawable', async () => {
        fails(new Error('spawn python3 ENOENT'), '', '');
        await expect(readPipelineGraph(SCRIPT, ROOT))
            .resolves.toEqual({ error: 'could not read the pipeline: spawn python3 ENOENT' });
    });

    it('prefers what Python said over what the runner said', async () => {
        fails(new Error('exited 1'), '', 'Traceback: ModuleNotFoundError: yaml\n');
        await expect(readPipelineGraph(SCRIPT, ROOT))
            .resolves.toEqual({ error: 'Traceback: ModuleNotFoundError: yaml' });
    });

    it('says so rather than throwing when the output is not the structure', async () => {
        execFile.mockImplementationOnce((_bin, _args, _opts, done) =>
            done(null, 'Deprecation warning: something\n', ''));
        await expect(readPipelineGraph(SCRIPT, ROOT))
            .resolves.toEqual({ error: 'the pipeline structure could not be read as JSON' });
    });

    it('allows a large pipeline more output than a shell would', async () => {
        execFile.mockImplementationOnce((_bin, _args, _opts, done) => done(null, '{}', ''));
        await readPipelineGraph(SCRIPT, ROOT);
        expect(execFile.mock.calls[0][2].maxBuffer).toBeGreaterThan(1024 * 1024);
    });
});
