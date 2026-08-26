import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    TelemetryService,
    getSpecTelemetryContext,
    buildBetaSnapshot,
    buildActivatedProperties,
    phaseTelemetryId,
    workflowTelemetryId,
    initTelemetry,
    reportInstallPromptShown,
    reportInstallPromptClicked,
    coerceInstallPromptSurface,
    __resetInstallPromptShownDedupe,
    INSTALL_PROMPT_EVENT,
    POSTHOG_PROJECT_API_KEY,
    reportSpecOpened,
    reportLivingSpecOpened,
    reportLivingSpecDrift,
    reportLivingSpecSync,
    reportSteeringOpened,
    __resetEngagementDedupe,
    SPEC_OPENED_EVENT,
    LIVING_SPEC_OPENED_EVENT,
    LIVING_SPEC_DRIFT_EVENT,
    LIVING_SPEC_SYNC_EVENT,
    STEERING_OPENED_EVENT,
} from '../telemetry';
import {
    TEST_POSTHOG_KEY,
    installTelemetryFetchMock,
    capturedTelemetryEvents,
    specificProps,
} from './helpers/telemetryFetch';

// The mock's gate driver isn't part of the real vscode types.
const { __fireTelemetryEnabledChange } = vscode as unknown as {
    __fireTelemetryEnabledChange: (enabled: boolean) => void;
};

const CAPTURE_URL = 'https://us.i.posthog.com/i/v0/e/';

let fetchMock: jest.Mock;

function capturedEvents() {
    return capturedTelemetryEvents(fetchMock);
}

/** Point `getConfiguration('speckit').get(key, default)` at a fixed map. */
function mockConfig(values: Record<string, unknown>): void {
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: (key: string, fallback?: unknown) =>
            key in values ? values[key] : fallback,
    });
}

function makeSpecDir(initial: Record<string, unknown>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-spec-'));
    fs.writeFileSync(
        path.join(dir, '.spec-context.json'),
        JSON.stringify(initial),
        'utf-8',
    );
    return dir;
}

function readContext(dir: string): Record<string, unknown> {
    return JSON.parse(
        fs.readFileSync(path.join(dir, '.spec-context.json'), 'utf-8'),
    );
}

/** Poll until the async backfill write lands a telemetryInstanceId on disk. */
async function waitForPersist(dir: string): Promise<void> {
    for (let i = 0; i < 50; i++) {
        if (readContext(dir).telemetryInstanceId) return;
        await new Promise(r => setTimeout(r, 10));
    }
}

const BASE_SPEC = {
    workflow: 'speckit',
    specName: 'demo',
    branch: 'main',
    currentStep: 'specify',
    status: 'specified',
    history: [],
};

