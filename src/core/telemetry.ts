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

/** The workflow + feature-flag states reported with `extension.activated`. */
export interface BetaSnapshot {
    defaultWorkflow: string;
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
        activityPanel: coerced('viewer.activityPanel', true),
        installPrompt: coerced('companion.installPrompt', true),
        telemetry: bool('telemetry', true),
    };
}

/** The per-activation facts reported once with `extension.activated`. */
export interface ActivationSnapshot {
    extensionVersion: string;
    vscodeVersion: string;
    speckitCliVersion: string;
    specCount: number;
    companionInstalled: boolean;
}

/**
 * Assemble the `extension.activated` payload from the activation facts plus the
 * settings snapshot. All values are stringified booleans, versions, counts, and
 * enum-like snapshot fields — no identifier or path. `companionInstalled` reports
 * whether the companion spec-kit extension is present in the active workspace.
 */
export function buildActivatedProperties(snapshot: ActivationSnapshot): TelemetryProperties {
    return {
        extensionVersion: snapshot.extensionVersion,
        vscodeVersion: snapshot.vscodeVersion,
        speckitCliVersion: snapshot.speckitCliVersion,
        specCount: String(snapshot.specCount),
        companionInstalled: String(snapshot.companionInstalled),
        ...buildBetaSnapshot(),
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

    sendEvent(name: string, properties?: TelemetryProperties): boolean {
        if (!this.reporter) return false;
        if (!this.isEnabled()) return false;
        this.reporter.sendTelemetryEvent(name, properties);
        return true;
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
export function sendTelemetryEvent(name: string, properties?: TelemetryProperties): boolean {
    return singleton?.sendEvent(name, properties) ?? false;
}

/** The two banner surfaces the install prompt appears on. */
export type InstallPromptSurface = 'createSpec' | 'activity';

/** The two funnel moments measured for the install banner. */
export type InstallPromptAction = 'shown' | 'clicked';

/** Event carrying the install-banner funnel: `action` (shown/clicked) × `surface`. */
export const INSTALL_PROMPT_EVENT = 'companion.installPrompt';

// Dedupe "shown" per session: the banner is server-rendered and re-emitted on every webview refresh.
const installPromptShownSurfaces = new Set<InstallPromptSurface>();

/**
 * Emit the install-banner "shown" event once per surface per session. The
 * `surface`/`action` values are fixed literals produced only by our own call
 * sites (never user data), so they satisfy the privacy allow-list as-is.
 */
export function reportInstallPromptShown(surface: InstallPromptSurface): void {
    if (installPromptShownSurfaces.has(surface)) return;
    // Only burn the dedupe slot on a real emit — a show while telemetry is off/uninitialized must still be able to fire once it's enabled.
    if (sendTelemetryEvent(INSTALL_PROMPT_EVENT, { action: 'shown', surface })) {
        installPromptShownSurfaces.add(surface);
    }
}

/** Emit the install-banner "clicked" event tagged with the surface it came from. */
export function reportInstallPromptClicked(surface: InstallPromptSurface): void {
    sendTelemetryEvent(INSTALL_PROMPT_EVENT, { action: 'clicked', surface });
}

/** Reset the per-session "shown" dedupe. Test-only — never called in production. */
export function __resetInstallPromptShownDedupe(): void {
    installPromptShownSurfaces.clear();
}

/**
 * Engagement events the extension can observe directly (a terminal-created spec
 * never fires `spec.created`). Every one is a BARE event — no spec name, path,
 * capability name, or any other identifier rides as a property (privacy contract).
 */
export const SPEC_OPENED_EVENT = 'spec.opened';
export const LIVING_SPEC_OPENED_EVENT = 'livingSpec.opened';
export const LIVING_SPEC_DRIFT_EVENT = 'livingSpec.drift';
export const LIVING_SPEC_SYNC_EVENT = 'livingSpec.sync';
export const STEERING_OPENED_EVENT = 'steering.opened';

// Dedupe the two "opened-in-viewer" events per session: the viewer re-renders and
// re-reveals the same panel constantly, and each pass would otherwise re-emit. The
// key is an internal identity (a spec directory for spec.opened, a capability name
// for livingSpec.opened) used ONLY as a Set member — it is never sent as a property,
// so distinct-open counts stay honest without emitting an identifier.
const specOpenedKeys = new Set<string>();
const livingSpecOpenedKeys = new Set<string>();

/**
 * Emit `spec.opened` once per spec per session. `specKey` is an internal dedupe
 * key (never emitted). Records the dedupe only AFTER a real emit, so an open while
 * telemetry is off/uninitialized can still fire once it's enabled (the #506 rule).
 */
export function reportSpecOpened(specKey: string): void {
    if (specOpenedKeys.has(specKey)) return;
    if (sendTelemetryEvent(SPEC_OPENED_EVENT)) {
        specOpenedKeys.add(specKey);
    }
}

/** Emit `livingSpec.opened` once per capability per session (same dedupe rules as {@link reportSpecOpened}). */
export function reportLivingSpecOpened(specKey: string): void {
    if (livingSpecOpenedKeys.has(specKey)) return;
    if (sendTelemetryEvent(LIVING_SPEC_OPENED_EVENT)) {
        livingSpecOpenedKeys.add(specKey);
    }
}

/** Emit `livingSpec.drift` — the drift report ran. A user-initiated run, counted each time. */
export function reportLivingSpecDrift(): void {
    sendTelemetryEvent(LIVING_SPEC_DRIFT_EVENT);
}

/** Emit `livingSpec.sync` — living-sync ran. A user-initiated run, counted each time. */
export function reportLivingSpecSync(): void {
    sendTelemetryEvent(LIVING_SPEC_SYNC_EVENT);
}

/** Emit `steering.opened` — a steering doc was opened. A user-initiated open, counted each time. */
export function reportSteeringOpened(): void {
    sendTelemetryEvent(STEERING_OPENED_EVENT);
}

/** Reset the per-session opened dedupe. Test-only — never called in production. */
export function __resetEngagementDedupe(): void {
    specOpenedKeys.clear();
    livingSpecOpenedKeys.clear();
}

// Re-export so call sites importing from this module have the filename handy.
export { SPEC_CONTEXT_FILENAME };
