/**
 * Reads tasks.md into phases, waves and tasks. Pure: no HTML, no DOM. Works on
 * stock spec-kit files (no run record) and on Companion files alike.
 */

export type TaskState = 'done' | 'running' | 'blocked' | 'todo';

export interface LgTask {
    id: string | null;
    done: boolean;
    parallel: boolean;
    story: string | null;
    phaseStory: string | null;
    desc: string;
    files: string[];
    doneWhen: string | null;
    waitsOn: string | null;
    blocked: boolean;
    wave: number | null;
}

export interface LgWave {
    num: number;
    note: string;
    after: number | null;
    tasks: LgTask[];
}

export interface LgPhase {
    num: number;
    title: string;
    story: string | null;
    storyTitle: string | null;
    priority: 1 | 2 | 3 | null;
    mvp: boolean;
    marked: boolean;
    goal: string | null;
    files: string[];
    tasks: LgTask[];
    waves: LgWave[];
}

export interface LgTasksModel {
    phases: LgPhase[];
    tasks: LgTask[];
    stories: Map<string, string>;
}

export const TASK_LINE = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const PHASE_HEADING = /^##\s+Phase\s+(\d+)\s*[:\-–—]\s*(.+?)\s*$/;
const WAVE_LINE = /^\*\*Wave\s+(\d+)\s*[—–:-]?\s*(.*?):?\*\*\s*$/i;
const WAIT_LINE = /^\*\*[^*]*\bWait for\b.*\*\*\s*$/i;
const GOAL_LINE = /^\*\*Goal(?:\s*:)?\*\*\s*:?\s*(.+)$/i;
const FILES_LINE = /^(?:\*\*)?Files(?:\s*:)?(?:\*\*)?\s*:\s*(.+)$/i;
const CHECKPOINT_LINE = /^\*\*Checkpoint(?:\s*:)?\*\*\s*:?\s*(.*)$/i;
const FENCE = /^\s*(```|~~~)/;
const DONE_MARK = /\s*✅\s*/g;

export const lineKinds = { WAVE_LINE, WAIT_LINE, GOAL_LINE, FILES_LINE, CHECKPOINT_LINE, PHASE_HEADING, FENCE };

const looksLikePath = (s: string): boolean => /^[\w@.\-/\\]+\.[A-Za-z0-9]{1,8}$/.test(s) || /^[\w@.\-]+\/[\w@.\-/]+\/?$/.test(s);

function splitPaths(text: string): string[] {
    const ticked = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const parts = ticked.length ? ticked : text.split(/[,;]\s*/).map((s) => s.trim());
    return parts.filter(looksLikePath);
}

/** Parse one task line's text (after the `[ ]`). `raw` keeps inline markdown for the caller to render. */
export function parseTaskText(text: string, done: boolean): LgTask {
    let rest = text.trim();
    const idm = rest.match(/^(?:\*\*)?(T\d+[a-z]?)(?:\*\*)?(?=\s|$)\s*/i);
    const id = idm ? idm[1].toUpperCase() : null;
    if (idm) rest = rest.slice(idm[0].length);
    let parallel = false;
    let story: string | null = null;
    for (;;) {
        const m = rest.match(/^\[(P|US\d+)\]\s*/i);
        if (!m) break;
        if (m[1].toUpperCase() === 'P') parallel = true;
        else story = m[1].toUpperCase();
        rest = rest.slice(m[0].length);
    }

    let files: string[] = [];
    const segs = rest.split(/\s+[·•]\s+/);
    if (segs.length > 1) {
        const tail = splitPaths(segs[segs.length - 1].replace(/^in\s+/i, ''));
        if (tail.length) {
            files = tail;
            rest = segs.slice(0, -1).join(' · ');
        }
    }

    let doneWhen: string | null = null;
    const dw = rest.match(/(?:\s[—–;-]\s*|\s*\()(?:done when|acceptance)\s*:?\s*(.+?)\)?\s*$/i);
    if (dw && dw.index !== undefined) {
        doneWhen = dw[1].trim();
        rest = rest.slice(0, dw.index).trim();
    }

    const waits = rest.match(/\b(?:waits?\s+on|blocked\s+(?:by|on))\s+(T\d+[a-z]?)/i);
    const blocked = !done && (/⛔|\[blocked\]/i.test(rest) || /\bblocked\s+(?:by|on)\b/i.test(rest));
    return { id, done, parallel, story, phaseStory: null, desc: rest.replace(/\s*⛔\s*/g, ' ').trim(), files, doneWhen, waitsOn: waits ? waits[1].toUpperCase() : null, blocked, wave: null };
}

function parsePhaseTitle(raw: string): Pick<LgPhase, 'title' | 'story' | 'storyTitle' | 'priority' | 'mvp' | 'marked'> {
    let title = raw;
    const marked = /✅/.test(title);
    title = title.replace(DONE_MARK, ' ');
    const mvp = /🎯|\bMVP\b/.test(title);
    title = title.replace(/🎯/g, '').replace(/\bMVP\b/g, '');
    let priority: 1 | 2 | 3 | null = null;
    const p = title.match(/\(P([1-5])\)/);
    if (p) {
        priority = Math.min(Number(p[1]), 3) as 1 | 2 | 3;
        title = title.replace(/\(P[1-5]\)/, '');
    }
    title = title.replace(/\s{2,}/g, ' ').trim();
    const us = title.match(/^User Story\s+(\d+)\s*[:\-–—]\s*(.+)$/i);
    if (us) return { title: us[2].trim(), story: `US${us[1]}`, storyTitle: us[2].trim(), priority, mvp, marked };
    return { title, story: null, storyTitle: null, priority, mvp, marked };
}

/** Rows of a `| US1 | User Story 5 — Title (P1) |` mapping table. */
export function parseStoryMapping(lines: string[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const line of lines) {
        const m = line.match(/^\|\s*(US\d+)\s*\|\s*(.+?)\s*\|\s*$/);
        if (!m) continue;
        const title = m[2].replace(/^User Story\s+\d+\s*[:\-–—]\s*/i, '').replace(/\s*\(P[1-5]\)\s*$/, '').trim();
        map.set(m[1].toUpperCase(), title);
    }
    return map;
}

export function isTasksDocument(lines: string[]): boolean {
    let inFence = false;
    let tasks = 0;
    let phases = 0;
    let checklist = false;
    for (const line of lines) {
        if (FENCE.test(line)) { inFence = !inFence; continue; }
        if (inFence) continue;
        if (/^#\s+.*checklist/i.test(line)) checklist = true;
        if (PHASE_HEADING.test(line)) phases++;
        const m = line.match(TASK_LINE);
        if (m && /^(?:\*\*)?T\d+/i.test(m[2])) tasks++;
    }
    return !checklist && tasks > 0 && phases > 0;
}

export function parseTasksModel(lines: string[]): LgTasksModel {
    const phases: LgPhase[] = [];
    const tasks: LgTask[] = [];
    let cur: LgPhase | null = null;
    let wave: LgWave | null = null;
    let waitSeen = false;
    let inFence = false;

    for (const line of lines) {
        if (FENCE.test(line)) { inFence = !inFence; continue; }
        if (inFence) continue;
        const ph = line.match(PHASE_HEADING);
        if (ph) {
            cur = { num: Number(ph[1]), ...parsePhaseTitle(ph[2]), goal: null, files: [], tasks: [], waves: [] };
            phases.push(cur);
            wave = null;
            waitSeen = false;
            continue;
        }
        if (/^##\s/.test(line)) { cur = null; wave = null; continue; }
        if (!cur) continue;

        const w = line.match(WAVE_LINE);
        if (w) {
            const num = Number(w[1]);
            wave = { num, note: w[2].trim(), after: waitSeen ? num - 1 : null, tasks: [] };
            cur.waves.push(wave);
            waitSeen = false;
            continue;
        }
        if (WAIT_LINE.test(line)) { waitSeen = true; continue; }
        if (CHECKPOINT_LINE.test(line)) { wave = null; continue; }
        const goal = line.match(GOAL_LINE);
        if (goal) { cur.goal = goal[1].trim(); continue; }
        const files = line.match(FILES_LINE);
        if (files) { cur.files = splitPaths(files[1]); continue; }

        const t = line.match(TASK_LINE);
        if (t && /^\s{0,1}[-*+]/.test(line)) {
            const task = parseTaskText(t[2], t[1].toLowerCase() === 'x');
            task.wave = wave ? wave.num : null;
            task.phaseStory = cur.story;
            if (!task.story) task.story = cur.story;
            cur.tasks.push(task);
            tasks.push(task);
            wave?.tasks.push(task);
        }
    }

    const stories = new Map<string, string>();
    for (const p of phases) if (p.story && p.storyTitle) stories.set(p.story, p.storyTitle);
    for (const [k, v] of parseStoryMapping(lines)) if (!stories.has(k)) stories.set(k, v);
    return { phases, tasks, stories };
}

export function taskState(t: LgTask, runningId: string | null): TaskState {
    if (t.done) return 'done';
    if (runningId && t.id === runningId) return 'running';
    if (t.blocked) return 'blocked';
    return 'todo';
}

export function phaseDone(p: LgPhase): boolean {
    return p.marked || (p.tasks.length > 0 && p.tasks.every((t) => t.done));
}
