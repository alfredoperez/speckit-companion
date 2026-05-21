import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hasNonTrivialArtifact } from '../stepArtifact';

describe('hasNonTrivialArtifact', () => {
    let dir: string;

    beforeEach(async () => {
        dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'step-artifact-'));
    });

    afterEach(async () => {
        await fs.promises.rm(dir, { recursive: true, force: true });
    });

    const write = (name: string, body: string) =>
        fs.promises.writeFile(path.join(dir, name), body, 'utf-8');

    it('returns false when the artifact file is missing', async () => {
        expect(await hasNonTrivialArtifact(dir, 'plan')).toBe(false);
    });

    it('returns true for a file with a real heading', async () => {
        await write('plan.md', '# Plan: Something\n\nApproach goes here.');
        expect(await hasNonTrivialArtifact(dir, 'plan')).toBe(true);
    });

    it('returns true for substantial body text with no heading', async () => {
        await write('tasks.md', 'one two three four five six seven eight nine ten eleven');
        expect(await hasNonTrivialArtifact(dir, 'tasks')).toBe(true);
    });

    it('returns false for an empty file', async () => {
        await write('spec.md', '');
        expect(await hasNonTrivialArtifact(dir, 'specify')).toBe(false);
    });

    it('returns false for a whitespace-only file', async () => {
        await write('spec.md', '   \n\n\t  \n');
        expect(await hasNonTrivialArtifact(dir, 'specify')).toBe(false);
    });

    it('returns false for a frontmatter-only stub', async () => {
        await write('plan.md', '---\ntitle: stub\nstatus: draft\n---\n');
        expect(await hasNonTrivialArtifact(dir, 'plan')).toBe(false);
    });

    it('counts content after frontmatter is stripped', async () => {
        await write('plan.md', '---\ntitle: x\n---\n# Plan\n\nReal content here.');
        expect(await hasNonTrivialArtifact(dir, 'plan')).toBe(true);
    });

    it('returns false for a tiny non-heading stub below the threshold', async () => {
        await write('tasks.md', 'wip');
        expect(await hasNonTrivialArtifact(dir, 'tasks')).toBe(false);
    });

    it('returns false for the implement step (no single artifact)', async () => {
        await write('plan.md', '# Plan\n\nlots of content here to be safe.');
        expect(await hasNonTrivialArtifact(dir, 'implement')).toBe(false);
    });
});
