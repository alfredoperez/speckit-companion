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
import { ConfigKeys } from './constants';
import { readSpecContextSync, SPEC_CONTEXT_FILENAME } from '../features/specs/specContextReader';
import { writeSpecContext } from '../features/specs/specContextWriter';

/**
 * Application Insights connection string. This is a **write-only ingestion
 * credential** — it can only push events, never read them — so it is safe to
 * commit (per the tracking issue).
 */
export const APP_INSIGHTS_CONNECTION_STRING =
    'InstrumentationKey=536761b8-e09d-4c53-8c7b-23b54523c17f;IngestionEndpoint=https://southcentralus-3.in.applicationinsights.azure.com/;LiveEndpoint=https://southcentralus.livediagnostics.monitor.azure.com/;ApplicationId=08e87c2e-a745-4eca-90e3-e00bae6f4256';

export type TelemetryProperties = Record<string, string>;

/** The seven beta-flag states reported with `extension.activated`. */
export interface BetaSnapshot {
    templateProfile: string;
    complexityFastPath: string;
    turboWorkflowPicker: string;
    resumeBeta: string;
    activityPanel: string;
    installPrompt: string;
    telemetry: string;
}

/** Read the seven `speckit.*` beta-flag settings into a string-valued snapshot. */
export function buildBetaSnapshot(): BetaSnapshot {
    const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
    const bool = (key: string, fallback: boolean): string =>
        String(config.get<boolean>(key, fallback));
    return {
        templateProfile: config.get<string>('companion.templateProfile', 'off'),
        complexityFastPath: bool('companion.complexityFastPath', false),
        turboWorkflowPicker: bool('companion.turboWorkflowPicker', true),
        resumeBeta: bool('companion.resumeBeta', false),
        activityPanel: bool('viewer.activityPanel', true),
        installPrompt: bool('companion.installPrompt', true),
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
        return { profile: ctx.profile, specInstanceId: ctx.telemetryInstanceId };
    }

    const id = crypto.randomUUID();
    // Persist the freshly-minted id; tolerate a write failure (still return it
    // for this event so the in-flight event is correlated).
    void writeSpecContext(specDir, { ...ctx, telemetryInstanceId: id }).catch(() => {
        /* a failed backfill is non-fatal — the id is still used for this event */
    });
    return { profile: ctx.profile, specInstanceId: id };
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
