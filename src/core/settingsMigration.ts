import * as vscode from 'vscode';

/**
 * Migration + defensive coercion for the three former tri-state beta settings
 * (#259). These were `'off' | 'beta' | 'on'` string enums where `beta` and `on`
 * behaved identically (they differed only by a redundant in-UI badge). They are
 * now plain booleans. This module:
 *
 *  1. Coerces a persisted value to a boolean at read time, tolerating BOTH a
 *     legacy string AND a real boolean (`coerceLegacyBoolean`) — so a reader is
 *     correct even before the migration has run or for an un-migrated scope.
 *  2. Rewrites any persisted legacy string in `settings.json` to its boolean
 *     equivalent at the same config scope, once, at activation
 *     (`migrateBetaTriStateSettings`).
 *
 * Mapping: `'beta'` / `'on'` → `true`, `'off'` → `false`. This preserves every
 * existing user's effective on/off state (no surprise flip).
 */

/** Settings whose legacy `'off' | 'beta' | 'on'` strings migrate to booleans. */
export const BETA_BOOLEAN_SETTINGS: ReadonlyArray<{
    /** Key relative to the `speckit` configuration section. */
    readonly key: string;
    /** Boolean default once migrated (matches the pre-migration effective default). */
    readonly default: boolean;
}> = [
    { key: 'viewer.activityPanel', default: true },
    { key: 'companion.installPrompt', default: true },
];

/**
 * Settings that no longer exist in the manifest. Their persisted values are
 * dropped at every scope on activation so they don't linger in users' settings.json.
 * Covers the collapsed spec-driven toggles and the retired Companion-workflow beta
 * gate (plus its two legacy key names). VS Code tolerates unknown keys either way;
 * this just keeps settings tidy.
 */
export const RETIRED_SETTINGS: ReadonlyArray<string> = [
    'companion.templateProfile',
    'companion.turboWorkflowPicker',
    'companion.complexityFastPath',
    'companion.speckitCompanionWorkflow',
    'companion.workflowBeta',
    'companion.resumeBeta',
    'notifications.phaseCompletion',
];

/**
 * Coerce a persisted setting value to a boolean, tolerating the legacy tri-state
 * strings. `true`/`false` pass through; `'beta'`/`'on'` → `true`; `'off'` → `false`;
 * anything else (undefined, unknown string) → `fallback`.
 *
 * Every reader of the three settings funnels through this so the live read is a
 * boolean regardless of whether the migration has rewritten settings.json yet.
 */
export function coerceLegacyBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (value === 'beta' || value === 'on') {
        return true;
    }
    if (value === 'off') {
        return false;
    }
    return fallback;
}

/** The two scopes a `speckit.*` value can be set at. Every key is window- or machine-scoped, so VS Code rejects folder-level writes. */
const SCOPES: ReadonlyArray<{
    readonly target: vscode.ConfigurationTarget;
    readonly field: 'globalValue' | 'workspaceValue';
}> = [
    { target: vscode.ConfigurationTarget.Global, field: 'globalValue' },
    { target: vscode.ConfigurationTarget.Workspace, field: 'workspaceValue' },
];

async function tryUpdate(config: vscode.WorkspaceConfiguration, key: string, value: unknown, target: vscode.ConfigurationTarget): Promise<void> {
    try {
        await config.update(key, value, target);
    } catch (err) {
        console.warn(`[settings-migration] ${key} write at target ${target} rejected: ${err instanceof Error ? err.message : String(err)}`);
    }
}

/**
 * One-time, idempotent migration: for each former tri-state setting, rewrite any
 * persisted *string* value to its boolean equivalent at the same scope it was set.
 * Values already boolean (or unset) are left untouched, so re-running is a no-op.
 * Scope is preserved via per-scope `inspect()` so a global vs. workspace override
 * isn't relocated.
 */
export async function migrateBetaTriStateSettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('speckit');
    for (const { key, default: settingDefault } of BETA_BOOLEAN_SETTINGS) {
        const inspected = config.inspect(key);
        for (const { target, field } of SCOPES) {
            const persisted = inspected?.[field];
            // Only rewrite a KNOWN legacy tri-state string. A boolean is already
            // migrated; undefined means unset at this scope; and an unknown string
            // (typo) is left untouched for VS Code to flag rather than silently
            // coerced. Fall back to the per-setting default (not a hardcoded true).
            if (persisted === 'off' || persisted === 'beta' || persisted === 'on') {
                await tryUpdate(config, key, coerceLegacyBoolean(persisted, settingDefault), target);
            }
        }
    }
}

/**
 * One-time, idempotent merge of the two former notification toggles into the
 * single survivor `notifications.stepComplete`. The deprecated
 * `notifications.phaseCompletion` is dropped by `removeRetiredSettings`; this
 * runs first so a user's explicit phase-completion preference survives on the
 * merged toggle. At every scope where `phaseCompletion` was explicitly set, the
 * merged value is the either-false-wins combination of the two explicit values
 * at that scope (`false` if either is `false`, else `true`) and is written only
 * when it differs from the current `stepComplete` at that scope. This both
 * propagates a broad `false` down AND preserves a narrower explicit `true`
 * override (e.g. `false` at User + `true` at Workspace stays ON at Workspace).
 * Scopes where `phaseCompletion` is unset are left untouched. Scope is preserved
 * via per-scope `inspect()`.
 */
export async function mergeNotificationSettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('speckit');
    const phase = config.inspect('notifications.phaseCompletion');
    const step = config.inspect('notifications.stepComplete');
    for (const { target, field } of SCOPES) {
        const phaseVal = phase?.[field];
        if (phaseVal === undefined) {
            continue;
        }
        const stepVal = step?.[field];
        const merged = phaseVal === false || stepVal === false ? false : true;
        if (merged !== stepVal) {
            await tryUpdate(config, 'notifications.stepComplete', merged, target);
        }
    }
}

/**
 * One-time, idempotent cleanup: remove any persisted value for the retired
 * spec-driven toggles from settings.json at every scope. Setting a key to
 * `undefined` deletes it at that scope; a key that was never set is skipped, so
 * re-running is a no-op. Activation tolerates these keys whether or not this runs
 * (VS Code ignores unknown keys) — this just keeps users' settings tidy (FR-004).
 */
export async function removeRetiredSettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('speckit');
    for (const key of RETIRED_SETTINGS) {
        const inspected = config.inspect(key);
        for (const { target, field } of SCOPES) {
            if (inspected?.[field] !== undefined) {
                await tryUpdate(config, key, undefined, target);
            }
        }
    }
}
