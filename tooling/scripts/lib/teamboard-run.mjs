// Writes the Teamboard profile photo spec into a project as it stands after one step of a run, for the walkthrough pictures.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const RUN_STATES = ['specified', 'planned', 'tasked', 'implementing'];
export const RUN_FOLDER = '041-profile-photo-upload';
const TICKED = ['T001', 'T002', 'T003'];
const FILES = {
    specified: ['spec.md'],
    planned: ['spec.md', 'plan.md', 'research.md', 'data-model.md'],
    tasked: ['spec.md', 'plan.md', 'research.md', 'data-model.md', 'tasks.md'],
    implementing: ['spec.md', 'plan.md', 'research.md', 'data-model.md', 'tasks.md'],
};

function contextFor(source, state) {
    if (state !== 'tasked') return JSON.parse(readFileSync(join(source, `spec-context.${state}.json`), 'utf8'));
    // The fixture has no tasked record, so it is the implementing one cut back to the end of the tasks step.
    const context = JSON.parse(readFileSync(join(source, 'spec-context.implementing.json'), 'utf8'));
    context.history = context.history.filter(entry => entry.step !== 'implement');
    delete context.currentTask;
    delete context.task_summaries;
    return { ...context, currentStep: 'tasks', status: 'ready-to-implement', last_action: 'tasks completed' };
}

/**
 * `record: false` leaves out the run record, as in a stock Spec Kit project. `comments` are review comments to carry.
 * Every time in the record is moved so the last thing the run did was 90 seconds ago.
 */
export function writeTeamboardRun(repo, folder, state, { workflow = 'speckit-companion', record = true, comments } = {}) {
    if (!RUN_STATES.includes(state)) throw new Error(`no Teamboard run state "${state}"`);
    const source = join(repo, 'apps/vscode/webview/src/spec-viewer/__fixtures__/teamboard', RUN_FOLDER);
    rmSync(folder, { recursive: true, force: true });
    mkdirSync(folder, { recursive: true });
    for (const name of FILES[state]) cpSync(join(source, name), join(folder, name));
    if (existsSync(join(source, 'checklists'))) cpSync(join(source, 'checklists'), join(folder, 'checklists'), { recursive: true });
    if (state === 'implementing') {
        const tasks = readFileSync(join(folder, 'tasks.md'), 'utf8');
        writeFileSync(join(folder, 'tasks.md'), TICKED.reduce((text, id) => text.replace(`- [ ] **${id}**`, `- [x] **${id}**`), tasks));
    }
    if (!record) return;
    const context = contextFor(source, state);
    delete context.profile;
    context.workflow = workflow;
    const shift = Date.now() - 90000 - Math.max(...context.history.map(entry => Date.parse(entry.at)));
    const moved = at => new Date(Date.parse(at) + shift).toISOString();
    context.selectedAt = moved(context.selectedAt);
    context.history = context.history.map(entry => ({ ...entry, at: moved(entry.at) }));
    if (comments) context.reviewComments = comments;
    writeFileSync(join(folder, '.spec-context.json'), JSON.stringify(context, null, 2));
}
