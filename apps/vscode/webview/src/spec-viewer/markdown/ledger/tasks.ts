/**
 * Ledger tasks: header, phases, execution lanes, checkpoints, dependency chain
 * and the task row. preprocessLedgerTasks rewrites a tasks.md document into
 * component lines the renderer passes through; renderTaskRow is called by the
 * renderer for each checkbox line.
 */

import { escapeHtml, parseInline } from '../inline';
import { codicon, eyebrow, priorityMark, refAnchor, statusDot } from './primitives';
import {
    LgPhase,
    LgTask,
    LgTasksModel,
    TASK_LINE,
    TaskState,
    isTasksDocument,
    lineKinds,
    parseStoryMapping,
    parseTaskText,
    parseTasksModel,
    phaseDone,
    taskState,
} from './tasksModel';

const STATE_LABEL: Record<TaskState, string> = { done: 'Done', running: 'Running', blocked: 'Blocked', todo: 'To do' };

let active: LgTasksModel | null = null;
let runningId: string | null = null;

const attr = (s: string): string => escapeHtml(s);
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

function stateIcon(state: TaskState): string {
    if (state === 'running') return `<span class="lg-spin">${codicon('sync')}</span>`;
    return statusDot(state === 'blocked' ? 'fail' : state);
}

function segments(tasks: LgTask[]): string {
    return tasks.map((t) => `<i class="lg-seg lg-seg--${taskState(t, runningId)}"></i>`).join('');
}

function counts(tasks: LgTask[]): { done: number; running: number; blocked: number; total: number } {
    let done = 0;
    let running = 0;
    let blocked = 0;
    for (const t of tasks) {
        const s = taskState(t, runningId);
        if (s === 'done') done++;
        else if (s === 'running') running++;
        else if (s === 'blocked') blocked++;
    }
    return { done, running, blocked, total: tasks.length };
}

function tasksHeader(model: LgTasksModel): string {
    const c = counts(model.tasks);
    const label = `${c.done} of ${c.total} tasks done${c.running ? `, ${c.running} running` : ''}${c.blocked ? `, ${c.blocked} blocked` : ''}`;
    const live = [
        c.running ? `<span class="lg-live lg-live--running">${stateIcon('running')}${c.running} running</span>` : '',
        c.blocked ? `<span class="lg-live lg-live--blocked">${stateIcon('blocked')}${c.blocked} blocked</span>` : '',
    ].join('');
    const groups = model.phases.filter((p) => p.tasks.length).map((p) => `<span class="lg-bar-group">${segments(p.tasks)}</span>`).join('');
    const storyIds = [...new Set(model.tasks.map((t) => t.story).filter((s): s is string => !!s))];
    const filters = storyIds.length > 1
        ? `<div class="lg-filters" role="group" aria-label="Filter by story"><span class="lg-filter-label">Story</span>` +
          `<button type="button" class="lg-filter" data-lg-story="" aria-pressed="true">All <span>${c.total}</span></button>` +
          storyIds.map((id) => {
              const title = model.stories.get(id);
              return `<button type="button" class="lg-filter" data-lg-story="${attr(id)}" aria-pressed="false"><code>${escapeHtml(id)}</code>${title ? ` ${escapeHtml(title)}` : ''}</button>`;
          }).join('') + `</div>`
        : '';
    const hide = `<button type="button" class="lg-toggle" role="switch" aria-checked="false" data-lg-hide-done><span class="lg-toggle-track"></span>Hide done</button>`;
    return `<div class="lg-tasks-header">` +
        `<div class="lg-tasks-eyebrow">${eyebrow('task', 'Tasks', `${plural(c.total, 'task')} · ${plural(model.phases.length, 'phase')}`)}</div>` +
        `<div class="lg-tasks-summary"><span class="lg-tasks-count"><strong>${c.done} of ${c.total}</strong> tasks done</span>${live}</div>` +
        `<div class="lg-bar" role="img" aria-label="${attr(label)}">${groups}</div>` +
        `<div class="lg-tasks-controls">${filters}${hide}</div></div>`;
}

function phaseChips(p: LgPhase): string {
    return p.mvp ? '<span class="lg-phase-chip">MVP</span>' : '';
}

