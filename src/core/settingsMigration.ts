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
 * Settings removed when the three spec-driven toggles collapsed into the single
 * `speckit.defaultWorkflow` picker. Their persisted values are dropped at every
 * scope on activation so they don't linger in users' settings.json.
 */
export const RETIRED_SETTINGS: ReadonlyArray<string> = [
    'companion.templateProfile',
    'companion.turboWorkflowPicker',
    'companion.complexityFastPath',
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

/**
 * Whether the SpecKit Companion workflow is enabled, resilient to a migration that
 * never ran (or threw — it's best-effort under try/catch). The renamed key
 * (`companion.speckitCompanionWorkflow`) wins when it's explicitly set at ANY scope;
 * otherwise the read falls back to the legacy `companion.workflowBeta`, then the
 * older `companion.resumeBeta` opt-in — all coerced via `coerceLegacyBoolean`. So a
 * user whose opt-in still lives only on a legacy key reads as enabled, and an
 * explicit `false` on the new key correctly overrides a stale legacy `true`.
 */
export function isCompanionWorkflowEnabled(config: vscode.WorkspaceConfiguration): boolean {
    const newInspected =
        typeof config.inspect === 'function'
            ? config.inspect<unknown>('companion.speckitCompanionWorkflow')
            : undefined;
    const explicitNew = newInspected
        ? newInspected.workspaceFolderValue ?? newInspected.workspaceValue ?? newInspected.globalValue
        : config.get<unknown>('companion.speckitCompanionWorkflow');
    if (explicitNew !== undefined) {
        return coerceLegacyBoolean(explicitNew, false);
    }
    const legacyWorkflowBeta = config.get<unknown>('companion.workflowBeta');
    if (legacyWorkflowBeta !== undefined) {
        return coerceLegacyBoolean(legacyWorkflowBeta, false);
    }
    return coerceLegacyBoolean(config.get<unknown>('companion.resumeBeta'), false);
}

/** The three config scopes a value can be explicitly set at, with their inspect field. */
const SCOPES: ReadonlyArray<{
    readonly target: vscode.ConfigurationTarget;
    readonly field: 'globalValue' | 'workspaceValue' | 'workspaceFolderValue';
}> = [
    { target: vscode.ConfigurationTarget.Global, field: 'globalValue' },
    { target: vscode.ConfigurationTarget.Workspace, field: 'workspaceValue' },
    { target: vscode.ConfigurationTarget.WorkspaceFolder, field: 'workspaceFolderValue' },
];

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
        if (!inspected) {
            continue;
        }
        for (const { target, field } of SCOPES) {
            const persisted = inspected[field];
            // Only rewrite a KNOWN legacy tri-state string. A boolean is already
            // migrated; undefined means unset at this scope; and an unknown string
            // (typo) is left untouched for VS Code to flag rather than silently
            // coerced. Fall back to the per-setting default (not a hardcoded true).
            if (persisted === 'off' || persisted === 'beta' || persisted === 'on') {
                await config.update(key, coerceLegacyBoolean(persisted, settingDefault), target);
            }
        }
    }
}

/**
 * One-time, idempotent migration of the retired `companion.resumeBeta` opt-in into
 * the single `companion.workflowBeta` gate. Per scope: when the old value coerces
 * to `true` (boolean, or legacy `'on'`/`'beta'`) AND the user hasn't already set
 * `workflowBeta` there, copy `true` across; then delete the old key at every scope
 * it was set. An off/garbage value migrates nothing but is still cleaned up. Scope
 * is preserved via per-scope `inspect()`, so re-running (old key gone) is a no-op.
 * Invoked from `activate()` inside try/catch — never throws activation (FR-005).
 */
export async function migrateResumeBetaToWorkflowBeta(): Promise<void> {
    const config = vscode.workspace.getConfiguration('speckit');
    const oldKey = 'companion.resumeBeta';
    const newKey = 'companion.workflowBeta';
    const oldInspected = config.inspect(oldKey);
    if (!oldInspected) {
        return;
    }
    const newInspected = config.inspect(newKey);
    for (const { target, field } of SCOPES) {
        const persisted = oldInspected[field];
        if (persisted === undefined) {
            continue;
        }
        const alreadySet = newInspected ? newInspected[field] !== undefined : false;
        if (coerceLegacyBoolean(persisted, false) && !alreadySet) {
            await config.update(newKey, true, target);
        }
        await config.update(oldKey, undefined, target);
    }
}

/**
 * One-time, idempotent migration of the renamed Companion-enable gate from
 * `companion.workflowBeta` to `companion.speckitCompanionWorkflow` (the key was
 * renamed so the Settings UI reads "SpecKit Companion Workflow"). Per scope: when
 * the new key isn't already set there, copy the old value across (coerced, so a
 * legacy tri-state string still carries an opt-in); then delete the old key at
 * every scope it was set. Scope is preserved via per-scope `inspect()`, so
 * re-running (old key gone) is a no-op. Invoked from `activate()` inside try/catch
 * — never throws activation.
 */
export async function migrateWorkflowBetaKey(): Promise<void> {
    const config = vscode.workspace.getConfiguration('speckit');
    const oldKey = 'companion.workflowBeta';
    const newKey = 'companion.speckitCompanionWorkflow';
    const oldInspected = config.inspect(oldKey);
    if (!oldInspected) {
        return;
    }
    const newInspected = config.inspect(newKey);
    for (const { target, field } of SCOPES) {
        const persisted = oldInspected[field];
        if (persisted === undefined) {
            continue;
        }
        const alreadySet = newInspected ? newInspected[field] !== undefined : false;
        if (!alreadySet) {
            await config.update(newKey, coerceLegacyBoolean(persisted, false), target);
        }
        await config.update(oldKey, undefined, target);
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
        if (!inspected) {
            continue;
        }
        for (const { target, field } of SCOPES) {
            if (inspected[field] !== undefined) {
                await config.update(key, undefined, target);
            }
        }
    }
}
