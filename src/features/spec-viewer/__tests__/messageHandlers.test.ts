import * as vscode from 'vscode';
import { createMessageHandlers, MessageHandlerDependencies } from '../messageHandlers';

// Mock specContextManager
jest.mock('../../specs/specContextManager', () => ({
    updateStepProgress: jest.fn().mockResolvedValue(undefined),
}));

// Mock stepLifecycle (canonical writer wrappers)
jest.mock('../../specs/stepLifecycle', () => ({
    setStatus: jest.fn().mockResolvedValue(undefined),
    reactivate: jest.fn().mockResolvedValue(undefined),
    startStep: jest.fn().mockResolvedValue(undefined),
    completeStep: jest.fn().mockResolvedValue(undefined),
}));

// Mock notificationUtils
jest.mock('../../../core/utils/notificationUtils', () => ({
    NotificationUtils: {
        showAutoDismissNotification: jest.fn(),
        showStatusBarMessage: jest.fn(),
    },
}));

// Mock workflows
jest.mock('../../workflows', () => ({
    getFeatureWorkflow: jest.fn().mockResolvedValue(undefined),
    getWorkflowCommands: jest.fn().mockReturnValue([]),
}));

import { setStatus, reactivate } from '../../specs/stepLifecycle';
import { updateStepProgress } from '../../specs/specContextManager';
import { NotificationUtils } from '../../../core/utils/notificationUtils';
import { getFeatureWorkflow, getWorkflowCommands } from '../../workflows';

const SPEC_DIR = '/workspace/specs/my-feature';

function createMockDeps(overrides?: Partial<MessageHandlerDependencies>): MessageHandlerDependencies {
    return {
        getInstance: jest.fn().mockReturnValue({
            state: {
                specDirectory: SPEC_DIR,
                specName: 'my-feature',
                currentDocument: 'spec',
                availableDocuments: [],
            },
            debounceTimer: undefined,
        }),
        updateContent: jest.fn().mockResolvedValue(undefined),
        sendContentUpdateMessage: jest.fn().mockResolvedValue(undefined),
        resolveWorkflowSteps: jest.fn().mockResolvedValue([]),
        executeInTerminal: jest.fn().mockResolvedValue(undefined),
        outputChannel: {
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn(),
        } as unknown as vscode.OutputChannel,
        context: {
            subscriptions: [],
            extensionPath: '/mock/extension',
            extensionUri: vscode.Uri.file('/mock/extension'),
        } as unknown as vscode.ExtensionContext,
        ...overrides,
    };
}

describe('messageHandlers - lifecycle actions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('completeSpec', () => {
        it('should call setSpecStatus with completed', async () => {
            const deps = createMockDeps();
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'completeSpec' } as any);

            expect(setStatus).toHaveBeenCalledWith(SPEC_DIR, 'completed');
        });

        it('should refresh the sidebar tree after setting status', async () => {
            const deps = createMockDeps();
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'completeSpec' } as any);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('speckit.refresh');
        });

        it('should update webview content after refreshing', async () => {
            const deps = createMockDeps();
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'completeSpec' } as any);

            expect(deps.updateContent).toHaveBeenCalledWith(SPEC_DIR, 'spec');
        });

        it('should show notification with spec name', async () => {
            const deps = createMockDeps();
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'completeSpec' } as any);

            expect(NotificationUtils.showAutoDismissNotification).toHaveBeenCalledWith(
                'Spec "my-feature" marked as completed'
            );
        });

        it('should do nothing if getInstance returns undefined', async () => {
            const deps = createMockDeps({
                getInstance: jest.fn().mockReturnValue(undefined),
            });
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'completeSpec' } as any);

            expect(setStatus).not.toHaveBeenCalled();
        });
    });

    describe('archiveSpec', () => {
        it('should call setSpecStatus with archived', async () => {
            const deps = createMockDeps();
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'archiveSpec' } as any);

            expect(setStatus).toHaveBeenCalledWith(SPEC_DIR, 'archived');
        });

        it('should refresh the sidebar tree after setting status', async () => {
            const deps = createMockDeps();
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'archiveSpec' } as any);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('speckit.refresh');
        });

        it('should update webview content after refreshing', async () => {
            const deps = createMockDeps();
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'archiveSpec' } as any);

            expect(deps.updateContent).toHaveBeenCalledWith(SPEC_DIR, 'spec');
        });

        it('should show notification with spec name', async () => {
            const deps = createMockDeps();
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'archiveSpec' } as any);

            expect(NotificationUtils.showAutoDismissNotification).toHaveBeenCalledWith(
                'Spec "my-feature" marked as archived'
            );
        });
    });

    describe('reactivateSpec', () => {
        it('should call reactivate (canonical in-progress derivation)', async () => {
            const deps = createMockDeps();
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'reactivateSpec' } as any);

            expect(reactivate).toHaveBeenCalledWith(SPEC_DIR);
        });

        it('should refresh the sidebar tree after setting status', async () => {
            const deps = createMockDeps();
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'reactivateSpec' } as any);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('speckit.refresh');
        });

        it('should update webview content after refreshing', async () => {
            const deps = createMockDeps();
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'reactivateSpec' } as any);

            expect(deps.updateContent).toHaveBeenCalledWith(SPEC_DIR, 'spec');
        });

        it('should show notification with spec name', async () => {
            const deps = createMockDeps();
            const handler = createMessageHandlers(SPEC_DIR, deps);

            await handler({ type: 'reactivateSpec' } as any);

            expect(NotificationUtils.showAutoDismissNotification).toHaveBeenCalledWith(
                'Spec "my-feature" marked as reactivated'
            );
        });
    });
});

