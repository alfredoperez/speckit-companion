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
        refreshContextIfDisplaying: jest.fn().mockResolvedValue(undefined),
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

describe('messageHandlers - clarify (built-in optional commands)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const config = vscode.workspace.getConfiguration();
        (config.get as jest.Mock).mockImplementation((key: string, defaultValue?: any) => {
            if (key === 'customCommands') return [];
            return defaultValue;
        });
        (getFeatureWorkflow as jest.Mock).mockResolvedValue(undefined);
        (getWorkflowCommands as jest.Mock).mockReturnValue([]);
    });

    it('dispatches a built-in optional command via the registered VS Code command', async () => {
        const deps = createMockDeps();
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({ type: 'clarify', command: 'speckit.clarify' } as any);

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('speckit.clarify', SPEC_DIR);
        expect(deps.executeInTerminal).not.toHaveBeenCalled();
    });

    it('lets a user customCommand with the same id win over the built-in', async () => {
        const config = vscode.workspace.getConfiguration();
        (config.get as jest.Mock).mockImplementation((key: string, defaultValue?: any) => {
            if (key === 'customCommands') {
                return [{ name: 'clarify', title: 'Clarify', command: 'speckit.clarify', step: 'spec' }];
            }
            return defaultValue;
        });

        const deps = createMockDeps();
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({ type: 'clarify', command: 'speckit.clarify' } as any);

        expect(deps.executeInTerminal).toHaveBeenCalledWith(
            expect.stringContaining('speckit.clarify')
        );
        expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('speckit.clarify', SPEC_DIR);
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

    function dispatchRefinements(
        currentDocument: 'spec' | 'plan' | 'tasks',
        availableDocuments: Array<Record<string, unknown>> = [],
    ) {
        const deps = createMockDeps({
            getInstance: jest.fn().mockReturnValue({
                state: {
                    specDirectory: SPEC_DIR,
                    specName: 'my-feature',
                    currentDocument,
                    availableDocuments,
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

    it('appends the batch to the matching scratchpad file when one exists', async () => {
        const scratchpad = {
            type: 'spec-extra',
            label: 'Spec Notes',
            fileName: 'spec-extra.md',
            filePath: `${SPEC_DIR}/spec-extra.md`,
            exists: false,
            isCore: false,
            category: 'related',
            parentStep: 'spec',
            isScratchpad: true,
            scratchpadFor: 'spec',
        };
        (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('not found'));
        (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

        const { deps, handler, refinements } = dispatchRefinements('spec', [scratchpad]);

        await handler({ type: 'submitRefinements', refinements } as any);

        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(1);
        const [, data] = (vscode.workspace.fs.writeFile as jest.Mock).mock.calls[0];
        const written = new TextDecoder().decode(data as Uint8Array);
        expect(written).toContain('tighten wording');
        expect(written).toContain('add detail');
        // Batch is h2, entries are h3, labels make role unambiguous.
        expect(written).toContain('## Refinement batch');
        expect(written).toContain('### Line 5');
        expect(written).toContain('### Line 12');
        expect(written).toContain('**Original**');
        expect(written).toContain('**Comment**');

        // AI dispatch still happens — persistence is layered on, not replacing.
        expect(deps.executeInTerminal).toHaveBeenCalledTimes(1);
    });

    it('skips scratchpad append when no matching scratchpad exists in the doc set', async () => {
        const { deps, handler, refinements } = dispatchRefinements('spec', []);

        await handler({ type: 'submitRefinements', refinements } as any);

        expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        // AI dispatch still happens.
        expect(deps.executeInTerminal).toHaveBeenCalledTimes(1);
    });

    it('enriches each refinement with its surrounding block + section heading from the source', async () => {
        // line numbers (1-based):
        // 1: "# Spec"
        // 2: ""
        // 3: "## Requirements"
        // 4: ""
        // 5: "Some paragraph text"
        // 6: "that wraps onto a second line"
        // 7: "and a third."
        // 8: ""
        // 9: "- **FR-001**: System MUST persist"
        //10: "  the chosen theme across sessions."
        //11: "- **FR-002**: Honor OS theme."
        const sourceMd = [
            '# Spec',
            '',
            '## Requirements',
            '',
            'Some paragraph text',
            'that wraps onto a second line',
            'and a third.',
            '',
            '- **FR-001**: System MUST persist',
            '  the chosen theme across sessions.',
            '- **FR-002**: Honor OS theme.',
        ].join('\n');

        const sourceDoc = {
            type: 'spec',
            label: 'Spec',
            fileName: 'spec.md',
            filePath: `${SPEC_DIR}/spec.md`,
            exists: true,
            isCore: true,
            category: 'core',
        };
        const scratchpad = {
            type: 'spec-extra',
            label: 'Spec Notes',
            fileName: 'spec-extra.md',
            filePath: `${SPEC_DIR}/spec-extra.md`,
            exists: false,
            isCore: false,
            category: 'related',
            parentStep: 'spec',
            isScratchpad: true,
            scratchpadFor: 'spec',
        };

        (vscode.workspace.fs.stat as jest.Mock).mockImplementation(async (u: any) => {
            const p = u?.fsPath ?? u?.path ?? '';
            if (p === `${SPEC_DIR}/spec.md`) return { type: vscode.FileType.File };
            throw new Error('not found');
        });
        (vscode.workspace.fs.readFile as jest.Mock).mockImplementation(async (u: any) => {
            const p = u?.fsPath ?? u?.path ?? '';
            if (p === `${SPEC_DIR}/spec.md`) return Buffer.from(sourceMd);
            return Buffer.from('');
        });
        (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

        const { deps, handler } = dispatchRefinements('spec', [sourceDoc, scratchpad]);
        const refinements = [
            { lineNum: 6, lineContent: 'that wraps onto a second line', comment: 'tighten this paragraph' },
            { lineNum: 9, lineContent: '- **FR-001**: System MUST persist', comment: 'scope unclear' },
        ];

        await handler({ type: 'submitRefinements', refinements } as any);

        const prompt = (deps.executeInTerminal as jest.Mock).mock.calls[0][0] as string;

        // Exact line numbers preserved for the AI.
        expect(prompt).toContain('Line 6');
        expect(prompt).toContain('Line 9');
        // Section heading attached.
        expect(prompt).toContain('Requirements');
        // Full paragraph block (all three lines) for line 6.
        expect(prompt).toContain('Some paragraph text');
        expect(prompt).toContain('and a third.');
        // FR-001 list item + its continuation captured (but FR-002 NOT).
        expect(prompt).toContain('the chosen theme across sessions');
        expect(prompt).not.toMatch(/FR-002/);

        // Scratchpad gets the same enrichment, in the labeled-sections shape.
        const [, data] = (vscode.workspace.fs.writeFile as jest.Mock).mock.calls[0];
        const written = new TextDecoder().decode(data as Uint8Array);
        expect(written).toContain('### Line 6 · Requirements');
        expect(written).toContain('### Line 9 · Requirements');
        expect(written).toContain('**Original**');
        expect(written).toContain('**Comment**');
        expect(written).toContain('Some paragraph text');
        expect(written).toContain('the chosen theme across sessions');
    });
});