function phaseOpen(p: LgPhase): string {
    const c = counts(p.tasks);
    const done = phaseDone(p);
    const state = done ? 'done' : c.done || c.running ? 'active' : 'todo';
    const lane = p.story
        ? `<span class="lg-chip lg-phase-story">${escapeHtml(p.story)}</span>${p.priority ? priorityMark(p.priority) : ''}`
        : `<span class="lg-phase-num">Phase ${p.num}</span>`;
    const progress = p.tasks.length
        ? `<span class="lg-phase-progress"><span class="lg-bar lg-bar--thin">${segments(p.tasks)}</span><span class="lg-phase-count">${c.done}/${c.total}${done ? ` ${codicon('check')}` : ''}</span></span>`
        : '';
    const bits = [
        p.tasks.length ? plural(p.tasks.length, 'task') : '',
        p.waves.length > 1 ? plural(p.waves.length, 'wave') : '',
        p.files.length ? `<span class="lg-phase-files" title="${attr(p.files.join('\n'))}">${plural(p.files.length, 'file')}</span>` : '',
    ].filter(Boolean).join(' · ');
    const goal = p.goal ? `<p class="lg-phase-goal"><span>Goal</span> ${parseInline(p.goal)}</p>` : '';
    return `<details class="lg-phase" data-phase="${p.num}" data-state="${state}" ${p.story ? `data-story="${attr(p.story)}" ` : ''}${done ? '' : 'open'}>` +
        `<summary class="lg-phase-head"><span class="lg-phase-lane">${lane}</span>` +
        `<span class="lg-phase-title">${codicon('chevron-right')}<span class="lg-phase-name" id="phase-${p.num}">${parseInline(p.title)}</span>${phaseChips(p)}</span>${progress}</summary>` +
        `<div class="lg-phase-body">${bits ? `<p class="lg-phase-meta">${bits}</p>` : ''}${goal}`;
}

const PHASE_CLOSE = '</div></details>';

function waveOpen(p: LgPhase, num: number): string {
    const w = p.waves.find((x) => x.num === num);
    if (!w) return '';
    const c = counts(w.tasks);
    const done = w.tasks.length > 0 && c.done === c.total;
    const note = w.note.replace(/\s*\(.*?\)\s*/g, ' ').replace(/^independent\s*/i, '').trim();
    const gate = w.after ? `after Wave ${w.after}` : num === 1 ? 'starts first' : '';
    const meta = [`${w.tasks.length} together`, done ? 'all done' : gate, !done && note ? note : ''].filter(Boolean).join(' · ');
    return `<details class="lg-wave" data-wave="${num}" data-state="${done ? 'done' : 'open'}"${done ? '' : ' open'}>` +
        `<summary class="lg-wave-head">${codicon('chevron-right')}<span class="lg-wave-name">Wave ${num}</span><span class="lg-wave-meta">${escapeHtml(meta)}</span>` +
        `<span class="lg-wave-count">${c.done}/${c.total}${done ? ` ${codicon('check')}` : ''}</span></summary><div class="lg-wave-body">`;
}

function checkpoint(p: LgPhase, text: string): string {
    const done = phaseDone(p);
    const left = p.tasks.filter((t) => !t.done).length;
    const clean = text.replace(/\s*✅\s*/g, ' ').trim();
    const head = done
        ? `<span class="lg-checkpoint-state lg-checkpoint-state--done">${statusDot('done')}Proved</span>`
        : `<span class="lg-checkpoint-state">${statusDot('todo')}To prove · ${left} of ${p.tasks.length} tasks left</span>`;
    return `<div class="lg-checkpoint" data-state="${done ? 'done' : 'todo'}"><div class="lg-checkpoint-head"><strong>Checkpoint</strong>${head}</div>${clean ? `<p>${parseInline(clean)}</p>` : ''}</div>`;
}

