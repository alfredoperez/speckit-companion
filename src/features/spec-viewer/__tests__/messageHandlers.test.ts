import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { createMessageHandlers, MessageHandlerDependencies, LivingUndoAction } from '../messageHandlers';
import { livingTierDocuments } from '../livingDocs';

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
    shouldRecordStepStart: jest.requireActual('../../workflows/pipelineResolution').shouldRecordStepStart,
}));

// Mock the spec-context reader/writer so review-comment persistence can be
// asserted without touching the filesystem. SPEC_CONTEXT_FILENAME stays real.
jest.mock('../../specs/specContextReader', () => ({
    ...jest.requireActual('../../specs/specContextReader'),
    readSpecContext: jest.fn(),
    readSpecContextSync: jest.fn(),
}));
jest.mock('../../specs/specContextWriter', () => ({
    updateSpecContext: jest.fn(),
}));

import { setStatus, reactivate } from '../../specs/stepLifecycle';
import { updateStepProgress } from '../../specs/specContextManager';
import { NotificationUtils } from '../../../core/utils/notificationUtils';
import { readSpecContext } from '../../specs/specContextReader';
import { updateSpecContext } from '../../specs/specContextWriter';

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
        offerLivingUndo: jest.fn(),
        takeLivingUndo: jest.fn(),
        ...overrides,
    };
}

describe('messageHandlers - living spec navigation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file('/workspace') }];
    });

    afterEach(() => {
        (vscode.workspace as any).workspaceFolders = undefined;
    });

    it('opens the exact enriched capability path in Living mode', async () => {
        const handler = createMessageHandlers(SPEC_DIR, createMockDeps());

        await handler({
            type: 'openLivingSpec',
            capabilityName: 'todos',
            specPath: 'capabilities/todos/spec.md',
        });

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'speckit.viewSpecDocument',
            '/workspace/capabilities/todos/spec.md',
            { living: true },
        );
    });

    it('resolves a historical names-only capability to its colocated spec', async () => {
        (vscode.workspace.findFiles as jest.Mock).mockResolvedValueOnce([
            vscode.Uri.file('/workspace/webview/src/spec-viewer/viewer-ui.spec.md'),
        ]);
        const handler = createMessageHandlers(SPEC_DIR, createMockDeps());

        await handler({ type: 'openLivingSpec', capabilityName: 'viewer-ui' });

        expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
            '**/viewer-ui.spec.md',
            '**/{.git,node_modules,dist,storybook-static}/**',
            1,
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'speckit.viewSpecDocument',
            '/workspace/webview/src/spec-viewer/viewer-ui.spec.md',
            { living: true },
        );
    });
});

