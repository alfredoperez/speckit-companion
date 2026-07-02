import * as vscode from 'vscode';
import { registerLivingSpecsCommands } from '../livingSpecsCommands';

const executeSlashCommand = jest.fn();

jest.mock('../../../extension', () => ({
    getAIProvider: jest.fn(() => ({
        executeInTerminal: jest.fn(),
        executeSlashCommand: (...args: unknown[]) => executeSlashCommand(...args),
    })),
}));

type Handler = (...args: unknown[]) => Promise<void> | void;

function registerAndCollect(provider: { refresh: jest.Mock }): Record<string, Handler> {
    const handlers: Record<string, Handler> = {};
    (vscode.commands.registerCommand as jest.Mock).mockImplementation(
        (id: string, handler: Handler) => {
            handlers[id] = handler;
            return { dispose: jest.fn() };
        }
    );
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    const outputChannel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;
    registerLivingSpecsCommands(context, provider as never, outputChannel);
    return handlers;
}

describe('registerLivingSpecsCommands', () => {
    let provider: { refresh: jest.Mock };
    let handlers: Record<string, Handler>;

    beforeEach(() => {
        jest.clearAllMocks();
        provider = { refresh: jest.fn() };
        handlers = registerAndCollect(provider);
    });

    it('registers all four living-specs commands', () => {
        expect(Object.keys(handlers).sort()).toEqual([
            'speckit.livingSpecs.adopt',
            'speckit.livingSpecs.coverage',
            'speckit.livingSpecs.drift',
            'speckit.livingSpecs.refresh',
        ]);
    });

    describe('drift', () => {
        it('dispatches the drift command scoped to the invoked capability', async () => {
            await handlers['speckit.livingSpecs.drift']({ capability: { name: 'checkout' } });
            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.drift checkout',
                'SpecKit - Living-Spec Drift',
                true
            );
        });

        it('dispatches unscoped when invoked without a capability node', async () => {
            await handlers['speckit.livingSpecs.drift']();
            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.drift',
                'SpecKit - Living-Spec Drift',
                true
            );
        });

        it('treats a non-capability node (no capability field) as unscoped', async () => {
            await handlers['speckit.livingSpecs.drift']({ groupId: 'living-specs-capabilities' });
            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.drift',
                expect.any(String),
                true
            );
        });
    });

    describe('coverage', () => {
        it('dispatches the coverage command scoped to the invoked capability', async () => {
            await handlers['speckit.livingSpecs.coverage']({ capability: { name: 'billing' } });
            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.coverage billing',
                'SpecKit - Requirement Coverage',
                true
            );
        });
    });

    describe('adopt', () => {
        it('dispatches the bare adopt command (the wizard prompts for the area)', async () => {
            await handlers['speckit.livingSpecs.adopt']();
            expect(executeSlashCommand).toHaveBeenCalledWith(
                '/speckit.companion.adopt',
                'SpecKit - Adopt Code Area',
                true
            );
        });
    });

    describe('refresh', () => {
        it('fires the provider refresh and never dispatches to the AI', () => {
            handlers['speckit.livingSpecs.refresh']();
            expect(provider.refresh).toHaveBeenCalledTimes(1);
            expect(executeSlashCommand).not.toHaveBeenCalled();
        });
    });
});
