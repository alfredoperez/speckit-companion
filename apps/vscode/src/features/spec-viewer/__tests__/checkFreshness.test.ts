import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { _clearFreshnessCacheForTests, filesChangedSince, staleCounts } from '../checkFreshness';
import { markStaleChecks } from '../stateDerivation';
import { makeDefaultGitRunner, type GitRunner } from '../../../core/utils/git';

const TREE = 'a1b2c3d4e5f6';

const NOW = 'ffffeeee0000';

const runner = (out: { changed?: string; now?: string }, calls: Array<{ args: string[]; env?: Record<string, string> }> = []): GitRunner =>
    async (args, _cwd, env) => {
        calls.push({ args, env });
        if (args[0] === 'write-tree') { return `${out.now ?? NOW}\n`; }
        if (args[0] === 'diff-tree') { return out.changed ?? ''; }
        if (args[0] === 'rev-parse') { return args[1] === '--git-path' ? '/nowhere/index\n' : '/repo\n'; }
        return '';
    };

beforeEach(() => _clearFreshnessCacheForTests());

describe('filesChangedSince', () => {
    it('counts the files that differ between the check and now', async () => {
        expect(await filesChangedSince('/repo', TREE, runner({ changed: 'a.ts\0b.ts\0' }))).toBe(2);
    });

    it('snapshots now through a scratch index and passes the excludes', async () => {
        const calls: Array<{ args: string[]; env?: Record<string, string> }> = [];
        await filesChangedSince('/repo', TREE, runner({}, calls));
        const add = calls.find(c => c.args[0] === 'add')!;
        const write = calls.find(c => c.args[0] === 'write-tree')!;
        expect(add.env?.GIT_INDEX_FILE).toBeTruthy();
        expect(write.env?.GIT_INDEX_FILE).toBe(add.env?.GIT_INDEX_FILE);
        const diff = calls.find(c => c.args[0] === 'diff-tree')!.args;
        expect(diff).toEqual(expect.arrayContaining([TREE, NOW, '-z', ':(top,exclude)specs', ':(top,exclude).specify']));
    });

    it('answers 0 without diffing when now is the same tree', async () => {
        const calls: Array<{ args: string[] }> = [];
        expect(await filesChangedSince('/repo', TREE, runner({ now: TREE }, calls))).toBe(0);
        expect(calls.some(c => c.args[0] === 'diff-tree')).toBe(false);
    });

    it('answers undefined for a tree that is not hex', async () => {
        expect(await filesChangedSince('/repo', 'HEAD; rm', runner({}))).toBeUndefined();
    });

    it('answers undefined when git fails', async () => {
        const git: GitRunner = async () => { throw new Error('boom'); };
        expect(await filesChangedSince('/repo', TREE, git)).toBeUndefined();
    });
});

describe('filesChangedSince against a real repository', () => {
    let root: string;
    const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf-8' }).trim();
    const snapshot = () => {
        const index = path.join(root, '.git', 'snapshot-index');
        fs.copyFileSync(path.join(root, '.git', 'index'), index);
        const env = { ...process.env, GIT_INDEX_FILE: index };
        execFileSync('git', ['-C', root, 'add', '-A'], { env });
        const tree = execFileSync('git', ['-C', root, 'write-tree'], { env, encoding: 'utf-8' }).trim();
        fs.rmSync(index);
        return tree;
    };

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'freshness-'));
        git('init', '-q');
        git('config', 'user.email', 't@example.com');
        git('config', 'user.name', 't');
        fs.writeFileSync(path.join(root, 'a.ts'), 'one\n');
        git('add', 'a.ts');
        git('commit', '-qm', 'first');
    });

    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('does not count a new file that is unchanged since the check', async () => {
        fs.writeFileSync(path.join(root, 'new.ts'), 'fresh\n');
        const tree = snapshot();
        expect(await filesChangedSince(root, tree, makeDefaultGitRunner(5000))).toBe(0);
    });

    it('counts an edit to a file that was new when the check ran, and a file added later', async () => {
        fs.writeFileSync(path.join(root, 'new.ts'), 'fresh\n');
        const tree = snapshot();
        fs.writeFileSync(path.join(root, 'new.ts'), 'edited\n');
        fs.writeFileSync(path.join(root, 'later.ts'), 'x\n');
        fs.mkdirSync(path.join(root, 'specs'));
        fs.writeFileSync(path.join(root, 'specs', 'note.md'), 'ignored\n');
        expect(await filesChangedSince(root, tree, makeDefaultGitRunner(5000))).toBe(2);
    });
});

describe('staleCounts', () => {
    it('asks once per distinct tree', async () => {
        const calls: Array<{ args: string[] }> = [];
        const out = await staleCounts('/repo', [TREE, TREE, 'b2c3d4e5f6a7'], runner({ changed: 'a.ts\0' }, calls));
        expect(calls.filter(c => c.args[0] === 'diff-tree')).toHaveLength(2);
        expect(out.get(TREE)).toBe(1);
    });

    it('answers undefined when git is slower than the timeout', async () => {
        const slow: GitRunner = args => args[0] === 'rev-parse'
            ? Promise.resolve('/repo')
            : new Promise<string>(resolve => setTimeout(() => resolve(''), 200));
        const out = await staleCounts('/repo', [TREE], slow, 20);
        expect(out.get(TREE)).toBeUndefined();
    });
});

describe('markStaleChecks', () => {
    const counts = new Map<string, number | undefined>([[TREE, 2]]);

    it('sets changedSince on derived entries that carry a tree', () => {
        const [v] = markStaleChecks([{ what: 'x', source: 'derived', tree: TREE }], counts)!;
        expect(v.changedSince).toBe(2);
    });

    it('leaves claims and treeless entries alone', () => {
        const input = [{ what: 'a' }, { what: 'b', source: 'derived' as const }];
        const out = markStaleChecks(input, counts)!;
        expect(out[0].changedSince).toBeUndefined();
        expect(out[1].changedSince).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
        expect(markStaleChecks(undefined, counts)).toBeUndefined();
    });
});
