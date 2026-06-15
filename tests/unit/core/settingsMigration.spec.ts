import * as vscode from 'vscode';
import { migrateWorkflowBetaKey, coerceLegacyBoolean } from '../../../src/core/settingsMigration';

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

describe('migrateWorkflowBetaKey', () => {
    const getConfigSpy = vscode.workspace.getConfiguration as jest.Mock;

    afterEach(() => {
        getConfigSpy.mockReset();
        getConfigSpy.mockReturnValue({ get: jest.fn().mockReturnValue(['specs']) });
    });

    it('carries a global opt-in to the new key and drops the old key', async () => {
        const { store, config } = makeConfigStore({
            'companion.workflowBeta': { global: true },
        });
        getConfigSpy.mockReturnValue(config);

        await migrateWorkflowBetaKey();

        expect(store['companion.speckitCompanionWorkflow'].global).toBe(true);
        expect(store['companion.workflowBeta'].global).toBeUndefined();
    });

    it('coerces a legacy tri-state opt-in (on/beta) to true on the new key', async () => {
        const { store, config } = makeConfigStore({
            'companion.workflowBeta': { workspace: 'beta' },
        });
        getConfigSpy.mockReturnValue(config);

        await migrateWorkflowBetaKey();

        expect(store['companion.speckitCompanionWorkflow'].workspace).toBe(true);
        expect(store['companion.workflowBeta'].workspace).toBeUndefined();
    });

    it('does not overwrite a value already set on the new key', async () => {
        const { store, config } = makeConfigStore({
            'companion.workflowBeta': { global: true },
            'companion.speckitCompanionWorkflow': { global: false },
        });
        getConfigSpy.mockReturnValue(config);

        await migrateWorkflowBetaKey();

        expect(store['companion.speckitCompanionWorkflow'].global).toBe(false);
        expect(store['companion.workflowBeta'].global).toBeUndefined();
    });

    it('is a no-op when the old key was never set', async () => {
        const { store, config } = makeConfigStore({});
        getConfigSpy.mockReturnValue(config);

        await migrateWorkflowBetaKey();

        expect(store['companion.speckitCompanionWorkflow']).toBeUndefined();
    });

    it('preserves scope (a workspace opt-in does not become global)', async () => {
        const { store, config } = makeConfigStore({
            'companion.workflowBeta': { workspace: true },
        });
        getConfigSpy.mockReturnValue(config);

        await migrateWorkflowBetaKey();

        expect(store['companion.speckitCompanionWorkflow'].workspace).toBe(true);
        expect(store['companion.speckitCompanionWorkflow'].global).toBeUndefined();
    });
});
