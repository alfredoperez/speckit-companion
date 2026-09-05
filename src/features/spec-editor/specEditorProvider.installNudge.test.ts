import * as vscode from 'vscode';
import { SpecEditorProvider } from './specEditorProvider';
import { COMPANION_WORKFLOW_NAME } from '../../core/constants';

jest.mock('../workflows', () => ({
    buildWorkflowChoices: jest.fn().mockReturnValue([]),
    resolveEffectiveDefaultWorkflow: jest.fn().mockReturnValue('speckit'),
}));

jest.mock('../../ai-providers', () => ({
    AIProviderFactory: { getProvider: jest.fn() },
    getConfiguredProviderType: jest.fn().mockReturnValue('claudeCode'),
}));

jest.mock('../../ai-providers/aiProvider', () => ({
    formatCommandForProvider: (c: string) => c,
}));

import { buildWorkflowChoices } from '../workflows';

const BUILDER_CHOICES = [
    { name: 'speckit', displayName: 'SpecKit', description: 'Standard SpecKit workflow', installed: true, entryCommand: 'speckit.specify' },
    { name: 'companion', displayName: 'SpecKit Companion', description: 'specs 60–68% leaner, same correctness', installed: false, supportsAuto: true, entryCommand: 'speckit.companion.specify' },
];

function createProvider(declinedBefore = false): SpecEditorProvider {
    const context = {
        subscriptions: [],
        extensionUri: vscode.Uri.file('/ext'),
        globalState: {
            get: jest.fn((key: string, fallback?: unknown) =>
                key === 'speckit.companionDeclinedAtCreate' ? declinedBefore : fallback ?? false),
            update: jest.fn(),
        },
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

    it('lists Companion from the shared builder even when not installed (install-to-enable)', () => {
        (buildWorkflowChoices as jest.Mock).mockReturnValue(BUILDER_CHOICES);
        const provider = createProvider();
        const workflows = (provider as unknown as { buildWorkflowDefinitions(): Array<Record<string, unknown>> }).buildWorkflowDefinitions();
        const companion = workflows.find(w => w.name === COMPANION_WORKFLOW_NAME);
        expect(companion).toBeDefined();
        expect(companion!.installed).toBe(false);
        // The card renders the install state separately — the name carries no suffix.
        expect(companion!.displayName).toBe('SpecKit Companion');
        expect(companion!.description).toBe('specs 60–68% leaner, same correctness');
    });

    it('passes the shared predicate result through when the extension is present', () => {
        (buildWorkflowChoices as jest.Mock).mockReturnValue(
            BUILDER_CHOICES.map(c => (c.name === COMPANION_WORKFLOW_NAME ? { ...c, installed: true } : c))
        );
        const provider = createProvider();
        const workflows = (provider as unknown as { buildWorkflowDefinitions(): Array<Record<string, unknown>> }).buildWorkflowDefinitions();
        const companion = workflows.find(w => w.name === COMPANION_WORKFLOW_NAME)!;
        expect(companion.installed).toBe(true);
        expect(companion.stepSpecify).toBe('/speckit.companion.specify');
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

    it('remembers Use SpecKit Instead so the modal is asked once, not every time', async () => {
        (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Use SpecKit Instead');
        const provider = createProvider();
        await (provider as unknown as {
            promptCompanionInstallFirst(): Promise<string>;
        }).promptCompanionInstallFirst();
        const context = (provider as unknown as { context: vscode.ExtensionContext }).context;
        expect(context.globalState.update).toHaveBeenCalledWith(
            'speckit.companionDeclinedAtCreate', true);
    });

    it('does not raise the modal again once the user has answered it', async () => {
        const provider = createProvider(true);
        const decision = await (provider as unknown as {
            promptCompanionInstallFirst(): Promise<string>;
        }).promptCompanionInstallFirst();
        expect(decision).toBe('continue');
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
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
            handleSubmit(c: string, i: string[], w: string, chosenAs: string, cmd?: string, auto?: boolean): Promise<void>;
        }).handleSubmit('build a thing', [], COMPANION_WORKFLOW_NAME, 'picked');
        // Install kicked off, but no dispatch — submissionStarted must never post.
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('speckit.companion.installSpecKitExtension');
        expect(posted.find((m) => m.type === 'submissionStarted')).toBeUndefined();
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('re-run New Spec'));
    });
});
