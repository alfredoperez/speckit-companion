import * as vscode from 'vscode';
import { SpecEditorProvider } from './specEditorProvider';
import { COMPANION_WORKFLOW_NAME } from '../../core/constants';

jest.mock('../workflows', () => ({
    normalizeWorkflowConfig: (w: unknown) => w,
    resolveStepCommand: () => 'speckit.specify',
    isWorkflowSupportedForProvider: () => true,
    isCompanionSelectable: jest.fn().mockReturnValue(false),
}));

jest.mock('../../ai-providers', () => ({
    AIProviderFactory: { getProvider: jest.fn() },
    getConfiguredProviderType: jest.fn().mockReturnValue('claudeCode'),
}));

jest.mock('../../ai-providers/aiProvider', () => ({
    formatCommandForProvider: (c: string) => c,
}));

import { isCompanionSelectable } from '../workflows';

function createProvider(): SpecEditorProvider {
    const context = {
        subscriptions: [],
        extensionUri: vscode.Uri.file('/ext'),
        globalState: { get: jest.fn().mockReturnValue(false), update: jest.fn() },
    } as unknown as vscode.ExtensionContext;
    const outputChannel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;
    return new SpecEditorProvider(context, outputChannel, {} as never, {} as never);
}

describe('Create Spec — Companion install nudge', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: (_k: string, d?: unknown) => d,
        });
    });

    it('offers SpecKit Companion even when the extension is not installed', () => {
        (isCompanionSelectable as jest.Mock).mockReturnValue(false);
        const provider = createProvider();
        const workflows = (provider as unknown as { getWorkflows(): Array<Record<string, unknown>> }).getWorkflows();
        const companion = workflows.find(w => w.name === COMPANION_WORKFLOW_NAME);
        expect(companion).toBeDefined();
        expect(companion!.installed).toBe(false);
        expect(String(companion!.displayName)).toContain('Install to enable');
    });

    it('marks Companion installed when the extension is present', () => {
        (isCompanionSelectable as jest.Mock).mockReturnValue(true);
        const provider = createProvider();
        const workflows = (provider as unknown as { getWorkflows(): Array<Record<string, unknown>> }).getWorkflows();
        const companion = workflows.find(w => w.name === COMPANION_WORKFLOW_NAME)!;
        expect(companion.installed).toBe(true);
        expect(companion.displayName).toBe('SpecKit Companion');
    });

    it('the install-first prompt installs and reports the click when the user chooses install', async () => {
        (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Install SpecKit Companion');
        const provider = createProvider();
        const decision = await (provider as unknown as {
            promptCompanionInstallFirst(): Promise<string>;
        }).promptCompanionInstallFirst();
        expect(decision).toBe('install');
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('speckit.companion.installSpecKitExtension');
    });

    it('the install-first prompt returns continue when the user keeps SpecKit', async () => {
        (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Use SpecKit Instead');
        const provider = createProvider();
        const decision = await (provider as unknown as {
            promptCompanionInstallFirst(): Promise<string>;
        }).promptCompanionInstallFirst();
        expect(decision).toBe('continue');
        expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('speckit.companion.installSpecKitExtension');
    });

    it('the install-first prompt returns cancel when dismissed', async () => {
        (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);
        const provider = createProvider();
        const decision = await (provider as unknown as {
            promptCompanionInstallFirst(): Promise<string>;
        }).promptCompanionInstallFirst();
        expect(decision).toBe('cancel');
    });

    it('choosing Install aborts the submission instead of silently creating a stock spec', async () => {
        (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Install SpecKit Companion');
        const provider = createProvider();
        (provider as unknown as { sessionId: string }).sessionId = 'sess';
        const posted: Array<{ type: string }> = [];
        (provider as unknown as { postMessage: (m: { type: string }) => void }).postMessage = (m) => posted.push(m);
        await (provider as unknown as {
            handleSubmit(c: string, i: string[], w: string, cmd?: string, auto?: boolean): Promise<void>;
        }).handleSubmit('build a thing', [], COMPANION_WORKFLOW_NAME, undefined, false);
        // Install kicked off, but no dispatch — submissionStarted must never post.
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('speckit.companion.installSpecKitExtension');
        expect(posted.find((m) => m.type === 'submissionStarted')).toBeUndefined();
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('re-run New Spec'));
    });
});
