/**
 * @jest-environment jsdom
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { mapToSourceLines } from '../sourceLines';
import { renderMarkdown, setCurrentTask, setHasSpecContext } from '../renderer';
import { extractBlock } from '../../../../../src/features/spec-viewer/extractBlock';

const TEAMBOARD = join(__dirname, '../../__fixtures__/teamboard/041-profile-photo-upload');

function lineOf(html: string, text: string): number {
    const host = document.createElement('div');
    host.innerHTML = html;
    const el = Array.from(host.querySelectorAll<HTMLElement>('[data-line]'))
        .find(node => node.matches('.line') && node.textContent!.includes(text));
    if (!el) throw new Error(`no rendered line contains "${text}"`);
    return Number(el.dataset.line);
}

function fileLine(source: string, text: string): number {
    return source.split('\n').findIndex(line => line.includes(text)) + 1;
}

describe('mapToSourceLines', () => {
    it('numbers an untouched document by position', () => {
        expect(mapToSourceLines('a\n\nb', 'a\n\nb')).toEqual([1, 2, 3]);
    });

    it('keeps the file line of everything after a removed block', () => {
        expect(mapToSourceLines('# T\n\ngone\ngone\n\n## H\n\ntext', '# T\n\n## H\n\ntext')).toEqual([1, 5, 6, 7, 8]);
    });

    it('numbers rewritten lines exactly when the stretch kept its length', () => {
        const source = '## Requirements\n\n- **FR-001** one\n- **FR-002** two\n\n## Next';
        const processed = '## Requirements\n\n<div>one</div>\n<div>two</div>\n\n## Next';
        expect(mapToSourceLines(source, processed)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('places a collapsed block inside the section it came from', () => {
        const source = '# T\n\n## Context\n\n**A**: 1\n**B**: 2\n\n## Shape\n\ntext';
        const processed = '# T\n\n<details>grid</details>\n## Shape\n\ntext';
        const map = mapToSourceLines(source, processed);
        expect(map[2]).toBeGreaterThanOrEqual(3);
        expect(map[2]).toBeLessThan(8);
        expect(map.slice(3)).toEqual([8, 9, 10]);
    });
});

describe('a rendered line carries its line in the file', () => {
    afterEach(() => setHasSpecContext(false));

    const plan = readFileSync(join(TEAMBOARD, 'plan.md'), 'utf8');

    it.each([true, false])('for a paragraph just after a heading in the second section (record present: %s)', (hasContext) => {
        setHasSpecContext(hasContext);
        const line = lineOf(renderMarkdown(plan), 'One endpoint, one storage write');
        expect(line).toBe(fileLine(plan, 'One endpoint, one storage write'));
        expect(extractBlock(plan.split('\n'), line)?.heading).toBe('Shape of the change');
    });

    it('for a list item in a later section', () => {
        setHasSpecContext(true);
        const line = lineOf(renderMarkdown(plan), 'The caller must be the member');
        expect(extractBlock(plan.split('\n'), line)?.heading).toBe('Constraints');
    });

    it('for a line just after the first heading', () => {
        const doc = '# Plan\n\n## First\nRight under the heading.\n\n## Second\n\nLater.';
        const line = lineOf(renderMarkdown(doc), 'Right under the heading');
        expect(line).toBe(4);
        expect(extractBlock(doc.split('\n'), line)?.heading).toBe('First');
    });

    it('for a task under stripped frontmatter, legend and metadata', () => {
        setHasSpecContext(true);
        const doc = [
            '---', 'description: "x"', '---', '',
            '# Tasks: Thing', '', '**Input**: plan', '',
            '## Format: `[ID] [P?] Description`', '', '- legend', '',
            '## Phase 1: Setup', '', '- [ ] T001 First', '- [ ] T002 Second',
        ].join('\n');
        const host = document.createElement('div');
        host.innerHTML = renderMarkdown(doc);
        const boxes = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        expect(boxes.map(box => Number(box.dataset.line))).toEqual([15, 16]);
    });
});

describe('the in-progress chip on a task', () => {
    afterEach(() => setCurrentTask(null));

    it('marks the current task while its box is open', () => {
        setCurrentTask('T002');
        expect(renderMarkdown('- [x] T001 a\n- [ ] T002 b\n')).toMatch(/class="task-item line in-progress"[^>]*data-task-id="T002"/);
    });

    it('never marks a ticked task, even when the record still names it', () => {
        setCurrentTask('T006');
        expect(renderMarkdown('- [x] **T006** Tests for size\n')).not.toContain('in-progress');
    });
});
