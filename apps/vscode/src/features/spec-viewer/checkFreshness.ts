import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { GitRunner } from '../living-specs/livingSpecsModel';

export const FRESHNESS_TIMEOUT_MS = 1500;
const REUSE_MS = 5000;
const SCOPE = [':(top)', ':(top,exclude)specs', ':(top,exclude).specify'];

const names = (out: string): string[] => out.split('\0').filter(Boolean);

/**
 * Files changed since the snapshot `tree`, outside the spec folders. The working files are snapshotted
 * the way the writer does it, through a copy of the index so its file timestamps spare re-reading
 * unchanged files, and the two trees are compared. The user's own index is never written.
 */
export async function filesChangedSince(root: string, tree: string, git: GitRunner): Promise<number | undefined> {
    if (!/^[0-9a-f]{7,64}$/.test(tree)) { return undefined; }
    const scratch = path.join(os.tmpdir(), `speckit-freshness-${process.pid}-${tree.slice(0, 12)}-${Math.random().toString(36).slice(2)}`);
    const env = { GIT_INDEX_FILE: scratch };
    try {
        const index = (await git(['rev-parse', '--git-path', 'index'], root)).trim();
        await fs.promises.copyFile(path.isAbsolute(index) ? index : path.join(root, index), scratch).catch(() => undefined);
        await git(['add', '-A'], root, env);
        const now = (await git(['write-tree'], root, env)).trim();
        if (now === tree) { return 0; }
        return names(await git(['diff-tree', '-r', '--name-only', '-z', tree, now, '--', ...SCOPE], root)).length;
    } catch {
        return undefined;
    } finally {
        for (const leftover of [scratch, `${scratch}.lock`]) { fs.rm(leftover, { force: true }, () => undefined); }
    }
}

const recent = new Map<string, { at: number; count: Promise<number | undefined> }>();

/** One comparison per distinct tree, each bounded by the timeout and reused for a few seconds. */
export async function staleCounts(
    root: string,
    trees: string[],
    git: GitRunner,
    timeoutMs = FRESHNESS_TIMEOUT_MS
): Promise<Map<string, number | undefined>> {
    let top = root;
    try { top = (await git(['rev-parse', '--show-toplevel'], root)).trim() || root; } catch { /* use root */ }
    const out = new Map<string, number | undefined>();
    await Promise.all([...new Set(trees)].map(async tree => {
        const key = `${top}\0${tree}`;
        const hit = recent.get(key);
        if (hit && Date.now() - hit.at < REUSE_MS) { out.set(tree, await hit.count); return; }
        let timer: NodeJS.Timeout | undefined;
        const count = Promise.race([
            filesChangedSince(top, tree, git),
            new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), timeoutMs); }),
        ]).catch(() => undefined).finally(() => clearTimeout(timer));
        recent.set(key, { at: Date.now(), count });
        out.set(tree, await count);
    }));
    return out;
}

export function _clearFreshnessCacheForTests(): void {
    recent.clear();
}
