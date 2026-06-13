/**
 * Test mock for `@vscode/extension-telemetry`.
 *
 * Captures every constructed reporter and every `sendTelemetryEvent` call so
 * tests can assert what would have been sent — without any network I/O.
 */

export interface CapturedEvent {
    name: string;
    properties?: Record<string, string>;
}

export const __captured: {
    constructed: string[];
    events: CapturedEvent[];
    disposed: number;
} = {
    constructed: [],
    events: [],
    disposed: 0,
};

export function __resetTelemetryMock(): void {
    __captured.constructed = [];
    __captured.events = [];
    __captured.disposed = 0;
}

export class TelemetryReporter {
    constructor(connectionString: string) {
        __captured.constructed.push(connectionString);
    }

    sendTelemetryEvent(
        eventName: string,
        properties?: Record<string, string>,
    ): void {
        __captured.events.push({ name: eventName, properties });
    }

    sendRawTelemetryEvent(): void {
        /* unused in tests */
    }

    sendDangerousTelemetryEvent(): void {
        /* unused in tests */
    }

    sendTelemetryErrorEvent(): void {
        /* unused in tests */
    }

    async dispose(): Promise<void> {
        __captured.disposed += 1;
    }
}
