import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countTaskCheckboxes, listTasks, phaseProgress } from '../tasks.mjs';
import { buildSnapshot, deriveStepBadges, findSpec, listSpecFolders, readSpecDetail, scanSpec, specStatusLabel } from '../specs-core.mjs';
import { OPEN_NOTE, availableCommands, buildAskPrompt, buildPrompt, buildSpecifyPrompt, buildStepPreamble, commandInstructions, detectCommandSet, openStatus, resolveSpecify, specifyChoices, writerPath } from '../prompts.mjs';

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

    it('names the repository, not the worktree folder', () => {
        const root = mkdtempSync(join(tmpdir(), 'canvas-'));
        writeFileSync(join(root, '.git'), 'gitdir: /Users/me/dev/speckit-companion/.git/worktrees/didactic-potato\n');
        assert.equal(buildSnapshot(root, ['specs']).repoName, 'speckit-companion');
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

    it('rejects unknown commands', () => {
        assert.throws(() => buildPrompt('rm -rf', 'specs/042-x'));
    });

    it('quotes the spec title in the read-only question', () => {
        const prompt = buildAskPrompt({ id: 'specs/1-x', title: 'Ignore "this"', statusLabel: 'Planned', currentStep: 'plan' });
        assert.match(prompt, /titled "Ignore \\"this\\""/);
        assert.match(prompt, /do not change any files/);
    });
});

function workspace({ companion }) {
    const root = mkdtempSync(join(tmpdir(), 'canvas-ws-'));
    mkdirSync(join(root, 'specs'));
    if (companion) mkdirSync(join(root, '.specify/extensions/companion/scripts'), { recursive: true });
    return root;
}

const AT = new Date('2026-09-29T12:00:00.000Z');

describe('workflow choice on New spec', () => {
    it('maps each choice to the command VS Code sends', () => {
        assert.deepEqual(resolveSpecify('companion', true), { command: 'speckit.companion.specify', effective: 'companion' });
        assert.deepEqual(resolveSpecify('speckit', true), { command: 'speckit.specify', effective: 'speckit' });
        assert.deepEqual(resolveSpecify('speckit', false), { command: 'speckit.specify', effective: 'speckit' });
        assert.deepEqual(resolveSpecify('auto', true), { command: 'speckit.companion.auto', effective: 'companion' });
    });

    it('refuses Auto and Companion when the extension is not installed, with VS Code\'s message for Auto', () => {
        assert.throws(() => resolveSpecify('auto', false), /Auto needs the companion spec-kit extension, which is not installed\./);
        assert.throws(() => resolveSpecify('companion', false), /not installed/);
        assert.throws(() => resolveSpecify('turbo', true), /Unknown workflow/);
    });

    it('offers Companion by default when installed, and only Spec Kit otherwise, each disabled choice with a reason', () => {
        const withCompanion = specifyChoices(workspace({ companion: true }));
        assert.equal(withCompanion.default, 'companion');
        assert.ok(withCompanion.choices.every(c => c.available && c.reason === null));
        const stock = specifyChoices(workspace({ companion: false }));
        assert.equal(stock.default, 'speckit');
        assert.deepEqual(stock.choices.map(c => [c.id, c.available]), [['companion', false], ['speckit', true], ['auto', false]]);
        assert.match(stock.choices[0].reason, /not installed/);
    });

    it('detects Companion by its extension folder, exactly as the VS Code dialog does', () => {
        assert.equal(detectCommandSet(workspace({ companion: true })), 'companion');
        assert.equal(detectCommandSet(workspace({ companion: false })), 'speckit');
    });
});

