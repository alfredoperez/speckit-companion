import { parseTasksFile } from '../taskProgressService';

describe('parseTasksFile', () => {
    it('counts the task items under each phase header', () => {
        const content = [
            '## Phase 1: Setup',
            '- [x] **T001** Scaffold',
            '- [ ] **T002** Wire it up',
            '## Phase 2: Ship',
            '- [x] **T003** Package',
        ].join('\n');

        const progress = parseTasksFile(content, 'demo', '/specs/demo');

        expect(progress.totalTasks).toBe(3);
        expect(progress.completedTasks).toBe(2);
        expect(progress.phases.map(p => p.isComplete)).toEqual([false, true]);
    });

    it('does not count example checkboxes inside a fenced block or an inline code span', () => {
        const content = [
            '## Phase 1: Setup',
            'Line format: `- [ ] **T###** description`',
            '```markdown',
            '- [ ] example task',
            '```',
            '- [x] **T001** The only real task',
        ].join('\n');

        const progress = parseTasksFile(content, 'demo', '/specs/demo');

        expect(progress.totalTasks).toBe(1);
        expect(progress.completedTasks).toBe(1);
        expect(progress.phases[0].isComplete).toBe(true);
    });
});
