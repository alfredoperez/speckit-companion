import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '../../../..');
const WEBVIEW = path.join(REPO, 'apps/vscode/webview/src');
const SUFFIXES = ['', '.ts', '.tsx', '.js', '.json', '/index.ts', '/index.tsx'];

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(full);
        return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : [];
    });
}

describe('webview story imports', () => {
    // Storybook resolves these only when a story opens, so a folder move breaks them with every suite still green.
    it('every relative import in a webview module resolves on disk, whichever quote it uses', () => {
        const broken: string[] = [];
        for (const file of sourceFiles(WEBVIEW)) {
            const source = fs.readFileSync(file, 'utf8');
            for (const match of source.matchAll(/from ['"](\.\.?\/[^'"]*)['"]/g)) {
                const spec = match[1].split('?')[0];
                const target = path.resolve(path.dirname(file), spec);
                if (SUFFIXES.some(suffix => fs.existsSync(target + suffix))) continue;
                broken.push(`${path.relative(REPO, file)} -> ${match[1]}`);
            }
        }
        expect(broken).toEqual([]);
    });
});
