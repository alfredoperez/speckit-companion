import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    livingTierType,
    livingCapabilityName,
    livingTierDocuments,
} from '../livingDocs';

describe('livingTierType', () => {
    it.each([
        ['spec.md', 'spec'],
        ['spec.arch.md', 'arch'],
        ['spec.coverage.md', 'coverage'],
        ['todos.spec.md', 'spec'],
        ['todos.arch.md', 'arch'],
        ['todos.coverage.md', 'coverage'],
    ])('%s → %s', (file, tier) => {
        expect(livingTierType(file)).toBe(tier);
    });
});

describe('livingCapabilityName', () => {
    it('uses the folder name for the centralized layout', () => {
        expect(livingCapabilityName('/w/capabilities/todos/spec.md')).toBe('todos');
        expect(livingCapabilityName('/w/capabilities/todos/spec.coverage.md')).toBe('todos');
    });
    it('uses the file stem for the colocated layout', () => {
        expect(livingCapabilityName('/w/src/store/todos.spec.md')).toBe('todos');
        expect(livingCapabilityName('/w/src/lib/storage.arch.md')).toBe('storage');
    });
});

describe('livingTierDocuments', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'living-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('centralized: lists existing tiers in order, spec always present', () => {
        const dir = path.join(root, 'capabilities', 'todos');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'spec.md'), '# s');
        fs.writeFileSync(path.join(dir, 'spec.coverage.md'), '# c');
        const docs = livingTierDocuments(path.join(dir, 'spec.md'));
        expect(docs.map(d => d.type)).toEqual(['spec', 'coverage']);
        expect(docs.every(d => d.exists)).toBe(true);
    });

    it('colocated: derives siblings from the stem', () => {
        const dir = path.join(root, 'src', 'store');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'todos.spec.md'), '# s');
        fs.writeFileSync(path.join(dir, 'todos.arch.md'), '# a');
        const docs = livingTierDocuments(path.join(dir, 'todos.spec.md'));
        expect(docs.map(d => d.fileName)).toEqual(['todos.spec.md', 'todos.arch.md']);
    });

    it('anchoring on a tier sibling still resolves the whole family', () => {
        const dir = path.join(root, 'capabilities', 'billing');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'spec.md'), '# s');
        fs.writeFileSync(path.join(dir, 'spec.arch.md'), '# a');
        const docs = livingTierDocuments(path.join(dir, 'spec.arch.md'));
        expect(docs.map(d => d.type)).toEqual(['spec', 'arch']);
    });
});
