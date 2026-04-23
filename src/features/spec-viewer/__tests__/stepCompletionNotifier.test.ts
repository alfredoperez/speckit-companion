import * as vscode from 'vscode';
import { StepCompletionNotifier } from '../stepCompletionNotifier';
import { SpecContext, StepHistoryEntry } from '../../../core/types/specContext';

jest.mock('vscode');

const SPEC_DIR = '/workspace/specs/074-elapsed-timer-notification';
const OTHER_SPEC_DIR = '/workspace/specs/099-other';

function ctx(history: Record<string, StepHistoryEntry>): SpecContext {
    return {
        workflow: 'sdd',
        specName: 'Test',
        branch: 'main',
        currentStep: 'specify',
        status: 'specifying',
        stepHistory: history,
        transitions: [],
    };
}

function entry(startedAt: string, completedAt: string | null = null): StepHistoryEntry {
    return { startedAt, completedAt };
}

describe('StepCompletionNotifier', () => {
    let showInfo: jest.Mock;
    let getConfig: jest.Mock;
    let configGet: jest.Mock;

    beforeEach(() => {
        configGet = jest.fn().mockReturnValue(true);
        getConfig = vscode.workspace.getConfiguration as jest.Mock;
        getConfig.mockReturnValue({ get: configGet });
        showInfo = vscode.window.showInformationMessage as jest.Mock;
        showInfo.mockReset();
        showInfo.mockResolvedValue(undefined);
        (vscode.commands.executeCommand as jest.Mock).mockReset();
    });

    describe('seeding on first observe', () => {
        it('does not notify for steps already complete when first observed', () => {
            const notifier = new StepCompletionNotifier();

            const next = ctx({
                specify: entry('2026-04-23T10:00:00Z', '2026-04-23T10:05:00Z'),
                plan: entry('2026-04-23T10:06:00Z', '2026-04-23T10:10:00Z'),
            });

            notifier.observe(SPEC_DIR, null, next);

            expect(showInfo).not.toHaveBeenCalled();
        });
    });

    describe('live completion transitions', () => {
        it('notifies exactly once when completedAt flips null → timestamp', () => {
            const notifier = new StepCompletionNotifier();

            const first = ctx({ plan: entry('2026-04-23T10:06:00Z', null) });
            notifier.observe(SPEC_DIR, null, first);
            expect(showInfo).not.toHaveBeenCalled();

            const second = ctx({ plan: entry('2026-04-23T10:06:00Z', '2026-04-23T10:10:00Z') });
            notifier.observe(SPEC_DIR, first, second);

            expect(showInfo).toHaveBeenCalledTimes(1);
            expect(showInfo).toHaveBeenCalledWith(
                'Spec 074 · Plan complete',
                'Open spec'
            );
        });

        it('does not re-notify for the same completion on subsequent observes', () => {
            const notifier = new StepCompletionNotifier();
            const a = ctx({ plan: entry('2026-04-23T10:06:00Z', null) });
            const b = ctx({ plan: entry('2026-04-23T10:06:00Z', '2026-04-23T10:10:00Z') });

            notifier.observe(SPEC_DIR, null, a);
            notifier.observe(SPEC_DIR, a, b);
            notifier.observe(SPEC_DIR, b, b);

            expect(showInfo).toHaveBeenCalledTimes(1);
        });

        it('stays silent when speckit.notifications.stepComplete is false', () => {
            configGet.mockReturnValue(false);
            const notifier = new StepCompletionNotifier();

            const first = ctx({ plan: entry('2026-04-23T10:06:00Z', null) });
            const second = ctx({ plan: entry('2026-04-23T10:06:00Z', '2026-04-23T10:10:00Z') });
            notifier.observe(SPEC_DIR, null, first);
            notifier.observe(SPEC_DIR, first, second);

            expect(showInfo).not.toHaveBeenCalled();
            expect(configGet).toHaveBeenCalledWith('notifications.stepComplete', true);
        });
    });

    describe('per-spec isolation', () => {
        it('tracks dedupe independently across specs', () => {
            const notifier = new StepCompletionNotifier();

            const aFirst = ctx({ plan: entry('2026-04-23T10:00:00Z', null) });
            const aSecond = ctx({ plan: entry('2026-04-23T10:00:00Z', '2026-04-23T10:05:00Z') });
            notifier.observe(SPEC_DIR, null, aFirst);
            notifier.observe(SPEC_DIR, aFirst, aSecond);

            const bFirst = ctx({ plan: entry('2026-04-23T11:00:00Z', null) });
            const bSecond = ctx({ plan: entry('2026-04-23T11:00:00Z', '2026-04-23T11:04:00Z') });
            notifier.observe(OTHER_SPEC_DIR, null, bFirst);
            notifier.observe(OTHER_SPEC_DIR, bFirst, bSecond);

            expect(showInfo).toHaveBeenCalledTimes(2);
            expect(showInfo).toHaveBeenNthCalledWith(1, 'Spec 074 · Plan complete', 'Open spec');
            expect(showInfo).toHaveBeenNthCalledWith(2, 'Spec 099 · Plan complete', 'Open spec');
        });
    });
});
