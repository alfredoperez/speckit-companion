import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { judgeAutoFold } from './auto-folds.mjs';

const WS = '/Users/me/dev/sandboxes/e2e-2026-11-08-1002-canvas2';
const at = (ms) => new Date(Date.parse('2026-11-08T16:23:29.609Z') + ms).toISOString();
const boundary = (step, kind, ms, by = 'extension') => ({ step, kind, by, at: at(ms) });
const foldedHistory = [
    { step: 'specify', kind: 'start', by: 'extension', at: '2026-11-08T16:21:43.126Z' },
    boundary('specify', 'complete', -144),
    boundary('plan', 'start', 0), boundary('plan', 'complete', 1), boundary('tasks', 'start', 2), boundary('tasks', 'complete', 3),
    { step: 'implement', kind: 'start', by: 'extension', at: '2026-11-08T16:23:37.885Z' },
];

// The 2026-11-08 run: the model read the tasks and implement skills while folding, and never ran plan or tasks.
const nov8 = {
    tools: [
        { name: 'view', detail: `${WS}/.github/skills/speckit-companion-auto/SKILL.md` },
        { name: 'glob', detail: '.github/skills/speckit-companion-*/SKILL.md' },
        { name: 'view', detail: `${WS}/.github/skills/speckit-companion-implement/SKILL.md` },
        { name: 'view', detail: `${WS}/.github/skills/speckit-companion-tasks/SKILL.md` },
        { name: 'rg', detail: '^<!-- speckit-companion:node|^## ' },
        { name: 'bash', detail: 'python3 .specify/extensions/companion/scripts/write-context.py --feature-dir specs/003-footer-app-name --set size=simple' },
    ],
    replies: ['The spec is drafted and classified as a small change, so the specified fast path applies.'],
    context: { size: 'simple', history: foldedHistory },
    tasksWritten: true,
};

describe('canvas-auto-folds judgement', () => {
    it('passes the 2026-11-08 run, where the model only viewed the tasks skill', () => {
        const verdict = judgeAutoFold(nov8);
        assert.equal(verdict.result, 'PASS', verdict.evidence);
        assert.match(verdict.evidence, /no plan or tasks command ran; folded in 3ms; said it folded/);
    });

    it('treats a view, glob or search of the command files as a read, not a run', () => {
        const reads = [
            { name: 'view', detail: `${WS}/.specify/extensions/companion/commands/speckit.companion.plan.md` },
            { name: 'glob', detail: '.github/skills/speckit-companion-plan/**' },
            { name: 'bash', detail: `cat ${WS}/.github/skills/speckit-companion-tasks/SKILL.md` },
            { name: 'bash', detail: 'ls .github/skills/speckit-companion-tasks/' },
            { name: 'bash', detail: 'grep -rn speckit-companion-plan .github' },
        ];
        assert.equal(judgeAutoFold({ ...nov8, tools: [...nov8.tools, ...reads] }).result, 'PASS');
    });

    it('fails a run that really invoked plan, naming the whole call', () => {
        const detail = `speckit-companion-plan specs/003-footer-app-name ${'with a long argument '.repeat(5)}end`;
        const history = [...foldedHistory.slice(0, 2), boundary('plan', 'start', 0, 'extension'), boundary('plan', 'complete', 240000, 'ai'), boundary('tasks', 'start', 240001), boundary('tasks', 'complete', 300000, 'ai')];
        const verdict = judgeAutoFold({ ...nov8, tools: [...nov8.tools, { name: 'skill', detail }], context: { size: 'simple', history } });
        assert.equal(verdict.result, 'FAIL');
        assert.ok(verdict.evidence.includes(`skill: ${detail}`), verdict.evidence);
        assert.match(verdict.evidence, /not written by the extension/);
    });

    it('fails when the boundaries are by the extension but minutes apart', () => {
        const history = foldedHistory.map((h) => (h.step === 'tasks' && h.kind === 'complete' ? boundary('tasks', 'complete', 180000) : h));
        const verdict = judgeAutoFold({ ...nov8, context: { size: 'simple', history } });
        assert.equal(verdict.result, 'FAIL');
        assert.match(verdict.evidence, /180s apart, not in one fold/);
    });

    it('fails when plan or tasks is missing from the record, or tasks.md was not written', () => {
        const noTasks = foldedHistory.filter((h) => h.step !== 'tasks');
        assert.match(judgeAutoFold({ ...nov8, context: { history: noTasks } }).evidence, /not both recorded/);
        assert.match(judgeAutoFold({ ...nov8, tasksWritten: false }).evidence, /no tasks\.md was written/);
        const noTime = foldedHistory.map((h) => (h.step === 'plan' && h.kind === 'start' ? { ...h, at: undefined } : h));
        assert.match(judgeAutoFold({ ...nov8, context: { history: noTime } }).evidence, /no valid timestamp/);
    });
});
