import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countTaskCheckboxes, listTasks, phaseProgress } from '../tasks.mjs';
import { buildSnapshot, deriveStepBadges, findSpec, listSpecFolders, readSpecDetail, scanSpec, specStatusLabel } from '../specs-core.mjs';
import { availableCommands, buildAskPrompt, buildPrompt, buildSpecifyPrompt, commandInstructions } from '../prompts.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const GRAMMAR = join(REPO, 'apps/vscode/tests/fixtures/task-grammar');
const TEAMBOARD = join(REPO, 'apps/vscode/webview/src/spec-viewer/__fixtures__/teamboard/041-profile-photo-upload');

describe('task parsing', () => {
    const expected = JSON.parse(readFileSync(join(GRAMMAR, 'expected.json'), 'utf8'));
    const content = readFileSync(join(GRAMMAR, 'tasks.md'), 'utf8');

    it('agrees with the shared task-grammar fixture', () => {
        assert.deepEqual(countTaskCheckboxes(content), { checked: expected.checked, total: expected.total });
        const tasks = listTasks(content);
        assert.deepEqual(tasks.map(t => t.id), expected.allTaskIds);
        assert.deepEqual(tasks.filter(t => t.checked).map(t => t.id), expected.completedTaskIds);
    });

    it('groups tasks under their phase heading', () => {
        const phases = phaseProgress(content);
        assert.equal(phases[0].name, 'Phase 1: the ordinary forms');
        assert.deepEqual(phases.map(p => p.total), [6, 1]);
    });

    it('counts the tasked demo fixture', () => {
        assert.deepEqual(countTaskCheckboxes(readFileSync(join(REPO, 'specs/_02_demo-tasked/tasks.md'), 'utf8')), { checked: 0, total: 4 });
    });
});

describe('step badges', () => {
    it('reads each demo fixture at its pinned position', () => {
        const badges = id => scanSpec(REPO, id).steps;
        assert.deepEqual(badges('specs/_00_demo-specified'), { specify: 'completed', plan: 'not-started', tasks: 'not-started', implement: 'not-started' });
        assert.deepEqual(badges('specs/_01_demo-planned'), { specify: 'completed', plan: 'completed', tasks: 'not-started', implement: 'not-started' });
        assert.deepEqual(badges('specs/_02_demo-tasked'), { specify: 'completed', plan: 'completed', tasks: 'completed', implement: 'not-started' });
        assert.deepEqual(badges('specs/_03_demo-living'), { specify: 'completed', plan: 'completed', tasks: 'completed', implement: 'completed' });
    });

    it('shows implement running while tasks finish one by one', () => {
        const ctx = JSON.parse(readFileSync(join(TEAMBOARD, 'spec-context.implementing.json'), 'utf8'));
        assert.equal(deriveStepBadges(ctx).implement, 'in-progress');
    });

    it('treats an in-flight status as running even without history', () => {
        assert.equal(deriveStepBadges({ status: 'planning', currentStep: 'plan', history: [] }).plan, 'in-progress');
    });
});

