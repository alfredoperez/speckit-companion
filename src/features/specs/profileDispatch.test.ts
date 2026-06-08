import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveProfileCommand } from './profileDispatch';

const ctx = (extra: Record<string, unknown>): string =>
    JSON.stringify({
        workflow: 'speckit',
        specName: 'demo',
        branch: 'main',
        currentStep: 'plan',
        status: 'planned',
        history: [],
        ...extra,
    });

describe('resolveProfileCommand', () => {
    let root: string;
    const writeCtx = (s: string): void =>
        fs.writeFileSync(path.join(root, '.spec-context.json'), s, 'utf8');

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-dispatch-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('returns the stock command when there is no context', () => {
        expect(resolveProfileCommand('speckit.plan', root)).toBe('speckit.plan');
    });

    it('maps a pipeline command to its lean twin when the spec profile is lean', () => {
        writeCtx(ctx({ profile: 'lean' }));
        expect(resolveProfileCommand('speckit.plan', root)).toBe('speckit.companion.plan');
        expect(resolveProfileCommand('speckit.implement', root)).toBe('speckit.companion.implement');
    });

    it('leaves the command unchanged for a standard spec', () => {
        writeCtx(ctx({ profile: 'standard' }));
        expect(resolveProfileCommand('speckit.plan', root)).toBe('speckit.plan');
    });

    it('passes through a command with no lean twin even when lean', () => {
        writeCtx(ctx({ profile: 'lean' }));
        expect(resolveProfileCommand('speckit.clarify', root)).toBe('speckit.clarify');
        expect(resolveProfileCommand('myteam.custom', root)).toBe('myteam.custom');
    });

    it('falls back to the stock command on a corrupt .spec-context.json (does not throw)', () => {
        writeCtx('{ this is not valid json');
        expect(() => resolveProfileCommand('speckit.plan', root)).not.toThrow();
        expect(resolveProfileCommand('speckit.plan', root)).toBe('speckit.plan');
    });
});