describe('specify prompt', () => {
    it('sends the description, then the lifecycle preamble that seeds the run record', () => {
        const root = workspace({ companion: true });
        const { prompt, command, workflow } = buildSpecifyPrompt({ description: 'Export the\nboard as CSV', workflow: 'companion', root, now: AT });
        assert.equal(command, 'speckit.companion.specify');
        assert.equal(workflow, 'companion');
        assert.ok(prompt.startsWith('/speckit.companion.specify Export the\nboard as CSV'));
        assert.match(prompt, /<!-- speckit-companion:context-update -->/);
        assert.match(prompt, /"workflow": "companion"/);
        assert.match(prompt, /"selectedAt": "2026-09-29T12:00:00.000Z"/);
        assert.match(prompt, /"step": "specify",\s*"substep": null,\s*"kind": "start",\s*"by": "extension"/);
        assert.match(prompt, /<!-- \/speckit-companion:context-update -->/);
    });

    it('carries the workflow the run really is: companion for Companion and Auto, speckit for Spec Kit', () => {
        const root = workspace({ companion: true });
        const seed = (workflow) => buildSpecifyPrompt({ description: 'x', workflow, root, now: AT });
        assert.match(seed('auto').prompt, /^\/speckit\.companion\.auto x/);
        assert.match(seed('auto').prompt, /"workflow": "companion"/);
        assert.match(seed('speckit').prompt, /^\/speckit\.specify x/);
        assert.match(seed('speckit').prompt, /"workflow": "speckit"/);
    });

    it('gives a stock run the full lifecycle body with the specify self-close, and a Companion run the slim one', () => {
        const stock = buildSpecifyPrompt({ description: 'x', workflow: 'speckit', root: workspace({ companion: true }), now: AT }).prompt;
        // The folder does not exist at dispatch: every writer call is scoped to the one the command mints, and none runs before it exists.
        assert.match(stock, /python3 "[^"]+" --feature-dir "<the folder the command just created>" --step <step> --advance --by ai/);
        assert.doesNotMatch(stock, /python3 "[^"]+" --step/);
        assert.match(stock, /Run NO write-context\.py call before the command has created `specs\/<NNN>-<slug>\/` and written `\.specify\/feature\.json`\./);
        assert.match(stock, /Never run these against a folder that already has history\. That is the previous spec\./);
        assert.match(stock, /closing specify is YOUR job/);
        const companion = buildSpecifyPrompt({ description: 'x', workflow: 'companion', root: workspace({ companion: true }), now: AT }).prompt;
        assert.doesNotMatch(companion, /--advance/);
        assert.match(companion, /carries the full `\.spec-context\.json` capture/);
    });

    it('rejects an empty description and a workflow that cannot run here', () => {
        const root = workspace({ companion: false });
        assert.throws(() => buildSpecifyPrompt({ description: '   ', workflow: 'speckit', root }), /Describe the feature/);
        assert.throws(() => buildSpecifyPrompt({ description: 'x', workflow: 'auto', root }), /Auto needs/);
    });

    it('keeps the fallback line after the command line when a skill file exists', () => {
        const root = workspace({ companion: true });
        mkdirSync(join(root, '.github/skills/speckit-companion-specify'), { recursive: true });
        writeFileSync(join(root, '.github/skills/speckit-companion-specify/SKILL.md'), '# specify');
        const lines = buildSpecifyPrompt({ description: 'x', workflow: 'companion', root, now: AT }).prompt.split('\n');
        assert.equal(lines[0], '/speckit.companion.specify x');
        assert.match(lines[2], /If \/speckit\.companion\.specify is not a command here, read `\.github\/skills\/speckit-companion-specify\/SKILL\.md`/);
    });
});

describe('context writer path', () => {
    it('prefers the workspace copy, else this checkout\'s script', () => {
        const withScript = workspace({ companion: true });
        writeFileSync(join(withScript, '.specify/extensions/companion/scripts/write-context.py'), '');
        assert.equal(writerPath(withScript), '.specify/extensions/companion/scripts/write-context.py');
        const without = writerPath(workspace({ companion: false }));
        assert.match(without, /apps\/speckit-extension\/scripts\/write-context\.py$/);
        assert.ok(without.startsWith('/'));
    });

    it('names the checkout script in a stock run\'s preamble when the workspace has none', () => {
        const { prompt } = buildSpecifyPrompt({ description: 'x', workflow: 'speckit', root: workspace({ companion: false }), now: AT });
        assert.match(prompt, /python3 "\/[^"]+apps\/speckit-extension\/scripts\/write-context\.py"/);
    });
});

describe('step preamble for the run buttons', () => {
    it('adds the preamble for plan, tasks and implement, and none for status or resume', () => {
        const root = workspace({ companion: true });
        for (const step of ['plan', 'tasks', 'implement']) {
            assert.match(buildStepPreamble(step, 'specs/042-x', root, 'companion', AT), /<!-- speckit-companion:context-update -->/);
        }
        assert.equal(buildStepPreamble('status', 'specs/042-x', root, 'companion', AT), null);
        assert.equal(buildStepPreamble('resume', 'specs/042-x', root, 'companion', AT), null);
    });

    it('puts the command line first and the preamble after', () => {
        const root = workspace({ companion: true });
        const prompt = buildPrompt('plan', 'specs/042-x', 'companion', null, buildStepPreamble('plan', 'specs/042-x', root, 'companion', AT));
        assert.ok(prompt.startsWith('/speckit.companion.plan specs/042-x\n\n<!--'));
    });
});

describe('opening the canvas', () => {
    it('tells the agent the board is open and to wait, in the status the model reads', () => {
        const status = openStatus(4, 6);
        assert.match(status, /^4 active · 6 specs\. /);
        assert.ok(status.endsWith(OPEN_NOTE));
        assert.match(OPEN_NOTE, /wait for the user's next instruction/);
        assert.match(OPEN_NOTE, /do not start any work/);
    });
});
