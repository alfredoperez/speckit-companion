import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveProfileCommand, resolveNewSpecProfileCommand, seedProfileForNewSpec } from './profileDispatch';
import { writeTemplateProfile } from '../settings/companionPresetReconciler';

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

    it('maps all four pipeline commands to their lean twins when the spec profile is lean', () => {
        writeCtx(ctx({ profile: 'lean' }));
        expect(resolveProfileCommand('speckit.specify', root)).toBe('speckit.companion.specify');
        expect(resolveProfileCommand('speckit.plan', root)).toBe('speckit.companion.plan');
        expect(resolveProfileCommand('speckit.tasks', root)).toBe('speckit.companion.tasks');
        expect(resolveProfileCommand('speckit.implement', root)).toBe('speckit.companion.implement');
    });

    it('leaves the command unchanged for a standard spec', () => {
        writeCtx(ctx({ profile: 'standard' }));
        expect(resolveProfileCommand('speckit.plan', root)).toBe('speckit.plan');
    });

    it('leaves the command unchanged for an invalid/unknown profile value', () => {
        writeCtx(ctx({ profile: 'turbo' }));
        expect(resolveProfileCommand('speckit.specify', root)).toBe('speckit.specify');
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

describe('resolveProfileCommand — project-default fallback when the spec has no pin', () => {
    let wsRoot: string;
    let specDir: string;
    const writeCtxNoProfile = (profile?: string): void =>
        fs.writeFileSync(
            path.join(specDir, '.spec-context.json'),
            JSON.stringify({ workflow: 'speckit', specName: 'demo', branch: 'main', currentStep: 'plan', status: 'planned', history: [], ...(profile ? { profile } : {}) }),
            'utf8',
        );

    beforeEach(() => {
        wsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-fallback-'));
        fs.mkdirSync(path.join(wsRoot, '.specify'), { recursive: true });
        specDir = path.join(wsRoot, 'specs', 'demo');
        fs.mkdirSync(specDir, { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(wsRoot, { recursive: true, force: true });
    });

    it('routes to the lean twin when the spec has no profile but the project default is lean', () => {
        writeTemplateProfile(wsRoot, 'lean');
        writeCtxNoProfile();
        expect(resolveProfileCommand('speckit.plan', specDir)).toBe('speckit.companion.plan');
        expect(resolveProfileCommand('speckit.implement', specDir)).toBe('speckit.companion.implement');
    });

    it('stays stock when the spec has no profile and the project default is standard / off / absent', () => {
        writeCtxNoProfile();
        expect(resolveProfileCommand('speckit.plan', specDir)).toBe('speckit.plan'); // absent default
        writeTemplateProfile(wsRoot, 'standard');
        expect(resolveProfileCommand('speckit.plan', specDir)).toBe('speckit.plan');
        writeTemplateProfile(wsRoot, 'off');
        expect(resolveProfileCommand('speckit.plan', specDir)).toBe('speckit.plan');
    });

    it('respects an explicit standard pin over a lean project default', () => {
        writeTemplateProfile(wsRoot, 'lean');
        writeCtxNoProfile('standard');
        expect(resolveProfileCommand('speckit.plan', specDir)).toBe('speckit.plan');
    });
});

describe('resolveNewSpecProfileCommand', () => {
    let wsRoot: string;

    beforeEach(() => {
        wsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'new-spec-route-'));
    });
    afterEach(() => {
        fs.rmSync(wsRoot, { recursive: true, force: true });
    });

    it('routes specify to the lean twin when the project default is lean', () => {
        writeTemplateProfile(wsRoot, 'lean');
        expect(resolveNewSpecProfileCommand('speckit.specify', wsRoot)).toBe('speckit.companion.specify');
    });

    it('leaves specify on stock for standard / off / absent project defaults', () => {
        expect(resolveNewSpecProfileCommand('speckit.specify', wsRoot)).toBe('speckit.specify'); // absent
        writeTemplateProfile(wsRoot, 'standard');
        expect(resolveNewSpecProfileCommand('speckit.specify', wsRoot)).toBe('speckit.specify');
        writeTemplateProfile(wsRoot, 'off');
        expect(resolveNewSpecProfileCommand('speckit.specify', wsRoot)).toBe('speckit.specify');
    });

    it('passes a command with no lean twin through unchanged even when lean', () => {
        writeTemplateProfile(wsRoot, 'lean');
        expect(resolveNewSpecProfileCommand('speckit.clarify', wsRoot)).toBe('speckit.clarify');
    });

    it('leaves the command on stock when no workspace root is known', () => {
        expect(resolveNewSpecProfileCommand('speckit.specify', undefined)).toBe('speckit.specify');
    });
});

describe('seedProfileForNewSpec', () => {
    let wsRoot: string;
    let specDir: string;

    beforeEach(() => {
        wsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-profile-'));
        // The workspace root is discovered by walking up to the nearest `.specify`.
        fs.mkdirSync(path.join(wsRoot, '.specify'), { recursive: true });
        specDir = path.join(wsRoot, 'specs', 'demo');
        fs.mkdirSync(specDir, { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(wsRoot, { recursive: true, force: true });
    });

    it('pins lean when the project default is lean', () => {
        writeTemplateProfile(wsRoot, 'lean');
        expect(seedProfileForNewSpec(specDir)).toBe('lean');
    });

    it('pins standard for standard / off / absent project defaults', () => {
        expect(seedProfileForNewSpec(specDir)).toBe('standard'); // absent config
        writeTemplateProfile(wsRoot, 'standard');
        expect(seedProfileForNewSpec(specDir)).toBe('standard');
        writeTemplateProfile(wsRoot, 'off');
        expect(seedProfileForNewSpec(specDir)).toBe('standard');
    });

    it('pins standard when no workspace root (.specify) can be found', () => {
        const orphan = fs.mkdtempSync(path.join(os.tmpdir(), 'orphan-spec-'));
        try {
            expect(seedProfileForNewSpec(orphan)).toBe('standard');
        } finally {
            fs.rmSync(orphan, { recursive: true, force: true });
        }
    });

    // In-flight safety: changing the project default changes what FUTURE specs
    // seed, but a spec already pinned keeps its recorded profile (resolveProfileCommand
    // reads the pin, not the live default).
    it('changing the default reshapes future seeds, not an already-pinned spec', () => {
        writeTemplateProfile(wsRoot, 'lean');
        const pinned = seedProfileForNewSpec(specDir);
        expect(pinned).toBe('lean');
        fs.writeFileSync(
            path.join(specDir, '.spec-context.json'),
            JSON.stringify({ workflow: 'speckit', specName: 'demo', branch: 'main', currentStep: 'plan', status: 'planned', history: [], profile: pinned }),
            'utf8',
        );
        writeTemplateProfile(wsRoot, 'standard');
        // The pinned spec still dispatches its lean twin despite the default flip.
        expect(resolveProfileCommand('speckit.plan', specDir)).toBe('speckit.companion.plan');
        // A brand-new spec seeded now would be standard.
        expect(seedProfileForNewSpec(specDir)).toBe('standard');
    });
});
