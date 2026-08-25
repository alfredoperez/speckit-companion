/**
 * Anonymous, PII-free telemetry for provider / pipeline-profile / beta-flag
 * adoption and the spec lifecycle.
 *
 * Single home for: the committed PostHog project key, the {@link TelemetryService}
 * that posts each event to PostHog's capture endpoint, and the helpers that read
 * a spec's profile + telemetry correlation id off `.spec-context.json`.
 *
 * Privacy contract: every payload carries only enum-like values, booleans,
 * versions, counts, and a random per-spec UUID — never prompt content, file
 * paths, spec names, or custom workflow names.
 */

import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ConfigKeys, WorkflowSteps } from './constants';
import { coerceLegacyBoolean } from './settingsMigration';
import { readSpecContextSync, SPEC_CONTEXT_FILENAME } from '../features/specs/specContextReader';
import { updateSpecContext } from '../features/specs/specContextWriter';

/**
 * PostHog project API key. This is a **write-only ingestion credential** — it
 * can only capture events, never read them — so it is safe to commit. Empty
 * until the PostHog project exists: an empty key constructs no transport and
 * sends nothing.
 */
export const POSTHOG_PROJECT_API_KEY = '';

/** PostHog single-event capture endpoint (US Cloud). */
const POSTHOG_CAPTURE_URL = 'https://us.i.posthog.com/i/v0/e/';

const EXTENSION_ID = 'alfredoperez.speckit-companion';

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
    return profile === 'standard' || profile === 'turbo' ? profile : undefined;
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
    // The former tri-state settings (#259) funnel through coerceLegacyBoolean
    // so an un-migrated scope reports a clean boolean, not a stale 'beta'/'on'/'off'.
    const coerced = (key: string, fallback: boolean): string =>
        String(coerceLegacyBoolean(config.get<unknown>(key), fallback));
    return {
        // Report the RAW configured value (unset → 'speckit'), never the install-derived effective default — only an explicit companion choice counts toward adoption.
        defaultWorkflow: defaultWorkflowTelemetryId(config.get<string>('defaultWorkflow', 'speckit')),
        activityPanel: coerced('viewer.activityPanel', true),
        installPrompt: coerced('companion.installPrompt', true),
        telemetry: String(config.get<boolean>('telemetry', true)),
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

    const profile = profileTelemetryId(ctx.profile);
    if (ctx.telemetryInstanceId) {
        return { profile, specInstanceId: ctx.telemetryInstanceId };
    }

    const id = crypto.randomUUID();
    // Persist the freshly-minted id via a re-read-then-set mutator, so a skill /
    // hook write that lands between our read above and this write isn't clobbered
    // (we touch only telemetryInstanceId). Fire-and-forget: a failed backfill is
    // non-fatal — the id is still returned for this in-flight event.
    void updateSpecContext(specDir, c => ({ ...c, telemetryInstanceId: id }), ctx).catch(() => {});
    return { profile, specInstanceId: id };
}

/**
 * Posts each event straight to PostHog's capture endpoint: one fire-and-forget
 * request per event — no queue, no retries, errors swallowed — so a dead or
 * unreachable backend can never surface to the user. Sends only when the
 * project key is non-empty AND the editor-wide telemetry gate is open AND
 * `speckit.telemetry` is true; either gate closing stops events instantly.
 *
 * Merges the common facts the retired reporter attached automatically
 * (extension version, VS Code version, platform) into every event's
 * properties; event-specific keys win on collision.
 */
export class TelemetryService {
    private readonly apiKey: string;
    private globalTelemetryEnabled: boolean;
    private readonly telemetryChangeSubscription: vscode.Disposable;
    private readonly commonProperties: TelemetryProperties;

    constructor(apiKey: string = POSTHOG_PROJECT_API_KEY) {
        this.apiKey = apiKey;
        this.globalTelemetryEnabled = vscode.env.isTelemetryEnabled;
        this.telemetryChangeSubscription = vscode.env.onDidChangeTelemetryEnabled(enabled => {
            this.globalTelemetryEnabled = enabled;
        });
        this.commonProperties = {
            extensionVersion: String(
                vscode.extensions.getExtension(EXTENSION_ID)?.packageJSON?.version ?? 'unknown',
            ),
            vscodeVersion: vscode.version,
            platform: process.platform,
        };
    }

    private isEnabled(): boolean {
        return vscode.workspace
            .getConfiguration(ConfigKeys.namespace)
            .get<boolean>('telemetry', true);
    }

    sendEvent(name: string, properties?: TelemetryProperties): boolean {
        if (!this.apiKey) return false;
        if (!this.globalTelemetryEnabled) return false;
        if (!this.isEnabled()) return false;
        void fetch(POSTHOG_CAPTURE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: this.apiKey,
                event: name,
                distinct_id: vscode.env.machineId,
                properties: { $process_person_profile: false, ...this.commonProperties, ...properties },
            }),
        }).catch(() => {});
        return true;
    }

    dispose(): void {
        this.telemetryChangeSubscription.dispose();
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

function sendEventOncePerKey<K extends string>(
    seen: Set<K>,
    key: K,
    name: string,
    properties?: TelemetryProperties,
): void {
    if (seen.has(key)) return;
    if (sendTelemetryEvent(name, properties)) {
        seen.add(key);
    }
}

const INSTALL_PROMPT_SURFACES = [
    'createSpec',
    'activity',
    'sidebarBadge',
    'pinnedRow',
    'welcome',
    'terminal',
    'activation',
] as const;

/** The surfaces the install prompt appears on. */
export type InstallPromptSurface = (typeof INSTALL_PROMPT_SURFACES)[number];

/** Coerce an untrusted surface value (e.g. a viewsWelcome command arg) to a known surface, else undefined. */
export function coerceInstallPromptSurface(value: unknown): InstallPromptSurface | undefined {
    return INSTALL_PROMPT_SURFACES.find(surface => surface === value);
}

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
    // Only burn the dedupe slot on a real emit — a show while telemetry is off/uninitialized must still be able to fire once it's enabled.
    sendEventOncePerKey(installPromptShownSurfaces, surface, INSTALL_PROMPT_EVENT, {
        action: 'shown',
        surface,
    });
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
    sendEventOncePerKey(specOpenedKeys, specKey, SPEC_OPENED_EVENT);
}

/** Emit `livingSpec.opened` once per capability per session (same dedupe rules as {@link reportSpecOpened}). */
export function reportLivingSpecOpened(specKey: string): void {
    sendEventOncePerKey(livingSpecOpenedKeys, specKey, LIVING_SPEC_OPENED_EVENT);
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
