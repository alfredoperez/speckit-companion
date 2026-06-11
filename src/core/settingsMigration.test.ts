import * as vscode from 'vscode';
import {
    coerceLegacyBoolean,
    migrateBetaTriStateSettings,
    BETA_BOOLEAN_SETTINGS,
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
            'viewer.activityPanel': {},
            'companion.turboWorkflowPicker': { workspaceValue: 'on' },
            'companion.installPrompt': { workspaceFolderValue: 'off' },
        });

        await migrateBetaTriStateSettings();

        expect(update).toHaveBeenCalledWith(
            'companion.turboWorkflowPicker',
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

    it('covers all three former tri-state settings', () => {
        expect(BETA_BOOLEAN_SETTINGS.map(s => s.key)).toEqual([
            'viewer.activityPanel',
            'companion.turboWorkflowPicker',
            'companion.installPrompt',
        ]);
    });
});
