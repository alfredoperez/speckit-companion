import * as fs from 'fs';
import * as path from 'path';

/** The project folder Companion stages its own files in; nothing under it is committed. */
export const CACHE_ROOT = '.speckit-companion';

/** Make `<root>/.speckit-companion/<folder>/` and keep the whole cache out of git. Returns the folder's path. */
export function ensureCacheFolder(root: string, folder: string): string {
    const cacheRoot = path.join(root, CACHE_ROOT);
    const target = path.join(cacheRoot, folder);
    fs.mkdirSync(target, { recursive: true });
    try {
        fs.writeFileSync(path.join(cacheRoot, '.gitignore'), '*\n', { flag: 'wx' });
    } catch {
        // already there, or not writable: the staged file still goes out
    }
    return target;
}
