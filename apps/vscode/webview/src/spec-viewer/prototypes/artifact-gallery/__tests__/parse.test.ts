import * as fs from 'fs';
import * as path from 'path';
import { findSection, metaValue, parseChecks, parseDoc, parseFields, parseItems, parseQa, parseTable, splitCells, splitId } from '../parse';

const FIXTURES = path.resolve(__dirname, '../../../__fixtures__/artifact-gallery/tiny-todo');
const BUGS = path.resolve(__dirname, '../../../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first');
const read = (root: string, rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('parseDoc', () => {
    it('reads the title and the leading facts of a bug assessment', () => {
        const doc = parseDoc(read(BUGS, 'assessment.md'));
        expect(doc.title).toBe('Bug Assessment: cartTotal skips the first cart item');
        expect(metaValue(doc, 'verdict')).toBe('valid');
        expect(metaValue(doc, 'Severity')).toBe('high');
        expect(doc.sections.map((s) => s.heading)).toContain('Reproduction');
    });

    it('reads facts written as bare bold lines separated by blank lines or pipes', () => {
        const doc = parseDoc('# T\n\n**Created**: today\n\n**Spec**: a | **Plan**: b\n\nIntro.\n\n## One\n\nBody');
        expect(doc.meta).toEqual([
            { key: 'Created', value: 'today' },
            { key: 'Spec', value: 'a' },
            { key: 'Plan', value: 'b' },
        ]);
        expect(doc.intro).toBe('Intro.');
    });

    it('skips a leading HTML comment and nests third-level headings', () => {
        const doc = parseDoc(read(FIXTURES, '.specify/memory/constitution.md'));
        expect(doc.title).toBe('Tiny Todo Constitution');
        expect(findSection(doc, /Principles/)?.children).toHaveLength(4);
    });

    it('does not treat a heading inside a fenced block as a section', () => {
        const doc = parseDoc('# T\n\n## Real\n\n```md\n## Fake\n```\n');
        expect(doc.sections.map((s) => s.heading)).toEqual(['Real']);
    });
});

describe('tables', () => {
    it('keeps a pipe inside a code span in its cell', () => {
        expect(splitCells('| a | `x | y` | c |')).toEqual(['a', '`x | y`', 'c']);
    });

    it('returns the rows with the prose on either side', () => {
        const table = parseTable('Before.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nAfter.');
        expect(table).toMatchObject({ headers: ['A', 'B'], rows: [['1', '2']], before: 'Before.', after: 'After.' });
    });

    it('returns null when a body has no table', () => {
        expect(parseTable('Just prose.')).toBeNull();
    });
});

describe('lists', () => {
    it('keeps nested bullets with their parent field', () => {
        const { fields, rest } = parseFields('- **Decision**: Use A.\n- **Alternatives**:\n  - B: slower.\n  - C: bigger.\n\nTail.');
        expect(fields).toEqual([
            { label: 'Decision', value: 'Use A.' },
            { label: 'Alternatives', value: '- B: slower.\n- C: bigger.' },
        ]);
        expect(rest).toBe('Tail.');
    });

    it('reports an ordered list and the prose after it', () => {
        const parsed = parseItems('1. One\n2. Two\n\nReproduced locally.');
        expect(parsed).toMatchObject({ items: ['One', 'Two'], ordered: true, after: 'Reproduced locally.' });
    });

    it('reads check items with their id and trailing tags', () => {
        const [open, done] = parseChecks('- [ ] CHK001 Is it clear? [Clarity, Spec §FR-001]\n- [x] No id here');
        expect(open).toEqual({ checked: false, id: 'CHK001', text: 'Is it clear?', tags: ['Clarity', 'Spec §FR-001'] });
        expect(done).toMatchObject({ checked: true, id: '', text: 'No id here' });
    });

    it('ignores a checkbox inside a fenced block', () => {
        expect(parseChecks('```\n- [ ] not a task\n```')).toEqual([]);
    });

    it('reads the clarify question and answer pairs from a real spec', () => {
        const doc = parseDoc(read(FIXTURES, 'specs/001-dark-mode-toggle/spec.md'));
        const session = findSection(doc, /^Session/);
        const pairs = parseQa(session?.body ?? '');
        expect(pairs.length).toBeGreaterThan(0);
        expect(pairs[0].question.endsWith('?')).toBe(true);
        expect(pairs[0].answer).not.toContain('→');
    });

    it('splits a leading identifier off a label', () => {
        expect(splitId('T001 Create the store')).toEqual({ id: 'T001', rest: 'Create the store' });
        expect(splitId('Create the store')).toEqual({ id: '', rest: 'Create the store' });
    });
});
