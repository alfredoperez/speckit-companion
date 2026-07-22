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
    profileTelemetryId,
    defaultWorkflowTelemetryId,
    initTelemetry,
    reportInstallPromptShown,
    reportInstallPromptClicked,
    __resetInstallPromptShownDedupe,
    INSTALL_PROMPT_EVENT,
    APP_INSIGHTS_CONNECTION_STRING,
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
// `@vscode/extension-telemetry` is mapped to the test mock (jest.config.js).
// The real package types don't declare the mock's captured-event helpers, so
// describe just the shape we reach for here and require through the mapper.
interface TelemetryMockShape {
    __captured: {
        constructed: string[];
        events: { name: string; properties?: Record<string, string> }[];
        disposed: number;
    };
    __resetTelemetryMock: () => void;
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __captured, __resetTelemetryMock } =
    require('@vscode/extension-telemetry') as TelemetryMockShape;

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
        __resetTelemetryMock();
        mockConfig({ telemetry: true });
    });

    describe('the dual gate', () => {
        it('sends an event when the reporter exists and speckit.telemetry is on', () => {
            const service = new TelemetryService();
            service.sendEvent('extension.activated', { specCount: '3' });

            expect(__captured.events).toHaveLength(1);
            expect(__captured.events[0]).toEqual({
                name: 'extension.activated',
                properties: { specCount: '3' },
            });
        });

        it('is a no-op when speckit.telemetry is false', () => {
            mockConfig({ telemetry: false });
            const service = new TelemetryService();
            service.sendEvent('provider.selected', { providerId: 'claude' });

            expect(__captured.events).toHaveLength(0);
        });

        it('does not construct a reporter and is a no-op when the connection string is empty', () => {
            const service = new TelemetryService('');
            service.sendEvent('provider.selected', { providerId: 'claude' });

            expect(__captured.constructed).toHaveLength(0);
            expect(__captured.events).toHaveLength(0);
        });

        it('constructs the reporter with the committed connection string by default', () => {
            new TelemetryService();
            expect(__captured.constructed).toEqual([APP_INSIGHTS_CONNECTION_STRING]);
        });

        it('disposes the underlying reporter', () => {
            const service = new TelemetryService();
            service.dispose();
            expect(__captured.disposed).toBe(1);
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

    describe('profileTelemetryId (privacy: no free-text profile)', () => {
        it('passes the two known profiles through', () => {
            expect(profileTelemetryId('standard')).toBe('standard');
            expect(profileTelemetryId('turbo')).toBe('turbo');
        });

        it('drops any other on-disk profile value rather than sending it verbatim', () => {
            expect(profileTelemetryId('client-acme-internal')).toBeUndefined();
            expect(profileTelemetryId('lean')).toBeUndefined();
            expect(profileTelemetryId(undefined)).toBeUndefined();
        });
    });

    describe('defaultWorkflowTelemetryId (privacy: no arbitrary settings.json value)', () => {
        it('passes the two built-in workflow ids through', () => {
            expect(defaultWorkflowTelemetryId('speckit')).toBe('speckit');
            expect(defaultWorkflowTelemetryId('companion')).toBe('companion');
        });

        it('reports an out-of-range / custom workflow name as the default speckit, never verbatim', () => {
            expect(defaultWorkflowTelemetryId('my-custom-workflow')).toBe('speckit');
            expect(defaultWorkflowTelemetryId('')).toBe('speckit');
            expect(defaultWorkflowTelemetryId(undefined)).toBe('speckit');
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

        it('emits companionInstalled through the reporter on extension.activated', () => {
            mockConfig({ telemetry: true });
            const service = new TelemetryService();
            service.sendEvent(
                'extension.activated',
                buildActivatedProperties({ ...baseSnapshot, companionInstalled: true }),
            );

            expect(__captured.events).toHaveLength(1);
            expect(__captured.events[0].name).toBe('extension.activated');
            expect(__captured.events[0].properties?.companionInstalled).toBe('true');
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
            initTelemetry(new TelemetryService());
        });

        it('emits action=shown with the surface the first time a surface is shown', () => {
            reportInstallPromptShown('createSpec');
            expect(__captured.events).toEqual([
                { name: INSTALL_PROMPT_EVENT, properties: { action: 'shown', surface: 'createSpec' } },
            ]);
        });

        it('dedupes a repeated shown for the same surface within a session', () => {
            reportInstallPromptShown('createSpec');
            reportInstallPromptShown('createSpec');
            reportInstallPromptShown('createSpec');
            expect(__captured.events).toHaveLength(1);
        });

        it('emits shown independently for each distinct surface', () => {
            reportInstallPromptShown('createSpec');
            reportInstallPromptShown('activity');
            expect(__captured.events.map(e => e.properties?.surface)).toEqual(['createSpec', 'activity']);
            expect(__captured.events.every(e => e.properties?.action === 'shown')).toBe(true);
        });

        it('emits action=clicked with the originating surface (not deduped)', () => {
            reportInstallPromptClicked('activity');
            reportInstallPromptClicked('activity');
            expect(__captured.events).toEqual([
                { name: INSTALL_PROMPT_EVENT, properties: { action: 'clicked', surface: 'activity' } },
                { name: INSTALL_PROMPT_EVENT, properties: { action: 'clicked', surface: 'activity' } },
            ]);
        });

        it('carries only the action + surface enum fields — no identifier or path', () => {
            reportInstallPromptShown('activity');
            reportInstallPromptClicked('createSpec');
            for (const event of __captured.events) {
                expect(Object.keys(event.properties ?? {}).sort()).toEqual(['action', 'surface']);
                expect(['shown', 'clicked']).toContain(event.properties?.action);
                expect(['createSpec', 'activity']).toContain(event.properties?.surface);
            }
        });

        it('sends nothing when telemetry is disabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService());
            reportInstallPromptShown('createSpec');
            reportInstallPromptClicked('createSpec');
            expect(__captured.events).toHaveLength(0);
        });

        it('a show while telemetry is disabled does not burn the dedupe — it still fires once enabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService());
            reportInstallPromptShown('createSpec');   // no-op, must NOT record the dedupe
            expect(__captured.events).toHaveLength(0);
            mockConfig({ telemetry: true });
            initTelemetry(new TelemetryService());
            reportInstallPromptShown('createSpec');   // now it should emit
            expect(__captured.events).toEqual([
                { name: INSTALL_PROMPT_EVENT, properties: { action: 'shown', surface: 'createSpec' } },
            ]);
        });
    });

    describe('the per-spec correlation id', () => {
        it('generates and persists a telemetryInstanceId on first read when missing', async () => {
            const dir = makeSpecDir({ ...BASE_SPEC, profile: 'turbo' });

            const ctx = getSpecTelemetryContext(dir);
            expect(ctx.profile).toBe('turbo');
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
        __resetTelemetryMock();
        __resetEngagementDedupe();
        mockConfig({ telemetry: true });
        initTelemetry(new TelemetryService());
    });

    describe('spec.opened', () => {
        it('fires a bare event the first time a spec opens', () => {
            reportSpecOpened('/ws/specs/123-feature');
            expect(__captured.events).toEqual([{ name: SPEC_OPENED_EVENT, properties: undefined }]);
        });

        it('carries no properties — no spec name or path', () => {
            reportSpecOpened('/ws/specs/123-feature');
            expect(__captured.events[0].properties).toBeUndefined();
        });

        it('dedupes re-renders/reveals of the same spec within a session', () => {
            reportSpecOpened('/ws/specs/123-feature');
            reportSpecOpened('/ws/specs/123-feature');
            reportSpecOpened('/ws/specs/123-feature');
            expect(__captured.events).toHaveLength(1);
        });

        it('fires once per distinct spec', () => {
            reportSpecOpened('/ws/specs/123-feature');
            reportSpecOpened('/ws/specs/456-other');
            expect(__captured.events).toHaveLength(2);
            expect(__captured.events.every(e => e.name === SPEC_OPENED_EVENT)).toBe(true);
        });

        it('an open while telemetry is disabled does not burn the dedupe — it still fires once enabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService());
            reportSpecOpened('/ws/specs/123-feature');
            expect(__captured.events).toHaveLength(0);

            mockConfig({ telemetry: true });
            initTelemetry(new TelemetryService());
            reportSpecOpened('/ws/specs/123-feature');
            expect(__captured.events).toEqual([{ name: SPEC_OPENED_EVENT, properties: undefined }]);
        });

        it('sends nothing when telemetry is disabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService());
            reportSpecOpened('/ws/specs/123-feature');
            expect(__captured.events).toHaveLength(0);
        });
    });

    describe('livingSpec.opened', () => {
        it('fires a bare event the first time a living spec opens', () => {
            reportLivingSpecOpened('/ws/src/auth/spec.md');
            expect(__captured.events).toEqual([{ name: LIVING_SPEC_OPENED_EVENT, properties: undefined }]);
        });

        it('dedupes re-renders of the same capability within a session', () => {
            reportLivingSpecOpened('/ws/src/auth/spec.md');
            reportLivingSpecOpened('/ws/src/auth/spec.md');
            expect(__captured.events).toHaveLength(1);
        });

        it('fires once per distinct capability', () => {
            reportLivingSpecOpened('/ws/src/auth/spec.md');
            reportLivingSpecOpened('/ws/src/billing/spec.md');
            expect(__captured.events).toHaveLength(2);
        });

        it('sends nothing when telemetry is disabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService());
            reportLivingSpecOpened('/ws/src/auth/spec.md');
            expect(__captured.events).toHaveLength(0);
        });
    });

    describe('livingSpec.drift / livingSpec.sync', () => {
        it('fires a bare drift event each run (not deduped)', () => {
            reportLivingSpecDrift();
            reportLivingSpecDrift();
            expect(__captured.events).toEqual([
                { name: LIVING_SPEC_DRIFT_EVENT, properties: undefined },
                { name: LIVING_SPEC_DRIFT_EVENT, properties: undefined },
            ]);
        });

        it('fires a bare sync event each run (not deduped)', () => {
            reportLivingSpecSync();
            reportLivingSpecSync();
            expect(__captured.events).toEqual([
                { name: LIVING_SPEC_SYNC_EVENT, properties: undefined },
                { name: LIVING_SPEC_SYNC_EVENT, properties: undefined },
            ]);
        });

        it('send nothing when telemetry is disabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService());
            reportLivingSpecDrift();
            reportLivingSpecSync();
            expect(__captured.events).toHaveLength(0);
        });
    });

    describe('steering.opened', () => {
        it('fires a bare event each time a steering doc opens (not deduped)', () => {
            reportSteeringOpened();
            reportSteeringOpened();
            expect(__captured.events).toEqual([
                { name: STEERING_OPENED_EVENT, properties: undefined },
                { name: STEERING_OPENED_EVENT, properties: undefined },
            ]);
        });

        it('sends nothing when telemetry is disabled', () => {
            mockConfig({ telemetry: false });
            initTelemetry(new TelemetryService());
            reportSteeringOpened();
            expect(__captured.events).toHaveLength(0);
        });
    });

    it('every engagement event carries no properties at all', () => {
        reportSpecOpened('/ws/specs/1');
        reportLivingSpecOpened('/ws/src/a/spec.md');
        reportLivingSpecDrift();
        reportLivingSpecSync();
        reportSteeringOpened();
        for (const event of __captured.events) {
            expect(event.properties).toBeUndefined();
        }
    });
});
