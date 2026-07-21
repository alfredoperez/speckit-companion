import * as vscode from 'vscode';
import { removeRetiredSettings, coerceLegacyBoolean } from '../../../src/core/settingsMigration';

/**
 * An in-memory `WorkspaceConfiguration` stand-in supporting per-scope `inspect()`
 * and `update()`, the two surfaces the key migration relies on. Mirrors the
 * three-scope model VS Code exposes (global / workspace / workspace-folder).
 */
function makeConfigStore(initial: Record<string, { global?: unknown; workspace?: unknown; folder?: unknown }>) {
    const store: Record<string, { global?: unknown; workspace?: unknown; folder?: unknown }> = {
        ...JSON.parse(JSON.stringify(initial)),
    };
    const fieldFor = (target: vscode.ConfigurationTarget): 'global' | 'workspace' | 'folder' =>
        target === vscode.ConfigurationTarget.Global
            ? 'global'
            : target === vscode.ConfigurationTarget.Workspace
            ? 'workspace'
            : 'folder';
    return {
        store,
        config: {
            inspect: (key: string) => {
                const entry = store[key];
                if (!entry) {
                    return undefined;
                }
                return {
                    globalValue: entry.global,
                    workspaceValue: entry.workspace,
                    workspaceFolderValue: entry.folder,
                };
            },
            update: async (key: string, value: unknown, target: vscode.ConfigurationTarget) => {
                const field = fieldFor(target);
                store[key] = store[key] ?? {};
                if (value === undefined) {
                    delete store[key][field];
                } else {
                    store[key][field] = value;
                }
            },
            get: (key: string, fallback?: unknown) => {
                const entry = store[key];
                if (!entry) {
                    return fallback;
                }
                return entry.folder ?? entry.workspace ?? entry.global ?? fallback;
            },
        },
    };
}

describe('coerceLegacyBoolean', () => {
    it('passes booleans through and maps legacy tri-state strings', () => {
        expect(coerceLegacyBoolean(true, false)).toBe(true);
        expect(coerceLegacyBoolean(false, true)).toBe(false);
        expect(coerceLegacyBoolean('on', false)).toBe(true);
        expect(coerceLegacyBoolean('beta', false)).toBe(true);
        expect(coerceLegacyBoolean('off', true)).toBe(false);
        expect(coerceLegacyBoolean(undefined, true)).toBe(true);
        expect(coerceLegacyBoolean('garbage', false)).toBe(false);
    });
});

describe('removeRetiredSettings clears the former Companion-workflow gate (migration safety)', () => {
    const getConfigSpy = vscode.workspace.getConfiguration as jest.Mock;

    afterEach(() => {
        getConfigSpy.mockReset();
        getConfigSpy.mockReturnValue({ get: jest.fn().mockReturnValue(['specs']) });
    });

    it('deletes a persisted gate value at the scope it was set', async () => {
        const { store, config } = makeConfigStore({
            'companion.speckitCompanionWorkflow': { global: true },
        });
        getConfigSpy.mockReturnValue(config);

        await removeRetiredSettings();

        expect(store['companion.speckitCompanionWorkflow'].global).toBeUndefined();
    });

    it('cleans up the legacy workflowBeta / resumeBeta keys too, across scopes', async () => {
        const { store, config } = makeConfigStore({
            'companion.workflowBeta': { workspace: 'on' },
            'companion.resumeBeta': { folder: 'beta' },
        });
        getConfigSpy.mockReturnValue(config);

        await removeRetiredSettings();

        expect(store['companion.workflowBeta'].workspace).toBeUndefined();
        expect(store['companion.resumeBeta'].folder).toBeUndefined();
    });

    it('a stale gate value never fails activation — resolves without throwing', async () => {
        const { config } = makeConfigStore({
            'companion.speckitCompanionWorkflow': { global: 'garbage' },
        });
        getConfigSpy.mockReturnValue(config);

        await expect(removeRetiredSettings()).resolves.toBeUndefined();
    });

    it('is a no-op when no retired key was ever set', async () => {
        const { config } = makeConfigStore({});
        getConfigSpy.mockReturnValue(config);

        await expect(removeRetiredSettings()).resolves.toBeUndefined();
    });
});
