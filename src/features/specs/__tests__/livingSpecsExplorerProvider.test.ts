import * as vscode from 'vscode';
import { LivingSpecsExplorerProvider } from '../livingSpecsExplorerProvider';

jest.mock('../livingSpecsModel', () => {
    const actual = jest.requireActual('../livingSpecsModel');
    return {
        ...actual,
        readLivingSpecs: jest.fn(),
        readCapabilityHealth: jest.fn().mockResolvedValue(undefined),
        isPathWithinRoot: jest.fn().mockReturnValue(true),
    };
});

import { readLivingSpecs, readCapabilityHealth } from '../livingSpecsModel';

const WORKSPACE = '/workspace';

function createProvider(): LivingSpecsExplorerProvider {
    const context = {
        subscriptions: [],
        extensionUri: vscode.Uri.file('/ext'),
    } as unknown as vscode.ExtensionContext;
    return new LivingSpecsExplorerProvider(context);
}

async function childrenOf(provider: LivingSpecsExplorerProvider, item?: any): Promise<any[]> {
    return await provider.getChildren(item);
}

function byLabel(items: any[], label: string): any {
    const found = items.find(i => i.label === label);
    if (!found) throw new Error(`no row "${label}" in [${items.map(i => i.label).join(', ')}]`);
    return found;
}

describe('LivingSpecsExplorerProvider', () => {
    let provider: LivingSpecsExplorerProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        (readCapabilityHealth as jest.Mock).mockResolvedValue(undefined);
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

    it('says the registry is unreadable instead of claiming living specs are off', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: false,
            capabilities: [],
            orphans: [],
            legacyStale: false,
            error: 'living-specs.yml could not be read (bad indentation); no capabilities loaded',
        });

        const roots = await provider.getChildren();

        expect(roots).toHaveLength(1);
        expect(roots[0].label).not.toBe('Living Specs are off');
        expect(roots[0].label).toContain("Can't read");
        expect(roots[0].contextValue).toBe('living-specs-error');
        expect(roots[0].tooltip).toContain('bad indentation');
        expect((roots[0].iconPath as vscode.ThemeIcon).id).toBe('error');
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

    it('surfaces a notice when capabilities still linger in the legacy config', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: true,
            capabilities: [],
            orphans: [],
            legacyStale: true,
        });

        const roots = await provider.getChildren();

        expect(roots[0].label).toContain('.specify/companion.yml');
        expect(roots[0].tooltip).toContain('living-specs.yml');
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

    it('groups capabilities into a directory tree mirroring where their specs live', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: true,
            capabilities: [
                { name: 'core', spec: 'src/core/core.spec.md', location: 'colocated', exists: true, tiers: [], match: [], exclude: [] },
                { name: 'specs', spec: 'src/features/specs/specs.spec.md', location: 'colocated', exists: true, tiers: [], match: [], exclude: [] },
            ],
            orphans: [],
        });

        const roots = await provider.getChildren();
        const src = byLabel(roots, 'src');
        expect(src.contextValue).toBe('living-specs-dir-group');

        const srcChildren = await childrenOf(provider, src);
        expect(byLabel(srcChildren, 'core').contextValue).toBe('living-specs-capability');
        const features = byLabel(srcChildren, 'features');
        expect(features.contextValue).toBe('living-specs-dir-group');

        const featuresChildren = await childrenOf(provider, features);
        expect(byLabel(featuresChildren, 'specs').contextValue).toBe('living-specs-capability');
    });

    it('shows orphans as a group after the capability tree', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: true,
            capabilities: [
                { name: 'auth', spec: 'capabilities/auth/spec.md', location: 'centralized', exists: true, tiers: [], match: [], exclude: [] },
            ],
            orphans: ['legacy/legacy-auth.spec.md'],
        });

        const roots = await provider.getChildren();

        expect(roots.map(r => r.label)).toEqual(['capabilities', 'Orphans']);
    });

    it('gives an orphan row its exact path so reveal can resolve it', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: true,
            capabilities: [],
            orphans: ['legacy/legacy-auth.spec.md'],
        });

        const roots = await provider.getChildren();
        const orphans = await childrenOf(provider, byLabel(roots, 'Orphans'));

        expect(orphans).toHaveLength(1);
        expect(orphans[0].contextValue).toBe('living-specs-orphan');
        expect(orphans[0].label).toBe('legacy-auth.spec.md');
        expect(orphans[0].tooltip).toBe('legacy/legacy-auth.spec.md');
        expect(orphans[0].relPath).toBe('legacy/legacy-auth.spec.md');
    });

    it('offers no open command on a capability whose spec does not exist', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: true,
            capabilities: [
                { name: 'billing', spec: 'capabilities/billing/spec.md', location: 'centralized', exists: false, tiers: [], match: [], exclude: [] },
            ],
            orphans: [],
        });

        const roots = await provider.getChildren();
        const caps = await childrenOf(provider, byLabel(roots, 'capabilities'));

        expect(caps[0].contextValue).toBe('living-specs-capability-missing');
        expect(caps[0].command).toBeUndefined();
        expect(caps[0].description).toContain('not created');
        expect((caps[0].iconPath as vscode.ThemeIcon).id).toBe('circle-outline');
    });

    it('promotes a drifted capability to its own context value and badges it', async () => {
        (readCapabilityHealth as jest.Mock).mockResolvedValue({ drifted: true });
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: true,
            capabilities: [
                { name: 'billing', spec: 'src/billing/billing.spec.md', location: 'colocated', exists: true, tiers: [], match: ['src/billing/**'], exclude: [] },
            ],
            orphans: [],
        });

        const roots = await provider.getChildren();
        const caps = await childrenOf(provider, byLabel(roots, 'src'));

        expect(caps[0].contextValue).toBe('living-specs-capability-drifted');
        expect(caps[0].description).toBe('drift');
    });

    it('leaves a clean capability at the plain context value with no location badge', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: true,
            capabilities: [
                { name: 'auth', spec: 'capabilities/auth/spec.md', location: 'centralized', exists: true, tiers: [], match: [], exclude: [] },
            ],
            orphans: [],
        });

        const roots = await provider.getChildren();
        const caps = await childrenOf(provider, byLabel(roots, 'capabilities'));

        expect(caps[0].contextValue).toBe('living-specs-capability');
        expect(caps[0].description).toBeUndefined();
        expect(caps[0].relPath).toBe('capabilities/auth/spec.md');
    });

    it('stays expandable when a capability has architecture or coverage tiers', async () => {
        (readLivingSpecs as jest.Mock).mockReturnValue({
            enabled: true,
            capabilities: [
                {
                    name: 'auth',
                    spec: 'capabilities/auth/spec.md',
                    location: 'centralized',
                    exists: true,
                    tiers: [{ kind: 'arch', path: 'capabilities/auth/architecture.md' }],
                    match: [],
                    exclude: [],
                },
            ],
            orphans: [],
        });

        const roots = await provider.getChildren();
        const caps = await childrenOf(provider, byLabel(roots, 'capabilities'));

        expect(caps[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);

        const tiers = await childrenOf(provider, caps[0]);
        expect(tiers.map(t => t.label)).toEqual(['Spec', 'Architecture']);
        expect(tiers[0].relPath).toBe('capabilities/auth/spec.md');
    });
});
