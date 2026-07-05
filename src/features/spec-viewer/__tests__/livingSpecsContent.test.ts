import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    enrichLivingSpecs,
    parseCapabilitySpec,
    parseDeltaCounts,
    stripInlineMarkdown,
} from '../livingSpecsContent';

const LIVING_SPEC = [
    '# Todos — Living Spec',
    '',
    'Task list behavior: everything the *todos* area guarantees today.',
    '',
    '## Requirements',
    '',
    '### A note can carry one tag',
    '',
    'Each note stores **at most one** tag, editable from the `note` form.',
    'Continuation line of the same paragraph.',
    '',
    'A second paragraph that must NOT appear in the row text.',
    '',
    '### Notes can be filtered by tag',
    '',
    'The list view filters by [tag](./tags.md).',
].join('\n');

function scaffold(config?: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'living-content-'));
    fs.mkdirSync(path.join(root, '.specify'), { recursive: true });
    if (config !== undefined) {
        fs.writeFileSync(path.join(root, '.specify', 'companion.yml'), config);
    }
    return root;
}

const CONFIG = [
    'livingSpecs:',
    '  enabled: true',
    '  capabilities:',
    '    - name: todos',
    '      match: ["src/todos/**"]',
    '    - name: notes-ui',
    '      match: ["src/ui/**"]',
].join('\n');

describe('parseCapabilitySpec', () => {
    it('parses the purpose paragraph and one row per requirement heading', () => {
        const parsed = parseCapabilitySpec(LIVING_SPEC);
        expect(parsed.purpose).toBe('Task list behavior: everything the todos area guarantees today.');
        expect(parsed.requirements).toEqual([
            {
                id: 'A note can carry one tag',
                text: 'Each note stores at most one tag, editable from the note form. Continuation line of the same paragraph.',
            },
            { id: 'Notes can be filtered by tag', text: 'The list view filters by tag.' },
        ]);
    });

    it('handles a spec with no intro and no requirements', () => {
        const parsed = parseCapabilitySpec('# Bare — Living Spec\n\n## Requirements\n');
        expect(parsed.purpose).toBeUndefined();
        expect(parsed.requirements).toEqual([]);
    });
});

describe('stripInlineMarkdown', () => {
    it('removes emphasis, code, and link markers but keeps the text', () => {
        expect(stripInlineMarkdown('**bold** and _it_ and `code` and [txt](url)')).toBe('bold and it and code and txt');
    });
});

describe('parseDeltaCounts', () => {
    const SPEC_WITH_DELTAS = [
        '# Feature',
        '',
        '## ADDED Requirements',
        '',
        '### First new requirement',
        'Body.',
        '### Second new requirement',
        'Body.',
        '',
        '## MODIFIED Requirements',
        '<!-- capability: notes-ui -->',
        '',
        '### Changed requirement',
        'Body.',
        '',
        '## Success Criteria',
    ].join('\n');

    it('counts per verb, honoring the capability marker and the most-specific default', () => {
        const counts = parseDeltaCounts(SPEC_WITH_DELTAS, 'todos');
        expect(counts.get('todos')).toEqual({ added: 2 });
        expect(counts.get('notes-ui')).toEqual({ modified: 1 });
    });

    it('returns an empty map when the spec has no delta blocks', () => {
        expect(parseDeltaCounts('# Feature\n\n## Requirements\n### FR-001\n', 'todos').size).toBe(0);
    });
});

describe('enrichLivingSpecs', () => {
    afterEach(() => jest.restoreAllMocks());

    it('loads, parses, and orders capabilities loaded-first with synced tagging', () => {
        const root = scaffold(CONFIG);
        fs.mkdirSync(path.join(root, 'capabilities', 'todos'), { recursive: true });
        fs.writeFileSync(path.join(root, 'capabilities', 'todos', 'spec.md'), LIVING_SPEC);

        const view = enrichLivingSpecs({ loaded: ['todos'], synced: ['todos'] }, root);
        expect(view.capabilities).toHaveLength(1);
        const cap = view.capabilities![0];
        expect(cap.name).toBe('todos');
        expect(cap.available).toBe(true);
        expect(cap.synced).toBe(true);
        expect(cap.purpose).toContain('Task list behavior');
        expect(cap.requirements).toHaveLength(2);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('attaches delta counts to synced capabilities from the feature spec', () => {
        const root = scaffold(CONFIG);
        fs.mkdirSync(path.join(root, 'capabilities', 'todos'), { recursive: true });
        fs.writeFileSync(path.join(root, 'capabilities', 'todos', 'spec.md'), LIVING_SPEC);
        const featureSpec = path.join(root, 'feature-spec.md');
        fs.writeFileSync(featureSpec, '## ADDED Requirements\n### New thing\nBody.\n');

        const view = enrichLivingSpecs({ loaded: ['todos'], synced: ['todos'] }, root, featureSpec);
        expect(view.capabilities![0].delta).toEqual({ added: 1 });
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('never attaches delta counts to an unsynced capability', () => {
        const root = scaffold(CONFIG);
        const featureSpec = path.join(root, 'feature-spec.md');
        fs.writeFileSync(featureSpec, '## ADDED Requirements\n### New thing\nBody.\n');

        const view = enrichLivingSpecs({ loaded: ['todos'], synced: [] }, root, featureSpec);
        expect(view.capabilities![0].delta).toBeUndefined();
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('degrades to available:false for unresolved names and missing files', () => {
        const root = scaffold(CONFIG);
        const view = enrichLivingSpecs({ loaded: ['todos', 'ghost'], synced: [] }, root);
        expect(view.capabilities).toHaveLength(2);
        expect(view.capabilities!.every(c => c.available === false)).toBe(true);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('degrades oversized files to available:false', () => {
        const root = scaffold(CONFIG);
        fs.mkdirSync(path.join(root, 'capabilities', 'todos'), { recursive: true });
        fs.writeFileSync(path.join(root, 'capabilities', 'todos', 'spec.md'), 'x'.repeat(300 * 1024));
        const view = enrichLivingSpecs({ loaded: ['todos'], synced: [] }, root);
        expect(view.capabilities![0].available).toBe(false);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('includes a synced-but-never-loaded capability once (de-duplicated)', () => {
        const root = scaffold(CONFIG);
        const view = enrichLivingSpecs({ loaded: ['todos'], synced: ['todos', 'notes-ui'] }, root);
        expect(view.capabilities!.map(c => c.name)).toEqual(['todos', 'notes-ui']);
        expect(view.capabilities![1].synced).toBe(true);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('still produces capability entries when the workspace has no living-specs config', () => {
        const root = scaffold();
        const view = enrichLivingSpecs({ loaded: ['todos'], synced: [] }, root);
        expect(view.capabilities).toHaveLength(1);
        expect(view.capabilities![0]).toMatchObject({ name: 'todos', available: false });
        fs.rmSync(root, { recursive: true, force: true });
    });
});
