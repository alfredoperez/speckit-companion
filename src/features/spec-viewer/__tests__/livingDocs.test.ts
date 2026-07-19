import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    livingTierType,
    livingCapabilityName,
    livingTierDocuments,
    isLivingDraft,
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

describe('isLivingDraft', () => {
    const ADOPT_BANNER =
        '> [DRAFT] Surface-first draft from existing code — review before trusting.';

    it('detects the adopt banner under the title', () => {
        const content = [
            '# Todos — Living Spec',
            '',
            ADOPT_BANNER,
            '',
            '## Requirements',
        ].join('\n');
        expect(isLivingDraft(content)).toBe(true);
    });

    it('tolerates a plain (unquoted) banner line and lower-case marker', () => {
        expect(isLivingDraft('# Todos\n\n[draft] still being reviewed.\n')).toBe(true);
    });

    it('sees past YAML frontmatter', () => {
        const content = [
            '---',
            'title: Todos',
            'tier: spec',
            '---',
            '',
            '# Todos — Living Spec',
            '',
            ADOPT_BANNER,
        ].join('\n');
        expect(isLivingDraft(content)).toBe(true);
    });

    it('is false for a reviewed living spec with no banner', () => {
        const content = [
            '# Todos — Living Spec',
            '',
            'Task list behavior: everything the todos area guarantees today.',
            '',
            '## Requirements',
        ].join('\n');
        expect(isLivingDraft(content)).toBe(false);
    });

    it('ignores the word "draft" in body prose', () => {
        const content = [
            '# Todos — Living Spec',
            '',
            '## Requirements',
            '',
            '### A note can be saved as a draft',
            '',
            'The editor MUST keep a [draft] copy until the note is published.',
        ].join('\n');
        expect(isLivingDraft(content)).toBe(false);
    });

    it('is false for empty content', () => {
        expect(isLivingDraft('')).toBe(false);
    });
});
