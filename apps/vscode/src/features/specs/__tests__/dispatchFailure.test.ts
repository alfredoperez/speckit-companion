import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { isSettledStatus, type HistoryEntry, type SpecContext } from '../../../core/types/specContext';
import { runInTerminal } from '../../../core/utils/terminalUtils';
import { watchStepDispatch } from '../dispatchFailure';
import { startStep } from '../stepLifecycle';
import { register, track, _resetForTests } from '../terminalStepTracker';
import { getFooterActions } from '../../spec-viewer/footerActions';
import { deriveStepHistory } from '../stepHistoryDerivation';
import { FooterActionIds } from '../../../core/constants';

const mock = vscode as unknown as {
    createMockTerminal: (o?: { name?: string; shellIntegration?: boolean }) => any;
    __fireShellExecutionEnd: (terminal: unknown, execution: unknown, exitCode: number | undefined) => void;
    __fireCloseTerminal: (terminal: unknown) => void;
};
const showErrorMessage = vscode.window.showErrorMessage as jest.Mock;

const at = (minute: number) => `2026-09-30T10:${String(minute).padStart(2, '0')}:00.000Z`;
const boundary = (step: HistoryEntry['step'], kind: 'start' | 'complete', minute: number): HistoryEntry =>
    ({ step, substep: null, kind, by: 'extension', at: at(minute) });

let specDir: string;

function writeRecord(ctx: Partial<SpecContext>): void {
    const full: SpecContext = { workflow: 'speckit', specName: 'Login', branch: 'main', currentStep: 'specify', status: 'draft', history: [], ...ctx };
    fs.writeFileSync(path.join(specDir, '.spec-context.json'), JSON.stringify(full, null, 2));
}

function readRecord(): SpecContext {
    return JSON.parse(fs.readFileSync(path.join(specDir, '.spec-context.json'), 'utf8'));
}

async function settle(): Promise<void> {
    for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve));
}

/** The viewer's approve path from a settled specify: watch, start plan, run its command. Returns the report's settlement. */
async function approvePlan(terminal: any): Promise<{ reported: Promise<void> }> {
    const watch = watchStepDispatch({ specDir, step: 'plan', fromStep: 'specify' });
    await startStep(specDir, 'plan', 'extension');
    watch.started();
    await runInTerminal(terminal, 'claude "/speckit-plan specs/012-login"');
    return { reported: watch.attach(terminal) };
}

beforeEach(() => {
    specDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-failure-'));
    showErrorMessage.mockReset();
});

afterEach(() => {
    fs.rmSync(specDir, { recursive: true, force: true });
});

describe('a step whose command fails before the run records anything', () => {
    beforeEach(() => {
        writeRecord({ currentStep: 'specify', status: 'specified', history: [boundary('specify', 'start', 0), boundary('specify', 'complete', 5)] });
    });

    it('stops showing the step as running, without recording it complete', async () => {
        const terminal = mock.createMockTerminal({ name: 'SpecKit - Claude Code' });
        const { reported } = await approvePlan(terminal);
        expect(readRecord().status).toBe('planning');

        mock.__fireShellExecutionEnd(terminal, terminal.executions[0], 127);
        await reported;

        const ctx = readRecord();
        expect(ctx.status).toBe('specified');
        expect(ctx.currentStep).toBe('specify');
        expect(ctx.history.some(e => e.step === 'plan' && e.kind === 'complete')).toBe(false);
        // A settled status is the gate the viewer's in-flight check reads first; the rolled-back attempt derives no plan entry, so no timer or lock.
        expect(isSettledStatus(ctx.status)).toBe(true);
        expect(deriveStepHistory(ctx.history, ctx.currentStep, ctx.status).plan).toBeUndefined();
    });

    it('keeps the dispatch start, because history only grows', async () => {
        const terminal = mock.createMockTerminal();
        const { reported } = await approvePlan(terminal);
        const before = readRecord().history;

        mock.__fireShellExecutionEnd(terminal, terminal.executions[0], 1);
        await reported;

        const after = readRecord().history;
        expect(after.slice(0, before.length)).toEqual(before);
        expect(after.filter(e => e.step === 'plan')).toEqual([expect.objectContaining({ kind: 'start' })]);
    });

    it('offers the step forward again, so the user can retry', async () => {
        const terminal = mock.createMockTerminal();
        const { reported } = await approvePlan(terminal);
        mock.__fireShellExecutionEnd(terminal, terminal.executions[0], 127);
        await reported;

        const ctx = readRecord();
        const ids = getFooterActions(ctx, ctx.currentStep).map(a => a.id);
        expect(ids).toContain(FooterActionIds.APPROVE);
    });

    it('tells the user plainly that the command did not run, naming the terminal and the exit code', async () => {
        const terminal = mock.createMockTerminal({ name: 'SpecKit - Claude Code' });
        const { reported } = await approvePlan(terminal);
        mock.__fireShellExecutionEnd(terminal, terminal.executions[0], 127);
        await reported;

        expect(showErrorMessage).toHaveBeenCalledTimes(1);
        const [message, action] = showErrorMessage.mock.calls[0];
        expect(message).toContain('Plan did not run');
        expect(message).toContain('"SpecKit - Claude Code" terminal');
        expect(message).toContain('exited with code 127');
        expect(action).toBe('Show Terminal');
    });

    it('shows the terminal when the user asks to see it', async () => {
        showErrorMessage.mockResolvedValueOnce('Show Terminal');
        const terminal = mock.createMockTerminal();
        const { reported } = await approvePlan(terminal);
        terminal.show.mockClear();
        mock.__fireShellExecutionEnd(terminal, terminal.executions[0], 127);
        await reported;
        expect(terminal.show).toHaveBeenCalled();
    });

    it('records nothing when the failed terminal is later closed', async () => {
        _resetForTests();
        register({} as vscode.ExtensionContext);
        const terminal = mock.createMockTerminal();
        const { reported } = await approvePlan(terminal);
        track(terminal, specDir, 'plan');
        mock.__fireShellExecutionEnd(terminal, terminal.executions[0], 127);
        await reported;
        const afterFailure = readRecord().history.length;

        mock.__fireCloseTerminal(terminal);
        await settle();

        expect(readRecord().history).toHaveLength(afterFailure);
        expect(readRecord().history.some(e => e.step === 'plan' && e.kind === 'complete')).toBe(false);
    });
});

