import * as fs from 'fs';
import * as path from 'path';

/** The project folder Companion stages its own files in; nothing under it is committed. */
export const CACHE_ROOT = '.speckit-companion';

/** Make `<root>/.speckit-companion/<folder>/` and keep the whole cache out of git. Returns the folder's path. */
export function ensureCacheFolder(root: string, folder: string): string {
    const cacheRoot = path.join(root, CACHE_ROOT);
    const target = path.join(cacheRoot, folder);
    // A cache folder shipped as a link must not carry a write outside the project, so each level is checked before the next is made.
    const inside = `${fs.realpathSync(root)}${path.sep}`;
    for (const level of [cacheRoot, target]) {
        fs.mkdirSync(level, { recursive: true });
        if (!`${fs.realpathSync(level)}${path.sep}`.startsWith(inside)) {
            throw new Error(`${path.relative(root, level)} resolves outside the project`);
        }
    }
    try {
        fs.writeFileSync(path.join(cacheRoot, '.gitignore'), '*\n', { flag: 'wx' });
    } catch {
        // already there, or not writable: the staged file still goes out
    }
    return target;
}
