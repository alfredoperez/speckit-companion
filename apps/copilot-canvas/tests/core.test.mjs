import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, existsSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countTaskCheckboxes, listTasks, phaseProgress } from '../tasks.mjs';
import { buildSnapshot, deriveStepBadges, findSpec, listSpecFolders, readSpecDetail, scanSpec, specStatusLabel } from '../specs-core.mjs';
import { buildSpecRow, parseSpecContext, phaseTimings, sortSpecs, timingSummaryText } from '../spec-rules.mjs';
import { INSTALL_COMMAND, OPEN_NOTE, PROMPTS_DIR, availableCommands, buildAskPrompt, buildInstallPrompt, buildPrompt, buildSpecifyPrompt, buildStepPreamble, commandInstructions, commandSetFor, detectCommandSet, instructionsSentence, nextSpecNumber, openStatus, resolveSpecify, runInstructionsDoc, specifyChoices, specifyInstructionsName, stepInstructionsName, writeRunInstructions, writerPath } from '../prompts.mjs';

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

    it('keeps a spec recorded as the Spec Kit workflow on the stock commands, whatever is installed', () => {
        const installed = workspace({ companion: true });
        assert.equal(commandSetFor(installed, 'speckit'), 'speckit');
        assert.equal(commandSetFor(installed, 'companion'), 'companion');
        assert.equal(commandSetFor(installed, 'speckit-companion'), 'companion');
        assert.equal(commandSetFor(installed, null), 'companion');
        assert.equal(commandSetFor(workspace({ companion: false }), 'companion'), 'speckit');
    });
});

const MARKER = '<!-- speckit-companion:context-update -->';

