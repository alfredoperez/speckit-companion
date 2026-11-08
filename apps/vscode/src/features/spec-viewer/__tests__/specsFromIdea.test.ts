import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('../../../core/specDirectoryResolver', () => ({
    resolveSpecDirectories: jest.fn(),
}));

import { resolveSpecDirectories } from '../../../core/specDirectoryResolver';
import { specsFromIdea } from '../reportPanels';

describe('specsFromIdea', () => {
    let root: string;

    const spec = (name: string, record: Record<string, unknown>) => {
        const dir = path.join(root, 'specs', name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'spec.md'), '# Spec');
        fs.writeFileSync(path.join(dir, '.spec-context.json'), JSON.stringify(record));
        return { name, path: path.join('specs', name) };
    };

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'idea-specs-'));
    });

    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('finds the specs whose record names the idea folder, however the path is written', async () => {
        (resolveSpecDirectories as jest.Mock).mockResolvedValue([
            spec('042-saved-filters', { specName: 'Saved filters', source: './.specify/assessments/saved-filters' }),
            spec('043-other', { specName: 'Other', source: 'TODO-42' }),
            spec('044-no-record-source', { specName: 'Plain' }),
        ]);

        const found = await specsFromIdea('.specify/assessments/saved-filters/', root);

        expect(found).toEqual([{ name: 'Saved filters', path: path.join(root, 'specs', '042-saved-filters', 'spec.md') }]);
    });

    it('skips a broken record and survives a failed scan', async () => {
        const broken = spec('045-broken', {});
        fs.writeFileSync(path.join(root, broken.path, '.spec-context.json'), 'null');
        (resolveSpecDirectories as jest.Mock).mockResolvedValue([
            broken,
            spec('046-ok', { specName: 'Ok', source: '.specify/assessments/x/' }),
        ]);
        expect((await specsFromIdea('.specify/assessments/x/', root)).map(s => s.name)).toEqual(['Ok']);

        (resolveSpecDirectories as jest.Mock).mockRejectedValue(new Error('scan failed'));
        await expect(specsFromIdea('.specify/assessments/x/', root)).resolves.toEqual([]);
    });
});
