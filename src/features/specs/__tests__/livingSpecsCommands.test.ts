import * as vscode from 'vscode';
import { registerLivingSpecsCommands, buildLivingUpdatePrompt } from '../livingSpecsCommands';

const executeSlashCommand = jest.fn();

jest.mock('../../../extension', () => ({
    getAIProvider: jest.fn(() => ({
        executeInTerminal: jest.fn(),
        executeSlashCommand: (...args: unknown[]) => executeSlashCommand(...args),
    })),
}));

jest.mock('../livingSpecsModel', () => {
    const nodePath = require('path');
    return {
        readDriftedFiles: jest.fn().mockResolvedValue([]),
        resolveCapabilityBySpecPath: jest.fn(),
        isPathWithinRoot: (root: string, relPath: string) => {
            if (nodePath.isAbsolute(relPath)) return false;
            const rel = nodePath.relative(root, nodePath.resolve(root, relPath));
            return rel !== '' && !rel.startsWith('..') && !nodePath.isAbsolute(rel);
        },
    };
});

jest.mock('../../../core/utils/notificationUtils', () => ({
    NotificationUtils: { showAutoDismissNotification: jest.fn() },
}));

import { readDriftedFiles, resolveCapabilityBySpecPath } from '../livingSpecsModel';

type Handler = (...args: unknown[]) => Promise<void> | void;

function registerAndCollect(provider: { refresh: jest.Mock }): Record<string, Handler> {
    const handlers: Record<string, Handler> = {};
    (vscode.commands.registerCommand as jest.Mock).mockImplementation(
        (id: string, handler: Handler) => {
            handlers[id] = handler;
            return { dispose: jest.fn() };
        }
    );
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    const outputChannel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;
    registerLivingSpecsCommands(context, provider as never, outputChannel);
    return handlers;
}