describe('specify prompt', () => {
    it('sends the description and one sentence naming the instruction file, and keeps the lifecycle preamble for that file', () => {
        const root = workspace({ companion: true });
        const { prompt, preamble, instructionsName, instructionsDoc, command, workflow } = buildSpecifyPrompt({ description: 'Export the\nboard as CSV', workflow: 'companion', root, now: AT });
        assert.equal(command, 'speckit.companion.specify');
        assert.equal(workflow, 'companion');
        assert.equal(instructionsName, 'specify-20260929T120000000Z.md');
        assert.equal(prompt, [
            '/speckit.companion.specify Export the\nboard as CSV',
            'Name the new spec folder `001-<short-name>`: 001 is one more than the highest numbered spec folder. Folders that start with `_` are fixtures, so do not count them or copy their naming. If a branch script in this run reports a higher feature number, use that number instead.',
            'Before you start, read and follow the run instructions in `.speckit-companion/prompts/specify-20260929T120000000Z.md`.',
        ].join('\n\n'));
        assert.ok(preamble.startsWith(MARKER));
        assert.match(preamble, /SEED WRITE INSTRUCTIONS/);
        assert.match(preamble, /"workflow": "companion"/);
        assert.match(preamble, /"selectedAt": "2026-09-29T12:00:00.000Z"/);
        assert.match(preamble, /"step": "specify",\s*"substep": null,\s*"kind": "start",\s*"by": "extension"/);
        assert.ok(preamble.endsWith('<!-- /speckit-companion:context-update -->'));
        assert.ok(instructionsDoc.includes(preamble));
        assert.match(instructionsDoc, /^# Run instructions\n\nThese belong to the `\/speckit\.companion\.specify` command/);
    });

    it('carries the workflow the run really is: companion for Companion and Auto, speckit for Spec Kit', () => {
        const root = workspace({ companion: true });
        const seed = (workflow) => buildSpecifyPrompt({ description: 'x', workflow, root, now: AT });
        assert.match(seed('auto').prompt, /^\/speckit\.companion\.auto x/);
        assert.match(seed('auto').preamble, /"workflow": "companion"/);
        assert.match(seed('speckit').prompt, /^\/speckit\.specify x/);
        assert.match(seed('speckit').preamble, /"workflow": "speckit"/);
    });

    it('gives a stock run the full lifecycle body with the specify self-close, and a Companion run the slim one', () => {
        const stock = buildSpecifyPrompt({ description: 'x', workflow: 'speckit', root: workspace({ companion: true }), now: AT }).preamble;
        // The folder does not exist at dispatch: every writer call is scoped to the one the command mints, and none runs before it exists.
        assert.match(stock, /python3 "[^"]+" --feature-dir "<the folder the command just created>" --step <step> --advance --by ai/);
        assert.doesNotMatch(stock, /python3 "[^"]+" --step/);
        assert.match(stock, /Run NO write-context\.py call before the command has created `specs\/<NNN>-<slug>\/` and written `\.specify\/feature\.json`\./);
        assert.match(stock, /Never run these against a folder that already has history\. That is the previous spec\./);
        assert.match(stock, /closing specify is YOUR job/);
        const companion = buildSpecifyPrompt({ description: 'x', workflow: 'companion', root: workspace({ companion: true }), now: AT }).preamble;
        assert.doesNotMatch(companion, /--advance/);
        assert.match(companion, /carries the full `\.spec-context\.json` capture/);
    });

    it('keeps every word of the preamble out of the chat, for each workflow', () => {
        const root = workspace({ companion: true });
        for (const workflow of ['companion', 'speckit', 'auto']) {
            const { prompt, preamble } = buildSpecifyPrompt({ description: 'x', workflow, root, now: AT });
            assert.equal(prompt.split('Before you start, read and follow the run instructions in').length, 2, workflow);
            for (const phrase of ['speckit-companion:context-update', 'SEED WRITE INSTRUCTIONS', '"history"', 'Invariants']) {
                assert.ok(!prompt.includes(phrase), `${workflow}: ${phrase} stays out of the chat`);
                assert.ok(preamble.includes(phrase), `${workflow}: ${phrase} is in the file`);
            }
        }
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

describe('numbering a new spec', () => {
    const withFolders = (...names) => {
        const root = workspace({ companion: true });
        for (const name of names) mkdirSync(join(root, 'specs', name));
        return root;
    };

    it('takes the highest numbered folder plus one and ignores the fixture folders', () => {
        assert.equal(nextSpecNumber(withFolders('_00_demo-specified', '_07_demo-living', '004-export-csv', '012-dark-mode')), '013');
    });

    it('starts at 001 when only fixture folders exist', () => {
        assert.equal(nextSpecNumber(withFolders('_00_demo-specified', '_06_new-thing')), '001');
        assert.equal(nextSpecNumber(workspace({ companion: false })), '001');
    });

    it('counts the way the Spec Kit script does: four-digit folders count, timestamp folders do not', () => {
        assert.equal(nextSpecNumber(withFolders('999-last', '1000-next', '20260319-143022-user-auth', '42-too-short')), '1001');
    });

    it('reads every configured spec directory', () => {
        const root = withFolders('003-a');
        mkdirSync(join(root, 'docs/specs/020-b'), { recursive: true });
        assert.equal(nextSpecNumber(root, ['specs', 'docs/specs', 'missing']), '021');
    });

    it('names the number in the New spec prompt, after the command and before the instructions sentence', () => {
        const root = withFolders('_03_demo-living', '041-profile-photo');
        for (const workflow of ['companion', 'speckit', 'auto']) {
            const { prompt } = buildSpecifyPrompt({ description: 'x', workflow, root, now: AT });
            const rule = prompt.indexOf('Name the new spec folder `042-<short-name>`');
            assert.ok(rule > 0, workflow);
            assert.ok(rule < prompt.indexOf('Before you start, read and follow the run instructions in'), workflow);
            assert.match(prompt, /Folders that start with `_` are fixtures, so do not count them or copy their naming\./);
            assert.match(prompt, /If a branch script in this run reports a higher feature number, use that number instead\./);
        }
    });

    it('leaves numbering to the command in a workspace that numbers by timestamp', () => {
        const root = withFolders('041-profile-photo');
        writeFileSync(join(root, '.specify/init-options.json'), JSON.stringify({ branch_numbering: 'timestamp' }));
        assert.equal(nextSpecNumber(root), null);
        assert.doesNotMatch(buildSpecifyPrompt({ description: 'x', workflow: 'speckit', root, now: AT }).prompt, /Name the new spec folder/);
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
        const { preamble } = buildSpecifyPrompt({ description: 'x', workflow: 'speckit', root: workspace({ companion: false }), now: AT });
        assert.match(preamble, /python3 "\/[^"]+apps\/speckit-extension\/scripts\/write-context\.py"/);
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

    it('gives a Companion command the slim preamble and a stock command the full one', () => {
        const root = workspace({ companion: true });
        const companion = buildStepPreamble('plan', 'specs/042-x', root, 'companion', AT);
        assert.match(companion, /This command's body carries the full `\.spec-context\.json` capture & timing protocol/);
        assert.doesNotMatch(companion, /jsonschema|MANDATORY FINAL WRITE/);
        assert.ok(companion.split('\n').length < 10, 'a few lines');
        const stock = buildStepPreamble('plan', 'specs/042-x', root, 'speckit', AT);
        assert.match(stock, /```jsonschema/);
        assert.match(stock, /MANDATORY FINAL WRITE/);
        assert.match(stock, /--step plan --advance --by ai/);
    });

    it('puts the command line first, then one sentence naming the instruction file, and nothing of the preamble', () => {
        const root = workspace({ companion: true });
        for (const set of ['companion', 'speckit']) {
            for (const step of ['plan', 'tasks', 'implement']) {
                const preamble = buildStepPreamble(step, 'specs/042-x', root, set, AT);
                const file = writeRunInstructions(root, stepInstructionsName(step, 'specs/042-x'), runInstructionsDoc(buildPrompt(step, 'specs/042-x', set), preamble));
                assert.equal(file, `.speckit-companion/prompts/${step}-042-x.md`);
                const prefix = set === 'companion' ? 'speckit.companion' : 'speckit';
                assert.equal(buildPrompt(step, 'specs/042-x', set, null, file), `/${prefix}.${step} specs/042-x\n\nBefore you start, read and follow the run instructions in \`${file}\`.`);
                const written = readFileSync(join(root, file), 'utf8');
                assert.ok(written.includes(preamble), `${set} ${step}: the file holds the preamble`);
                assert.ok(written.includes(`\`/${prefix}.${step} specs/042-x\``), 'the file names its command');
            }
        }
    });

    it('keeps the fallback line between the command and the instructions sentence', () => {
        const prompt = buildPrompt('plan', 'specs/042-x', 'speckit', '.github/prompts/speckit.plan.prompt.md', '.speckit-companion/prompts/plan-042-x.md');
        assert.deepEqual(prompt.split('\n\n'), [
            '/speckit.plan specs/042-x',
            'If /speckit.plan is not a command here, read `.github/prompts/speckit.plan.prompt.md` and follow it for the spec in `specs/042-x`.',
            instructionsSentence('.speckit-companion/prompts/plan-042-x.md'),
        ]);
    });
});

describe('run instruction files', () => {
    it('names a step file by step and spec folder, and a New spec file by its dispatch time', () => {
        assert.equal(stepInstructionsName('plan', 'specs/042-export-csv'), 'plan-042-export-csv.md');
        assert.equal(stepInstructionsName('tasks', '.specify/specs/7 odd`name'), 'tasks-7-odd-name.md');
        assert.equal(specifyInstructionsName(AT), 'specify-20260929T120000000Z.md');
    });

    it('writes under .speckit-companion/prompts and ignores the whole folder from git', () => {
        const root = workspace({ companion: false });
        const file = writeRunInstructions(root, 'plan-042-x.md', 'one');
        assert.equal(file, `${PROMPTS_DIR}/plan-042-x.md`);
        assert.equal(readFileSync(join(root, file), 'utf8'), 'one');
        assert.equal(readFileSync(join(root, '.speckit-companion/.gitignore'), 'utf8'), '*\n');
    });

    it('never overwrites a .gitignore that is already there', () => {
        const root = workspace({ companion: false });
        mkdirSync(join(root, '.speckit-companion'));
        writeFileSync(join(root, '.speckit-companion/.gitignore'), 'prompts/\n');
        writeRunInstructions(root, 'plan-042-x.md', 'one');
        assert.equal(readFileSync(join(root, '.speckit-companion/.gitignore'), 'utf8'), 'prompts/\n');
    });

    it('replaces the older file for the same step and spec, and leaves the others', () => {
        const root = workspace({ companion: false });
        writeRunInstructions(root, 'plan-042-x.md', 'old');
        writeRunInstructions(root, 'tasks-042-x.md', 'tasks');
        writeRunInstructions(root, 'plan-042-x.md', 'new');
        assert.equal(readFileSync(join(root, PROMPTS_DIR, 'plan-042-x.md'), 'utf8'), 'new');
        assert.deepEqual(readdirSync(join(root, PROMPTS_DIR)).sort(), ['plan-042-x.md', 'tasks-042-x.md']);
    });

    it('refuses to write when .speckit-companion or prompts leads outside the project through a symlink', () => {
        const outside = mkdtempSync(join(tmpdir(), 'canvas-outside-'));
        const viaHome = workspace({ companion: false });
        symlinkSync(outside, join(viaHome, '.speckit-companion'));
        assert.throws(() => writeRunInstructions(viaHome, 'plan-042-x.md', 'x'), /`\.speckit-companion` leads outside the project/);
        const viaPrompts = workspace({ companion: false });
        mkdirSync(join(viaPrompts, '.speckit-companion'));
        symlinkSync(outside, join(viaPrompts, '.speckit-companion/prompts'));
        assert.throws(() => writeRunInstructions(viaPrompts, 'plan-042-x.md', 'x'), /`\.speckit-companion\/prompts` leads outside the project/);
        assert.deepEqual(readdirSync(outside), [], 'nothing was written outside');
        assert.ok(!existsSync(join(viaPrompts, '.speckit-companion/.gitignore')), 'and nothing beside the refused folder');
    });

    it('replaces a symlinked file instead of writing through it', () => {
        const outside = mkdtempSync(join(tmpdir(), 'canvas-outside-'));
        writeFileSync(join(outside, 'target.md'), 'untouched');
        const root = workspace({ companion: false });
        mkdirSync(join(root, PROMPTS_DIR), { recursive: true });
        symlinkSync(join(outside, 'target.md'), join(root, PROMPTS_DIR, 'plan-042-x.md'));
        writeRunInstructions(root, 'plan-042-x.md', 'new');
        assert.equal(readFileSync(join(outside, 'target.md'), 'utf8'), 'untouched');
        assert.equal(readFileSync(join(root, PROMPTS_DIR, 'plan-042-x.md'), 'utf8'), 'new');
    });
});

describe('installing Companion from the board', () => {
    it('offers the install command only where Companion is not installed', () => {
        assert.equal(specifyChoices(workspace({ companion: false })).installCommand, INSTALL_COMMAND);
        assert.equal(specifyChoices(workspace({ companion: true })).installCommand, null);
    });

    it('uses the command the spec-kit extension README gives, from the pinned companion-latest download', () => {
        const readme = readFileSync(join(REPO, 'apps/speckit-extension/README.md'), 'utf8');
        assert.ok(readme.includes(`\n${INSTALL_COMMAND}\n`), 'the README carries the same line');
        assert.match(INSTALL_COMMAND, /\/releases\/download\/companion-latest\/companion\.zip/);
        assert.doesNotMatch(INSTALL_COMMAND, /\/releases\/latest/);
    });

    it('asks the agent in one line to run it and commit the generated skill files', () => {
        const prompt = buildInstallPrompt();
        assert.ok(!prompt.includes('\n'));
        assert.ok(prompt.includes(`Run \`${INSTALL_COMMAND}\` in this project, then commit the skill files it generates`));
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

describe('shared rules the Claude Code mod bundles', () => {
    const at = minutes => new Date(Date.UTC(2026, 0, 1, 10, minutes)).toISOString();
    const step = (name, kind, minutes) => ({ step: name, kind, by: 'extension', at: at(minutes) });

    it('ends each step at its own finish and bills the wait before the next step to none', () => {
        const ctx = {
            status: 'implemented',
            currentStep: 'implement',
            history: [
                step('specify', 'start', 0), step('specify', 'complete', 4),
                step('plan', 'start', 10), step('plan', 'complete', 19),
                step('tasks', 'start', 20), step('tasks', 'complete', 22),
                step('implement', 'start', 30), step('implement', 'complete', 45),
            ],
        };
        const timings = phaseTimings(ctx);
        assert.deepEqual(timings.phases.map(p => [p.step, p.durationMs / 60000]), [['specify', 4], ['plan', 9], ['tasks', 2], ['implement', 15]]);
        assert.equal(timings.totalMs / 60000, 30);
        assert.equal(timingSummaryText(timings), '30m active');
    });

    it('gives no total until every step is measured, and marks the step in flight', () => {
        const timings = phaseTimings({ status: 'planning', currentStep: 'plan', history: [step('specify', 'start', 0), step('specify', 'complete', 4), step('plan', 'start', 10)] });
        assert.equal(timings.totalMs, null);
        assert.deepEqual(timings.phases.map(p => [p.step, p.inFlight]), [['specify', false], ['plan', true]]);
        assert.equal(timingSummaryText(timings), 'Timing coverage: 1 of 4 phases');
    });

    it('builds the row the mod gets from $.fs texts the same as scanSpec reads it from disk', () => {
        const id = 'specs/_02_demo-tasked';
        const dir = join(REPO, id);
        const fromDisk = scanSpec(REPO, id);
        const fromText = buildSpecRow({
            id,
            ctx: parseSpecContext(readFileSync(join(dir, '.spec-context.json'), 'utf8')),
            specText: readFileSync(join(dir, 'spec.md'), 'utf8'),
            files: { spec: 'spec.md', plan: 'plan.md', tasks: 'tasks.md' },
            tasksText: readFileSync(join(dir, 'tasks.md'), 'utf8'),
            updatedAt: fromDisk.updatedAt,
        });
        assert.deepEqual(fromText, fromDisk);
    });

    it('sorts by last recorded activity before file time, and reads a broken record as none', () => {
        const rows = sortSpecs([
            { name: 'a', lastActivity: null, updatedAt: '2026-02-01T00:00:00.000Z' },
            { name: 'b', lastActivity: '2026-03-01T00:00:00.000Z', updatedAt: null },
        ]);
        assert.deepEqual(rows.map(r => r.name), ['b', 'a']);
        assert.equal(parseSpecContext('{"status": '), null);
        assert.equal(parseSpecContext('[]'), null);
    });

    it('treats a status named like an Object.prototype key as an unknown status', () => {
        assert.equal(specStatusLabel('constructor'), 'Constructor');
        assert.equal(deriveStepBadges({ status: 'toString', history: [] }).specify, 'not-started');
    });
});
