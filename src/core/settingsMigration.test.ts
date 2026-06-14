import * as vscode from 'vscode';
import {
    coerceLegacyBoolean,
    migrateBetaTriStateSettings,
    migrateResumeBetaToWorkflowBeta,
    removeRetiredSettings,
    BETA_BOOLEAN_SETTINGS,
    RETIRED_SETTINGS,
} from './settingsMigration';

describe('coerceLegacyBoolean', () => {
    it('maps legacy "beta" and "on" strings to true', () => {
        expect(coerceLegacyBoolean('beta', false)).toBe(true);
        expect(coerceLegacyBoolean('on', false)).toBe(true);
    });

    it('maps legacy "off" string to false', () => {
        expect(coerceLegacyBoolean('off', true)).toBe(false);
    });

    it('passes real booleans through unchanged', () => {
        expect(coerceLegacyBoolean(true, false)).toBe(true);
        expect(coerceLegacyBoolean(false, true)).toBe(false);
    });

    it('falls back for undefined / unknown values', () => {
        expect(coerceLegacyBoolean(undefined, true)).toBe(true);
        expect(coerceLegacyBoolean(undefined, false)).toBe(false);
        expect(coerceLegacyBoolean('weird', true)).toBe(true);
        expect(coerceLegacyBoolean(42, false)).toBe(false);
    });
});

describe('migrateBetaTriStateSettings', () => {
    type Inspection = {
        globalValue?: unknown;
        workspaceValue?: unknown;
        workspaceFolderValue?: unknown;
    };

    function setupConfig(inspections: Record<string, Inspection>) {
        const update = jest.fn().mockResolvedValue(undefined);
        const inspect = jest.fn((key: string) => inspections[key]);
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            inspect,
            update,
            get: jest.fn(),
        } as unknown as vscode.WorkspaceConfiguration);
        return { update, inspect };
    }

    afterEach(() => jest.restoreAllMocks());

    it('rewrites a legacy "beta" string to true at the global scope', async () => {
        const { update } = setupConfig({
            'viewer.activityPanel': { globalValue: 'beta' },
            'companion.turboWorkflowPicker': {},
            'companion.installPrompt': {},
        });

        await migrateBetaTriStateSettings();

        expect(update).toHaveBeenCalledWith(
            'viewer.activityPanel',
            true,
            vscode.ConfigurationTarget.Global
        );
    });

    it('rewrites legacy "on" → true and "off" → false at their set scopes', async () => {
        const { update } = setupConfig({
            'viewer.activityPanel': { workspaceValue: 'on' },
            'companion.installPrompt': { workspaceFolderValue: 'off' },
        });

        await migrateBetaTriStateSettings();

        expect(update).toHaveBeenCalledWith(
            'viewer.activityPanel',
            true,
            vscode.ConfigurationTarget.Workspace
        );
        expect(update).toHaveBeenCalledWith(
            'companion.installPrompt',
            false,
            vscode.ConfigurationTarget.WorkspaceFolder
        );
    });

    it('preserves scope: a global override is not relocated to workspace', async () => {
        const { update } = setupConfig({
            'viewer.activityPanel': { globalValue: 'off' },
            'companion.turboWorkflowPicker': {},
            'companion.installPrompt': {},
        });

        await migrateBetaTriStateSettings();

        expect(update).toHaveBeenCalledWith(
            'viewer.activityPanel',
            false,
            vscode.ConfigurationTarget.Global
        );
        // Only the global scope was touched.
        expect(update).toHaveBeenCalledTimes(1);
    });

    it('is a no-op for already-boolean and unset values (idempotent)', async () => {
        const { update } = setupConfig({
            'viewer.activityPanel': { globalValue: true },
            'companion.turboWorkflowPicker': { workspaceValue: false },
            'companion.installPrompt': {},
        });

        await migrateBetaTriStateSettings();

        expect(update).not.toHaveBeenCalled();
    });

    it('leaves an unknown (non-legacy) string untouched rather than coercing it', async () => {
        const { update } = setupConfig({
            'viewer.activityPanel': { globalValue: 'maybe' },
            'companion.turboWorkflowPicker': {},
            'companion.installPrompt': {},
        });

        await migrateBetaTriStateSettings();

        // Only the three known legacy strings ('off'/'beta'/'on') are migrated;
        // a typo is left for VS Code to flag, not silently rewritten to a boolean.
        expect(update).not.toHaveBeenCalled();
    });

    it('covers the remaining tri-state settings (turboWorkflowPicker retired)', () => {
        expect(BETA_BOOLEAN_SETTINGS.map(s => s.key)).toEqual([
            'viewer.activityPanel',
            'companion.installPrompt',
        ]);
    });
});