describe('a step whose command runs', () => {
    beforeEach(() => {
        writeRecord({ currentStep: 'specify', status: 'specified', history: [boundary('specify', 'start', 0), boundary('specify', 'complete', 5)] });
    });

    it('leaves the running state alone when the command exits cleanly', async () => {
        const terminal = mock.createMockTerminal();
        const { reported } = await approvePlan(terminal);
        const before = readRecord();

        mock.__fireShellExecutionEnd(terminal, terminal.executions[0], 0);
        await reported;

        expect(readRecord()).toEqual(before);
        expect(showErrorMessage).not.toHaveBeenCalled();
    });

    it('leaves the record alone when the run had already recorded something before a non-zero exit', async () => {
        const terminal = mock.createMockTerminal();
        const { reported } = await approvePlan(terminal);
        const ctx = readRecord();
        writeRecord({ ...ctx, history: [...ctx.history, { step: 'plan', substep: 'research', kind: 'start', by: 'ai', at: at(9) }] });
        const recorded = readRecord();

        mock.__fireShellExecutionEnd(terminal, terminal.executions[0], 130);
        await reported;

        expect(readRecord()).toEqual(recorded);
        expect(showErrorMessage).not.toHaveBeenCalled();
    });

    it('watches nothing when the command was typed without shell integration', async () => {
        jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
        try {
            const terminal = mock.createMockTerminal({ shellIntegration: false });
            const watch = watchStepDispatch({ specDir, step: 'plan', fromStep: 'specify' });
            await startStep(specDir, 'plan', 'extension');
            watch.started();
            const pending = runInTerminal(terminal, 'claude');
            await jest.advanceTimersByTimeAsync(120_000);
            await pending;
            await watch.attach(terminal);
        } finally {
            jest.useRealTimers();
        }
        await settle();
        expect(readRecord().status).toBe('planning');
        expect(showErrorMessage).not.toHaveBeenCalled();
    });
});

describe('re-running the step the run is on', () => {
    it('returns the step to the status it had, adding no history', async () => {
        writeRecord({
            currentStep: 'plan',
            status: 'planned',
            history: [boundary('specify', 'start', 0), boundary('specify', 'complete', 5), boundary('plan', 'start', 6), boundary('plan', 'complete', 20)],
        });
        const before = readRecord().history;
        const terminal = mock.createMockTerminal();

        const watch = watchStepDispatch({ specDir, step: 'plan' });
        await startStep(specDir, 'plan', 'extension');
        watch.started();
        expect(readRecord().status).toBe('planning');
        await runInTerminal(terminal, 'claude "/speckit-plan"');
        const reported = watch.attach(terminal);

        mock.__fireShellExecutionEnd(terminal, terminal.executions[0], 127);
        await reported;

        const ctx = readRecord();
        expect(ctx.status).toBe('planned');
        expect(ctx.currentStep).toBe('plan');
        expect(ctx.history).toEqual(before);
    });
});

describe('a spec with no run record before the dispatch', () => {
    it('falls back to the step the click left, settled', async () => {
        const terminal = mock.createMockTerminal();
        const watch = watchStepDispatch({ specDir, step: 'plan', fromStep: 'specify' });
        await startStep(specDir, 'plan', 'extension');
        watch.started();
        await runInTerminal(terminal, 'claude');
        const reported = watch.attach(terminal);

        mock.__fireShellExecutionEnd(terminal, terminal.executions[0], 127);
        await reported;

        const ctx = readRecord();
        expect(ctx.status).toBe('specified');
        expect(ctx.currentStep).toBe('specify');
        // A settled status is the gate the viewer's in-flight check reads first; the rolled-back attempt derives no plan entry, so no timer or lock.
        expect(isSettledStatus(ctx.status)).toBe(true);
        expect(deriveStepHistory(ctx.history, ctx.currentStep, ctx.status).plan).toBeUndefined();
    });
});
