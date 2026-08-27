import * as vscode from 'vscode';
import { dispatchStep } from '../dispatchStep';
import { resolveDispatchWithFallback } from '../profileDispatch';
import { sendTelemetryEvent } from '../../../core/telemetry';
import { buildPrompt } from '../../../ai-providers/promptBuilder';
import { formatCommandForProvider } from '../../../ai-providers/aiProvider';

jest.mock('../profileDispatch', () => ({ resolveDispatchWithFallback: jest.fn() }));
jest.mock('../../../core/telemetry', () => ({
    sendTelemetryEvent: jest.fn(),
    getSpecTelemetryContext: jest.fn(() => ({ specInstanceId: 'spec-1' })),
    phaseTelemetryId: jest.fn((step: string) => step),
}));
jest.mock('../../../ai-providers/promptBuilder', () => ({
    buildPrompt: jest.fn(({ command }: { command: string }) => `WRAPPED:${command}`),
}));
jest.mock('../../../ai-providers/aiProvider', () => ({
    formatCommandForProvider: jest.fn((c: string) => c.replace(/\./g, ':')),
    getConfiguredProviderType: jest.fn(() => 'claude'),
}));

const resolved = resolveDispatchWithFallback as jest.Mock;
const outputChannel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;

function deps(run = jest.fn().mockResolvedValue('terminal')) {
    return { outputChannel, logPrefix: 'SpecKit', run };
}

const request = {
    baseCommand: 'speckit.companion.plan',
    step: 'plan',
    targetPath: '/ws/specs/001-x',
    specDirectory: '/ws/specs/001-x',
    promptSpecDir: 'specs/001-x',
};

describe('dispatchStep', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (outputChannel.appendLine as jest.Mock).mockClear();
        // The warning is fire-and-forget; the shared mock returns undefined,
        // so give it a thenable for the `.then(choice => …)` continuation.
        (vscode.window.showWarningMessage as unknown as jest.Mock).mockResolvedValue(undefined);
    });

    it('runs the resolved command, formatted for the provider and wrapped in the preamble', async () => {
        resolved.mockReturnValue({ command: 'speckit.companion.plan', fellBack: false });
        const d = deps();

        const result = await dispatchStep(request, d);

        expect(formatCommandForProvider).toHaveBeenCalledWith('speckit.companion.plan');
        expect(d.run).toHaveBeenCalledWith('WRAPPED:/speckit:companion:plan /ws/specs/001-x');
        expect(result).toBe('terminal');
    });

    it('records the dispatch once, with the spec it belongs to', async () => {
        resolved.mockReturnValue({ command: 'speckit.plan', fellBack: false });

        await dispatchStep(request, deps());

        expect(sendTelemetryEvent).toHaveBeenCalledTimes(1);
        expect(sendTelemetryEvent).toHaveBeenCalledWith('phase.dispatched', {
            providerId: 'claude',
            phase: 'plan',
            specInstanceId: 'spec-1',
        });
    });

    it('tells the preamble the spec directory the caller named, not the target path', async () => {
        // The sidebar passes a workspace-relative path here and the viewer the
        // change root; collapsing the two onto one value would change one of them.
        resolved.mockReturnValue({ command: 'speckit.plan', fellBack: false });

        await dispatchStep(request, deps());

        expect(buildPrompt).toHaveBeenCalledWith(
            expect.objectContaining({ specDir: 'specs/001-x', step: 'plan' }),
        );
    });

    it('appends refinement context to the command line, not to the logged command', async () => {
        resolved.mockReturnValue({ command: 'speckit.plan', fellBack: false });
        const d = deps();

        await dispatchStep({ ...request, refinementContext: '\n\nAlso: tighten FR-002' }, d);

        expect(d.run).toHaveBeenCalledWith(
            'WRAPPED:/speckit:plan /ws/specs/001-x\n\nAlso: tighten FR-002',
        );
        expect(outputChannel.appendLine).toHaveBeenCalledWith(
            '[SpecKit] Executing step "plan": /speckit:plan /ws/specs/001-x',
        );
    });

    it('warns and offers the install when it falls back to the stock command', async () => {
        resolved.mockReturnValue({ command: 'speckit.plan', fellBack: true });
        const d = deps();

        await dispatchStep(request, d);

        expect(outputChannel.appendLine).toHaveBeenCalledWith(
            expect.stringContaining('Companion command unavailable'),
        );
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            expect.stringContaining('companion spec-kit extension'),
            'Install spec-kit Extension',
        );
        expect(d.run).toHaveBeenCalled();
    });

    it('dispatches nothing when a companion-only step has no stock twin', async () => {
        // mark-complete with the extension missing: there is nothing to run, and
        // running the base command anyway would send the CLI a command it cannot
        // resolve.
        resolved.mockReturnValue({ command: null, fellBack: true });
        const d = deps();

        const result = await dispatchStep(request, d);

        expect(d.run).not.toHaveBeenCalled();
        expect(sendTelemetryEvent).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });
});
