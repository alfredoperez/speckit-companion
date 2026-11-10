/**
 * @jest-environment jsdom
 */

import { parseInline } from '../../inline';
import { renderMarkdown } from '../../renderer';
import { idChip, priorityMark, refAnchor, slugForId } from '../primitives';
import { linkifyIds, resolveLedgerRefs } from '../refs';

describe('ids in prose', () => {
    it.each(['FR-001', 'SC-012', 'US1', 'US-2', 'T003', 'R12', 'D4'])('turns %s into a chip', (id) => {
        const html = parseInline(`See ${id} for context`);

        expect(html).toContain(`class="lg-chip" href="#${slugForId(id)}" data-ref="${id}"`);
    });

    it('keeps US1 and US-1 on one anchor', () => {
        expect(slugForId('US1')).toBe(slugForId('US-1'));
    });

    it('reads "research.md R12" as a cross-document chip', () => {
        const html = parseInline('Chosen in research.md R12.');

        expect(html).toContain('data-ref="R12" data-doc="research"');
        expect(html).toContain('research.md R12</a>');
    });

    it('leaves ids inside code spans, links and words alone', () => {
        expect(parseInline('`FR-001`')).not.toContain('lg-chip');
        expect(parseInline('[FR-001](https://example.com)')).not.toContain('lg-chip');
        expect(parseInline('R2D2 and ABC-FR-001 and v1.R12')).not.toContain('lg-chip');
    });

    it('does not chip ids when asked not to', () => {
        expect(parseInline('T001 do it', false)).toBe('T001 do it');
    });

    it('chips a requirement id inside a task description but keeps the task id as its own chip', () => {
        const html = renderMarkdown('- [ ] T005 Implement FR-002\n');

        expect(html).toContain('lg-task-id');
        expect(html).toContain('data-ref="FR-002"');
    });

    it('keeps escaped text next to an id escaped', () => {
        expect(linkifyIds('<b>x</b> T001 &lt;script&gt;')).toContain('&lt;script&gt;');
    });
});

describe('resolveLedgerRefs', () => {
    it('keeps a chip whose target row exists and unlinks one that does not', () => {
        const root = document.createElement('div');
        root.innerHTML = `<p ${refAnchor('FR-001')}>row</p>${idChip('FR-001')}${idChip('FR-999')}${idChip('R1', { doc: 'research' })}`;

        resolveLedgerRefs(root);

        expect(root.querySelector('a[data-ref="FR-001"]')).not.toBeNull();
        expect(root.querySelector('a[data-ref="FR-999"]')).toBeNull();
        expect(root.querySelector('.lg-chip--unresolved')?.textContent).toBe('FR-999');
        expect(root.querySelector('a[data-doc="research"]')).not.toBeNull();
    });
});

describe('refAnchor', () => {
    it('builds the id and the hover-card data, escaped', () => {
        const attrs = refAnchor('T003', { family: 'task', status: 'done', label: 'A "task"' });

        expect(attrs).toContain('id="ref-t003"');
        expect(attrs).toContain('data-status="done"');
        expect(attrs).toContain('data-label="A &quot;task&quot;"');
    });
});

describe('story priority', () => {
    it('renders the neutral P-mark, never a coloured word', () => {
        const html = renderMarkdown('### User Story 1 - Sign in (Priority: P1)\n');

        expect(html).toContain('class="lg-priority"');
        expect(html).toContain('<span>P1</span>');
        expect(html).not.toMatch(/Critical|priority-dot|priority-p1/);
        expect(html).toContain('id="ref-us-1"');
    });

    it('shows P4 as a single bar with its own label', () => {
        expect(priorityMark(4)).toContain('<span>P4</span>');
    });
});
