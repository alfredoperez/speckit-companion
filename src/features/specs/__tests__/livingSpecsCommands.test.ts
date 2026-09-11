import * as vscode from 'vscode';
import { registerLivingSpecsCommands, buildLivingUpdatePrompt } from '../livingSpecsCommands';

const executeSlashCommand = jest.fn();
const executeInTerminal = jest.fn();

jest.mock('../../../extension', () => ({
    getAIProvider: jest.fn(() => ({
        executeInTerminal: (...args: unknown[]) => executeInTerminal(...args),
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
            'speckit.livingSpecs.init',
            'speckit.livingSpecs.move',
            'speckit.livingSpecs.refresh',
            'speckit.livingSpecs.sync',
            'speckit.livingSpecs.update',
            'speckit.livingSpecs.validate',
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
        it('asks which area to adopt and passes the answer to the command', async () => {
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue([
                ['src', vscode.FileType.Directory],
                ['README.md', vscode.FileType.File],
                ['node_modules', vscode.FileType.Directory],
            ]);
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue([{ label: 'src' }]);

            await handlers['speckit.livingSpecs.adopt']();

            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.living-adopt src',
                'SpecKit - Adopt Code Area',
                true
            );
        });

        it('adopts several areas in one run', async () => {
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue([]);
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue([
                { label: 'src/pages' },
                { label: 'src/features' },
            ]);

            await handlers['speckit.livingSpecs.adopt']();

            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.living-adopt src/pages src/features',
                'SpecKit - Adopt Code Area',
                true
            );
        });

        it('collapses the whole-project choice to the repository root', async () => {
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue([]);
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue([
                { label: '$(globe) The whole project' },
                { label: 'src' },
            ]);

            await handlers['speckit.livingSpecs.adopt']();

            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.living-adopt .',
                'SpecKit - Adopt Code Area',
                true
            );
        });

        it('dispatches nothing when the area prompt is dismissed', async () => {
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue([]);
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(undefined);

            await handlers['speckit.livingSpecs.adopt']();

            expect(executeSlashCommand).not.toHaveBeenCalled();
        });

        it('carries the layout through when setup already chose one', async () => {
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue([]);
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue([{ label: 'src/pages' }]);

            await handlers['speckit.livingSpecs.adopt']({ layout: 'colocated' });

            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.living-adopt src/pages --layout colocated',
                'SpecKit - Adopt Code Area',
                true
            );
        });
    });

    describe('move', () => {
        it('asks where the capability should live and dispatches the answer', async () => {
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ label: 'Central' });

            await handlers['speckit.livingSpecs.move']({ capability: { name: 'billing' } });

            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.living-move billing to central',
                'SpecKit - Move Living Specs',
                true
            );
        });

        it('moves every spec when invoked without a capability', async () => {
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ label: 'Next to the code' });

            await handlers['speckit.livingSpecs.move']();

            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.living-move everything to colocated',
                'SpecKit - Move Living Specs',
                true
            );
        });
    });

    describe('init', () => {
        it('writes a registry at the chosen layout and refreshes the view', async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
                label: 'Next to the code — each spec sits in the folder it describes',
            });
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

            await handlers['speckit.livingSpecs.init']();

            const write = (vscode.workspace.fs.writeFile as jest.Mock).mock.calls[0];
            expect(write[0].fsPath).toContain('living-specs.yml');
            expect(Buffer.from(write[1]).toString('utf8')).toContain('enabled: true');
            expect(provider.refresh).toHaveBeenCalled();
        });

        it('never overwrites a registry that already exists', async () => {
            (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({});

            await handlers['speckit.livingSpecs.init']();

            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('sync', () => {
        it('dispatches the one-pass sync command for the AI to expand', async () => {
            await handlers['speckit.livingSpecs.sync']();
            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.living-sync',
                'SpecKit - Sync Living Specs',
                true
            );
            expect(executeInTerminal).not.toHaveBeenCalled();
        });
    });

    describe('validate', () => {
        it('dispatches the shape check for the AI to run', async () => {
            await handlers['speckit.livingSpecs.validate']();
            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.living-validate',
                'SpecKit - Validate Living Specs',
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

        it('dispatches the update as a natural-language prompt (not a slash command)', async () => {
            (readDriftedFiles as jest.Mock).mockResolvedValue(['src/checkout/cart.ts', 'src/checkout/api.ts']);

            await handlers['speckit.livingSpecs.update']({ capability: cap });

            // Must go through executeInTerminal — executeSlashCommand would force a
            // leading `/` on CLI providers and break the prompt.
            expect(executeSlashCommand).not.toHaveBeenCalled();
            expect(executeInTerminal).toHaveBeenCalledTimes(1);
            const [prompt, title] = (executeInTerminal as jest.Mock).mock.calls[0];
            expect(prompt).toContain('drifted');
            expect(prompt).toContain('Edit this spec file in place: src/checkout/checkout.spec.md');
            expect(prompt).toContain('UPDATE, do not regenerate');
            expect(prompt).toContain('src/checkout/cart.ts');
            expect(prompt).toContain('src/checkout/api.ts');
            expect(title).toBe('SpecKit - Update Living Spec');
        });

        it('resolves the capability from a viewer spec path when no node is passed', async () => {
            (resolveCapabilityBySpecPath as jest.Mock).mockReturnValue(cap);
            (readDriftedFiles as jest.Mock).mockResolvedValue(['src/checkout/cart.ts']);

            await handlers['speckit.livingSpecs.update']({ capabilitySpecPath: cap.spec });

            expect(resolveCapabilityBySpecPath).toHaveBeenCalledWith('/workspace', cap.spec);
            expect(executeInTerminal).toHaveBeenCalledTimes(1);
            expect((executeInTerminal as jest.Mock).mock.calls[0][0]).toContain('src/checkout/cart.ts');
        });

        it('warns and does not dispatch when no capability can be resolved', async () => {
            await handlers['speckit.livingSpecs.update']({});
            expect(vscode.window.showWarningMessage).toHaveBeenCalled();
            expect(executeInTerminal).not.toHaveBeenCalled();
        });
    });

    describe('copy actions', () => {
        it('copies the workspace-relative path', async () => {
            await handlers['speckit.livingSpecs.copyRelativePath']({ relPath: 'src/x/x.spec.md' });
            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('src/x/x.spec.md');
        });

        it('copies the basename as the name for a tier/orphan row', async () => {
            await handlers['speckit.livingSpecs.copyName']({ relPath: 'src/x/x.spec.md' });
            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('x.spec.md');
        });

        it('copies the capability name for a capability row, not the spec filename', async () => {
            await handlers['speckit.livingSpecs.copyName']({
                capability: { name: 'checkout', spec: 'capabilities/checkout/spec.md' },
            });
            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('checkout');
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
    it('names the spec file to edit, lists each changed file, and insists on an update', () => {
        const prompt = buildLivingUpdatePrompt('checkout', 'src/checkout/checkout.spec.md', ['src/a.ts', 'src/b.ts']);
        expect(prompt).toContain('"checkout" living spec has drifted');
        expect(prompt).toContain('Edit this spec file in place: src/checkout/checkout.spec.md');
        expect(prompt).toContain('UPDATE, do not regenerate');
        expect(prompt).toContain('- src/a.ts');
        expect(prompt).toContain('- src/b.ts');
    });

    it('falls back to an inspect instruction when the file list is empty (computed, none)', () => {
        const prompt = buildLivingUpdatePrompt('checkout', 'src/checkout/checkout.spec.md', []);
        expect(prompt).toContain('UPDATE, do not regenerate');
        expect(prompt).toContain('match globs');
        expect(prompt).not.toContain('could not be determined');
    });

    it('notes when the changed-file list could not be computed (git failed/timeout)', () => {
        const prompt = buildLivingUpdatePrompt('checkout', 'src/checkout/checkout.spec.md', undefined);
        expect(prompt).toContain('could not be determined');
        expect(prompt).toContain('match globs');
    });
});
