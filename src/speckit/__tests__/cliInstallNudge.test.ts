import * as fs from 'fs';
import * as vscode from 'vscode';

jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn() }));

jest.mock('../../features/settings/companionPresetReconciler', () => ({
    isCompanionInstalled: jest.fn().mockReturnValue(false),
}));

import {
    shouldShowCliInstallNudge,
    maybeShowCliInstallNudge,
    __resetCliInstallNudgeSession,
    CliInstallNudgeGateInput,
} from '../cliInstallNudge';
import { isCompanionInstalled } from '../../features/settings/companionPresetReconciler';
import {
    initTelemetry,
    TelemetryService,
    __resetInstallPromptShownDedupe,
    INSTALL_PROMPT_EVENT,
} from '../../core/telemetry';
import { AIProviders } from '../../core/constants';

interface TelemetryMockShape {
    __captured: { events: { name: string; properties?: Record<string, string> }[] };
    __resetTelemetryMock: () => void;
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __captured, __resetTelemetryMock } =
    require('@vscode/extension-telemetry') as TelemetryMockShape;

function mockConfig(values: Record<string, unknown>): void {
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: (key: string, fallback?: unknown) => (key in values ? values[key] : fallback),
    });
}

/** All-true gate input — the one positive combination. */
function positiveInput(): CliInstallNudgeGateInput {
    return {
        specKitDetected: true,
        companionInstalled: false,
        dismissed: false,
        providerDispatchesToTerminal: true,
        alreadyShownThisSession: false,
    };
}

function fakeContext(dismissed = false): vscode.ExtensionContext {
    return {
        globalState: {
            get: (_k: string, d?: unknown) => (dismissed ? true : d),
            update: async () => {},
        },
    } as unknown as vscode.ExtensionContext;
}

describe('shouldShowCliInstallNudge (gate predicate)', () => {
    it('returns true only for the full positive combination', () => {
        expect(shouldShowCliInstallNudge(positiveInput())).toBe(true);
    });

    it('returns false when spec-kit is not detected', () => {
        expect(shouldShowCliInstallNudge({ ...positiveInput(), specKitDetected: false })).toBe(false);
    });

    it('returns false when the companion extension is already installed', () => {
        expect(shouldShowCliInstallNudge({ ...positiveInput(), companionInstalled: true })).toBe(false);
    });

    it('returns false when the nudge was already dismissed', () => {
        expect(shouldShowCliInstallNudge({ ...positiveInput(), dismissed: true })).toBe(false);
    });

    it('returns false for a provider that does not dispatch to a terminal', () => {
        expect(
            shouldShowCliInstallNudge({ ...positiveInput(), providerDispatchesToTerminal: false })
        ).toBe(false);
    });

    it('returns false when it has already shown this session', () => {
        expect(
            shouldShowCliInstallNudge({ ...positiveInput(), alreadyShownThisSession: true })
        ).toBe(false);
    });
});

describe('maybeShowCliInstallNudge (wrapper)', () => {
    beforeEach(() => {
        __resetCliInstallNudgeSession();
        __resetInstallPromptShownDedupe();
        __resetTelemetryMock();
        mockConfig({ telemetry: true });
        initTelemetry(new TelemetryService());
        (isCompanionInstalled as jest.Mock).mockReturnValue(false);
        (vscode.window.showInformationMessage as jest.Mock).mockReset().mockResolvedValue(undefined);
        (fs.existsSync as jest.Mock).mockReturnValue(true); // .specify present
    });

    it('shows the hint and emits the terminal shown event on the positive path', () => {
        maybeShowCliInstallNudge(fakeContext(), '/root', AIProviders.CLAUDE);
        expect(vscode.window.showInformationMessage as jest.Mock).toHaveBeenCalledTimes(1);
        expect(__captured.events).toEqual([
            { name: INSTALL_PROMPT_EVENT, properties: { action: 'shown', surface: 'terminal' } },
        ]);
    });

    it('shows at most once per session', () => {
        maybeShowCliInstallNudge(fakeContext(), '/root', AIProviders.CLAUDE);
        maybeShowCliInstallNudge(fakeContext(), '/root', AIProviders.CLAUDE);
        expect(vscode.window.showInformationMessage as jest.Mock).toHaveBeenCalledTimes(1);
    });

    it('is silent (no render, no telemetry) when the companion extension is installed', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        maybeShowCliInstallNudge(fakeContext(), '/root', AIProviders.CLAUDE);
        expect(vscode.window.showInformationMessage as jest.Mock).not.toHaveBeenCalled();
        expect(__captured.events).toHaveLength(0);
    });

    it('is silent when spec-kit is not detected', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        maybeShowCliInstallNudge(fakeContext(), '/root', AIProviders.CLAUDE);
        expect(vscode.window.showInformationMessage as jest.Mock).not.toHaveBeenCalled();
        expect(__captured.events).toHaveLength(0);
    });

    it('is silent when the shared dismissal is set', () => {
        maybeShowCliInstallNudge(fakeContext(true), '/root', AIProviders.CLAUDE);
        expect(vscode.window.showInformationMessage as jest.Mock).not.toHaveBeenCalled();
        expect(__captured.events).toHaveLength(0);
    });

    it('is silent for an in-editor chat provider (already covered by #543)', () => {
        maybeShowCliInstallNudge(fakeContext(), '/root', AIProviders.IDE_CHAT);
        expect(vscode.window.showInformationMessage as jest.Mock).not.toHaveBeenCalled();
        expect(__captured.events).toHaveLength(0);
    });

    it('does not throw and does not render when there is no workspace root', () => {
        expect(() => maybeShowCliInstallNudge(fakeContext(), undefined, AIProviders.CLAUDE)).not.toThrow();
        expect(vscode.window.showInformationMessage as jest.Mock).not.toHaveBeenCalled();
    });

    it('gates the telemetry emit on the same condition as the render (no emit when silent)', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        maybeShowCliInstallNudge(fakeContext(), '/root', AIProviders.CLAUDE);
        expect(__captured.events).toHaveLength(0);
        expect(vscode.window.showInformationMessage as jest.Mock).not.toHaveBeenCalled();
    });
});
