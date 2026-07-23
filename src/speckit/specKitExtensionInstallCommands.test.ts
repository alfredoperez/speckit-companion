import * as vscode from 'vscode';
import { registerSpecKitExtensionInstallCommands } from './specKitExtensionInstallCommands';
import { INSTALL_PROMPT_EVENT, initTelemetry, TelemetryService } from '../core/telemetry';

jest.mock('./specKitExtensionInstall', () => ({
    runInstallSpecKitExtension: jest.fn(),
    openReadmeFallback: jest.fn(),
}));

const captured: Array<{ name: string; properties?: Record<string, unknown> }> = [];

function registerAndCapture(): {
    handlers: Map<string, (...args: unknown[]) => unknown>;
    globalStateStore: Map<string, unknown>;
} {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    (vscode.commands.registerCommand as jest.Mock).mockImplementation(
        (id: string, cb: (...args: unknown[]) => unknown) => {
            handlers.set(id, cb);
            return { dispose: jest.fn() };
        }
    );
    const globalStateStore = new Map<string, unknown>();
    const context = {
        subscriptions: [],
        globalState: {
            get: (k: string, d?: unknown) => (globalStateStore.has(k) ? globalStateStore.get(k) : d),
            update: async (k: string, v: unknown) => { globalStateStore.set(k, v); },
        },
    } as unknown as vscode.ExtensionContext;
    registerSpecKitExtensionInstallCommands(context);
    return { handlers, globalStateStore };
}

describe('companion install-nudge commands', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        captured.length = 0;
        const svc = new TelemetryService();
        jest.spyOn(svc, 'sendEvent').mockImplementation((name: string, properties?: Record<string, unknown>) => {
            captured.push({ name, properties });
            return true;
        });
        initTelemetry(svc);
    });

    it('installNudge fires clicked telemetry tagged with a known surface, then installs', async () => {
        const { handlers } = registerAndCapture();
        await handlers.get('speckit.companion.installNudge')!('pinnedRow');
        expect(captured).toContainEqual({
            name: INSTALL_PROMPT_EVENT,
            properties: { action: 'clicked', surface: 'pinnedRow' },
        });
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('speckit.companion.installSpecKitExtension');
    });

    it('installNudge ignores an unknown surface but still installs', async () => {
        const { handlers } = registerAndCapture();
        await handlers.get('speckit.companion.installNudge')!('__proto__');
        expect(captured.some(e => e.name === INSTALL_PROMPT_EVENT)).toBe(false);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('speckit.companion.installSpecKitExtension');
    });

    it('dismissInstallNudge persists globalState and sets the context key', async () => {
        const { handlers, globalStateStore } = registerAndCapture();
        await handlers.get('speckit.companion.dismissInstallNudge')!();
        expect(globalStateStore.get('speckit.installNudgeDismissed')).toBe(true);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            'speckit.companion.installNudgeDismissed',
            true
        );
    });
});
