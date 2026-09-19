import * as fs from 'fs';
import * as path from 'path';
import { countTaskCheckboxes, taskId, proseLines, taskCheckboxMarker } from '../taskCheckboxes';

describe('countTaskCheckboxes', () => {
    it('counts line-leading task items, checked and unchecked', () => {
        expect(countTaskCheckboxes('- [ ] T001 a\n- [x] T002 b\n- [X] T003 c')).toEqual({ checked: 2, total: 3 });
    });

    it('counts nested and indented task items', () => {
        expect(countTaskCheckboxes('- [x] T001 parent\n  - [ ] T002 child\n    - [ ] T003 grandchild'))
            .toEqual({ checked: 1, total: 3 });
    });

    it('counts either bullet character', () => {
        expect(countTaskCheckboxes('- [x] T001 dash\n* [ ] T002 asterisk\n+ [ ] T003 plus'))
            .toEqual({ checked: 1, total: 3 });
    });

    it('ignores a checkbox shown inside an inline code span', () => {
        const content = 'Line format: `- [ ] **T###** description`\n- [x] **T001** Do the thing';
        expect(countTaskCheckboxes(content)).toEqual({ checked: 1, total: 1 });
    });

    it('ignores checkboxes inside a fenced code block', () => {
        expect(countTaskCheckboxes('```markdown\n- [ ] T900 example\n```\n- [x] T001 real'))
            .toEqual({ checked: 1, total: 1 });
    });

    it('ignores checkboxes inside a tilde fence, and inside an indented fence', () => {
        expect(countTaskCheckboxes('~~~\n- [ ] T900 example\n~~~\n- [x] T001 real'))
            .toEqual({ checked: 1, total: 1 });
        expect(countTaskCheckboxes('- [x] T001 shows:\n  ```\n  - [ ] T900 example\n  ```\n- [x] T002'))
            .toEqual({ checked: 2, total: 2 });
    });

    it('does not treat a fence marker of the other kind as a closer', () => {
        expect(countTaskCheckboxes('```\n~~~\n- [ ] T900 example\n```\n- [x] T001 real'))
            .toEqual({ checked: 1, total: 1 });
    });

    it('still counts a task whose description contains inline code', () => {
        const content = '- [x] **T001** fix `foo.ts`\n- [ ] **T002** touch `bar.ts` and `baz.ts`';
        expect(countTaskCheckboxes(content)).toEqual({ checked: 1, total: 2 });
    });

    it('still counts a task whose description holds an unbalanced backtick', () => {
        expect(countTaskCheckboxes('- [ ] **T001** rename `foo')).toEqual({ checked: 0, total: 1 });
    });

    it('ignores a checkbox written mid-sentence — a task is a list item', () => {
        expect(countTaskCheckboxes('Write it as - [ ] T900 here.\n- [x] T001 real')).toEqual({ checked: 1, total: 1 });
    });

    it('reports nothing for a document with no task items', () => {
        expect(countTaskCheckboxes('# Tasks\n\nNothing yet.')).toEqual({ checked: 0, total: 0 });
    });

    it('ignores a checkbox carrying no task id', () => {
        // Verification notes and prose checklists sit beside real tasks in a
        // task list. Counting them here while the spec-kit side ignored them is
        // how the two halves came to disagree about whether implement was done.
        const content = [
            '- [x] **T001** a real task',
            '- [x] `npm run compile` green',
            '- [ ] Refactor the loader',
            '- [P] = different files, no ordering dependency',
        ].join('\n');
        expect(countTaskCheckboxes(content)).toEqual({ checked: 1, total: 1 });
    });

    it('reads the task id off a task line', () => {
        expect(taskId('- [x] **T042** something')).toBe('T042');
        expect(taskId('- [x] a note with no id')).toBeNull();
    });
});

/**
 * The other half of the product parses the same file to decide the same thing.
 * `speckit-extension/tests/test_task_grammar.py` asserts the same expectations
 * against the same fixture, so the two grammars cannot drift apart silently.
 */
describe('the shared task-grammar fixture', () => {
    const dir = path.join(__dirname, '..', '..', '..', '..', 'tests', 'fixtures', 'task-grammar');
    const content = fs.readFileSync(path.join(dir, 'tasks.md'), 'utf8');
    const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));

    it('counts what both parsers must count', () => {
        expect(countTaskCheckboxes(content)).toEqual({
            checked: expected.checked,
            total: expected.total,
        });
    });

    it('finds the same task ids, in document order', () => {
        const all: string[] = [];
        const done: string[] = [];
        for (const line of proseLines(content)) {
            const id = taskId(line);
            if (!id) continue;
            all.push(id);
            if (taskCheckboxMarker(line)?.toLowerCase() === 'x') done.push(id);
        }
        expect(all).toEqual(expected.allTaskIds);
        expect(done).toEqual(expected.completedTaskIds);
    });
});
