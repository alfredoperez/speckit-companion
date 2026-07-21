import {
    buildCapabilityTree,
    readDriftedFiles,
    CapabilityTreeGroup,
    CapabilityTreeNode,
    ResolvedCapability,
} from '../livingSpecsModel';

function cap(name: string, spec: string, extra: Partial<ResolvedCapability> = {}): ResolvedCapability {
    return {
        name,
        spec,
        location: spec.endsWith('/spec.md') ? 'centralized' : 'colocated',
        exists: true,
        tiers: [],
        match: [],
        exclude: [],
        ...extra,
    };
}

function group(nodes: CapabilityTreeNode[], name: string): CapabilityTreeGroup {
    const found = nodes.find((n): n is CapabilityTreeGroup => n.kind === 'group' && n.name === name);
    if (!found) throw new Error(`no group "${name}" in [${nodes.map(n => n.kind === 'group' ? n.name : n.capability.name).join(', ')}]`);
    return found;
}

function leafNames(nodes: CapabilityTreeNode[]): string[] {
    return nodes.filter(n => n.kind === 'capability').map(n => (n as { capability: ResolvedCapability }).capability.name);
}

describe('buildCapabilityTree', () => {
    it('nests capabilities under the parent directory of their spec folder', () => {
        const tree = buildCapabilityTree([
            cap('core', 'src/core/core.spec.md'),
            cap('specs', 'src/features/specs/specs.spec.md'),
            cap('spec-viewer', 'src/features/spec-viewer/spec-viewer.spec.md'),
            cap('viewer-ui', 'webview/src/spec-viewer/viewer-ui.spec.md'),
        ]);

        // Top level: one group per first segment.
        expect(tree.map(n => n.kind === 'group' ? n.name : '(leaf)')).toEqual(['src', 'webview']);

        const src = group(tree, 'src');
        // `core` is a leaf directly under src; `features` is a nested group.
        expect(leafNames(src.children)).toEqual(['core']);
        const features = group(src.children, 'features');
        expect(leafNames(features.children).sort()).toEqual(['spec-viewer', 'specs']);

        const webview = group(tree, 'webview');
        const webviewSrc = group(webview.children, 'src');
        expect(leafNames(webviewSrc.children)).toEqual(['viewer-ui']);
    });

    it('groups a central spec under its capability root', () => {
        const tree = buildCapabilityTree([cap('auth', 'capabilities/auth/spec.md')]);
        const capabilities = group(tree, 'capabilities');
        expect(leafNames(capabilities.children)).toEqual(['auth']);
    });

    it('places a repo-root spec as a top-level leaf with no group', () => {
        const tree = buildCapabilityTree([cap('foo', 'foo.spec.md')]);
        expect(tree).toHaveLength(1);
        expect(tree[0].kind).toBe('capability');
        expect(leafNames(tree)).toEqual(['foo']);
    });

    it('carries the resolved capability through onto each leaf', () => {
        const resolved = cap('billing', 'src/billing/billing.spec.md', { match: ['src/billing/**'] });
        const tree = buildCapabilityTree([resolved]);
        const leaf = group(tree, 'src').children[0];
        expect(leaf.kind).toBe('capability');
        expect((leaf as { capability: ResolvedCapability }).capability).toBe(resolved);
    });
});

describe('readDriftedFiles', () => {
    const drifted = cap('checkout', 'capabilities/checkout/spec.md', { match: ['src/checkout/**'] });

    it('returns only the matched files changed since the spec commit', async () => {
        const git = async (args: string[]) =>
            args[0] === 'log' ? 'abc123\n' : 'src/checkout/cart.ts\nREADME.md\nsrc/checkout/api.ts\n';
        const files = await readDriftedFiles('/ws', drifted, { git });
        expect(files).toEqual(['src/checkout/cart.ts', 'src/checkout/api.ts']);
    });

    it('is absent (not empty) when the spec was never committed', async () => {
        const files = await readDriftedFiles('/ws', drifted, { git: async () => '' });
        expect(files).toBeUndefined();
    });

    it('is absent when git fails', async () => {
        const files = await readDriftedFiles('/ws', drifted, {
            git: async () => { throw new Error('not a repo'); },
        });
        expect(files).toBeUndefined();
    });
});
