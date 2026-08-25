import * as vscode from 'vscode';
import {
    TelemetryService,
    initTelemetry,
    reportInstalledOnce,
    trackPanelOpened,
    __resetFunnelDedupe,
    EXTENSION_INSTALLED_EVENT,
    PANEL_OPENED_EVENT,
} from '../telemetry';
import { ConfigKeys } from '../constants';
import {
    TEST_POSTHOG_KEY,
    installTelemetryFetchMock,
    capturedTelemetryEvents,
} from './helpers/telemetryFetch';

// The mock's tree-view factory isn't part of the real vscode types.
const { createMockTreeView } = vscode as unknown as {
    createMockTreeView: () => {
        visible: boolean;
        onDidChangeVisibility: (cb: (e: { visible: boolean }) => void) => { dispose: () => void };
        __fireVisibilityChange: (visible: boolean) => void;
    };
};

let fetchMock: jest.Mock;
let telemetrySetting = true;

function eventNames(): string[] {
    return capturedTelemetryEvents(fetchMock).map(e => e.name);
}

function makeGlobalState(initial: Record<string, unknown> = {}) {
    const store = new Map<string, unknown>(Object.entries(initial));
    return {
        get: jest.fn((key: string, fallback?: unknown) => (store.has(key) ? store.get(key) : fallback)),
        update: jest.fn(async (key: string, value: unknown) => {
            store.set(key, value);
        }),
        __store: store,
    };
}

describe('activation-funnel events', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        __resetFunnelDedupe();
        fetchMock = installTelemetryFetchMock();
        telemetrySetting = true;
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: (key: string, fallback?: unknown) => (key === 'telemetry' ? telemetrySetting : fallback),
        });
        (vscode.env as { isTelemetryEnabled: boolean }).isTelemetryEnabled = true;
        initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
    });

    describe('extension.installed (once ever per install identity)', () => {
        it('fires when the marker is unset and persists the marker after the confirmed send', async () => {
            const globalState = makeGlobalState();

            await reportInstalledOnce(globalState as never);

            expect(eventNames()).toEqual([EXTENSION_INSTALLED_EVENT]);
            expect(globalState.update).toHaveBeenCalledWith(ConfigKeys.globalState.installedEventSent, true);
        });

        it('never re-fires once the marker is set', async () => {
            const globalState = makeGlobalState({ [ConfigKeys.globalState.installedEventSent]: true });

            await reportInstalledOnce(globalState as never);
            await reportInstalledOnce(globalState as never);

            expect(eventNames()).toEqual([]);
        });

        it('burns no marker on an unsent event: telemetry off leaves the install reportable later', async () => {
            const globalState = makeGlobalState();
            telemetrySetting = false;

            await reportInstalledOnce(globalState as never);
            expect(eventNames()).toEqual([]);
            expect(globalState.update).not.toHaveBeenCalled();

            telemetrySetting = true;
            await reportInstalledOnce(globalState as never);
            expect(eventNames()).toEqual([EXTENSION_INSTALLED_EVENT]);
            expect(globalState.update).toHaveBeenCalledWith(ConfigKeys.globalState.installedEventSent, true);
        });
    });

    describe('panel.opened (once per session)', () => {
        it('fires on the first visibility event and never on later toggles', () => {
            const treeView = createMockTreeView();
            trackPanelOpened(treeView as never);
            expect(eventNames()).toEqual([]);

            treeView.__fireVisibilityChange(true);
            treeView.__fireVisibilityChange(false);
            treeView.__fireVisibilityChange(true);
            treeView.__fireVisibilityChange(true);

            expect(eventNames()).toEqual([PANEL_OPENED_EVENT]);
        });

        it('fires immediately when the panel is already visible at wiring time', () => {
            const treeView = createMockTreeView();
            treeView.visible = true;

            trackPanelOpened(treeView as never);

            expect(eventNames()).toEqual([PANEL_OPENED_EVENT]);
        });

        it('burns no session slot on an unsent event: a visibility while telemetry is off still fires later', () => {
            telemetrySetting = false;
            const treeView = createMockTreeView();
            trackPanelOpened(treeView as never);

            treeView.__fireVisibilityChange(true);
            expect(eventNames()).toEqual([]);

            telemetrySetting = true;
            treeView.__fireVisibilityChange(false);
            treeView.__fireVisibilityChange(true);
            expect(eventNames()).toEqual([PANEL_OPENED_EVENT]);
        });
    });
});
