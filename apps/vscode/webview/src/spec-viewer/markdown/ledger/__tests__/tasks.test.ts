/**
 * @jest-environment jsdom
 */
import { parseTaskText, parseTasksModel, isTasksDocument, phaseDone } from '../tasksModel';
import { preprocessLedgerTasks } from '../tasks';
import { applyTaskFilters } from '../tasksInteractions';
import { renderMarkdown, setCurrentTask } from '../../renderer';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const OURS = [
    '# Tasks: A check says what code it ran on',
    '',
    '## Phase 2: Foundational',
    '',
    'Files: `apps/a/specContext.ts`, `apps/b/model.ts`',
    '',
    '**Wave 1 — independent (different files):**',
    '',
    '- [x] **T001** [P] [US2] `commit` on `ViewerVerification` · apps/a/specContext.ts',
    '- [x] **T002** [P] [US2] Export the runner · apps/b/model.ts',
    '',
    '## Phase 3: User Story 1 - Record the code a check ran on (P1)',
    '',
    '- [x] **T003** [US1] Record commit · apps/c/capture.py',
    '',
    '**Checkpoint**: run checks carry the code they ran on.',
    '',
    '## Phase 4: User Story 2 - See when a check is out of date (P1)',
    '',
    '**Goal**: Someone can tell the code moved.',
    '',
    '**Wave 1 — independent (different files):**',
    '',
    '- [x] **T005** [P] [US2] pickVerified passes · apps/d/state.ts',
    '',
    '**⟶ Wait for Wave 1 to finish, then:**',
    '',
    '**Wave 2 — independent (different files):**',
    '',
    '- [ ] **T009** [P] [US2] Enrichment beside markMissingTests · apps/d/provider.ts',
    '- [ ] **T010** [P] [US2] Tests for it, waits on T009 · apps/d/a.test.ts',
    '- [ ] **T011** [P] [US2] Blocked by T009: a story ⛔',
    '',
    '**Checkpoint**: a check followed by an edit reads out of date.',
    '',
    '## Dependencies & Execution Order',
    '',
    '- Foundational → Phase 3 and Phase 4 (disjoint).',
    '- Phase 4: Wave 1 blocks Wave 2.',
].join('\n');

describe('parseTaskText', () => {
    it('reads id, markers, files and the done-when clause', () => {
        const t = parseTaskText('**T012** [P] [US3] Add the parser — done when the tests pass · src/a.ts, src/b.ts', false);
        expect(t).toMatchObject({ id: 'T012', parallel: true, story: 'US3', files: ['src/a.ts', 'src/b.ts'], doneWhen: 'the tests pass' });
        expect(t.desc).toBe('Add the parser');
    });

    it('reads a bare id and an id with a letter suffix', () => {
        expect(parseTaskText('T006a Implement traits', false).id).toBe('T006A');
    });

    it('marks blocked only when not done', () => {
        expect(parseTaskText('T1 x blocked by T2', false).blocked).toBe(true);
        expect(parseTaskText('T1 x blocked by T2', true).blocked).toBe(false);
    });
});

describe('parseTasksModel', () => {
    const model = parseTasksModel(OURS.split('\n'));

    it('builds phases, waves and story titles', () => {
        expect(model.phases.map((p) => p.num)).toEqual([2, 3, 4]);
        expect(model.phases[2].waves.map((w) => [w.num, w.after, w.tasks.length])).toEqual([[1, null, 1], [2, 1, 3]]);
        expect(model.stories.get('US2')).toBe('See when a check is out of date');
        expect(model.phases[0].files).toHaveLength(2);
    });

    it('treats a phase of checked tasks as done', () => {
        expect(phaseDone(model.phases[1])).toBe(true);
        expect(phaseDone(model.phases[2])).toBe(false);
    });

    it('reads a check-marked heading as done even with open boxes', () => {
        const m = parseTasksModel(['## Phase 1: Setup ✅', '- [ ] T001 a', '- [x] T002 b']);
        expect(m.phases[0].title).toBe('Setup');
        expect(phaseDone(m.phases[0])).toBe(true);
    });

    it('ignores task-looking lines inside fences and non-task documents', () => {
        expect(isTasksDocument(['# Quality Checklist', '## Phase 1: x', '- [ ] T001 a'])).toBe(false);
        expect(isTasksDocument(['# T', '```', '## Phase 1: x', '- [ ] T001 a', '```'])).toBe(false);
    });
});

