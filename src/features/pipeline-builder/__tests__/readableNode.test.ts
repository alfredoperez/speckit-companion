import * as fs from 'fs';
import * as path from 'path';
import { readableNode } from '../readableNode';

/**
 * The reason this exists: opening a node showed frontmatter and a stack of empty
 * HTML comment fences before any instruction. That is the authoring format, not
 * the answer to "what does this node tell the assistant".
 */
describe('a node file read as instructions', () => {
    it('drops the frontmatter', () => {
        const { body } = readableNode(
            '---\nid: handoff\nkind: control\n---\n\nHand the run to the next step.\n');
        expect(body).toBe('Hand the run to the next step.');
    });

    it('drops bare key: value metadata that has no opening fence', () => {
        // Several shipped nodes are written this way — keys, then `---`.
        const { body } = readableNode(
            'id: handoff\nkind: control\nreads: []\n---\n\nHand it over.\n');
        expect(body).toBe('Hand it over.');
        expect(body).not.toContain('kind:');
    });

    it('names the shared blocks instead of showing empty fences', () => {
        const { body, parts } = readableNode([
            '---', 'id: handoff', '---', '',
            '<!-- speckit-companion:part timing -->',
            '<!-- /speckit-companion:part timing -->',
            '',
            '<!-- speckit-companion:part self-advance -->',
            '<!-- /speckit-companion:part self-advance -->',
            '',
            'Pin the workflow identity before handing off.',
        ].join('\n'));

        expect(parts).toEqual(['timing', 'self-advance']);
        expect(body).toBe('Pin the workflow identity before handing off.');
        expect(body).not.toContain('speckit-companion');
    });

    it('keeps a fence that already holds content', () => {
        const { body, parts } = readableNode([
            '<!-- speckit-companion:part timing -->',
            'Record the start time.',
            '<!-- /speckit-companion:part timing -->',
        ].join('\n'));

        expect(parts).toEqual(['timing']);
        expect(body).toBe('Record the start time.');
    });

    it('leaves ordinary markdown alone', () => {
        const source = '## Draft the spec\n\n1. Load the template.\n2. Write `spec.md`.\n';
        expect(readableNode(source).body).toBe(source.trim());
    });

    it('never collapses a blank line inside a code block into nothing readable', () => {
        const { body } = readableNode('Run it:\n\n```bash\npython3 x.py\n```\n');
        expect(body).toContain('```bash');
        expect(body).toContain('python3 x.py');
    });

    // The real files are the point — a stripper that only works on fixtures is
    // a stripper that will meet the first shipped node and give up.
    it('leaves every shipped node with something to read', () => {
        const root = path.join(__dirname, '..', '..', '..', '..', 'speckit-extension', 'nodes');
        const files: string[] = [];
        for (const command of fs.readdirSync(root)) {
            const dir = path.join(root, command);
            if (!fs.statSync(dir).isDirectory()) { continue; }
            for (const file of fs.readdirSync(dir)) {
                if (file.endsWith('.md')) { files.push(path.join(dir, file)); }
            }
        }
        expect(files.length).toBeGreaterThan(20);

        for (const file of files) {
            const { body, parts } = readableNode(fs.readFileSync(file, 'utf8'));
            // Every node has something to show: its own instructions, or the
            // shared blocks it exists to carry. `specify/handoff` is the second
            // kind — all fence, no prose — and a panel that renders it blank
            // would be describing a real node as nothing.
            expect(body.length > 0 || parts.length > 0).toBe(true);
            expect(body).not.toContain('speckit-companion:part');
            expect(body.startsWith('---')).toBe(false);
        }
    });

    it('reports a node that is nothing but shared blocks as exactly that', () => {
        const file = path.join(
            __dirname, '..', '..', '..', '..',
            'speckit-extension', 'nodes', 'specify', 'handoff.md');
        const { body, parts } = readableNode(fs.readFileSync(file, 'utf8'));

        expect(body).toBe('');
        expect(parts).toContain('timing');
    });
});
