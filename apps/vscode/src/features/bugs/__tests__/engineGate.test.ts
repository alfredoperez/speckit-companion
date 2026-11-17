import * as vscode from 'vscode';
import { answerReviewGate, coerceGateVerdict } from '../engineGate';
import type { EngineRun } from '../engineFormat';

const createTerminal = vscode.window.createTerminal as jest.Mock;
const { createMockTerminal } = vscode as unknown as { createMockTerminal: (o?: object) => unknown };
const defaultCreateTerminal = createTerminal.getMockImplementation();

const paused: EngineRun = {
    runId: '3471d74b',
    workflowId: 'bugfix',
    slug: 'star-crash',
    status: 'paused',
    steps: [],
    workSeconds: 0,
    pausedAt: 'review-assessment',
};

beforeEach(() => {
    createTerminal.mockClear();
    createTerminal.mockImplementation(() => createMockTerminal({ autoExitCode: 0 }));
});

afterEach(() => createTerminal.mockImplementation(defaultCreateTerminal));

describe('answerReviewGate', () => {
    it.each([
        ['approve', '1'],
        ['reject', '2'],
    ] as const)('resumes the run in a terminal and types the %s choice at the gate', async (verdict, choice) => {
        const terminal = await answerReviewGate('/work/project', paused, verdict);

        expect(createTerminal).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/work/project' }));
        expect(terminal!.show).toHaveBeenCalled();
        expect(createTerminal.mock.results[0].value.__commands()).toEqual(['specify workflow resume 3471d74b', choice]);
    });

    it('opens nothing for a run that is not waiting at the bundled review gate', async () => {
        expect(await answerReviewGate('/work/project', { ...paused, pausedAt: 'sign-off' }, 'approve')).toBeUndefined();
        expect(await answerReviewGate('/work/project', { ...paused, workflowId: 'custom' }, 'approve')).toBeUndefined();
        expect(await answerReviewGate('/work/project', { ...paused, pausedAt: undefined }, 'approve')).toBeUndefined();
        expect(await answerReviewGate('/work/project', undefined, 'approve')).toBeUndefined();
        expect(createTerminal).not.toHaveBeenCalled();
    });

    it('opens nothing for a run id that is not safe on a command line', async () => {
        for (const runId of ['x; rm -rf ~', '-h', '']) {
            expect(await answerReviewGate('/work/project', { ...paused, runId }, 'approve')).toBeUndefined();
        }
        expect(createTerminal).not.toHaveBeenCalled();
    });
});

describe('coerceGateVerdict', () => {
    it('accepts only approve and reject', () => {
        expect(coerceGateVerdict('approve')).toBe('approve');
        expect(coerceGateVerdict('reject')).toBe('reject');
        expect(coerceGateVerdict('abort')).toBeUndefined();
        expect(coerceGateVerdict(1)).toBeUndefined();
    });
});
