/**
 * Shared `fetch` stub for telemetry tests: captures every PostHog capture POST
 * so suites can assert on the wire payloads without network I/O.
 */

export const TEST_POSTHOG_KEY = 'phc_test_key';

export interface CapturedTelemetryEvent {
    name: string;
    properties: Record<string, unknown>;
}

/** Replace global fetch with a resolving jest mock; returns it for assertions. */
export function installTelemetryFetchMock(): jest.Mock {
    const mock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    (globalThis as { fetch: unknown }).fetch = mock;
    return mock;
}

/** Parse each captured POST body into `{ name, properties }`, in call order. */
export function capturedTelemetryEvents(fetchMock: jest.Mock): CapturedTelemetryEvent[] {
    return fetchMock.mock.calls.map(([, init]) => {
        const body = JSON.parse((init as { body: string }).body) as {
            event: string;
            properties: Record<string, unknown>;
        };
        return { name: body.event, properties: body.properties };
    });
}

/**
 * The event-specific slice of a captured payload: everything minus the
 * anonymous-processing marker and the service-attached common facts.
 */
export function specificProps(properties: Record<string, unknown>): Record<string, unknown> {
    const rest = { ...properties };
    delete rest['$process_person_profile'];
    delete rest['extensionVersion'];
    delete rest['vscodeVersion'];
    delete rest['platform'];
    return rest;
}