describe('TelemetryService', () => {
    beforeEach(() => {
        fetchMock = installTelemetryFetchMock();
        (vscode.env as { isTelemetryEnabled: boolean }).isTelemetryEnabled = true;
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            packageJSON: { version: '9.9.9' },
        });
        mockConfig({ telemetry: true });
    });

    describe('the dual gate', () => {
        it('sends an event when a key is set and speckit.telemetry is on', () => {
            const service = new TelemetryService(TEST_POSTHOG_KEY);
            const sent = service.sendEvent('extension.activated', { specCount: '3' });

            expect(sent).toBe(true);
            expect(capturedEvents()).toHaveLength(1);
            expect(capturedEvents()[0].name).toBe('extension.activated');
            expect(specificProps(capturedEvents()[0].properties)).toEqual({ specCount: '3' });
        });

        it('is a no-op when speckit.telemetry is false', () => {
            mockConfig({ telemetry: false });
            const service = new TelemetryService(TEST_POSTHOG_KEY);
            const sent = service.sendEvent('provider.selected', { providerId: 'claude' });

            expect(sent).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('constructs no transport and is a no-op when the key is empty', () => {
            const service = new TelemetryService('');
            const sent = service.sendEvent('provider.selected', { providerId: 'claude' });

            expect(sent).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('uses the committed project key by default — silent while it is empty', () => {
            const service = new TelemetryService();
            const sent = service.sendEvent('provider.selected', { providerId: 'claude' });

            expect(sent).toBe(POSTHOG_PROJECT_API_KEY !== '');
            expect(fetchMock).toHaveBeenCalledTimes(POSTHOG_PROJECT_API_KEY ? 1 : 0);
        });

        it('dispose is safe to call', () => {
            const service = new TelemetryService(TEST_POSTHOG_KEY);
            expect(() => service.dispose()).not.toThrow();
        });
    });

    describe('the editor-wide gate (vscode.env.isTelemetryEnabled)', () => {
        it('sends nothing while editor-wide telemetry is off, even with the extension switch on', () => {
            (vscode.env as { isTelemetryEnabled: boolean }).isTelemetryEnabled = false;
            const service = new TelemetryService(TEST_POSTHOG_KEY);

            expect(service.sendEvent('provider.selected', { providerId: 'claude' })).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('sends nothing when the extension switch is off, even with the editor-wide gate open', () => {
            mockConfig({ telemetry: false });
            const service = new TelemetryService(TEST_POSTHOG_KEY);

            expect(service.sendEvent('provider.selected', { providerId: 'claude' })).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('a mid-session editor-wide toggle disables and re-enables sending without reconstructing the service', () => {
            const service = new TelemetryService(TEST_POSTHOG_KEY);
            expect(service.sendEvent('provider.selected')).toBe(true);

            __fireTelemetryEnabledChange(false);
            expect(service.sendEvent('provider.selected')).toBe(false);

            __fireTelemetryEnabledChange(true);
            expect(service.sendEvent('provider.selected')).toBe(true);

            expect(capturedEvents()).toHaveLength(2);
        });

        it('dispose drops the change subscription — later gate firings no longer reach the service', () => {
            const service = new TelemetryService(TEST_POSTHOG_KEY);
            service.dispose();

            __fireTelemetryEnabledChange(false);
            expect(service.sendEvent('provider.selected')).toBe(true);
        });
    });

    describe('the wire shape (PostHog capture contract)', () => {
        it('POSTs one JSON capture payload per event to the capture endpoint', () => {
            const service = new TelemetryService(TEST_POSTHOG_KEY);
            service.sendEvent('provider.selected', { providerId: 'claude' });

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, init] = fetchMock.mock.calls[0] as [
                string,
                { method: string; headers: Record<string, string>; body: string },
            ];
            expect(url).toBe(CAPTURE_URL);
            expect(init.method).toBe('POST');
            expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
        });

        it('carries the api_key, the event name, and the machine id as distinct_id', () => {
            const service = new TelemetryService(TEST_POSTHOG_KEY);
            service.sendEvent('provider.selected', { providerId: 'claude' });

            const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
            expect(body.api_key).toBe(TEST_POSTHOG_KEY);
            expect(body.event).toBe('provider.selected');
            expect(body.distinct_id).toBe('test-machine-id');
        });

        it('marks every event for anonymous processing', () => {
            const service = new TelemetryService(TEST_POSTHOG_KEY);
            service.sendEvent('provider.selected', { providerId: 'claude' });

            expect(capturedEvents()[0].properties['$process_person_profile']).toBe(false);
        });
    });

    describe('the common properties (service-attached)', () => {
        it('every captured payload carries extensionVersion, vscodeVersion, and platform', () => {
            const service = new TelemetryService(TEST_POSTHOG_KEY);
            service.sendEvent('provider.selected', { providerId: 'claude' });

            const props = capturedEvents()[0].properties;
            expect(props.extensionVersion).toBe('9.9.9');
            expect(props.vscodeVersion).toBe('1.90.0-test');
            expect(props.platform).toBe(process.platform);
        });

        it('falls back to "unknown" when the extension manifest is unavailable', () => {
            (vscode.extensions.getExtension as jest.Mock).mockReturnValue(undefined);
            const service = new TelemetryService(TEST_POSTHOG_KEY);
            service.sendEvent('provider.selected', { providerId: 'claude' });

            expect(capturedEvents()[0].properties.extensionVersion).toBe('unknown');
        });

        it('the extension.activated collision resolves to the event payload\'s own values', () => {
            const service = new TelemetryService(TEST_POSTHOG_KEY);
            service.sendEvent('extension.activated', {
                extensionVersion: '1.2.3',
                vscodeVersion: '1.90.0',
                specCount: '4',
            });

            const props = capturedEvents()[0].properties;
            expect(props.extensionVersion).toBe('1.2.3');
            expect(props.vscodeVersion).toBe('1.90.0');
            expect(props.platform).toBe(process.platform);
        });

        it('the five bare engagement events carry the common facts and nothing else (privacy contract)', () => {
            __resetEngagementDedupe();
            initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
            reportSpecOpened('/ws/specs/1');
            reportLivingSpecOpened('/ws/src/a/spec.md');
            reportLivingSpecDrift();
            reportLivingSpecSync();
            reportSteeringOpened();

            expect(capturedEvents()).toHaveLength(5);
            for (const event of capturedEvents()) {
                expect(Object.keys(event.properties).sort()).toEqual([
                    '$process_person_profile',
                    'extensionVersion',
                    'platform',
                    'vscodeVersion',
                ]);
            }
        });
    });

    describe('silent failure (a dead backend never surfaces)', () => {
        it('swallows a rejected fetch — the emit still reports true and nothing throws', async () => {
            fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
            const service = new TelemetryService(TEST_POSTHOG_KEY);

            expect(service.sendEvent('provider.selected', { providerId: 'claude' })).toBe(true);
            await new Promise(r => setTimeout(r, 0));
        });

        it('ignores a non-2xx response', async () => {
            fetchMock.mockResolvedValueOnce({ ok: false, status: 429 });
            const service = new TelemetryService(TEST_POSTHOG_KEY);

            expect(service.sendEvent('provider.selected', { providerId: 'claude' })).toBe(true);
            await new Promise(r => setTimeout(r, 0));
        });
    });

    describe('the workflow + settings snapshot', () => {
        it('assembles the workflow + feature-flag fields from config', () => {
            mockConfig({
                defaultWorkflow: 'companion',
                'viewer.activityPanel': false,
                'companion.installPrompt': true,
                telemetry: true,
            });

            expect(buildBetaSnapshot()).toEqual({
                defaultWorkflow: 'companion',
                activityPanel: 'false',
                installPrompt: 'true',
                telemetry: 'true',
            });
        });

        it('reports the default workflow as speckit when unset or out-of-range', () => {
            mockConfig({ telemetry: true });
            expect(buildBetaSnapshot().defaultWorkflow).toBe('speckit');
        });
    });

    describe('phaseTelemetryId (privacy: no custom step names)', () => {
        it('sends the four built-in lifecycle steps verbatim', () => {
            expect(phaseTelemetryId('specify')).toBe('specify');
            expect(phaseTelemetryId('plan')).toBe('plan');
            expect(phaseTelemetryId('tasks')).toBe('tasks');
            expect(phaseTelemetryId('implement')).toBe('implement');
        });

        it('collapses any user-defined custom workflow step name to "custom"', () => {
            expect(phaseTelemetryId('my-internal-secret-phase')).toBe('custom');
            expect(phaseTelemetryId('review')).toBe('custom');
            expect(phaseTelemetryId('')).toBe('custom');
        });
    });

    describe('workflowTelemetryId (privacy: the one shared workflow coercer)', () => {
        it('passes the two built-in workflow ids through verbatim', () => {
            expect(workflowTelemetryId('speckit')).toBe('speckit');
            expect(workflowTelemetryId('companion')).toBe('companion');
        });

        it('maps the legacy "default" alias to speckit', () => {
            expect(workflowTelemetryId('default')).toBe('speckit');
        });

        it('collapses any custom workflow name to "custom", never verbatim', () => {
            expect(workflowTelemetryId('my-custom-workflow')).toBe('custom');
            expect(workflowTelemetryId('')).toBe('custom');
            expect(workflowTelemetryId(undefined)).toBe('custom');
        });
    });

    describe('the extension.activated payload (install rate)', () => {
        const baseSnapshot = {
            extensionVersion: '1.2.3',
            vscodeVersion: '1.90.0',
            speckitCliVersion: 'unknown',
            specCount: 4,
        };

        it('reports companionInstalled as a stringified boolean when installed', () => {
            mockConfig({ telemetry: true });
            const props = buildActivatedProperties({ ...baseSnapshot, companionInstalled: true });
            expect(props.companionInstalled).toBe('true');
            expect(props.specCount).toBe('4');
        });

        it('reports companionInstalled as "false" when the companion extension is absent', () => {
            mockConfig({ telemetry: true });
            const props = buildActivatedProperties({ ...baseSnapshot, companionInstalled: false });
            expect(props.companionInstalled).toBe('false');
        });

        it('emits companionInstalled over the wire on extension.activated', () => {
            mockConfig({ telemetry: true });
            const service = new TelemetryService(TEST_POSTHOG_KEY);
            service.sendEvent(
                'extension.activated',
                buildActivatedProperties({ ...baseSnapshot, companionInstalled: true }),
            );

            expect(capturedEvents()).toHaveLength(1);
            expect(capturedEvents()[0].name).toBe('extension.activated');
            expect(capturedEvents()[0].properties.companionInstalled).toBe('true');
        });

        it('carries only booleans/versions/counts/enums — no identifier or path', () => {
            mockConfig({ telemetry: true });
            const props = buildActivatedProperties({ ...baseSnapshot, companionInstalled: false });
            for (const value of Object.values(props)) {
                expect(value).not.toContain('/');
                expect(value).not.toContain('\\');
            }
        });
    });

    describe('the install-prompt funnel (companion.installPrompt)', () => {
        beforeEach(() => {
            __resetInstallPromptShownDedupe();
            mockConfig({ telemetry: true });
            initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
        });

        it('emits action=shown with the surface the first time a surface is shown', () => {
            reportInstallPromptShown('createSpec');
            expect(capturedEvents()).toHaveLength(1);
            expect(capturedEvents()[0].name).toBe(INSTALL_PROMPT_EVENT);
            expect(specificProps(capturedEvents()[0].properties)).toEqual({
                action: 'shown',
                surface: 'createSpec',
            });
        });

        it('dedupes a repeated shown for the same surface within a session', () => {
            reportInstallPromptShown('createSpec');
            reportInstallPromptShown('createSpec');
            reportInstallPromptShown('createSpec');
            expect(capturedEvents()).toHaveLength(1);
        });

        it('emits shown independently for each distinct surface', () => {
            reportInstallPromptShown('createSpec');
            reportInstallPromptShown('activity');
            expect(capturedEvents().map(e => e.properties.surface)).toEqual(['createSpec', 'activity']);
            expect(capturedEvents().every(e => e.properties.action === 'shown')).toBe(true);
        });

        it('records the new sidebar/pinned/welcome surfaces distinctly', () => {
            reportInstallPromptShown('sidebarBadge');
            reportInstallPromptShown('pinnedRow');
            reportInstallPromptClicked('welcome');
            expect(capturedEvents().map(e => `${e.properties.action}:${e.properties.surface}`)).toEqual([
                'shown:sidebarBadge',
                'shown:pinnedRow',
                'clicked:welcome',
            ]);
        });

        it('coerces an untrusted surface value at the boundary', () => {
            expect(coerceInstallPromptSurface('pinnedRow')).toBe('pinnedRow');
            expect(coerceInstallPromptSurface('welcome')).toBe('welcome');
            expect(coerceInstallPromptSurface('__proto__')).toBeUndefined();
            expect(coerceInstallPromptSurface('nope')).toBeUndefined();
            expect(coerceInstallPromptSurface(undefined)).toBeUndefined();
            expect(coerceInstallPromptSurface(42)).toBeUndefined();
        });

        it('emits action=clicked with the originating surface (not deduped)', () => {
            reportInstallPromptClicked('activity');
            reportInstallPromptClicked('activity');
            expect(capturedEvents()).toHaveLength(2);
            for (const event of capturedEvents()) {
                expect(event.name).toBe(INSTALL_PROMPT_EVENT);
                expect(specificProps(event.properties)).toEqual({ action: 'clicked', surface: 'activity' });
            }
        });

        it('carries only the action + surface enum fields — no identifier or path', () => {
            reportInstallPromptShown('activity');
            reportInstallPromptClicked('createSpec');
            for (const event of capturedEvents()) {
                expect(Object.keys(specificProps(event.properties)).sort()).toEqual(['action', 'surface']);
                expect(['shown', 'clicked']).toContain(event.properties.action);
                expect(['createSpec', 'activity']).toContain(event.properties.surface);
            }
        });

        it('sends nothing when telemetry is disabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
            reportInstallPromptShown('createSpec');
            reportInstallPromptClicked('createSpec');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('a show while telemetry is disabled does not burn the dedupe — it still fires once enabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
            reportInstallPromptShown('createSpec');   // no-op, must NOT record the dedupe
            expect(fetchMock).not.toHaveBeenCalled();
            mockConfig({ telemetry: true });
            initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
            reportInstallPromptShown('createSpec');   // now it should emit
            expect(capturedEvents()).toHaveLength(1);
            expect(specificProps(capturedEvents()[0].properties)).toEqual({
                action: 'shown',
                surface: 'createSpec',
            });
        });
    });

    describe('the funnel contract (pinned identifiers, byte-for-byte)', () => {
        const ALL_SURFACES = [
            'createSpec',
            'activity',
            'sidebarBadge',
            'pinnedRow',
            'welcome',
            'terminal',
            'activation',
        ] as const;

        beforeEach(() => {
            __resetInstallPromptShownDedupe();
            mockConfig({ telemetry: true });
            initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
        });

        it('posts the event name exactly "companion.installPrompt" with action exactly "shown"/"clicked"', () => {
            reportInstallPromptShown('terminal');
            reportInstallPromptClicked('terminal');

            const bodies = fetchMock.mock.calls.map(
                ([, init]) => JSON.parse((init as { body: string }).body),
            );
            expect(bodies.map(b => b.event)).toEqual([
                'companion.installPrompt',
                'companion.installPrompt',
            ]);
            expect(bodies.map(b => b.properties.action)).toEqual(['shown', 'clicked']);
        });

        it('emits every surface in the closed allow-list verbatim', () => {
            for (const surface of ALL_SURFACES) {
                reportInstallPromptShown(surface);
            }
            expect(capturedEvents().map(e => e.properties.surface)).toEqual([...ALL_SURFACES]);
        });

        it('accepts exactly the closed allow-list at the coercion boundary and nothing else', () => {
            for (const surface of ALL_SURFACES) {
                expect(coerceInstallPromptSurface(surface)).toBe(surface);
            }
            expect(coerceInstallPromptSurface('Shown')).toBeUndefined();
            expect(coerceInstallPromptSurface('createspec')).toBeUndefined();
            expect(coerceInstallPromptSurface('custom-surface')).toBeUndefined();
        });

        it('keeps the funnel payload shape to exactly action + surface beyond the common facts', () => {
            reportInstallPromptShown('welcome');
            reportInstallPromptClicked('welcome');
            for (const event of capturedEvents()) {
                expect(Object.keys(specificProps(event.properties)).sort()).toEqual(['action', 'surface']);
            }
        });
    });

    describe('the per-spec correlation id', () => {
        it('generates and persists a telemetryInstanceId on first read when missing', async () => {
            const dir = makeSpecDir({ ...BASE_SPEC });

            const ctx = getSpecTelemetryContext(dir);
            expect(ctx.specInstanceId).toMatch(/^[0-9a-f-]{36}$/);

            // The backfill write is non-blocking (fire-and-forget); let it flush.
            await waitForPersist(dir);
            const persisted = readContext(dir);
            expect(persisted.telemetryInstanceId).toBe(ctx.specInstanceId);
        });

        it('reuses the existing id on subsequent reads (does not regenerate)', () => {
            const dir = makeSpecDir({
                ...BASE_SPEC,
                telemetryInstanceId: 'fixed-id-1234',
            });

            const first = getSpecTelemetryContext(dir);
            const second = getSpecTelemetryContext(dir);

            expect(first.specInstanceId).toBe('fixed-id-1234');
            expect(second.specInstanceId).toBe('fixed-id-1234');
            expect(readContext(dir).telemetryInstanceId).toBe('fixed-id-1234');
        });

        it('returns an empty context for a spec with no .spec-context.json', () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-empty-'));
            expect(getSpecTelemetryContext(dir)).toEqual({});
        });
    });
});

describe('engagement events', () => {
    beforeEach(() => {
        fetchMock = installTelemetryFetchMock();
        (vscode.env as { isTelemetryEnabled: boolean }).isTelemetryEnabled = true;
        __resetEngagementDedupe();
        mockConfig({ telemetry: true });
        initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
    });

    describe('spec.opened', () => {
        it('fires a bare event the first time a spec opens', () => {
            reportSpecOpened('/ws/specs/123-feature');
            expect(capturedEvents()).toHaveLength(1);
            expect(capturedEvents()[0].name).toBe(SPEC_OPENED_EVENT);
        });

        it('carries nothing event-specific — no spec name or path', () => {
            reportSpecOpened('/ws/specs/123-feature');
            expect(specificProps(capturedEvents()[0].properties)).toEqual({});
        });

        it('dedupes re-renders/reveals of the same spec within a session', () => {
            reportSpecOpened('/ws/specs/123-feature');
            reportSpecOpened('/ws/specs/123-feature');
            reportSpecOpened('/ws/specs/123-feature');
            expect(capturedEvents()).toHaveLength(1);
        });

        it('fires once per distinct spec', () => {
            reportSpecOpened('/ws/specs/123-feature');
            reportSpecOpened('/ws/specs/456-other');
            expect(capturedEvents()).toHaveLength(2);
            expect(capturedEvents().every(e => e.name === SPEC_OPENED_EVENT)).toBe(true);
        });

        it('an open while telemetry is disabled does not burn the dedupe — it still fires once enabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
            reportSpecOpened('/ws/specs/123-feature');
            expect(fetchMock).not.toHaveBeenCalled();

            mockConfig({ telemetry: true });
            initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
            reportSpecOpened('/ws/specs/123-feature');
            expect(capturedEvents()).toHaveLength(1);
            expect(capturedEvents()[0].name).toBe(SPEC_OPENED_EVENT);
        });

        it('sends nothing when telemetry is disabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
            reportSpecOpened('/ws/specs/123-feature');
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('livingSpec.opened', () => {
        it('fires a bare event the first time a living spec opens', () => {
            reportLivingSpecOpened('/ws/src/auth/spec.md');
            expect(capturedEvents()).toHaveLength(1);
            expect(capturedEvents()[0].name).toBe(LIVING_SPEC_OPENED_EVENT);
        });

        it('dedupes re-renders of the same capability within a session', () => {
            reportLivingSpecOpened('/ws/src/auth/spec.md');
            reportLivingSpecOpened('/ws/src/auth/spec.md');
            expect(capturedEvents()).toHaveLength(1);
        });

        it('fires once per distinct capability', () => {
            reportLivingSpecOpened('/ws/src/auth/spec.md');
            reportLivingSpecOpened('/ws/src/billing/spec.md');
            expect(capturedEvents()).toHaveLength(2);
        });

        it('sends nothing when telemetry is disabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
            reportLivingSpecOpened('/ws/src/auth/spec.md');
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('livingSpec.drift / livingSpec.sync', () => {
        it('fires a bare drift event each run (not deduped)', () => {
            reportLivingSpecDrift();
            reportLivingSpecDrift();
            expect(capturedEvents().map(e => e.name)).toEqual([
                LIVING_SPEC_DRIFT_EVENT,
                LIVING_SPEC_DRIFT_EVENT,
            ]);
        });

        it('fires a bare sync event each run (not deduped)', () => {
            reportLivingSpecSync();
            reportLivingSpecSync();
            expect(capturedEvents().map(e => e.name)).toEqual([
                LIVING_SPEC_SYNC_EVENT,
                LIVING_SPEC_SYNC_EVENT,
            ]);
        });

        it('sends nothing when telemetry is disabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
            reportLivingSpecDrift();
            reportLivingSpecSync();
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('steering.opened', () => {
        it('fires a bare event each time a steering doc opens (not deduped)', () => {
            reportSteeringOpened();
            reportSteeringOpened();
            expect(capturedEvents().map(e => e.name)).toEqual([
                STEERING_OPENED_EVENT,
                STEERING_OPENED_EVENT,
            ]);
        });

        it('sends nothing when telemetry is disabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
            reportSteeringOpened();
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    it('every engagement event carries nothing event-specific at all', () => {
        reportSpecOpened('/ws/specs/1');
        reportLivingSpecOpened('/ws/src/a/spec.md');
        reportLivingSpecDrift();
        reportLivingSpecSync();
        reportSteeringOpened();
        for (const event of capturedEvents()) {
            expect(specificProps(event.properties)).toEqual({});
        }
    });
});
