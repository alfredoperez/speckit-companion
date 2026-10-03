import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../../src');

// The resolver itself, and the viewer's lookup that walks every folder to find a file's owner.
const MAY_READ_WORKSPACE_FOLDERS = new Set([
    'core/projectRoot.ts',
    'features/spec-viewer/messageHandlers.ts',
]);

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
        return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
    });
}

describe('the project folder has one source', () => {
    it('no source file reads the workspace folders directly', () => {
        const offenders = sourceFiles(SRC)
            .filter(file => /\bworkspaceFolders\b/.test(fs.readFileSync(file, 'utf8')))
            .map(file => path.relative(SRC, file).split(path.sep).join('/'))
            .filter(file => !MAY_READ_WORKSPACE_FOLDERS.has(file));

        expect(offenders).toEqual([]);
    });

    it('the allow-list names only files that still read them', () => {
        for (const file of MAY_READ_WORKSPACE_FOLDERS) {
            expect(fs.readFileSync(path.join(SRC, file), 'utf8')).toMatch(/\bworkspaceFolders\b/);
        }
    });
});
