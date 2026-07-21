import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    TelemetryService,
    getSpecTelemetryContext,
    buildBetaSnapshot,
    phaseTelemetryId,
    profileTelemetryId,
    defaultWorkflowTelemetryId,
    APP_INSIGHTS_CONNECTION_STRING,
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

    describe('the beta snapshot', () => {
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