describe('migrateResumeBetaToWorkflowBeta', () => {
    type Inspection = {
        globalValue?: unknown;
        workspaceValue?: unknown;
        workspaceFolderValue?: unknown;
    };

    const OLD = 'companion.resumeBeta';
    const NEW = 'companion.workflowBeta';

    function setupConfig(inspections: Record<string, Inspection | undefined>) {
        const update = jest.fn().mockResolvedValue(undefined);
        const inspect = jest.fn((key: string) => inspections[key]);
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            inspect,
            update,
            get: jest.fn(),
        } as unknown as vscode.WorkspaceConfiguration);
        return { update, inspect };
    }

    afterEach(() => jest.restoreAllMocks());

    it.each([true, 'on', 'beta'])(
        'migrates an on-style value (%p) to workflowBeta=true and deletes the old key at the same scope',
        async (value) => {
            const { update } = setupConfig({
                [OLD]: { globalValue: value },
                [NEW]: {},
            });

            await migrateResumeBetaToWorkflowBeta();

            expect(update).toHaveBeenCalledWith(NEW, true, vscode.ConfigurationTarget.Global);
            expect(update).toHaveBeenCalledWith(OLD, undefined, vscode.ConfigurationTarget.Global);
            expect(update).toHaveBeenCalledTimes(2);
        }
    );

    it.each([false, 'off', 'xyz', 42])(
        'leaves workflowBeta untouched for an off/garbage value (%p) but still deletes the old key',
        async (value) => {
            const { update } = setupConfig({
                [OLD]: { workspaceValue: value },
                [NEW]: {},
            });

            await migrateResumeBetaToWorkflowBeta();

            expect(update).not.toHaveBeenCalledWith(NEW, expect.anything(), expect.anything());
            expect(update).toHaveBeenCalledWith(OLD, undefined, vscode.ConfigurationTarget.Workspace);
            expect(update).toHaveBeenCalledTimes(1);
        }
    );

    it('preserves scope: a global opt-in migrates at Global, not relocated to Workspace', async () => {
        const { update } = setupConfig({
            [OLD]: { globalValue: true },
            [NEW]: {},
        });

        await migrateResumeBetaToWorkflowBeta();

        expect(update).toHaveBeenCalledWith(NEW, true, vscode.ConfigurationTarget.Global);
        expect(update).not.toHaveBeenCalledWith(NEW, true, vscode.ConfigurationTarget.Workspace);
    });

    it('is a no-op when the old key was never set (nothing to migrate or delete)', async () => {
        const { update } = setupConfig({
            [OLD]: {},
            [NEW]: {},
        });

        await migrateResumeBetaToWorkflowBeta();

        expect(update).not.toHaveBeenCalled();
    });

    it('does not overwrite a workflowBeta the user already set explicitly at that scope', async () => {
        const { update } = setupConfig({
            [OLD]: { globalValue: true },
            [NEW]: { globalValue: false },
        });

        await migrateResumeBetaToWorkflowBeta();

        // The explicit new value wins; only the stale old key is removed.
        expect(update).not.toHaveBeenCalledWith(NEW, true, vscode.ConfigurationTarget.Global);
        expect(update).toHaveBeenCalledWith(OLD, undefined, vscode.ConfigurationTarget.Global);
        expect(update).toHaveBeenCalledTimes(1);
    });

    it('is idempotent: a re-run after the old key is gone writes nothing', async () => {
        const { update } = setupConfig({
            [OLD]: {},
            [NEW]: { globalValue: true },
        });

        await migrateResumeBetaToWorkflowBeta();

        expect(update).not.toHaveBeenCalled();
    });

    it('does not crash when inspect returns undefined for the old key', async () => {
        setupConfig({ [NEW]: {} });
        await expect(migrateResumeBetaToWorkflowBeta()).resolves.toBeUndefined();
    });
});

describe('removeRetiredSettings', () => {
    type Inspection = {
        globalValue?: unknown;
        workspaceValue?: unknown;
        workspaceFolderValue?: unknown;
    };

    function setupConfig(inspections: Record<string, Inspection | undefined>) {
        const update = jest.fn().mockResolvedValue(undefined);
        const inspect = jest.fn((key: string) => inspections[key]);
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            inspect,
            update,
            get: jest.fn(),
        } as unknown as vscode.WorkspaceConfiguration);
        return { update, inspect };
    }

    afterEach(() => jest.restoreAllMocks());

    it('lists exactly the three retired keys', () => {
        expect([...RETIRED_SETTINGS]).toEqual([
            'companion.templateProfile',
            'companion.turboWorkflowPicker',
            'companion.complexityFastPath',
        ]);
    });

    it('deletes a persisted retired key at the scope it was set (update to undefined)', async () => {
        const { update } = setupConfig({
            'companion.templateProfile': { globalValue: 'turbo' },
            'companion.turboWorkflowPicker': { workspaceValue: true },
            'companion.complexityFastPath': {},
        });

        await removeRetiredSettings();

        expect(update).toHaveBeenCalledWith(
            'companion.templateProfile',
            undefined,
            vscode.ConfigurationTarget.Global
        );
        expect(update).toHaveBeenCalledWith(
            'companion.turboWorkflowPicker',
            undefined,
            vscode.ConfigurationTarget.Workspace
        );
    });

    it('is a no-op when no retired key is set (idempotent)', async () => {
        const { update } = setupConfig({
            'companion.templateProfile': {},
            'companion.turboWorkflowPicker': {},
            'companion.complexityFastPath': {},
        });

        await removeRetiredSettings();

        expect(update).not.toHaveBeenCalled();
    });

    it('does not crash when inspect returns undefined for a key', async () => {
        setupConfig({});
        await expect(removeRetiredSettings()).resolves.toBeUndefined();
    });
});
