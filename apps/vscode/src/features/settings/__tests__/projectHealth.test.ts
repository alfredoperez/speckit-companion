import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const mockCli: { version: { cli: string; integrationUpgrade: boolean } | undefined } = { version: { cli: '1.2.3', integrationUpgrade: true } };
jest.mock('../../../speckit/specKitUpgrade', () => ({
    resetSpecifyVersion: jest.fn(),
    specifyVersion: async () => mockCli.version,
    installedAgents: (root: string) => {
        try { return JSON.parse(fs.readFileSync(path.join(root, '.specify', 'integration.json'), 'utf-8')).installed_integrations ?? []; } catch { return []; }
    },
}));
const mockInstalled = { value: true };
jest.mock('../../../speckit/detector', () => ({
    SpecKitDetector: { getInstance: () => ({ checkCliInstalled: async () => mockInstalled.value }) },
}));
let mockRoot: string | undefined;
jest.mock('../../../core/projectRoot', () => ({ getProjectRoot: () => mockRoot, onDidChangeProjectRoot: () => ({ dispose: () => undefined }) }));

import { gatherProjectHealth, constitutionState } from '../projectHealth';
import { OverviewProvider, healthItem } from '../overviewProvider';

describe('project health', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'health-'));
        mockRoot = root;
        mockCli.version = { cli: '1.2.3', integrationUpgrade: true };
        mockInstalled.value = true;
    });

    const write = (rel: string, content: string) => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), content);
    };

    it('reports every check not ready in an empty project', async () => {
        mockCli.version = undefined;
        mockInstalled.value = false;
        const checks = await gatherProjectHealth(root);
        expect(checks.map(c => c.ok)).toEqual([false, false, false, false]);
        expect(checks.every(c => c.fixCommand.length > 0)).toBe(true);
    });

    it('reports every check ready in a set-up project', async () => {
        write('.specify/extensions/companion/extension.yml', 'x');
        write('.specify/memory/constitution.md', '# Real\n');
        write('.specify/integration.json', JSON.stringify({ installed_integrations: ['claude'] }));
        const checks = await gatherProjectHealth(root);
        expect(checks.map(c => c.ok)).toEqual([true, true, true, true]);
    });

    it('calls an old CLI without the JSON version installed, version unknown', async () => {
        mockCli.version = undefined;
        const [cli] = await gatherProjectHealth(root);
        expect(cli.ok).toBe(true);
        expect(cli.detail).toBe('Installed, version unknown');
    });

    it('tells a template constitution from a filled one that keeps its report comment', () => {
        write('.specify/memory/constitution.md', '# [PROJECT_NAME]\n');
        expect(constitutionState(root)).toBe('template');
        write('.specify/memory/constitution.md', '<!-- replaced [PROJECT_NAME] -->\n# Real\n');
        expect(constitutionState(root)).toBe('filled');
    });

    it('gives a not-ready child a fix command and a ready child none', async () => {
        write('.specify/extensions/companion/extension.yml', 'x');
        const [cli, companion, constitution] = (await gatherProjectHealth(root)).map(healthItem);
        expect(companion.command).toBeUndefined();
        expect((companion.iconPath as { id: string }).id).toBe('pass');
        expect(constitution.command?.command).toBe('speckit.projectHealth.fix');
        expect(constitution.command?.arguments).toEqual(['speckit.constitution']);
        expect(String(constitution.tooltip)).toContain('speckit.constitution');
        expect((constitution.iconPath as { id: string }).id).toBe('warning');
        expect(cli.command).toBeUndefined();
    });

    it('lists Project health first, collapsed, and fills its children on expand', async () => {
        const provider = new OverviewProvider({ subscriptions: [] } as never);
        const top = await provider.getChildren();
        expect(top[0].label).toBe('Project health');
        expect(await provider.getChildren(top[0])).toHaveLength(4);
    });
});
