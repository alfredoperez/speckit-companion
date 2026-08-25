import * as fs from 'fs';
import * as vscode from 'vscode';

jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn() }));

jest.mock('../../features/settings/companionPresetReconciler', () => ({
    isCompanionInstalled: jest.fn().mockReturnValue(false),
}));

import {
    shouldShowActivationInstallNudge,
    maybeShowActivationInstallNudge,
    __resetActivationInstallNudgeSession,
    ActivationInstallNudgeGateInput,
} from '../activationInstallNudge';
import { isCompanionInstalled } from '../../features/settings/companionPresetReconciler';
import {
    initTelemetry,
    TelemetryService,
    __resetInstallPromptShownDedupe,
    INSTALL_PROMPT_EVENT,
} from '../../core/telemetry';
import {
    TEST_POSTHOG_KEY,
    installTelemetryFetchMock,
    capturedTelemetryEvents,
    specificProps,
} from '../../core/__tests__/helpers/telemetryFetch';

let fetchMock: jest.Mock;

function mockConfig(values: Record<string, unknown>): void {
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: (key: string, fallback?: unknown) => (key in values ? values[key] : fallback),
    });
}

/** All-true gate input — the one positive combination. */
function positiveInput(): ActivationInstallNudgeGateInput {
    return {
        specKitDetected: true,
        companionInstalled: false,
        dismissed: false,
        installPromptEnabled: true,
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

describe('shouldShowActivationInstallNudge (gate predicate)', () => {
    it('returns true only for the full positive combination', () => {
        expect(shouldShowActivationInstallNudge(positiveInput())).toBe(true);
    });

    it('returns false when spec-kit is not detected', () => {
        expect(shouldShowActivationInstallNudge({ ...positiveInput(), specKitDetected: false })).toBe(false);
    });

    it('returns false when the companion extension is already installed', () => {
        expect(shouldShowActivationInstallNudge({ ...positiveInput(), companionInstalled: true })).toBe(false);
    });

    it('returns false when the nudge was already dismissed', () => {
        expect(shouldShowActivationInstallNudge({ ...positiveInput(), dismissed: true })).toBe(false);
    });

    it('returns false when the install-prompt preference is off', () => {
        expect(shouldShowActivationInstallNudge({ ...positiveInput(), installPromptEnabled: false })).toBe(false);
    });

    it('returns false when it has already shown this session', () => {
        expect(shouldShowActivationInstallNudge({ ...positiveInput(), alreadyShownThisSession: true })).toBe(false);
    });
});

describe('maybeShowActivationInstallNudge (wrapper)', () => {
    beforeEach(() => {
        __resetActivationInstallNudgeSession();
        __resetInstallPromptShownDedupe();
        fetchMock = installTelemetryFetchMock();
        mockConfig({ telemetry: true, 'companion.installPrompt': true });
        initTelemetry(new TelemetryService(TEST_POSTHOG_KEY));
        (isCompanionInstalled as jest.Mock).mockReturnValue(false);
        (vscode.window.showInformationMessage as jest.Mock).mockReset().mockResolvedValue(undefined);
        (fs.existsSync as jest.Mock).mockReturnValue(true); // .specify present
    });

    it('shows the prompt and emits the activation shown event on the positive path', () => {
        maybeShowActivationInstallNudge(fakeContext(), '/root');
        expect(vscode.window.showInformationMessage as jest.Mock).toHaveBeenCalledTimes(1);
        const events = capturedTelemetryEvents(fetchMock);
        expect(events).toHaveLength(1);
        expect(events[0].name).toBe(INSTALL_PROMPT_EVENT);
        expect(specificProps(events[0].properties)).toEqual({ action: 'shown', surface: 'activation' });
    });

    it('shows at most once per session', () => {
        maybeShowActivationInstallNudge(fakeContext(), '/root');
        maybeShowActivationInstallNudge(fakeContext(), '/root');
        expect(vscode.window.showInformationMessage as jest.Mock).toHaveBeenCalledTimes(1);
    });

    it('is silent (no render, no telemetry) when the companion extension is installed', () => {
        (isCompanionInstalled as jest.Mock).mockReturnValue(true);
        maybeShowActivationInstallNudge(fakeContext(), '/root');
        expect(vscode.window.showInformationMessage as jest.Mock).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('is silent when spec-kit is not detected', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        maybeShowActivationInstallNudge(fakeContext(), '/root');
        expect(vscode.window.showInformationMessage as jest.Mock).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('is silent when the shared dismissal is set', () => {
        maybeShowActivationInstallNudge(fakeContext(true), '/root');
        expect(vscode.window.showInformationMessage as jest.Mock).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('is silent when the install-prompt preference is off', () => {
        mockConfig({ telemetry: true, 'companion.installPrompt': false });
        maybeShowActivationInstallNudge(fakeContext(), '/root');
        expect(vscode.window.showInformationMessage as jest.Mock).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fires for any provider — no terminal-provider gate (installing is a terminal command regardless)', () => {
        // No provider argument at all: the prompt is provider-agnostic by construction.
        maybeShowActivationInstallNudge(fakeContext(), '/root');
        expect(vscode.window.showInformationMessage as jest.Mock).toHaveBeenCalledTimes(1);
    });

    it('does not throw and does not render when there is no workspace root', () => {
        expect(() => maybeShowActivationInstallNudge(fakeContext(), undefined)).not.toThrow();
        expect(vscode.window.showInformationMessage as jest.Mock).not.toHaveBeenCalled();
    });
});