describe('messageHandlers - clarify (workflow commands)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should execute a customCommand matching the button command', async () => {
        const config = vscode.workspace.getConfiguration();
        (config.get as jest.Mock).mockImplementation((key: string, defaultValue?: any) => {
            if (key === 'customCommands') {
                return [{ name: 'review', title: 'Review', command: '/speckit.review', step: 'spec' }];
            }
            return defaultValue;
        });

        const deps = createMockDeps();
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({ type: 'clarify', command: '/speckit.review' } as any);

        expect(deps.executeInTerminal).toHaveBeenCalledWith(
            expect.stringContaining('/speckit.review')
        );
    });

    it('should fall back to workflow commands when no customCommand matches', async () => {
        const config = vscode.workspace.getConfiguration();
        (config.get as jest.Mock).mockImplementation((key: string, defaultValue?: any) => {
            if (key === 'customCommands') return [];
            return defaultValue;
        });

        (getFeatureWorkflow as jest.Mock).mockResolvedValue({ workflow: 'sdd' });
        (getWorkflowCommands as jest.Mock).mockReturnValue([
            { name: 'auto', title: 'Auto Mode', command: '/sdd:auto', step: 'spec' },
        ]);

        const deps = createMockDeps();
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({ type: 'clarify', command: '/sdd:auto' } as any);

        expect(getWorkflowCommands).toHaveBeenCalledWith('sdd');
        expect(deps.executeInTerminal).toHaveBeenCalledWith(
            expect.stringContaining('/sdd:auto')
        );
    });

    it('should not execute workflow command when step does not match', async () => {
        const config = vscode.workspace.getConfiguration();
        (config.get as jest.Mock).mockImplementation((key: string, defaultValue?: any) => {
            if (key === 'customCommands') return [];
            return defaultValue;
        });

        (getFeatureWorkflow as jest.Mock).mockResolvedValue({ workflow: 'sdd' });
        (getWorkflowCommands as jest.Mock).mockReturnValue([
            { name: 'auto', title: 'Auto Mode', command: '/sdd:auto', step: 'plan' },
        ]);

        const deps = createMockDeps({
            getInstance: jest.fn().mockReturnValue({
                state: { specDirectory: SPEC_DIR, specName: 'my-feature', currentDocument: 'spec', availableDocuments: [] },
                debounceTimer: undefined,
            }),
        });
        const handler = createMessageHandlers(SPEC_DIR, deps);

        // No buttonCommand — falls through to step matching; "plan" !== "spec"
        await handler({ type: 'clarify' } as any);

        expect(deps.executeInTerminal).not.toHaveBeenCalled();
    });

    it('should execute workflow command with step "all" on any tab', async () => {
        const config = vscode.workspace.getConfiguration();
        (config.get as jest.Mock).mockImplementation((key: string, defaultValue?: any) => {
            if (key === 'customCommands') return [];
            return defaultValue;
        });

        (getFeatureWorkflow as jest.Mock).mockResolvedValue({ workflow: 'sdd' });
        (getWorkflowCommands as jest.Mock).mockReturnValue([
            { name: 'auto', title: 'Auto Mode', command: '/sdd:auto', step: 'all' },
        ]);

        const deps = createMockDeps();
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({ type: 'clarify' } as any);

        expect(deps.executeInTerminal).toHaveBeenCalledWith(
            expect.stringContaining('/sdd:auto')
        );
    });
});