describe('registerLivingSpecsCommands', () => {
    let provider: { refresh: jest.Mock };
    let handlers: Record<string, Handler>;

    beforeEach(() => {
        jest.clearAllMocks();
        (readDriftedFiles as jest.Mock).mockResolvedValue([]);
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
        provider = { refresh: jest.fn() };
        handlers = registerAndCollect(provider);
    });

    it('registers the full living-specs command set', () => {
        expect(Object.keys(handlers).sort()).toEqual([
            'speckit.livingSpecs.adopt',
            'speckit.livingSpecs.copyName',
            'speckit.livingSpecs.copyPath',
            'speckit.livingSpecs.copyRelativePath',
            'speckit.livingSpecs.coverage',
            'speckit.livingSpecs.delete',
            'speckit.livingSpecs.drift',
            'speckit.livingSpecs.refresh',
            'speckit.livingSpecs.update',
        ]);
    });

    describe('drift', () => {
        it('dispatches the drift command scoped to the invoked capability', async () => {
            await handlers['speckit.livingSpecs.drift']({ capability: { name: 'checkout' } });
            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.living-drift checkout',
                'SpecKit - Living-Spec Drift',
                true
            );
        });

        it('dispatches unscoped when invoked without a capability node', async () => {
            await handlers['speckit.livingSpecs.drift']();
            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.living-drift',
                'SpecKit - Living-Spec Drift',
                true
            );
        });
    });

    describe('coverage', () => {
        it('dispatches the coverage command scoped to the invoked capability', async () => {
            await handlers['speckit.livingSpecs.coverage']({ capability: { name: 'billing' } });
            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.living-coverage billing',
                'SpecKit - Requirement Coverage',
                true
            );
        });
    });

    describe('adopt', () => {
        it('dispatches the bare adopt command (the wizard prompts for the area)', async () => {
            await handlers['speckit.livingSpecs.adopt']();
            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.living-adopt',
                'SpecKit - Adopt Code Area',
                true
            );
        });
    });

    describe('update', () => {
        const cap = {
            name: 'checkout',
            spec: 'src/checkout/checkout.spec.md',
            location: 'colocated',
            exists: true,
            tiers: [],
            match: ['src/checkout/**'],
            exclude: [],
        };

        it('dispatches an update prompt naming drift, the changed files, and update-not-regenerate', async () => {
            (readDriftedFiles as jest.Mock).mockResolvedValue(['src/checkout/cart.ts', 'src/checkout/api.ts']);

            await handlers['speckit.livingSpecs.update']({ capability: cap });

            expect(executeSlashCommand).toHaveBeenCalledTimes(1);
            const [prompt, title, autoExec] = (executeSlashCommand as jest.Mock).mock.calls[0];
            expect(prompt).toContain('drifted');
            expect(prompt).toContain('UPDATE, do not regenerate');
            expect(prompt).toContain('src/checkout/cart.ts');
            expect(prompt).toContain('src/checkout/api.ts');
            expect(title).toBe('SpecKit - Update Living Spec');
            expect(autoExec).toBe(true);
        });

        it('resolves the capability from a viewer spec path when no node is passed', async () => {
            (resolveCapabilityBySpecPath as jest.Mock).mockReturnValue(cap);
            (readDriftedFiles as jest.Mock).mockResolvedValue(['src/checkout/cart.ts']);

            await handlers['speckit.livingSpecs.update']({ capabilitySpecPath: cap.spec });

            expect(resolveCapabilityBySpecPath).toHaveBeenCalledWith('/workspace', cap.spec);
            expect(executeSlashCommand).toHaveBeenCalledTimes(1);
            expect((executeSlashCommand as jest.Mock).mock.calls[0][0]).toContain('src/checkout/cart.ts');
        });

        it('warns and does not dispatch when no capability can be resolved', async () => {
            await handlers['speckit.livingSpecs.update']({});
            expect(vscode.window.showWarningMessage).toHaveBeenCalled();
            expect(executeSlashCommand).not.toHaveBeenCalled();
        });
    });

    describe('copy actions', () => {
        it('copies the workspace-relative path', async () => {
            await handlers['speckit.livingSpecs.copyRelativePath']({ relPath: 'src/x/x.spec.md' });
            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('src/x/x.spec.md');
        });

        it('copies the basename as the name', async () => {
            await handlers['speckit.livingSpecs.copyName']({ relPath: 'src/x/x.spec.md' });
            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('x.spec.md');
        });

        it('copies the absolute path', async () => {
            await handlers['speckit.livingSpecs.copyPath']({ relPath: 'src/x/x.spec.md' });
            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('/workspace/src/x/x.spec.md');
        });

        it('falls back to the capability spec path when no explicit relPath', async () => {
            await handlers['speckit.livingSpecs.copyRelativePath']({ capability: { spec: 'src/y/y.spec.md' } });
            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('src/y/y.spec.md');
        });
    });

    describe('delete', () => {
        it('deletes the single file after confirmation and refreshes', async () => {
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Delete');
            await handlers['speckit.livingSpecs.delete']({ relPath: 'src/x/x.spec.md' });
            expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(
                expect.objectContaining({ fsPath: '/workspace/src/x/x.spec.md' }),
                { recursive: false }
            );
            expect(provider.refresh).toHaveBeenCalled();
        });

        it('does nothing when the confirmation is dismissed', async () => {
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Cancel');
            await handlers['speckit.livingSpecs.delete']({ relPath: 'src/x/x.spec.md' });
            expect(vscode.workspace.fs.delete).not.toHaveBeenCalled();
            expect(provider.refresh).not.toHaveBeenCalled();
        });

        it('refuses a path that escapes the workspace root, without even prompting', async () => {
            (vscode.window.showWarningMessage as jest.Mock).mockClear();
            await handlers['speckit.livingSpecs.delete']({ relPath: '../../etc/passwd' });
            expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
            expect(vscode.workspace.fs.delete).not.toHaveBeenCalled();
        });
    });

    describe('refresh', () => {
        it('fires the provider refresh and never dispatches to the AI', () => {
            handlers['speckit.livingSpecs.refresh']();
            expect(provider.refresh).toHaveBeenCalledTimes(1);
            expect(executeSlashCommand).not.toHaveBeenCalled();
        });
    });
});

describe('buildLivingUpdatePrompt', () => {
    it('lists each changed file and insists on an update, not a regeneration', () => {
        const prompt = buildLivingUpdatePrompt('checkout', ['src/a.ts', 'src/b.ts']);
        expect(prompt).toContain('"checkout" living spec has drifted');
        expect(prompt).toContain('UPDATE, do not regenerate');
        expect(prompt).toContain('- src/a.ts');
        expect(prompt).toContain('- src/b.ts');
    });

    it('falls back to an inspect instruction when the file list is empty', () => {
        const prompt = buildLivingUpdatePrompt('checkout', []);
        expect(prompt).toContain('UPDATE, do not regenerate');
        expect(prompt).toContain('match globs');
    });
});
