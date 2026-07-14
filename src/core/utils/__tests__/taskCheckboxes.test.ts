import { countTaskCheckboxes } from '../taskCheckboxes';

describe('countTaskCheckboxes', () => {
    it('counts line-leading task items, checked and unchecked', () => {
        expect(countTaskCheckboxes('- [ ] a\n- [x] b\n- [X] c')).toEqual({ checked: 2, total: 3 });
    });

    it('counts nested and indented task items', () => {
        expect(countTaskCheckboxes('- [x] parent\n  - [ ] child\n    - [ ] grandchild'))
            .toEqual({ checked: 1, total: 3 });
    });

    it('ignores a checkbox shown inside an inline code span', () => {
        const content = 'Line format: `- [ ] **T###** description`\n- [x] **T001** Do the thing';
        expect(countTaskCheckboxes(content)).toEqual({ checked: 1, total: 1 });
    });

    it('ignores checkboxes inside a fenced code block', () => {
        expect(countTaskCheckboxes('```markdown\n- [ ] example\n```\n- [x] real'))
            .toEqual({ checked: 1, total: 1 });
    });

    it('ignores checkboxes inside a tilde fence, and inside an indented fence', () => {
        expect(countTaskCheckboxes('~~~\n- [ ] example\n~~~\n- [x] real'))
            .toEqual({ checked: 1, total: 1 });
        expect(countTaskCheckboxes('- [x] T001 shows:\n  ```\n  - [ ] example\n  ```\n- [x] T002'))
            .toEqual({ checked: 2, total: 2 });
    });

    it('does not treat a fence marker of the other kind as a closer', () => {
        expect(countTaskCheckboxes('```\n~~~\n- [ ] example\n```\n- [x] real'))
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
        expect(countTaskCheckboxes('Write it as - [ ] here.\n- [x] real')).toEqual({ checked: 1, total: 1 });
    });

    it('reports nothing for a document with no task items', () => {
        expect(countTaskCheckboxes('# Tasks\n\nNothing yet.')).toEqual({ checked: 0, total: 0 });
    });
});
