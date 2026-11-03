import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { rebuildIfLost } from '../pipelineBuildCommands';

jest.mock('child_process', () => ({ execFile: jest.fn() }));

const { execFile } = require('child_process') as { execFile: jest.Mock };

const PREVIEW_LOST = [
    '[build] would build 4 commands from .specify/companion.yml',
    '[build] what would change:',
    '  implement: unchanged',
    '  plan: +3 −0 lines',
    '  specify: unchanged',
    '  tasks: unchanged',
    '  and refresh 4 agent command files from them',
].join('\n');
const PREVIEW_CURRENT = PREVIEW_LOST.replace('plan: +3 −0 lines', 'plan: unchanged');

let root: string;
let log: jest.Mock;

/** Answer each python call in turn: the preview first, then the build. */
function buildSays(...outputs: string[]): void {
    for (const output of outputs) {
        execFile.mockImplementationOnce((_cmd, _args, _opts, done) => done(null, output, ''));
    }
}

beforeEach(() => {
    jest.clearAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rebuild-'));
    const script = path.join(root, '.specify', 'extensions', 'companion', 'scripts', 'build-pipeline.py');
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.writeFileSync(script, '');
    log = jest.fn();
});

const OLD = new Date('2026-01-01T00:00:00Z');
/** A configured project whose built commands are newer than its configuration, as a reinstall leaves them. */
const configure = () => {
    const config = path.join(root, '.specify', 'companion.yml');
    fs.writeFileSync(config, 'commands: {}\n');
    fs.utimesSync(config, OLD, OLD);
    const built = path.join(root, '.specify', 'extensions', 'companion', 'commands', 'speckit.companion.plan.md');
    fs.mkdirSync(path.dirname(built), { recursive: true });
    fs.writeFileSync(built, 'shipped');
};
const dryRun = (call: number) => (execFile.mock.calls[call][1] as string[]).includes('--dry-run');

describe('after a reinstall put the shipped commands back', () => {
    it('rebuilds when the installed commands no longer match companion.yml, and says which', async () => {
        configure();
        buildSays(PREVIEW_LOST, '[build] built 4 commands');
        expect(await rebuildIfLost(root, '/ext', log)).toEqual(['plan']);
        expect(execFile).toHaveBeenCalledTimes(2);
        expect(dryRun(0)).toBe(true);
        expect(dryRun(1)).toBe(false);
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Rebuilt plan'));
    });

    it('writes nothing when the build is current', async () => {
        configure();
        buildSays(PREVIEW_CURRENT);
        expect(await rebuildIfLost(root, '/ext', log)).toEqual([]);
        expect(execFile).toHaveBeenCalledTimes(1);
        expect(log).not.toHaveBeenCalled();
    });

    it('leaves a configuration edited ahead of its build to the person', async () => {
        configure();
        fs.utimesSync(path.join(root, '.specify', 'companion.yml'), new Date(), new Date());
        fs.utimesSync(path.join(root, '.specify', 'extensions', 'companion', 'commands', 'speckit.companion.plan.md'), OLD, OLD);
        expect(await rebuildIfLost(root, '/ext', log)).toEqual([]);
        expect(execFile).not.toHaveBeenCalled();
    });

    it('says why when the preview fails, and builds nothing', async () => {
        configure();
        execFile.mockImplementationOnce((_cmd, _args, _opts, done) => done(new Error('exit 1'), '', '[build] cannot build\n  bad key\n'));
        expect(await rebuildIfLost(root, '/ext', log)).toEqual([]);
        expect(execFile).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith(expect.stringContaining('bad key'));
    });

    it('runs one check at a time when change events pile up', async () => {
        configure();
        buildSays(PREVIEW_CURRENT);
        const [a, b] = [rebuildIfLost(root, '/ext', log), rebuildIfLost(root, '/ext', log)];
        expect(a).toBe(b);
        await a;
        expect(execFile).toHaveBeenCalledTimes(1);
    });

    it('does not run the build for a project with nothing of its own to build', async () => {
        expect(await rebuildIfLost(root, '/ext', log)).toEqual([]);
        expect(execFile).not.toHaveBeenCalled();
    });
});
