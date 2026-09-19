import { renderPreamble } from '../promptPreamble';
import { HISTORY_ENTRY_BY, STATUSES, STEP_NAMES } from '../../core/types/specContext';

const SPEC_DIR = 'specs/001-example';
const AT = '2026-08-26T12:00:00Z';

/** The preamble tells the assistant to close a step when it names the writer's finish verbs. */
function tellsAssistantToCloseStep(step: string, companionInstalled: boolean): boolean {
    const preamble = renderPreamble(step as never, SPEC_DIR, AT, companionInstalled);
    return preamble.includes(`--step ${step} --advance`) || preamble.includes(`--step ${step} --finish`);
}

describe('who closes a step, per pipeline', () => {
    // Stock spec-kit stamps no boundaries of its own, so every step the
    // assistant can close, it must — or the step sticks at its in-progress
    // status forever (#332).
    for (const step of ['specify', 'plan', 'tasks', 'clarify', 'analyze'] as const) {
        it(`asks the assistant to close ${step} in stock mode, where nothing else will`, () => {
            expect(tellsAssistantToCloseStep(step, false)).toBe(true);
        });
    }

    it('never asks the assistant to close implement — the tasks.md watcher does', () => {
        expect(tellsAssistantToCloseStep('implement', false)).toBe(false);
    });

    // Under companion the whole capture protocol lives in the command body
    // (presets/_parts/timing.md), which is stricter than this preamble: it
    // reserves specify, plan, tasks and implement for the command bodies and
    // after-step hooks. The preamble must not restate a weaker rule beside it —
    // the completion append is first-writer-wins, so an `ai` complete landing
    // first would permanently block the hook's close (the #509 failure).
    for (const step of STEP_NAMES) {
        it(`defers ${step} entirely to the command body under companion`, () => {
            const preamble = renderPreamble(step, SPEC_DIR, AT, true);
            expect(preamble).toContain("command's body carries the full");
            expect(tellsAssistantToCloseStep(step, true)).toBe(false);
        });
    }
});

describe('the embedded schema quotes the canonical vocabulary', () => {
    // The schema block ships on the stock path; companion commands carry their own.
    const preamble = renderPreamble('plan', SPEC_DIR, AT, false);

    it('lists every author a writer may stamp', () => {
        // A hand-typed copy of this block omitted `derive`, so the assistant
        // was told a record the writers really produce was invalid.
        for (const author of HISTORY_ENTRY_BY) {
            expect(preamble).toContain(`"${author}"`);
        }
    });

    it('lists every step and status', () => {
        for (const step of STEP_NAMES) {
            expect(preamble).toContain(`"${step}"`);
        }
        for (const status of STATUSES) {
            expect(preamble).toContain(`"${status}"`);
        }
    });
});