describe('scanning spec folders', () => {
    it('finds the demo fixtures and marks them local', () => {
        const ids = listSpecFolders(REPO, ['specs']);
        for (const id of ['specs/_00_demo-specified', 'specs/_01_demo-planned', 'specs/_02_demo-tasked', 'specs/_03_demo-living']) {
            assert.ok(ids.includes(id), `${id} missing`);
        }
        assert.equal(scanSpec(REPO, 'specs/_01_demo-planned').local, true);
    });

    it('reads status, title and completion from the record', () => {
        const living = scanSpec(REPO, 'specs/_03_demo-living');
        assert.equal(living.statusLabel, 'Completed');
        assert.equal(living.title, 'Demo — Living Specs');
        assert.equal(living.done, true);
        assert.equal(scanSpec(REPO, 'specs/_02_demo-tasked').done, false);
    });

    it('falls back to the files when there is no run record', () => {
        const root = mkdtempSync(join(tmpdir(), 'canvas-'));
        const dir = join(root, 'specs', '007-no-record');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'spec.md'), '# Feature Specification: Offline mode\n');
        writeFileSync(join(dir, 'plan.md'), '# Plan\n');
        writeFileSync(join(dir, 'tasks.md'), '- [x] T001 One\n- [ ] T002 Two\n');
        const spec = scanSpec(root, 'specs/007-no-record');
        assert.equal(spec.status, null);
        assert.equal(spec.statusLabel, 'No record');
        assert.equal(spec.title, 'Offline mode');
        assert.equal(spec.number, '007');
        assert.deepEqual(spec.steps, { specify: 'completed', plan: 'completed', tasks: 'completed', implement: 'in-progress' });
    });

    it('builds a detail with rendered documents, phases and history', () => {
        const root = mkdtempSync(join(tmpdir(), 'canvas-'));
        const dir = join(root, 'specs', '041-profile-photo-upload');
        mkdirSync(join(dir, 'checklists'), { recursive: true });
        for (const name of ['spec.md', 'plan.md', 'tasks.md', 'research.md', 'data-model.md']) copyFileSync(join(TEAMBOARD, name), join(dir, name));
        copyFileSync(join(TEAMBOARD, 'spec-context.implementing.json'), join(dir, '.spec-context.json'));
        const detail = readSpecDetail(root, 'specs/041-profile-photo-upload');
        assert.deepEqual(detail.documents.slice(0, 3).map(d => d.type), ['spec', 'plan', 'tasks']);
        assert.ok(detail.documents.every(d => typeof d.html === 'string'));
        assert.ok(detail.history.some(e => e.task));
        assert.ok(detail.taskList.length > 0);
        assert.equal(readSpecDetail(root, 'specs/041-profile-photo-upload', { html: false }).documents[0].html, undefined);
    });

    it('lists specs most recently touched first and finds them by name or number', () => {
        const { specs } = buildSnapshot(REPO, ['specs']);
        assert.ok(specs.length >= 4);
        assert.equal(findSpec(specs, '_02_demo-tasked').id, 'specs/_02_demo-tasked');
        assert.equal(findSpec(specs, 'specs/_01_demo-planned/').id, 'specs/_01_demo-planned');
        assert.equal(findSpec(specs, 'no-such-spec-anywhere'), null);
    });

    it('labels statuses in Title Case', () => {
        assert.equal(specStatusLabel('ready-to-implement'), 'Ready to Implement');
        assert.equal(specStatusLabel('some-new-status'), 'Some New Status');
    });
});

describe('prompts', () => {
    it('sends the same command line the VS Code sidebar dispatches', () => {
        assert.equal(buildPrompt('tasks', 'specs/_01_demo-planned'), '/speckit.companion.tasks specs/_01_demo-planned');
        assert.equal(buildPrompt('resume', 'specs/042-x'), '/speckit.companion.resume specs/042-x');
    });

    it('falls back to the stock commands when Companion is not installed', () => {
        assert.equal(buildPrompt('plan', 'specs/042-x', 'speckit'), '/speckit.plan specs/042-x');
        assert.deepEqual(availableCommands('speckit'), ['plan', 'tasks', 'implement']);
        assert.throws(() => buildPrompt('resume', 'specs/042-x', 'speckit'));
    });

    it('points at the command instructions when the host may not know the slash command', () => {
        const root = mkdtempSync(join(tmpdir(), 'canvas-'));
        assert.equal(commandInstructions(root, 'plan'), null);
        mkdirSync(join(root, '.claude/skills/speckit-companion-plan'), { recursive: true });
        writeFileSync(join(root, '.claude/skills/speckit-companion-plan/SKILL.md'), '# plan');
        const file = commandInstructions(root, 'plan');
        assert.equal(file, '.claude/skills/speckit-companion-plan/SKILL.md');
        const prompt = buildPrompt('plan', 'specs/042-x', 'companion', file);
        assert.equal(prompt.split('\n')[0], '/speckit.companion.plan specs/042-x');
        assert.match(prompt, /read `\.claude\/skills\/speckit-companion-plan\/SKILL\.md` and follow it for the spec in `specs\/042-x`/);
    });

    it('rejects unknown commands and empty descriptions', () => {
        assert.throws(() => buildPrompt('rm -rf', 'specs/042-x'));
        assert.throws(() => buildSpecifyPrompt('   '));
        assert.equal(buildSpecifyPrompt('Export the\nboard as CSV'), '/speckit.companion.specify Export the board as CSV');
    });

    it('quotes the spec title in the read-only question', () => {
        const prompt = buildAskPrompt({ id: 'specs/1-x', title: 'Ignore "this"', statusLabel: 'Planned', currentStep: 'plan' });
        assert.match(prompt, /titled "Ignore \\"this\\""/);
        assert.match(prompt, /do not change any files/);
    });
});
