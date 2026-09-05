import * as vscode from 'vscode';
import {
    coerceLegacyBoolean,
    migrateBetaTriStateSettings,
    mergeNotificationSettings,
    removeRetiredSettings,
    BETA_BOOLEAN_SETTINGS,
    RETIRED_SETTINGS,
} from './settingsMigration';

type Inspection = { globalValue?: unknown; workspaceValue?: unknown; workspaceFolderValue?: unknown };

function setupConfig(inspections: Record<string, Inspection | undefined>) {
    const update = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        inspect: jest.fn((key: string) => inspections[key]),
        update,
        get: jest.fn(),
    } as unknown as vscode.WorkspaceConfiguration);
    return { update };
}

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
            'companion.installPrompt': { globalValue: 'off' },
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
            vscode.ConfigurationTarget.Global
        );
    });

    it('never writes the WorkspaceFolder tier even when a folder value is reported', async () => {
        const { update } = setupConfig({
            'viewer.activityPanel': { globalValue: 'beta', workspaceFolderValue: 'on' },
            'companion.installPrompt': {},
        });

        await migrateBetaTriStateSettings();

        expect(update).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith('viewer.activityPanel', true, vscode.ConfigurationTarget.Global);
    });

    it('keeps migrating the next key after one write is rejected', async () => {
        const { update } = setupConfig({
            'viewer.activityPanel': { globalValue: 'beta' },
            'companion.installPrompt': { globalValue: 'off' },
        });
        update.mockRejectedValueOnce(new Error('settings.json parse error'));
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        await expect(migrateBetaTriStateSettings()).resolves.toBeUndefined();

        expect(update).toHaveBeenCalledWith('companion.installPrompt', false, vscode.ConfigurationTarget.Global);
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

describe('removeRetiredSettings', () => {
    afterEach(() => jest.restoreAllMocks());

    it('lists the retired toggles, the former Companion-workflow gate keys, and the merged-away phase-completion toggle', () => {
        expect([...RETIRED_SETTINGS]).toEqual([
            'companion.templateProfile',
            'companion.turboWorkflowPicker',
            'companion.complexityFastPath',
            'companion.speckitCompanionWorkflow',
            'companion.workflowBeta',
            'companion.resumeBeta',
            'notifications.phaseCompletion',
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

    it('cleans up a stale Companion-workflow gate value without crashing (migration safety)', async () => {
        const { update } = setupConfig({
            'companion.speckitCompanionWorkflow': { globalValue: true },
            'companion.workflowBeta': { workspaceValue: 'on' },
            'companion.resumeBeta': { workspaceValue: 'beta' },
        });

        await expect(removeRetiredSettings()).resolves.toBeUndefined();

        expect(update).toHaveBeenCalledWith(
            'companion.speckitCompanionWorkflow',
            undefined,
            vscode.ConfigurationTarget.Global
        );
        expect(update).toHaveBeenCalledWith(
            'companion.workflowBeta',
            undefined,
            vscode.ConfigurationTarget.Workspace
        );
        expect(update).toHaveBeenCalledWith(
            'companion.resumeBeta',
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

describe('mergeNotificationSettings', () => {
    afterEach(() => jest.restoreAllMocks());

    it('turns stepComplete off at the scope where phaseCompletion was false', async () => {
        const { update } = setupConfig({
            'notifications.phaseCompletion': { globalValue: false },
            'notifications.stepComplete': {},
        });

        await mergeNotificationSettings();

        expect(update).toHaveBeenCalledWith(
            'notifications.stepComplete',
            false,
            vscode.ConfigurationTarget.Global
        );
    });

    it('forces stepComplete off even when it was explicitly true (either-false wins)', async () => {
        const { update } = setupConfig({
            'notifications.phaseCompletion': { workspaceValue: false },
            'notifications.stepComplete': { workspaceValue: true },
        });

        await mergeNotificationSettings();

        expect(update).toHaveBeenCalledWith(
            'notifications.stepComplete',
            false,
            vscode.ConfigurationTarget.Workspace
        );
    });

    it('preserves a narrower explicit true override (phase false@User + true@Workspace)', async () => {
        const { update } = setupConfig({
            'notifications.phaseCompletion': { globalValue: false, workspaceValue: true },
            'notifications.stepComplete': {},
        });

        await mergeNotificationSettings();

        expect(update).toHaveBeenCalledWith(
            'notifications.stepComplete',
            false,
            vscode.ConfigurationTarget.Global
        );
        expect(update).toHaveBeenCalledWith(
            'notifications.stepComplete',
            true,
            vscode.ConfigurationTarget.Workspace
        );
    });

    it('is a no-op when phaseCompletion is unset at every scope', async () => {
        const { update } = setupConfig({
            'notifications.phaseCompletion': {},
            'notifications.stepComplete': {},
        });

        await mergeNotificationSettings();

        expect(update).not.toHaveBeenCalled();
    });

    it('is a no-op when stepComplete is already false at that scope (idempotent)', async () => {
        const { update } = setupConfig({
            'notifications.phaseCompletion': { globalValue: false },
            'notifications.stepComplete': { globalValue: false },
        });

        await mergeNotificationSettings();

        expect(update).not.toHaveBeenCalled();
    });

    it('does not crash when phaseCompletion inspect returns undefined', async () => {
        const { update } = setupConfig({});
        await expect(mergeNotificationSettings()).resolves.toBeUndefined();
        expect(update).not.toHaveBeenCalled();
    });
});
