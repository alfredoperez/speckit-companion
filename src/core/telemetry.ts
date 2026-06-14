/**
 * Anonymous, PII-free telemetry for provider / pipeline-profile / beta-flag
 * adoption and the spec lifecycle.
 *
 * Single home for: the committed connection string, the {@link TelemetryService}
 * wrapper around `@vscode/extension-telemetry`, and the helpers that read a
 * spec's profile + telemetry correlation id off `.spec-context.json`.
 *
 * Privacy contract: every payload carries only enum-like values, booleans,
 * versions, counts, and a random per-spec UUID — never prompt content, file
 * paths, spec names, or custom workflow names.
 */

import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { TelemetryReporter } from '@vscode/extension-telemetry';
import { ConfigKeys, WorkflowSteps } from './constants';
import { coerceLegacyBoolean } from './settingsMigration';
import { readSpecContextSync, SPEC_CONTEXT_FILENAME } from '../features/specs/specContextReader';
import { updateSpecContext } from '../features/specs/specContextWriter';

/**
 * Application Insights connection string. This is a **write-only ingestion
 * credential** — it can only push events, never read them — so it is safe to
 * commit (per the tracking issue).
 */
export const APP_INSIGHTS_CONNECTION_STRING =
    'InstrumentationKey=536761b8-e09d-4c53-8c7b-23b54523c17f;IngestionEndpoint=https://southcentralus-3.in.applicationinsights.azure.com/;LiveEndpoint=https://southcentralus.livediagnostics.monitor.azure.com/;ApplicationId=08e87c2e-a745-4eca-90e3-e00bae6f4256';

export type TelemetryProperties = Record<string, string>;

/** Canonical built-in lifecycle phases — the only step names sent verbatim. */
const BUILT_IN_PHASES: ReadonlySet<string> = new Set([
    WorkflowSteps.SPECIFY,
    WorkflowSteps.PLAN,
    WorkflowSteps.TASKS,
    WorkflowSteps.IMPLEMENT,
]);

/**
 * Map a workflow step name to the value reported as `phase`: the built-in step
 * verbatim, or the literal `"custom"` for any user-defined workflow step
 * (privacy: a custom workflow's step names are user-authored — never send them).
 */
export function phaseTelemetryId(stepName: string): string {
    return BUILT_IN_PHASES.has(stepName) ? stepName : 'custom';
}

/**
 * Coerce a `.spec-context.json` `profile` to the reported enum. The on-disk
 * value is user/hook-authored free text, so anything other than the two known
 * profiles is dropped (returns `undefined`) — never sent verbatim.
 */
export function profileTelemetryId(profile: string | undefined): 'standard' | 'turbo' | undefined {
    return profile === 'turbo' ? 'turbo' : profile === 'standard' ? 'standard' : undefined;
}

/**
 * Coerce the `speckit.defaultWorkflow` setting to its allow-list before reporting.
 * The setting is an enum, but settings.json accepts arbitrary strings — anything
 * other than `companion` is reported as the default `'speckit'`, never sent
 * verbatim (privacy contract: a custom workflow name is user-authored).
 */
export function defaultWorkflowTelemetryId(value: string | undefined): 'speckit' | 'companion' {
    return value === 'companion' ? 'companion' : 'speckit';
}

/** The beta-flag + workflow states reported with `extension.activated`. */
export interface BetaSnapshot {
    defaultWorkflow: string;
    workflowBeta: string;
    activityPanel: string;
    installPrompt: string;
    telemetry: string;
}

/** Read the reported `speckit.*` settings into a string-valued snapshot. */
export function buildBetaSnapshot(): BetaSnapshot {
    const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
    const bool = (key: string, fallback: boolean): string =>
        String(config.get<boolean>(key, fallback));
    // The former tri-state settings (#259) funnel through coerceLegacyBoolean
    // so an un-migrated scope reports a clean boolean, not a stale 'beta'/'on'/'off'.
    const coerced = (key: string, fallback: boolean): string =>
        String(coerceLegacyBoolean(config.get<unknown>(key), fallback));
    return {
        defaultWorkflow: defaultWorkflowTelemetryId(config.get<string>('defaultWorkflow', 'speckit')),
        // Coerced (not bool): workflowBeta inherits migrated resumeBeta values, so an
        // un-migrated scope could still hold a legacy 'on'/'beta' string — report a clean boolean.
        workflowBeta: coerced('companion.workflowBeta', false),
        activityPanel: coerced('viewer.activityPanel', true),
        installPrompt: coerced('companion.installPrompt', true),
        telemetry: bool('telemetry', true),
    };
}

/**
 * Per-spec telemetry correlation context: the spec's pipeline profile and a
 * stable random id. The id is minted + persisted lazily on first read for a
 * spec that has none yet (created before this feature, or by a hook).
 */
export interface SpecTelemetryContext {
    profile?: string;
    specInstanceId?: string;
}

/**
 * Read a spec's `{ profile, telemetryInstanceId }`. When the spec exists on
 * disk but carries no id, generate one and persist it (so the same id rides
 * every later event for this spec). A spec with no `.spec-context.json` yields
 * an empty context — the id is minted by the create path instead.
 */
export function getSpecTelemetryContext(specDir: string): SpecTelemetryContext {
    let ctx;
    try {
        ctx = readSpecContextSync(specDir);
    } catch {
        return {};
    }
    if (!ctx) return {};

    if (ctx.telemetryInstanceId) {
        return { profile: profileTelemetryId(ctx.profile), specInstanceId: ctx.telemetryInstanceId };
    }

    const id = crypto.randomUUID();
    // Persist the freshly-minted id via a re-read-then-set mutator, so a skill /
    // hook write that lands between our read above and this write isn't clobbered
    // (we touch only telemetryInstanceId). Fire-and-forget: a failed backfill is
    // non-fatal — the id is still returned for this in-flight event.
    void updateSpecContext(specDir, c => ({ ...c, telemetryInstanceId: id }), ctx).catch(() => {
        /* a failed backfill is non-fatal — the id is still used for this event */
    });
    return { profile: profileTelemetryId(ctx.profile), specInstanceId: id };
}

/**
 * Wraps `TelemetryReporter`. Constructed only when the connection string is
 * non-empty; `sendEvent` fires only when the reporter exists AND
 * `speckit.telemetry` is true (the reporter adds VS Code's global-telemetry
 * gate on top).
 */
export class TelemetryService {
    private reporter: TelemetryReporter | undefined;

    constructor(connectionString: string = APP_INSIGHTS_CONNECTION_STRING) {
        if (connectionString) {
            this.reporter = new TelemetryReporter(connectionString);
        }
    }

    private isEnabled(): boolean {
        return vscode.workspace
            .getConfiguration(ConfigKeys.namespace)
            .get<boolean>('telemetry', true);
    }

    sendEvent(name: string, properties?: TelemetryProperties): void {
        if (!this.reporter) return;
        if (!this.isEnabled()) return;
        this.reporter.sendTelemetryEvent(name, properties);
    }

    dispose(): void {
        void this.reporter?.dispose();
    }
}

let singleton: TelemetryService | undefined;

/** Initialize the module-level telemetry singleton (called once in `activate`). */
export function initTelemetry(service: TelemetryService): void {
    singleton = service;
}

/**
 * Fire a telemetry event through the singleton. A no-op before init or when
 * telemetry is disabled — so event sites can call this unconditionally.
 */
export function sendTelemetryEvent(name: string, properties?: TelemetryProperties): void {
    singleton?.sendEvent(name, properties);
}

// Re-export so call sites importing from this module have the filename handy.
export { SPEC_CONTEXT_FILENAME };
