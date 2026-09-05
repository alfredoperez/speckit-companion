import * as vscode from 'vscode';

jest.mock('../../../core/telemetry', () => ({
    sendTelemetryEvent: jest.fn(),
    reportSpecCreated: jest.fn(),
    workflowTelemetryId: (n: string | undefined) =>
        n === 'companion' ? 'companion' : n === 'speckit' || n === 'default' ? 'speckit' : 'custom',
    getSpecTelemetryContext: jest.fn().mockReturnValue({ specInstanceId: 'id-123' }),
    SPEC_COMPLETED_EVENT: 'spec.completed',
    SPEC_CREATED_EVENT: 'spec.created',
}));
jest.mock('../../../ai-providers/aiProvider', () => ({
    getConfiguredProviderType: jest.fn().mockReturnValue('claudeCode'),
    formatCommandForProvider: (c: string) => c,
}));
jest.mock('../specExplorerProvider', () => ({ SpecExplorerProvider: jest.fn() }));
jest.mock('../../steering/steeringExplorerProvider', () => ({ SteeringExplorerProvider: jest.fn() }));
jest.mock('../../spec-viewer/specViewerProvider', () => ({ SpecViewerProvider: jest.fn() }));
jest.mock('../../../speckit/taskProgressService', () => ({
    parseTasksFile: jest.fn(),
    detectNewlyCompletedPhases: jest.fn(),
    extractSpecNameFromPath: jest.fn(),
    initializeCache: jest.fn(),
}));
jest.mock('../../../core/utils/notificationUtils', () => ({
    NotificationUtils: { showPhaseCompleteNotification: jest.fn() },
}));
jest.mock('../../../core/specDirectoryResolver', () => ({
    getFileWatcherPatterns: jest.fn().mockReturnValue({ specs: [], tasks: [], markdown: [], specContext: [] }),
}));
jest.mock('../specContextReader', () => ({
    readSpecContextSync: jest.fn(),
    SPEC_CONTEXT_FILENAME: '.spec-context.json',
}));
jest.mock('../stepLifecycle', () => ({ completeStep: jest.fn() }));
jest.mock('../implementCloseGuard', () => ({ shouldCloseImplement: jest.fn().mockReturnValue(false) }));

import { handleSpecContextChange } from '../../fileWatchers';
import { transitionCache } from '../transitionLogger';
import { sendTelemetryEvent, reportSpecCreated } from '../../../core/telemetry';

const specViewer = { refreshContextIfDisplaying: jest.fn().mockResolvedValue(undefined) } as never;
const outputChannel = { appendLine: jest.fn() } as never;

async function fireContextWrite(
    specDir: string,
    context: Record<string, unknown>,
    opts?: { created?: boolean }
): Promise<void> {
    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValueOnce(
        Buffer.from(JSON.stringify(context))
    );
    await handleSpecContextChange(
        vscode.Uri.file(`${specDir}/.spec-context.json`),
        specViewer,
        outputChannel,
        opts
    );
}

function completedEvents(): unknown[][] {
    return (sendTelemetryEvent as jest.Mock).mock.calls.filter(c => c[0] === 'spec.completed');
}

describe('the completion seam (single spec.completed owner)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        transitionCache.clear();
    });

    it('fires spec.completed exactly once per transition into completed', async () => {
        await fireContextWrite('/ws/specs/a', { currentStep: 'implement', status: 'implementing', history: [] });
        await fireContextWrite('/ws/specs/a', { currentStep: 'implement', status: 'completed', history: [] });

        expect(completedEvents()).toHaveLength(1);
        expect(completedEvents()[0][1]).toMatchObject({ specInstanceId: 'id-123' });

        // A re-write of completed (e.g. a second completion path landing) never re-fires.
        await fireContextWrite('/ws/specs/a', { currentStep: 'implement', status: 'completed', history: [] });
        expect(completedEvents()).toHaveLength(1);
    });

    it('covers every completion path through the one seam — one event per spec transition', async () => {
        for (const dir of ['/ws/specs/sidebar', '/ws/specs/viewer', '/ws/specs/pipeline']) {
            await fireContextWrite(dir, { currentStep: 'implement', status: 'implementing', history: [] });
            await fireContextWrite(dir, { currentStep: 'implement', status: 'completed', history: [] });
        }

        expect(completedEvents()).toHaveLength(3);
    });

    it('seeds silently on first sight: an already-completed spec never fires a stale burst', async () => {
        await fireContextWrite('/ws/specs/old', { currentStep: 'implement', status: 'completed', history: [] }, { created: true });
        await fireContextWrite('/ws/specs/old', { currentStep: 'implement', status: 'completed', history: [] });

        expect(completedEvents()).toHaveLength(0);
    });

    it('seeds silently on a first-sight change event too (no created flag)', async () => {
        await fireContextWrite('/ws/specs/unseen', { currentStep: 'implement', status: 'completed', history: [] });

        expect(completedEvents()).toHaveLength(0);
    });

    describe('watcher spec.created (terminal-created specs)', () => {
        it('emits for an id-less, non-sample context and mints the id via the back-fill machinery', async () => {
            await fireContextWrite(
                '/ws/specs/terminal',
                { workflow: 'speckit', currentStep: 'specify', status: 'specifying', history: [] },
                { created: true }
            );

            expect(reportSpecCreated).toHaveBeenCalledTimes(1);
            expect((reportSpecCreated as jest.Mock).mock.calls[0][0]).toMatchObject({
                workflow: 'speckit',
                source: 'watcher',
                specInstanceId: 'id-123',
            });
        });

        it('never emits for a context carrying a telemetryInstanceId (form-created, already counted)', async () => {
            await fireContextWrite(
                '/ws/specs/form-created',
                { workflow: 'companion', telemetryInstanceId: 'seeded-id', currentStep: 'specify', status: 'specifying', history: [] },
                { created: true }
            );

            expect(reportSpecCreated).not.toHaveBeenCalled();
        });

        it('never emits for the seeded sample (sampleSpec marker)', async () => {
            await fireContextWrite(
                '/ws/specs/sample-command-palette',
                { workflow: 'speckit', sampleSpec: true, currentStep: 'tasks', status: 'ready-to-implement', history: [] },
                { created: true }
            );

            expect(reportSpecCreated).not.toHaveBeenCalled();
        });
    });
});
