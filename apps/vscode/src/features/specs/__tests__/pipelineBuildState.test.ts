import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readPipelineBuildState, BUILT_COMMANDS_REL } from '../pipelineBuild';

const sha = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
const OLD = new Date('2026-01-01T00:00:00Z');
const NEW = new Date('2026-01-01T00:00:05Z');

let root: string;

function write(rel: string, text: string, at: Date): void {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    fs.utimesSync(file, at, at);
}

function build(inputs: Record<string, string> | undefined): void {
    write(path.join(BUILT_COMMANDS_REL, 'speckit.companion.plan.md'), 'body', OLD);
    write(path.join(BUILT_COMMANDS_REL, '.manifest.json'), JSON.stringify(inputs ? { commands: {}, inputs } : { commands: {} }), OLD);
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'build-state-'));
    write('.specify/companion.yml', 'commands: {}\n', OLD);
    write('.specify/companion/nodes/x.md', 'node', OLD);
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const recorded = () => ({
    '.specify/companion.yml': sha('commands: {}\n'),
    '.specify/companion/nodes/x.md': sha('node'),
});

describe('readPipelineBuildState after a clone', () => {
    it('is current when every input is newer but has the built content', () => {
        build(recorded());
        write('.specify/companion.yml', 'commands: {}\n', NEW);
        write('.specify/companion/nodes/x.md', 'node', NEW);
        expect(readPipelineBuildState(root).kind).toBe('current');
    });

    it('is stale when an input changed content', () => {
        build(recorded());
        write('.specify/companion/nodes/x.md', 'edited', NEW);
        expect(readPipelineBuildState(root).kind).toBe('stale');
    });

    it('is stale when an input file was added', () => {
        build(recorded());
        write('.specify/companion/nodes/y.md', 'new', NEW);
        expect(readPipelineBuildState(root).kind).toBe('stale');
    });

    it('is stale when a recorded input was removed', () => {
        build({ ...recorded(), '.specify/companion/nodes/gone.md': sha('x') });
        write('.specify/companion.yml', 'commands: {}\n', NEW);
        expect(readPipelineBuildState(root).kind).toBe('stale');
    });

    it('keeps the time answer when the manifest records no inputs', () => {
        build(undefined);
        write('.specify/companion.yml', 'commands: {}\n', NEW);
        expect(readPipelineBuildState(root).kind).toBe('stale');
    });

    it('keeps the time answer when there is no manifest', () => {
        write(path.join(BUILT_COMMANDS_REL, 'speckit.companion.plan.md'), 'body', OLD);
        write('.specify/companion.yml', 'commands: {}\n', NEW);
        expect(readPipelineBuildState(root).kind).toBe('stale');
    });
});