describe('messageHandlers - living Approve all, Remove and Undo', () => {
    const LINKS = path.join(__dirname, '..', '..', '..', '..', 'speckit-extension', 'tests', 'fixtures', 'requirement-slices', 'links');
    let root: string;

    const specOf = (cap: string) => path.join(root, 'capabilities', cap, 'spec.md');
    const ctxOf = (cap: string) => path.join(root, 'capabilities', cap, '.spec-context.json');
    const warn = vscode.window.showWarningMessage as jest.Mock;

    function panel(cap: string) {
        let held: (LivingUndoAction & { token: string }) | undefined;
        let n = 0;
        const deps = createMockDeps({
            getInstance: jest.fn().mockReturnValue({
                state: {
                    specDirectory: path.dirname(specOf(cap)),
                    specName: cap,
                    living: true,
                    livingSourcePath: specOf(cap),
                    currentDocument: 'spec',
                    availableDocuments: livingTierDocuments(specOf(cap)),
                },
                debounceTimer: undefined,
            }),
            offerLivingUndo: jest.fn((_dir: string, action: LivingUndoAction) => { held = { ...action, token: `t${++n}` }; }),
            takeLivingUndo: jest.fn((_dir: string, token: string) => {
                if (held?.token !== token) return undefined;
                const action = held;
                held = undefined;
                return action;
            }),
        });
        return { deps, handler: createMessageHandlers(path.dirname(specOf(cap)), deps), token: () => held?.token ?? '' };
    }

    beforeEach(() => {
        jest.clearAllMocks();
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'living-undo-'));
        fs.cpSync(LINKS, root, { recursive: true });
        (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file(root) }];
        warn.mockResolvedValue('Remove');
    });

    afterEach(() => {
        (vscode.workspace as any).workspaceFolders = undefined;
        fs.rmSync(root, { recursive: true, force: true });
    });

    const ADOPTED = '# Alpha\n\n> [DRAFT] Review before trusting.\n\n## Requirements\n\n### One\n<!-- adopted: CLAUDE.md:1 -->\n\nA.\n\n### Two\n<!-- adopted: developer -->\n\nB.\n';

    it('Approve all stores a pending undo, and Undo restores the file byte for byte without a record', async () => {
        fs.writeFileSync(specOf('alpha'), ADOPTED);
        const { deps, handler, token } = panel('alpha');

        await handler({ type: 'approveSpec' });
        expect(fs.readFileSync(specOf('alpha'), 'utf-8')).not.toContain('adopted:');
        expect(deps.offerLivingUndo).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ kind: 'approve', before: ADOPTED }));

        await handler({ type: 'undoLivingAction', token: token() });
        expect(fs.readFileSync(specOf('alpha'), 'utf-8')).toBe(ADOPTED);
        expect(fs.existsSync(ctxOf('alpha'))).toBe(false);
    });

    it('Remove stores a pending undo, and Undo restores the file byte for byte without a record', async () => {
        const before = fs.readFileSync(specOf('alpha'), 'utf-8');
        const { deps, handler, token } = panel('alpha');

        await handler({ type: 'removeRequirement', heading: 'Checks itself' });
        expect(fs.readFileSync(specOf('alpha'), 'utf-8')).not.toContain('### Checks itself');
        expect(deps.offerLivingUndo).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ kind: 'remove', capability: 'alpha', heading: 'Checks itself' }));

        await handler({ type: 'undoLivingAction', token: token() });
        expect(fs.readFileSync(specOf('alpha'), 'utf-8')).toBe(before);
        expect(fs.existsSync(ctxOf('alpha'))).toBe(false);
    });

    it('Undo writes nothing and warns when the file changed, and the removal then stands with a record', async () => {
        const { handler, token } = panel('alpha');
        await handler({ type: 'removeRequirement', heading: 'Checks itself' });
        fs.appendFileSync(specOf('alpha'), '\nEdited elsewhere.\n');
        const edited = fs.readFileSync(specOf('alpha'), 'utf-8');
        warn.mockClear();

        await handler({ type: 'undoLivingAction', token: token() });

        expect(fs.readFileSync(specOf('alpha'), 'utf-8')).toBe(edited);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('changed after the removal'));
        expect(JSON.parse(fs.readFileSync(ctxOf('alpha'), 'utf-8')).history).toEqual([
            expect.objectContaining({ kind: 'requirement-removed', capability: 'alpha', requirement: 'Checks itself' }),
        ]);
    });

    it('records the removal when the restore itself cannot be written', async () => {
        const { handler, token } = panel('alpha');
        await handler({ type: 'removeRequirement', heading: 'Checks itself' });
        const write = jest.spyOn(fs.promises, 'writeFile').mockRejectedValueOnce(new Error('EROFS'));
        warn.mockClear();

        await handler({ type: 'undoLivingAction', token: token() });

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not be written'));
        expect(JSON.parse(fs.readFileSync(ctxOf('alpha'), 'utf-8')).history).toEqual([
            expect.objectContaining({ kind: 'requirement-removed', requirement: 'Checks itself' }),
        ]);
        write.mockRestore();
    });

    it('ignores a stale token', async () => {
        fs.writeFileSync(specOf('alpha'), ADOPTED);
        const { handler } = panel('alpha');
        await handler({ type: 'approveSpec' });
        const approved = fs.readFileSync(specOf('alpha'), 'utf-8');

        await handler({ type: 'undoLivingAction', token: 'stale' });

        expect(fs.readFileSync(specOf('alpha'), 'utf-8')).toBe(approved);
    });

    it('refuses Remove when another capability leans on the heading', async () => {
        const before = fs.readFileSync(specOf('beta'), 'utf-8');
        const { deps, handler } = panel('beta');

        await handler({ type: 'removeRequirement', heading: 'Sessions expire' });

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('alpha still aligns to it'));
        expect(fs.readFileSync(specOf('beta'), 'utf-8')).toBe(before);
        expect(deps.offerLivingUndo).not.toHaveBeenCalled();
    });

    it.each(['Reads the session', 'Checks itself'])('does not refuse Remove of "%s", leaned on only from its own capability', async heading => {
        const { handler } = panel('alpha');
        await handler({ type: 'removeRequirement', heading });
        expect(fs.readFileSync(specOf('alpha'), 'utf-8')).not.toContain(`### ${heading}`);
    });
});

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

describe('messageHandlers - clarify (custom commands)', () => {
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
});