describe('preprocessLedgerTasks', () => {
    it('leaves other documents untouched', () => {
        const md = '# Plan\n\n- [ ] a checklist item\n';
        expect(preprocessLedgerTasks(md)).toBe(md);
    });

    it('adds the header with counts, a segmented bar and story filters', () => {
        const out = preprocessLedgerTasks(OURS, 'T009');
        expect(out).toContain('<strong>4 of 7</strong>');
        expect(out).toContain('1 running');
        expect(out).toContain('1 blocked');
        expect(out).toContain('aria-label="4 of 7 tasks done, 1 running, 1 blocked"');
        expect(out).toContain('data-lg-story="US1"');
        expect(out).toContain('See when a check is out of date');
    });

    it('folds a done phase and opens the active one', () => {
        const out = preprocessLedgerTasks(OURS);
        expect(out).toMatch(/<details class="lg-phase" data-phase="2" data-state="done" >/);
        expect(out).toMatch(/data-phase="4" data-state="active" data-story="US2" open>/);
        expect(out).toContain('2 files');
    });

    it('turns wave and wait lines into lanes and drops the wait line', () => {
        const out = preprocessLedgerTasks(OURS);
        expect(out).not.toContain('Wait for');
        expect(out).toContain('after Wave 1');
        expect(out).toContain('class="lg-lanes"');
        expect((out.match(/<details/g) ?? []).length).toBe((out.match(/<\/details>/g) ?? []).length);
    });

    it('closes every phase, wave and lane block', () => {
        const out = preprocessLedgerTasks(OURS);
        expect((out.match(/<div/g) ?? []).length).toBe((out.match(/<\/div>/g) ?? []).length);
    });

    it('draws the dependency chain with progress, parallel bracket and note', () => {
        const out = preprocessLedgerTasks(OURS);
        expect(out).toContain('class="lg-chain"');
        expect(out).toContain('lg-step-group--par');
        expect(out).toContain('disjoint files, may run together');
        expect(out).toContain('Wave 1 blocks Wave 2');
        expect(out).not.toContain('## Dependencies');
    });

    it('keeps the section as written when it is not a plain chain', () => {
        const md = OURS.replace('- Foundational → Phase 3 and Phase 4 (disjoint).', 'Some prose here.');
        expect(preprocessLedgerTasks(md)).toContain('## Dependencies & Execution Order');
    });

    it('shows the checkpoint as proved or still to prove', () => {
        const out = preprocessLedgerTasks(OURS);
        expect(out).toContain('Proved');
        expect(out).toContain('To prove · 3 of 4 tasks left');
    });

    it('replaces a user story mapping table with the titles it carried', () => {
        const md = ['# T', '## User Story Mapping', '', '| Tasks label | spec |', '|---|---|', '| US1 | User Story 5 — Configure Pager (P1) |', '', '## Phase 1: Setup', '- [ ] T001 [US1] a', '- [ ] T002 [US2] b'].join('\n');
        const out = preprocessLedgerTasks(md);
        expect(out).not.toContain('User Story Mapping');
        expect(out).toContain('Configure Pager');
    });
});

describe('task row (rendered)', () => {
    afterEach(() => setCurrentTask(null));

    it('renders states, anchors, file chips and the live state from the current task', () => {
        setCurrentTask('T009');
        const html = renderMarkdown(OURS);
        expect(html).toContain('id="ref-t009"');
        expect(html).toContain('data-task-id="T009"');
        expect(html).toContain('data-state="running"');
        expect(html).toContain('Running');
        expect(html).toContain('data-state="blocked"');
        expect(html).toContain('waits on T009');
        expect(html).toContain('data-filename="apps/d/provider.ts"');
        expect(html).not.toContain('IN PROGRESS');
        expect(html).not.toContain('task-item__marker');
    });

    it('shows the story chip only outside the story phase', () => {
        const html = renderMarkdown(OURS);
        const t001 = html.slice(html.indexOf('data-task-id="T001"'), html.indexOf('data-task-id="T002"'));
        const t005 = html.slice(html.indexOf('data-task-id="T005"'), html.indexOf('data-task-id="T009"'));
        expect(t001).toContain('lg-task-story');
        expect(t005).not.toContain('lg-task-story');
    });

    it('renders a done-when footer and escapes repository text', () => {
        const html = renderMarkdown('# T\n\n## Phase 1: A\n\n- [ ] T001 <img src=x onerror=1> — done when ok · a.ts\n');
        expect(html).toContain('Done when');
        expect(html).not.toContain('<img src=x');
    });

    it('keeps the checkbox, comment button and source line', () => {
        const html = renderMarkdown(OURS);
        expect(html).toMatch(/<input type="checkbox" [^>]*data-line="\d+"/);
        expect(html).toContain('line-add-btn');
    });
});

describe('applyTaskFilters', () => {
    const build = (): HTMLElement => {
        document.body.innerHTML = `<div id="r"><button class="lg-filter" data-lg-story="US1"></button><button class="lg-toggle"></button>` +
            `<details class="lg-phase"><ul><li class="task-item" data-story="US1" data-state="done"></li><li class="task-item" data-story="US2" data-state="todo"></li></ul></details>` +
            `<details class="lg-phase"><ul><li class="task-item" data-story="US1" data-state="done"></li></ul></details></div>`;
        return document.getElementById('r')!;
    };

    it('filters by story and hides empty phases', () => {
        const r = build();
        applyTaskFilters(r, { story: 'US2', hideDone: false });
        expect(r.querySelectorAll('li.lg-hidden')).toHaveLength(2);
        expect(r.querySelectorAll('.lg-phase.lg-hidden')).toHaveLength(1);
    });

    it('hides done rows', () => {
        const r = build();
        applyTaskFilters(r, { story: '', hideDone: true });
        expect(r.querySelectorAll('li.lg-hidden')).toHaveLength(2);
        expect(r.querySelector('.lg-toggle')!.getAttribute('aria-checked')).toBe('true');
    });
});

describe('real tasks files', () => {
    const base = '/Users/alfredoperez/dev/GitHub/speckit-companion/apps/vscode/webview/src/spec-viewer/__stories__/__fixtures__/external';
    for (const dir of ['hl-010-pager', 'iris-history-monitor-002-new-ui', 'server-108-redis-outage-resilience']) {
        const file = join(base, dir, 'tasks.md');
        (existsSync(file) ? it : it.skip)(`${dir} renders balanced with every task`, () => {
            const md = readFileSync(file, 'utf8');
            const html = renderMarkdown(md);
            const tasks = (md.match(/^\s*[-*+]\s+\[[ xX]\]\s+(?:\*\*)?T\d+/gm) ?? []).length;
            expect((html.match(/class="task-item /g) ?? []).length).toBe(tasks);
            expect((html.match(/<details/g) ?? []).length).toBe((html.match(/<\/details>/g) ?? []).length);
            expect((html.match(/<div/g) ?? []).length).toBe((html.match(/<\/div>/g) ?? []).length);
        });
    }
});
