/**
 * The editor and the command line write the same run record (#629).
 *
 * Two programs, two read-modify-write loops. Each used to guard only its own
 * concurrency — the capture scripts with an advisory lock, the extension with
 * an in-process promise chain — so a write from one landing inside the other's
 * read→publish window was silently discarded.
 *
 * This is the shared test the issue asks for: it drives the REAL Python writer
 * and the REAL TypeScript writer against one spec directory at the same moment,
 * so the two implementations cannot drift apart without it going red.
 */

import { execFileSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    specContextLockPath,
    updateSpecContext,
} from '../../src/features/specs/specContextWriter';
import { backfillMinimalContext } from '../../src/features/specs/specContextBackfill';
import { SpecContext } from '../../src/core/types/specContext';

const REPO = path.resolve(__dirname, '../..');
const WRITER = path.join(REPO, 'speckit-extension', 'scripts', 'write-context.py');
const SPEC_CONTEXT = path.join('specs', '001-x');

function hasPython(): boolean {
    try {
        execFileSync('python3', ['--version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

const describeWithPython = hasPython() ? describe : describe.skip;

/** A throwaway repo with one spec dir, the way a real run finds it. */
function makeCell(): { root: string; specDir: string } {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'xproc-lock-')));
    const specDir = path.join(root, SPEC_CONTEXT);
    fs.mkdirSync(specDir, { recursive: true });
    execFileSync('git', ['init', '-q', '.'], { cwd: root });
    return { root, specDir };
}

function fallback(): SpecContext {
    return backfillMinimalContext({
        workflow: 'speckit-companion',
        specName: 'x',
        branch: 'main',
    });
}

function readRecord(specDir: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(specDir, '.spec-context.json'), 'utf-8'));
}

/**
 * One command-line capture. `--finish` is the widest of the writer's
 * read-modify-writes — it resolves the repo and the branch between reading the
 * record and publishing it — which is the window an editor write disappears
 * into. `--set` rides along so the call also leaves a key of its own.
 */
function pythonWrite(root: string, pair: string): Promise<void> {
    return new Promise(resolve => {
        const child = spawn(
            'python3',
            [
                WRITER,
                '--feature-dir',
                SPEC_CONTEXT,
                '--set',
                pair,
                '--step',
                'plan',
                '--finish',
                '--by',
                'ai',
            ],
            { cwd: root, stdio: 'ignore' }
        );
        child.on('close', () => resolve());
        child.on('error', () => resolve());
    });
}

/** True once the command-line capture has exited. */
function pythonWriteTracked(root: string, pair: string): { done: Promise<void>; isDone: () => boolean } {
    let finished = false;
    const done = pythonWrite(root, pair).then(() => {
        finished = true;
    });
    return { done, isDone: () => finished };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

describeWithPython('cross-process run-record lock (#629)', () => {
    jest.setTimeout(60_000);

    it('both writers queue on the same lock file, keyed the same way', () => {
        const { specDir } = makeCell();
        const target = path.join(specDir, '.spec-context.json');
        const fromPython = execFileSync(
            'python3',
            [
                '-c',
                'import sys,pathlib;sys.path.insert(0,sys.argv[1]);' +
                    'import spec_context;print(spec_context._lock_path(pathlib.Path(sys.argv[2])))',
                path.join(REPO, 'speckit-extension', 'scripts'),
                target,
            ],
            { encoding: 'utf-8' }
        ).trim();
        expect(specContextLockPath(target)).toBe(fromPython);
    });

    it('an editor write and a command-line write issued at the same moment both end up recorded', async () => {
        const { root, specDir } = makeCell();
        // Seed the record the way the pipeline does, so both writers are
        // merging into an existing document.
        await pythonWrite(root, 'seed=1');

        // The script's read→publish window is tens of milliseconds wide (it
        // resolves the repo and the branch in between), so the editor's write
        // has to be issued repeatedly across the script's whole lifetime to be
        // sure of landing inside it. Unlocked, the script publishes the copy it
        // read and the editor's key is simply gone.
        const rounds = 4;
        const editorKeys: string[] = [];
        const cliKeys: string[] = [];
        for (let round = 0; round < rounds; round++) {
            const cli = `cli${round}`;
            cliKeys.push(cli);
            const script = pythonWriteTracked(root, `${cli}=${round}`);
            const editorWrites: Promise<unknown>[] = [];
            for (let n = 0; !script.isDone(); n++) {
                const key = `editor${round}_${n}`;
                editorKeys.push(key);
                editorWrites.push(
                    updateSpecContext(
                        specDir,
                        ctx => ({ ...ctx, [key]: n }) as SpecContext,
                        fallback()
                    ).catch((err: Error) => err)
                );
                await sleep(10);
            }
            await Promise.all([script.done, ...editorWrites]);
        }

        const record = readRecord(specDir);
        const missing = [...cliKeys, ...editorKeys].filter(k => !(k in record));
        expect({ missing, wrote: cliKeys.length + editorKeys.length }).toEqual({
            missing: [],
            wrote: cliKeys.length + editorKeys.length,
        });
    });

    it('a single write from either side still works and leaves no lock behind', async () => {
        const { root, specDir } = makeCell();
        await pythonWrite(root, 'only=1');
        await updateSpecContext(
            specDir,
            ctx => ({ ...ctx, alone: 2 }) as SpecContext,
            fallback()
        );

        const record = readRecord(specDir);
        expect(record.only).toBe(1);
        expect(record.alone).toBe(2);
        expect(fs.existsSync(specContextLockPath(path.join(specDir, '.spec-context.json')))).toBe(
            false
        );
    });

    it('a lock nobody released never blocks a write for good', async () => {
        const { specDir } = makeCell();
        const target = path.join(specDir, '.spec-context.json');
        // A crashed writer's leftover: the lock file exists, its owner is gone.
        fs.mkdirSync(path.dirname(specContextLockPath(target)), { recursive: true });
        fs.writeFileSync(specContextLockPath(target), 'someone-who-died', 'utf-8');

        const started = Date.now();
        await updateSpecContext(
            specDir,
            ctx => ({ ...ctx, survived: true }) as SpecContext,
            fallback()
        );
        expect(readRecord(specDir).survived).toBe(true);
        expect(Date.now() - started).toBeLessThan(20_000);
    });
});