describe('messageHandlers - clarify (built-in optional commands)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const config = vscode.workspace.getConfiguration();
        (config.get as jest.Mock).mockImplementation((key: string, defaultValue?: any) => {
            if (key === 'customCommands') return [];
            return defaultValue;
        });
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
        expect(deps.sendContentUpdateMessage).toHaveBeenCalledWith(SPEC_DIR, 'plan');
    });

    it('updates by message, never by regenerating the webview', async () => {
        // A full regeneration reloads the webview and wipes its in-memory shell
        // state, which would bounce the reader back to the Overview.
        const deps = createMockDeps();
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({ type: 'stepperClick', phase: 'plan' } as any);

        expect(deps.updateContent).not.toHaveBeenCalled();
    });

    it('is a no-op when phase is "done"', async () => {
        const deps = createMockDeps();
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({ type: 'stepperClick', phase: 'done' } as any);

        expect(deps.sendContentUpdateMessage).not.toHaveBeenCalled();
        expect(deps.updateContent).not.toHaveBeenCalled();
        expect(updateStepProgress).not.toHaveBeenCalled();
    });
});

describe('messageHandlers - persisted review comments', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    function baseCtx(reviewComments: any[] = []): any {
        return {
            workflow: 'speckit',
            specName: 'my-feature',
            branch: 'main',
            currentStep: 'specify',
            status: 'specified',
            stepHistory: {},
            transitions: [],
            reviewComments,
        };
    }

    /** Wire updateSpecContext to apply the mutate fn and capture the result. */
    function captureWrite(): { get: () => any } {
        const box: { value: any } = { value: undefined };
        (updateSpecContext as jest.Mock).mockImplementation(
            async (_dir: string, mutate: (c: any) => any, fallback: any) => {
                box.value = mutate(fallback);
                return box.value;
            },
        );
        return { get: () => box.value };
    }

    function comment(over: Partial<any> = {}): any {
        return {
            id: 'c1',
            doc: 'spec',
            anchor: { heading: null, blockText: 'block', line: 1 },
            comment: 'note',
            status: 'pending',
            createdAt: '2026-05-21T00:00:00.000Z',
            ...over,
        };
    }

    it('persists an added comment as pending and preserves other context fields', async () => {
        (readSpecContext as jest.Mock).mockResolvedValue(baseCtx([]));
        const written = captureWrite();
        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
            Buffer.from('## Requirements\nsome text'),
        );

        const deps = createMockDeps({
            getInstance: jest.fn().mockReturnValue({
                state: {
                    currentDocument: 'spec',
                    availableDocuments: [
                        { isCore: true, type: 'spec', filePath: `${SPEC_DIR}/spec.md`, fileName: 'spec.md' },
                    ],
                },
                debounceTimer: undefined,
            }),
        });
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({
            type: 'addComment', id: 'c9', doc: 'spec', lineNum: 2,
            lineContent: 'some text', comment: 'tighten wording',
        } as any);

        expect(updateSpecContext).toHaveBeenCalledTimes(1);
        const ctx = written.get();
        expect(ctx.reviewComments).toHaveLength(1);
        expect(ctx.reviewComments[0]).toMatchObject({
            id: 'c9', doc: 'spec', comment: 'tighten wording', status: 'pending',
        });
        // Anchor captured the nearest heading from the live source.
        expect(ctx.reviewComments[0].anchor.heading).toBe('Requirements');
        // Untouched fields preserved; transitions never mutated by comment writes.
        expect(ctx.specName).toBe('my-feature');
        expect(ctx.transitions).toEqual([]);
        expect(deps.refreshContextIfDisplaying).toHaveBeenCalled();
    });

    it('persists a comment removal', async () => {
        (readSpecContext as jest.Mock).mockResolvedValue(baseCtx([comment({ id: 'c1' })]));
        const written = captureWrite();

        const deps = createMockDeps();
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({ type: 'removeComment', id: 'c1' } as any);

        expect(written.get().reviewComments).toHaveLength(0);
    });

    it('persists an edited comment, preserving its identity, anchor, status and creation time', async () => {
        (readSpecContext as jest.Mock).mockResolvedValue(
            baseCtx([
                comment({ id: 'c1', status: 'applied', comment: 'first take' }),
                comment({ id: 'c2', comment: 'untouched' }),
            ]),
        );
        const written = captureWrite();

        const handler = createMessageHandlers(SPEC_DIR, createMockDeps());
        await handler({ type: 'editComment', id: 'c1', comment: 'second take' } as any);

        const [edited, other] = written.get().reviewComments;
        expect(edited).toEqual({
            id: 'c1',
            doc: 'spec',
            anchor: { heading: null, blockText: 'block', line: 1 },
            comment: 'second take',
            status: 'applied',
            createdAt: '2026-05-21T00:00:00.000Z',
        });
        expect(other.comment).toBe('untouched');
    });

    it('leaves comments untouched when an edit is blank or names an unknown id', async () => {
        for (const msg of [
            { type: 'editComment', id: 'c1', comment: '   ' },
            { type: 'editComment', id: 'nope', comment: 'ignored' },
        ]) {
            (readSpecContext as jest.Mock).mockResolvedValue(
                baseCtx([comment({ id: 'c1', comment: 'original' })]),
            );
            const written = captureWrite();

            const handler = createMessageHandlers(SPEC_DIR, createMockDeps());
            await handler(msg as any);

            expect(written.get().reviewComments).toEqual([
                expect.objectContaining({ id: 'c1', comment: 'original' }),
            ]);
        }
    });

    it('dispatches a doc\'s pending comments to the AI and marks them applied', async () => {
        const ctx = baseCtx([
            comment({ id: 'c1', doc: 'spec', anchor: { heading: 'Requirements', blockText: 'Some text', line: 5 }, comment: 'tighten wording' }),
            comment({ id: 'c2', doc: 'spec', anchor: { heading: null, blockText: 'Other', line: 12 }, comment: 'add detail' }),
            comment({ id: 'c3', doc: 'plan', anchor: { heading: null, blockText: 'p', line: 1 }, comment: 'plan note' }),
        ]);
        (readSpecContext as jest.Mock).mockResolvedValue(ctx);
        const written = captureWrite();

        const deps = createMockDeps({
            getInstance: jest.fn().mockReturnValue({
                state: {
                    currentDocument: 'spec',
                    availableDocuments: [
                        { isCore: true, type: 'spec', filePath: `${SPEC_DIR}/spec.md`, fileName: 'spec.md' },
                    ],
                },
                debounceTimer: undefined,
            }),
        });
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({ type: 'runDocRefinement', doc: 'spec' } as any);

        // AI dispatch — direct-edit prompt, no slash command, doc's comments only.
        expect(deps.executeInTerminal).toHaveBeenCalledTimes(1);
        const prompt = (deps.executeInTerminal as jest.Mock).mock.calls[0][0] as string;
        expect(prompt.startsWith('/')).toBe(false);
        expect(prompt).toContain(`${SPEC_DIR}/spec.md`);
        expect(prompt).toContain('Line 5');
        expect(prompt).toContain('Requirements');
        expect(prompt).toContain('tighten wording');
        expect(prompt).toContain('add detail');
        expect(prompt).not.toMatch(/plan note/);
        expect(prompt).toContain('DO NOT regenerate');
        expect(prompt).toContain('DO NOT run any setup script');

        // No `<doc>-extra.md` is ever written.
        expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();

        // The dispatched (spec) comments flip to applied; plan stays pending.
        const status = Object.fromEntries(
            written.get().reviewComments.map((c: any) => [c.id, c.status]),
        );
        expect(status).toEqual({ c1: 'applied', c2: 'applied', c3: 'pending' });
    });

    it('does nothing when a doc has no pending comments', async () => {
        (readSpecContext as jest.Mock).mockResolvedValue(
            baseCtx([comment({ id: 'c1', doc: 'spec', status: 'applied' })]),
        );

        const deps = createMockDeps({
            getInstance: jest.fn().mockReturnValue({
                state: { currentDocument: 'spec', availableDocuments: [] },
                debounceTimer: undefined,
            }),
        });
        const handler = createMessageHandlers(SPEC_DIR, deps);

        await handler({ type: 'runDocRefinement', doc: 'spec' } as any);

        expect(deps.executeInTerminal).not.toHaveBeenCalled();
        expect(updateSpecContext).not.toHaveBeenCalled();
    });
});

