import * as vscode from 'vscode';
import { LivingSpecsExplorerProvider } from '../livingSpecsExplorerProvider';

jest.mock('../livingSpecsModel', () => ({
    readLivingSpecs: jest.fn(),
    readCapabilityHealth: jest.fn().mockResolvedValue(undefined),
    isPathWithinRoot: jest.fn().mockReturnValue(true),
}));

import { readLivingSpecs } from '../livingSpecsModel';

const WORKSPACE = '/workspace';

function createProvider(): LivingSpecsExplorerProvider {
    const context = {
        subscriptions: [],
        extensionUri: vscode.Uri.file('/ext'),
    } as unknown as vscode.ExtensionContext;
    return new LivingSpecsExplorerProvider(context);
}

describe('LivingSpecsExplorerProvider', () => {
    let provider: LivingSpecsExplorerProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: WORKSPACE } }];
        provider = createProvider();
    });

    it('renders one informative row when living specs are turned off', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: false,
            capabilities: [],
            orphans: [],
        });

        const roots = await provider.getChildren();

        expect(roots).toHaveLength(1);
        expect(roots[0].label).toBe('Living Specs are off');
        expect(roots[0].contextValue).toBe('living-specs-empty');
        expect(roots[0].command).toBeUndefined();
        expect((roots[0].iconPath as vscode.ThemeIcon).id).toBe('info');
    });

    it('renders one informative row when enabled but empty', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: true,
            capabilities: [],
            orphans: [],
        });

        const roots = await provider.getChildren();

        expect(roots).toHaveLength(1);
        expect(roots[0].label).toBe('No living specs yet');
        expect(roots[0].tooltip).toContain('Adopt');
    });

    it('never returns a blank root', async () => {
        for (const listing of [
            { enabled: false, capabilities: [], orphans: [] },
            { enabled: true, capabilities: [], orphans: [] },
        ]) {
            (readLivingSpecs as jest.Mock).mockReturnValue(listing);
            provider = createProvider();
            expect((await provider.getChildren()).length).toBeGreaterThan(0);
        }
    });

    it('groups capabilities before orphans', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: true,
            capabilities: [
                { name: 'auth', spec: 'capabilities/auth/spec.md', location: 'central', exists: true, tiers: [] },
            ],
            orphans: ['legacy/legacy-auth.spec.md'],
        });

        const roots = await provider.getChildren();

        expect(roots.map(r => r.label)).toEqual(['Capabilities', 'Orphans']);
    });

    it('gives an orphan row its exact path so reveal can resolve it', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: true,
            capabilities: [],
            orphans: ['legacy/legacy-auth.spec.md'],
        });

        const roots = await provider.getChildren();
        const orphans = await provider.getChildren(roots[0]);

        expect(orphans).toHaveLength(1);
        expect(orphans[0].contextValue).toBe('living-specs-orphan');
        expect(orphans[0].label).toBe('legacy-auth.spec.md');
        expect(orphans[0].tooltip).toBe('legacy/legacy-auth.spec.md');
    });

    it('offers no open command on a capability whose spec does not exist', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: true,
            capabilities: [
                { name: 'billing', spec: 'capabilities/billing/spec.md', location: 'central', exists: false, tiers: [] },
            ],
            orphans: [],
        });

        const roots = await provider.getChildren();
        const caps = await provider.getChildren(roots[0]);

        expect(caps[0].contextValue).toBe('living-specs-capability-missing');
        expect(caps[0].command).toBeUndefined();
        expect(caps[0].description).toContain('not created');
        expect((caps[0].iconPath as vscode.ThemeIcon).id).toBe('circle-outline');
    });
});
