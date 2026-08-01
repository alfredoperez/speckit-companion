import * as vscode from 'vscode';
import { SpecEditorProvider } from './specEditorProvider';
import { WorkflowSteps } from '../../core/constants';

jest.mock('../workflows', () => ({
    normalizeWorkflowConfig: (w: unknown) => w,
    resolveStepCommand: () => 'speckit.specify',
    isWorkflowSupportedForProvider: () => true,
    isCompanionSelectable: jest.fn().mockReturnValue(false),
    isCompanionInstalled: jest.fn().mockReturnValue(false),
}));

jest.mock('../../ai-providers', () => ({
    AIProviderFactory: { getProvider: jest.fn().mockReturnValue({ executeInTerminal: jest.fn() }) },
    getConfiguredProviderType: jest.fn().mockReturnValue('claudeCode'),
}));

jest.mock('../../ai-providers/aiProvider', () => ({
    formatCommandForProvider: (c: string) => c,
}));

jest.mock('../../ai-providers/promptBuilder', () => ({
    buildSpecifyCreationPreamble: () => null,
}));

jest.mock('../../core/telemetry', () => ({
    sendTelemetryEvent: jest.fn(),
    reportInstallPromptShown: jest.fn(),
    reportInstallPromptClicked: jest.fn(),
}));

import { sendTelemetryEvent } from '../../core/telemetry';

function createProvider(): SpecEditorProvider {
    const context = {
        subscriptions: [],
        extensionUri: vscode.Uri.file('/ext'),
        globalState: { get: jest.fn().mockReturnValue(false), update: jest.fn() },
    } as unknown as vscode.ExtensionContext;
    const outputChannel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;
    const tempFileManager = {
        createTempFileSet: jest.fn().mockResolvedValue({ id: 't1', markdownFilePath: '/tmp/spec.md', imageFilePaths: [] }),
        markSubmitted: jest.fn().mockResolvedValue(undefined),
        cleanupSession: jest.fn().mockResolvedValue(undefined),
    } as unknown as never;
    return new SpecEditorProvider(context, outputChannel, tempFileManager, {} as never);
}

describe('Create Spec — telemetry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({ get: (_k: string, d?: unknown) => d });
    });

    it('emits phase.dispatched(specify) alongside spec.created so the funnel does not undercount specify', async () => {
        const provider = createProvider();
        (provider as unknown as { sessionId: string }).sessionId = 'sess';
        (provider as unknown as { workflows: Map<string, unknown> }).workflows = new Map([
            ['speckit', { name: 'speckit', stepSpecify: '/speckit.specify' }],
        ]);
        (provider as unknown as { postMessage: (m: unknown) => void }).postMessage = () => {};

        await (provider as unknown as {
            handleSubmit(c: string, i: string[], w: string, cmd?: string, auto?: boolean): Promise<void>;
        }).handleSubmit('build a thing', [], 'speckit', undefined, false);

        const send = sendTelemetryEvent as jest.Mock;
        const created = send.mock.calls.find(c => c[0] === 'spec.created');
        const dispatched = send.mock.calls.find(c => c[0] === 'phase.dispatched');

        expect(created).toBeDefined();
        expect(dispatched).toBeDefined();
        expect(dispatched![1]).toMatchObject({ phase: WorkflowSteps.SPECIFY, providerId: 'claudeCode' });
        // Both events correlate to the same spec instance.
        expect(dispatched![1].specInstanceId).toBe(created![1].specInstanceId);
    });
});