describe("recording a start for a project's added step (US3)", () => {
    const path = require('path');
    const { resolveCompanionSteps } = require('../../workflows/pipelineResolution');
    const { readSpecContextSync } = require('../../specs/specContextReader');
    const { startStep } = require('../../specs/stepLifecycle');
    const steps = resolveCompanionSteps(path.join(__dirname, '../../../../tests/fixtures/project-steps'));

    async function approveFrom(currentStep: string, pipeline = steps) {
        jest.clearAllMocks();
        (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);
        (readSpecContextSync as jest.Mock).mockReturnValue({
            workflow: 'companion',
            currentStep,
            status: 'active',
            history: [],
        });
        const deps = createMockDeps({ resolveWorkflowSteps: jest.fn().mockResolvedValue(pipeline) });
        await createMessageHandlers(SPEC_DIR, deps)({ type: 'approve' });
        return deps;
    }

    it('writes a start for the added step it dispatches', async () => {
        await approveFrom('implement');
        expect(startStep).toHaveBeenCalledWith(SPEC_DIR, 'bench-run', 'extension');
    });

    it('still refuses a start for the untimed mark-complete step', async () => {
        await approveFrom('code-review');
        expect(startStep).not.toHaveBeenCalledWith(SPEC_DIR, 'mark-complete', 'extension');
    });

    it('still refuses a start for a user-workflow step', async () => {
        await approveFrom('specify', [
            { name: 'specify', command: 'to-spec', file: 'spec.md' },
            { name: 'tickets', command: 'to-tickets', file: 'tickets.md' },
        ]);
        expect(startStep).not.toHaveBeenCalledWith(SPEC_DIR, 'tickets', 'extension');
    });
});