describe('messageHandlers - stepperClick', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not mutate .spec-context.json currentStep on tab click', async () => {
        const deps = createMockDeps();
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({ type: 'stepperClick', phase: 'plan' } as any);

        expect(updateStepProgress).not.toHaveBeenCalled();
        expect(deps.updateContent).toHaveBeenCalledWith(SPEC_DIR, 'plan');
    });

    it('is a no-op when phase is "done"', async () => {
        const deps = createMockDeps();
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({ type: 'stepperClick', phase: 'done' } as any);

        expect(deps.updateContent).not.toHaveBeenCalled();
        expect(updateStepProgress).not.toHaveBeenCalled();
    });
});

describe('messageHandlers - submitRefinements', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    function dispatchRefinements(currentDocument: 'spec' | 'plan' | 'tasks') {
        const deps = createMockDeps({
            getInstance: jest.fn().mockReturnValue({
                state: {
                    specDirectory: SPEC_DIR,
                    specName: 'my-feature',
                    currentDocument,
                    availableDocuments: [],
                },
                debounceTimer: undefined,
            }),
        });
        const handler = createMessageHandlers(SPEC_DIR, deps);

        const refinements = [
            { lineNum: 5, lineContent: 'first line content', comment: 'tighten wording' },
            { lineNum: 12, lineContent: 'second line content', comment: 'add detail' },
        ];

        return { deps, handler, refinements };
    }

    it('does not invoke a slash command (avoids running setup-plan.sh)', async () => {
        const { deps, handler, refinements } = dispatchRefinements('plan');

        await handler({ type: 'submitRefinements', refinements } as any);

        expect(deps.executeInTerminal).toHaveBeenCalledTimes(1);
        const prompt = (deps.executeInTerminal as jest.Mock).mock.calls[0][0] as string;
        expect(prompt.startsWith('/')).toBe(false);
        expect(prompt).not.toMatch(/\/speckit\./);
    });

    it('includes guardrails forbidding template regen and setup scripts', async () => {
        const { deps, handler, refinements } = dispatchRefinements('plan');

        await handler({ type: 'submitRefinements', refinements } as any);

        const prompt = (deps.executeInTerminal as jest.Mock).mock.calls[0][0] as string;
        expect(prompt).toContain('DO NOT regenerate');
        expect(prompt).toContain('DO NOT run any setup script');
        expect(prompt).toContain('DO NOT replace the file');
    });

    it('targets the correct doc filename and includes the user comments', async () => {
        const { deps, handler, refinements } = dispatchRefinements('plan');

        await handler({ type: 'submitRefinements', refinements } as any);

        const prompt = (deps.executeInTerminal as jest.Mock).mock.calls[0][0] as string;
        expect(prompt).toContain(`${SPEC_DIR}/plan.md`);
        expect(prompt).toContain('Line 5');
        expect(prompt).toContain('Line 12');
        expect(prompt).toContain('tighten wording');
        expect(prompt).toContain('add detail');
    });

    it('uses the same direct-edit path for spec and tasks', async () => {
        for (const doc of ['spec', 'tasks'] as const) {
            const { deps, handler, refinements } = dispatchRefinements(doc);

            await handler({ type: 'submitRefinements', refinements } as any);

            const prompt = (deps.executeInTerminal as jest.Mock).mock.calls[0][0] as string;
            expect(prompt.startsWith('/')).toBe(false);
            expect(prompt).toContain(`${SPEC_DIR}/${doc}.md`);
            expect(prompt).toContain('DO NOT regenerate');
        }
    });
});