function resolveStep(name: string, model: LgTasksModel): LgPhase | null {
    const n = name.trim().replace(/[.*_`]/g, '');
    const num = n.match(/\bPhase\s+(\d+)/i);
    if (num) return model.phases.find((p) => p.num === Number(num[1])) ?? null;
    const us = n.match(/^(US\d+)\b/i);
    if (us) return model.phases.find((p) => p.story === us[1].toUpperCase()) ?? null;
    const word = n.toLowerCase().replace(/\(.*?\)/g, '').trim().split(/\s+/)[0];
    if (!word) return null;
    return model.phases.find((p) => p.title.toLowerCase().startsWith(word)) ?? null;
}

function chainStep(p: LgPhase): string {
    const c = counts(p.tasks);
    const done = phaseDone(p);
    const label = p.story ? `<code>${escapeHtml(p.story)}</code> ${escapeHtml(p.title)}` : escapeHtml(p.title);
    return `<span class="lg-step${done ? ' lg-step--done' : ''}"><span class="lg-step-name">${label}</span> <span class="lg-step-count">${c.done}/${c.total}${done ? ` ${codicon('check')}` : ''}</span></span>`;
}

/** The chain card for an "Execution order" section made only of bullets, or null to leave the section as written. */
function dependencyChain(body: string[], model: LgTasksModel): string | null {
    const bullets: string[] = [];
    for (const line of body) {
        if (!line.trim()) continue;
        const m = line.match(/^[-*+]\s+(.+)$/);
        if (!m) return null;
        bullets.push(m[1]);
    }
    const arrow = bullets.findIndex((b) => /→|->/.test(b));
    if (arrow === -1) return null;
    const steps = bullets[arrow].replace(/\.\s*$/, '').split(/\s*(?:→|->)\s*/);
    const out: string[] = [];
    let known = 0;
    for (const step of steps) {
        const parts = step.split(/\s*(?:,|\band\b|\+)\s*/).filter(Boolean);
        const phases = parts.map((x) => resolveStep(x, model));
        if (phases.every(Boolean) && phases.length) {
            known++;
            const unique = [...new Set(phases as LgPhase[])];
            if (unique.length === 1) out.push(`<span class="lg-step-group">${chainStep(unique[0])}</span>`);
            else out.push(`<span class="lg-step-group lg-step-group--par">${unique.map(chainStep).join('')}${/disjoint|parallel/i.test(step) ? '<span class="lg-step-note">disjoint files, may run together</span>' : ''}</span>`);
        } else {
            out.push(`<span class="lg-step-group"><span class="lg-step"><span class="lg-step-name">${parseInline(step.trim())}</span></span></span>`);
        }
    }
    if (known === 0) return null;
    const notes = bullets.filter((_, i) => i !== arrow).map((b) => `<li>${parseInline(b)}</li>`).join('');
    const arrowIcon = `<span class="lg-arrow" aria-hidden="true">${codicon('arrow-right')}</span>`;
    return `<div class="lg-chain"><div class="lg-chain-eyebrow">${eyebrow('task', 'Execution order', `${plural(out.length, 'step')} · ${plural(model.tasks.length, 'task')}`)}</div>` +
        `<div class="lg-chain-steps">${out.join(arrowIcon)}</div>${notes ? `<ul class="lg-chain-notes">${notes}</ul>` : ''}</div>`;
}

/** Rewrite a tasks.md document into Ledger component lines; any other document passes through unchanged. */
export function preprocessLedgerTasks(markdown: string, currentTaskId: string | null = null): string {
    const lines = markdown.split('\n');
    active = null;
    runningId = currentTaskId;
    if (!isTasksDocument(lines)) return markdown;

    const model = parseTasksModel(lines);
    active = model;
    const out: string[] = [];
    let phase: LgPhase | null = null;
    let phaseIdx = -1;
    let inWave = false;
    let inLanes = false;
    let inFence = false;
    let titled = false;

    const closeWaves = (): void => {
        if (inWave) out.push(PHASE_CLOSE);
        if (inLanes) out.push('</div>');
        inWave = false;
        inLanes = false;
    };
    const closePhase = (): void => {
        if (!phase) return;
        closeWaves();
        out.push(PHASE_CLOSE);
        phase = null;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (lineKinds.FENCE.test(line)) { inFence = !inFence; out.push(line); continue; }
        if (inFence) { out.push(line); continue; }

        if (!titled && /^#\s/.test(line)) {
            titled = true;
            out.push(line, tasksHeader(model));
            continue;
        }

        const ph = line.match(lineKinds.PHASE_HEADING);
        if (ph) {
            closePhase();
            phase = model.phases[++phaseIdx];
            out.push(phaseOpen(phase));
            continue;
        }

        if (/^##\s/.test(line)) {
            closePhase();
            let end = i + 1;
            while (end < lines.length && !/^#{1,2}\s/.test(lines[end])) end++;
            const body = lines.slice(i + 1, end);
            if (/^##\s+Dependencies\s*(?:&|and)\s*Execution Order/i.test(line)) {
                const chain = dependencyChain(body, model);
                if (chain) { out.push(chain); i = end - 1; continue; }
            }
            if (/^##\s+User Story Mapping/i.test(line) && parseStoryMapping(body).size) { i = end - 1; continue; }
            out.push(line);
            continue;
        }

        if (!phase) { out.push(line); continue; }

        if (lineKinds.GOAL_LINE.test(line) || lineKinds.FILES_LINE.test(line) || lineKinds.WAIT_LINE.test(line)) continue;

        const w = line.match(lineKinds.WAVE_LINE);
        if (w) {
            if (inWave) out.push(PHASE_CLOSE);
            out.push(`${inLanes ? '' : '<div class="lg-lanes">'}${waveOpen(phase, Number(w[1]))}`);
            inLanes = true;
            inWave = true;
            continue;
        }

        const cp = line.match(lineKinds.CHECKPOINT_LINE);
        if (cp) {
            closeWaves();
            out.push(checkpoint(phase, cp[1]));
            continue;
        }

        out.push(line);
    }
    closePhase();
    return out.join('\n');
}

export interface TaskRowInput {
    text: string;
    checked: boolean;
    line: number;
    commentButton: string;
    capture: string;
}

/** One checkbox line as a Ledger task row; `text` is the raw markdown after `- [ ]`. */
export function renderTaskRow(input: TaskRowInput): string {
    const task = parseTaskText(input.text, input.checked);
    const known = task.id ? active?.tasks.find((t) => t.id === task.id) : undefined;
    if (known) {
        task.phaseStory = known.phaseStory;
        task.story = known.story;
    }
    const state = taskState(task, runningId);
    const classes = ['task-item', 'line', 'lg-task'];
    if (input.checked) classes.push('checked');
    if (state === 'running') classes.push('in-progress');
    const outside = !!task.story && task.story !== task.phaseStory;
    const storyChip = outside
        ? `<span class="lg-chip lg-task-story" title="${attr(active?.stories.get(task.story!) ?? task.story!)}">${escapeHtml(task.story!)}</span>`
        : '';
    const idChip = task.id ? `<span class="lg-chip lg-task-id">${stateIcon(state)}${escapeHtml(task.id)}</span>` : '';
    const files = task.files.map((f) =>
        `<button type="button" class="file-ref lg-chip lg-file" data-filename="${attr(f)}" title="${attr(f)}">${codicon('file')}<code>${escapeHtml(f.split('/').pop() ?? f)}</code></button>`).join('');
    const waits = task.waitsOn ? `<span class="lg-task-waits">waits on ${escapeHtml(task.waitsOn)}</span>` : '';
    const meta = files || waits ? `<span class="lg-task-meta">${files}${waits}</span>` : '';
    const done = task.doneWhen ? `<span class="lg-task-donewhen"><span>Done when</span> ${parseInline(task.doneWhen)}</span>` : '';
    const dataTask = task.id ? ` data-task-id="${attr(task.id)}" ${refAnchor(task.id, { family: 'task', status: state === 'blocked' ? 'fail' : state, label: 'Task' })}` : '';
    const story = task.story ? ` data-story="${attr(task.story)}"` : '';
    const checkedAttr = input.checked ? 'checked' : '';
    return `<li class="${classes.join(' ')}" data-line="${input.line}" data-state="${state}"${dataTask}${story}>` +
        input.commentButton +
        `<input type="checkbox" ${checkedAttr} data-line="${input.line}" aria-label="${attr(task.id ?? 'Task')} done">` +
        `<span class="task-text line-content lg-task-main"><span class="lg-task-ids">${idChip}${storyChip}</span>` +
        `<span class="lg-task-body"><span class="lg-task-title">${parseInline(task.desc)}</span>${meta}${done}</span>` +
        `<span class="lg-task-state lg-task-state--${state}">${stateIcon(state)}${STATE_LABEL[state]}</span></span>` +
        input.capture +
        `<div class="line-comment-slot"></div></li>\n`;
}

export function isTaskLine(line: string): boolean {
    return TASK_LINE.test(line);
}
