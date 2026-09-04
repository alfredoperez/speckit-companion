/**
 * A node file, read for a person and written back for the build.
 *
 * This is the only place an edit made in the panel becomes a file on disk, so
 * the property that matters most is not how nicely it reads — it is that a
 * save cannot lose anything. The metadata orders the pipeline and the fences
 * are where shared blocks land; both are invisible in what the inspector shows,
 * and both have to survive a round trip through it.
 */
import { nodeFile, readableNode } from '../../../src/features/pipeline-builder/readableNode';

/** A node as the build writes it: metadata, prose, and a fence pair. */
const NODE = [
    '---',
    'id: draft',
    'name: Draft the spec',
    'kind: author',
    'reads: [research]',
    'writes: [spec.md]',
    '---',
    '',
    'Write the specification.',
    '',
    '<!-- speckit-companion:part quality -->',
    '<!-- /speckit-companion:part quality -->',
    '',
    'Then stop.',
    '',
].join('\n');

describe('what the inspector shows', () => {
    it('drops the metadata, which is the build\'s and not the reader\'s', () => {
        expect(readableNode(NODE).body).not.toContain('kind: author');
    });

    it('keeps the instructions, in order', () => {
        expect(readableNode(NODE).body)
            .toBe('Write the specification.\n\nThen stop.');
    });

    it('names a shared block instead of showing the empty comment it sits in', () => {
        const { body, parts } = readableNode(NODE);
        expect(parts).toEqual(['quality']);
        expect(body).not.toContain('speckit-companion');
    });

    it('names a shared block once, however many times it is fenced', () => {
        const twice = NODE + [
            '<!-- speckit-companion:part quality -->',
            '<!-- /speckit-companion:part quality -->',
            '',
        ].join('\n');
        expect(readableNode(twice).parts).toEqual(['quality']);
    });

    it('names every distinct block, in the order they appear', () => {
        const source = [
            '---', 'id: x', '---', '',
            '<!-- speckit-companion:part quality -->',
            '<!-- /speckit-companion:part quality -->',
            '<!-- speckit-companion:part budget -->',
            '<!-- /speckit-companion:part budget -->',
        ].join('\n');
        expect(readableNode(source).parts).toEqual(['quality', 'budget']);
    });

    it('takes out the node, phase and hook markers a build writes', () => {
        const source = [
            '---', 'id: x', '---', '',
            '<!-- speckit-companion:node draft -->',
            '<!-- speckit-companion:phase gather -->',
            '<!-- speckit-companion:hook check -->',
            'Only this.',
            '<!-- /speckit-companion:node draft -->',
        ].join('\n');
        const { body, parts } = readableNode(source);
        expect(body).toBe('Only this.');
        expect(parts).toEqual([]);
    });

    it('does not stack blank lines where a fence pair was', () => {
        expect(readableNode(NODE).body).not.toMatch(/\n{3}/);
    });

    it('reads a node whose metadata has no fence of its own', () => {
        const bare = 'id: draft\nkind: author\n---\n\nWrite it.\n';
        const { body, meta } = readableNode(bare);
        expect(body).toBe('Write it.');
        expect(meta).toContain('id: draft');
    });

    it('reads a file that is only instructions', () => {
        const { body, meta } = readableNode('Just the words.\n');
        expect(body).toBe('Just the words.');
        expect(meta).toBe('');
    });

    it('reads a file written with Windows line endings', () => {
        const source = '---\r\nid: draft\r\n---\r\n\r\nWrite it.\r\n';
        expect(readableNode(source).body).toBe('Write it.');
    });
});

describe('what an edit starts from', () => {
    it('keeps the fences, because a fence is where a shared block lands', () => {
        expect(readableNode(NODE).editable).toContain('speckit-companion:part quality');
    });

    it('leaves the metadata out, so nobody edits what orders the pipeline', () => {
        expect(readableNode(NODE).editable).not.toContain('kind: author');
    });

    it('opens on the first line of the instructions, not on blank space', () => {
        expect(readableNode(NODE).editable.startsWith('Write the specification.')).toBe(true);
    });

    it('ends on the last thing written, with no trailing blank lines', () => {
        expect(readableNode(NODE).editable.endsWith('Then stop.')).toBe(true);
    });
});

describe('writing it back', () => {
    it('puts the metadata back exactly as it was', () => {
        const { meta, editable } = readableNode(NODE);
        expect(nodeFile(meta, editable)).toContain('reads: [research]');
    });

    it('saves an untouched node back as itself, bar the gap under the metadata', () => {
        // The one thing a round trip does not preserve, and it closes up rather
        // than opening up — so a file cannot drift wider each time it is saved.
        const { meta, editable } = readableNode(NODE);
        expect(nodeFile(meta, editable)).toBe(NODE.replace('---\n\nWrite', '---\nWrite'));
    });

    it('survives being read and written repeatedly', () => {
        const once = (() => { const n = readableNode(NODE); return nodeFile(n.meta, n.editable); })();
        const twice = (() => { const n = readableNode(once); return nodeFile(n.meta, n.editable); })();
        expect(twice).toBe(once);
    });

    it('keeps the shared blocks through a real edit', () => {
        const { meta, editable } = readableNode(NODE);
        const edited = editable.replace('Write the specification.', 'Write it our way.');
        const saved = nodeFile(meta, edited);

        expect(saved).toContain('Write it our way.');
        expect(readableNode(saved).parts).toEqual(['quality']);
    });

    it('would lose the shared blocks if the rendered text were saved instead', () => {
        // The reason `editable` exists at all, kept as a test so the two can
        // never quietly become the same string again.
        const { meta, body } = readableNode(NODE);
        expect(readableNode(nodeFile(meta, body)).parts).toEqual([]);
    });

    it('ends the file with exactly one newline, however the edit ended', () => {
        for (const body of ['Text.', 'Text.\n', 'Text.\n\n\n', 'Text.   \n\t\n']) {
            expect(nodeFile('---\nid: x\n---\n\n', body)).toBe('---\nid: x\n---\n\nText.\n');
        }
    });

    it('writes a node that never had metadata without inventing any', () => {
        expect(nodeFile('', 'Just the words.')).toBe('Just the words.\n');
    });
});
