import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getSpecDirectoryFromPath } from '../utils';

describe('getSpecDirectoryFromPath', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-root-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('returns the spec dir for a top-level spec doc (spec.md marker)', () => {
        const specDir = path.join(root, 'specs', '001-feature');
        fs.mkdirSync(specDir, { recursive: true });
        fs.writeFileSync(path.join(specDir, 'spec.md'), '# spec');
        expect(getSpecDirectoryFromPath(path.join(specDir, 'spec.md'))).toBe(specDir);
    });

    it('walks up to the spec root for a doc nested in a step subDir', () => {
        // Matt Pocock layout: .scratch/<feature>/issues/NN-*.md
        const specDir = path.join(root, '.scratch', 'todo-priority-levels');
        fs.mkdirSync(path.join(specDir, 'issues'), { recursive: true });
        fs.writeFileSync(path.join(specDir, '.spec-context.json'), '{}');
        fs.writeFileSync(path.join(specDir, 'spec.md'), '# spec');
        const ticket = path.join(specDir, 'issues', '01-set-and-show-priority.md');
        fs.writeFileSync(ticket, '# ticket');
        // The bug: path.dirname would return .../issues; the fix returns the spec root.
        expect(getSpecDirectoryFromPath(ticket)).toBe(specDir);
    });

    it('prefers the .spec-context.json marker when present', () => {
        const specDir = path.join(root, 'specs', '002');
        fs.mkdirSync(path.join(specDir, 'sub'), { recursive: true });
        fs.writeFileSync(path.join(specDir, '.spec-context.json'), '{}');
        const nested = path.join(specDir, 'sub', 'note.md');
        fs.writeFileSync(nested, '# note');
        expect(getSpecDirectoryFromPath(nested)).toBe(specDir);
    });

    it('falls back to the parent dir when no spec-root marker exists', () => {
        const dir = path.join(root, 'loose');
        fs.mkdirSync(dir, { recursive: true });
        const f = path.join(dir, 'orphan.md');
        fs.writeFileSync(f, '# orphan');
        expect(getSpecDirectoryFromPath(f)).toBe(dir);
    });
});
