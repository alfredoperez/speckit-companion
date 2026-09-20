import * as vscode from 'vscode';
import * as headerMeta from '../../../src/features/living-specs/livingHeaderMeta';
import { SpecViewerProvider } from '../../../src/features/spec-viewer/specViewerProvider';
import type { LivingHeaderMeta } from '../../../src/protocol/viewer';

type Health = Awaited<ReturnType<typeof headerMeta.resolveLivingHealth>>;

describe('living spec health', () => {
    it('drops a result that finishes after a newer request for the same panel', async () => {
        const { context } = (vscode as unknown as {
            createMockExtensionContext: () => { context: vscode.ExtensionContext };
        }).createMockExtensionContext();
        const provider = new SpecViewerProvider(context, vscode.window.createOutputChannel('test'));
        (vscode.workspace as { workspaceFolders?: unknown }).workspaceFolders = [{ uri: { fsPath: '/root' } }];

        const pending: Array<(h: Health) => void> = [];
        const spy = jest.spyOn(headerMeta, 'resolveLivingHealth').mockImplementation(
            () => new Promise<Health>(resolve => pending.push(resolve)),
        );
        const posted: unknown[] = [];
        const internals = provider as unknown as {
            panels: { get: (k: string) => unknown };
            postMessage: (dir: string, msg: unknown) => void;
            livingSpecTier: unknown;
            pushLivingHealth: (dir: string, meta: LivingHeaderMeta) => Promise<void>;
        };
        internals.panels.get = () => ({ state: { living: true, livingSourcePath: undefined } });
        internals.postMessage = (_dir, msg) => posted.push(msg);
        const meta = { capabilityName: 'c', specPath: undefined as unknown as string, location: 'colocated' as const, match: [] };

        const older = internals.pushLivingHealth('panel', meta);
        const newer = internals.pushLivingHealth('panel', meta);
        pending[1]({ requirementCoverage: { A: '2 tests' } });
        await newer;
        pending[0]({ requirementCoverage: { A: '1 test' } });
        await older;

        expect(posted).toHaveLength(1);
        expect((posted[0] as { livingMeta: LivingHeaderMeta }).livingMeta.requirementCoverage).toEqual({ A: '2 tests' });
        spy.mockRestore();
    });
});
